from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import asyncio
import json
import httpx
import structlog
from app.config import settings
from app.agent import build_graph, emit_sse
import app.agent as agent_module
from app.mcp.auth import MCPAuth
from app.mcp.client import MCPClient
from app.pipeline import extractor as extractor_module
from langgraph.errors import GraphInterrupt

from app.logging_config import configure_logging

configure_logging(settings.LOG_LEVEL)

logger = structlog.get_logger()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # Production — add your Vercel URL here
        # "https://your-app.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.(?:vercel\.app|onrender\.com)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

event_queues: Dict[str, asyncio.Queue] = {}

async def push_sse(session_id: str, data: dict):
    if session_id in event_queues:
        await event_queues[session_id].put(data)

agent_module.emit_sse = push_sse
extractor_module.set_sse_emitter(push_sse)

graphs_state: Dict[str, Any] = {}

class ProcessRequest(BaseModel):
    session_id: str
    url_or_text: str
    session_type: Optional[str] = "solo"
    contributors: Optional[List[Dict[str, Any]]] = None

class ConfirmRequest(BaseModel):
    session_id: str
    cart_items: List[Dict[str, Any]]

class ContributorApprovalRequest(BaseModel):
    session_id: str
    user_id: str
    approval_status: bool

class VoiceRequest(BaseModel):
    text: str

class CompareRequest(BaseModel):
    ingredients: List[str]
    location: Optional[str] = ""

@app.get("/health")
def health():
    return {
        "status": "ok",
        "mock_store": settings.MOCK_MCP,
        "recipe_ai_configured": bool(settings.NVIDIA_API_KEY or settings.GEMINI_API_KEY),
        "voice_configured": bool(settings.ELEVENLABS_API_KEY),
    }

@app.post("/api/voice")
async def generate_voice(req: VoiceRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if len(text) > 3000:
        raise HTTPException(status_code=400, detail="Text is too long for one voice clip (max 3,000 characters)")
    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="Voice playback is not configured on the backend")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{settings.ELEVENLABS_VOICE_ID}"
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            upstream = await client.post(
                url,
                params={"output_format": "mp3_44100_128"},
                headers={
                    "xi-api-key": settings.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                json={"text": text, "model_id": "eleven_multilingual_v2"},
            )
    except Exception as exc:
        logger.error("voice.elevenlabs_unavailable", error=str(exc)[:160])
        raise HTTPException(status_code=502, detail="Could not reach ElevenLabs") from exc

    if upstream.status_code >= 400:
        logger.error("voice.elevenlabs_error", status_code=upstream.status_code)
        raise HTTPException(status_code=502, detail="ElevenLabs rejected the voice request; check the key and account quota")
    return Response(content=upstream.content, media_type=upstream.headers.get("content-type", "audio/mpeg"))

@app.post("/api/compare-prices")
async def compare_online_prices(req: CompareRequest):
    ingredients = [item.strip() for item in req.ingredients if item.strip()]
    if not ingredients:
        raise HTTPException(status_code=400, detail="Add ingredients before comparing stores")
    if len(ingredients) > 30:
        raise HTTPException(status_code=400, detail="Compare up to 30 ingredients at a time")
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Online comparison needs GEMINI_API_KEY configured on the backend")

    location = (req.location or "India").strip()[:100]
    prompt = (
        "Use Google Search now to compare these grocery ingredients on Swiggy Instamart, Blinkit, and Zepto. "
        f"Search area: {location}. Ingredients: {json.dumps(ingredients, ensure_ascii=False)}. "
        "Use only information visible in current search results or store product pages. "
        "For every ingredient, report store, matching product/pack, listed price, and whether the source actually confirms local availability. "
        "If price, pack size, or local stock is not explicitly visible, write 'not shown' or 'not verified'; never estimate or invent it. "
        "Group by ingredient, prefer a compact comparison table, and end with the cheapest source-backed listed option per ingredient where possible. "
        "Mention that grocery prices and stock can vary by delivery location and change quickly. Cite sources inline."
    )

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            upstream = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/interactions",
                headers={"x-goog-api-key": settings.GEMINI_API_KEY},
                json={
                    "model": settings.GEMINI_MODEL,
                    "input": prompt,
                    "tools": [{"type": "google_search"}],
                },
            )
        if upstream.status_code >= 400:
            logger.error("compare.gemini_error", status_code=upstream.status_code)
            raise HTTPException(
                status_code=502,
                detail="Gemini online search failed. Check that this API project has Google Search grounding enabled.",
            )
        data = upstream.json()
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("compare.gemini_unavailable", error=str(exc)[:160])
        raise HTTPException(status_code=502, detail="Could not reach Gemini online search") from exc

    answer_parts = []
    sources = []
    for step in data.get("steps", []):
        if step.get("type") != "model_output":
            continue
        for block in step.get("content", []):
            if block.get("type") != "text":
                continue
            if block.get("text"):
                answer_parts.append(block["text"])
            for citation in block.get("annotations", []):
                url = citation.get("url", "")
                if url.startswith(("https://", "http://")):
                    sources.append({"title": citation.get("title") or url, "url": url})

    answer = "\n\n".join(answer_parts).strip()
    if not answer:
        raise HTTPException(status_code=502, detail="Gemini returned no comparison. Try again with fewer ingredients.")
    unique_sources = list({source["url"]: source for source in sources}.values())
    return {"comparison": answer, "sources": unique_sources, "location": location}

@app.get("/auth/status")
async def auth_status(session_id: str):
    auth = MCPAuth(session_id)
    return {"authenticated": await auth.has_valid_session()}

@app.get("/auth/login")
def auth_login(session_id: str):
    auth = MCPAuth(session_id)
    return {"url": auth.generate_auth_url(), "mock": settings.MOCK_MCP}

@app.post("/api/process")
async def process_recipe(req: ProcessRequest):
    # Input validation
    if not req.url_or_text or not req.url_or_text.strip():
        raise HTTPException(status_code=400, detail="Input cannot be empty")
    if len(req.url_or_text) > 10000:
        raise HTTPException(status_code=400, detail="Input too long (max 10,000 characters)")

    graph = build_graph()
    state = {
        "session_id": req.session_id,
        "session_type": req.session_type or "solo",
        "contributors": req.contributors or [],
        "raw_input": req.url_or_text,
        "input_type": "",
        "raw_content": "",
        "recipe": None,
        "normalized_ingredients": [],
        "search_results": {},
        "ranked_products": [],
        "cart_items": [],
        "user_approved": False,
        "order_id": None,
        "error": None,
        # Agentic intelligence state
        "user_context": None,
        "validation_result": None,
        "cart_validation_result": None,
        "retry_count": 0,
        "pipeline_trace": [],
        "pipeline_metrics": {},
        "started_at": 0,
    }
    
    if req.session_id not in event_queues:
        event_queues[req.session_id] = asyncio.Queue()
        
    asyncio.create_task(run_pipeline(graph, state, req.session_id))
    return {"status": "started"}

async def run_pipeline(graph, state, session_id):
    config = {"configurable": {"thread_id": session_id}}
    try:
        async for s in graph.astream(state, config=config):
            current_state = graph.get_state(config).values
            graphs_state[session_id] = current_state

            # Check if optimize + validate_cart is done → send proposal
            for node_name, node_output in s.items():
                if node_name == "validate_cart":
                    if current_state.get("cart_items") and not current_state.get("error"):
                        available_items = [i for i in current_state["cart_items"] if i.get("spin_id")]
                        await push_sse(session_id, {
                            "stage": "proposal_ready",
                            "cart_items": current_state["cart_items"],
                            "cart_total": sum(
                                i.get("product_price", 0) * i.get("quantity", 1)
                                for i in available_items
                            ),
                            "session_type": current_state.get("session_type", "solo"),
                            "contributors": current_state.get("contributors", []),
                            "pipeline_trace": current_state.get("pipeline_trace", []),
                            "pipeline_metrics": current_state.get("pipeline_metrics", {}),
                            "validation": current_state.get("cart_validation_result", {}),
                            "mock_mode": settings.MOCK_MCP,
                        })

    except GraphInterrupt as e:
        logger.info("pipeline.paused.waiting_approval", session_id=session_id, detail=str(e))
    except Exception as e:
        logger.error("pipeline.crashed", session_id=session_id, error=str(e))
        await push_sse(session_id, {"stage": "error", "message": str(e)})


async def run_pipeline_resume(graph, config, session_id):
    try:
        async for s in graph.astream(None, config=config):
            current_state = graph.get_state(config).values
            graphs_state[session_id] = current_state
            for node_name, node_output in s.items():
                logger.info("pipeline.resumed.node_complete", session_id=session_id, node=node_name)
    except GraphInterrupt as e:
        logger.info("pipeline.paused.waiting_approvals", session_id=session_id, detail=str(e))
    except Exception as e:
        logger.error("pipeline.resume.crashed", session_id=session_id, error=str(e))
        await push_sse(session_id, {"stage": "error", "message": str(e)})


@app.post("/api/cart/confirm")
async def confirm_cart(req: ConfirmRequest):
    session_id = req.session_id
    graph = build_graph()
    config = {"configurable": {"thread_id": session_id}}
    
    state = graph.get_state(config)
    if not state or not state.values:
        raise HTTPException(status_code=400, detail="Session not found")
        
    graph.update_state(config, {
        "user_approved": True,
        "cart_items": req.cart_items
    }, as_node="validate_cart")
    
    asyncio.create_task(run_pipeline_resume(graph, config, session_id))
    return {"status": "success"}


@app.post("/api/cart/approve")
async def approve_contributor(req: ContributorApprovalRequest):
    session_id = req.session_id
    user_id = req.user_id
    approved = req.approval_status
    
    graph = build_graph()
    config = {"configurable": {"thread_id": session_id}}
    
    state = graph.get_state(config)
    if not state or not state.values:
        raise HTTPException(status_code=404, detail="Session not found")
        
    contributors = [dict(c) for c in state.values.get("contributors", [])]
    
    user_found = False
    for c in contributors:
        if c.get("user_id") == user_id:
            c["approval_status"] = approved
            user_found = True
            break
            
    if not user_found:
        raise HTTPException(status_code=400, detail=f"Contributor {user_id} not found in this group session")
        
    graph.update_state(config, {"contributors": contributors}, as_node="validate_cart")
    
    logger.info("hostelsync.contributor_approval",
                session_id=session_id,
                user_id=user_id,
                approval_status=approved,
                contributors=contributors)
                
    updated_state = graph.get_state(config).values
    graphs_state[session_id] = updated_state
    
    all_approved = all(c.get("approval_status", False) for c in contributors)
    primary_approved = updated_state.get("user_approved", False)
    
    if all_approved and primary_approved:
        asyncio.create_task(run_pipeline_resume(graph, config, session_id))
    else:
        not_approved = [c.get("user_id") for c in contributors if not c.get("approval_status", False)]
        await push_sse(session_id, {
            "stage": "waiting_approvals",
            "status": "pending",
            "not_approved": not_approved,
            "contributors": contributors
        })
        
    return {"status": "success", "contributors": contributors}


@app.get("/api/session")
async def get_session(session_id: str):
    graph = build_graph()
    config = {"configurable": {"thread_id": session_id}}
    state = graph.get_state(config)
    
    if not state or not state.values:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return {
        "status": "success",
        "cart_items": state.values.get("cart_items", []),
        "contributors": state.values.get("contributors", []),
        "session_type": state.values.get("session_type", "solo")
    }

@app.get("/api/stream")
async def stream_events(session_id: str, request: Request):
    if session_id not in event_queues:
        event_queues[session_id] = asyncio.Queue()
        
    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(
                        event_queues[session_id].get(), timeout=15.0
                    )
                    yield json.dumps(data)
                except asyncio.TimeoutError:
                    yield json.dumps({"stage": "heartbeat", "status": "alive"})
        finally:
            pass
                
    return EventSourceResponse(event_generator())


@app.get("/api/track")
async def track_order(session_id: str):
    state = graphs_state.get(session_id, {})
    order_id = state.get("order_id", None)
    if not order_id:
        return {"status": "No active order", "eta_minutes": 0}
    client = MCPClient(session_id)
    status = await client.call_tool("track_order", {"orderId": order_id})
    return status
