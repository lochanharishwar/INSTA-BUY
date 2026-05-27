from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import asyncio
import json
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
    allow_origin_regex=r"https://.*\.vercel\.app",
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

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/auth/status")
def auth_status(session_id: str):
    auth = MCPAuth(session_id)
    return {"authenticated": auth.has_valid_session()}

@app.get("/auth/login")
def auth_login(session_id: str):
    auth = MCPAuth(session_id)
    return {"url": auth.generate_auth_url()}

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
