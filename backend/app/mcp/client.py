import uuid
import httpx
import asyncio
from typing import Any, Dict, List, Optional
import structlog
from app.config import settings
from app.mcp.auth import MCPAuth

logger = structlog.get_logger()

NON_IDEMPOTENT_TOOLS = {"checkout", "place_food_order", "book_table"}


class MCPClient:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.auth = MCPAuth(session_id)
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10)
            )
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        if name in NON_IDEMPOTENT_TOOLS:
            return await self._execute_call(name, arguments)
        
        max_attempts = 4
        attempt = 0
        
        while True:
            try:
                return await self._execute_call(name, arguments)
            except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException) as e:
                attempt += 1
                if attempt >= max_attempts:
                    raise e
                
                if isinstance(e, httpx.HTTPStatusError):
                    status = e.response.status_code
                    if 400 <= status < 500 and status != 429 and status != 401:
                        raise e

                base_ms = 500 * (2 ** (attempt - 1))
                logger.warning("mcp.retry", tool=name, attempt=attempt, delay_ms=base_ms)
                await asyncio.sleep(base_ms / 1000.0)

    async def _execute_call(self, name: str, arguments: Dict[str, Any]) -> Any:
        request_id = str(uuid.uuid4())

        if settings.MOCK_MCP:
            result = self._mock_call(name, arguments)
            logger.debug("mcp.mock_call", tool=name, request_id=request_id)
            return result

        token = await self.auth.get_valid_token()
        if not token:
            raise ValueError("No valid auth token")

        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments
            }
        }

        logger.info("mcp.call", tool=name, request_id=request_id, args_keys=list(arguments.keys()))

        client = await self._get_client()
        try:
            resp = await client.post(
                settings.SWIGGY_MCP_INSTAMART_URL,
                json=payload,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "30"))
                logger.warning("mcp.rate_limited", tool=name, retry_after=retry_after)
                await asyncio.sleep(retry_after)
                raise httpx.HTTPStatusError("Rate limited", request=resp.request, response=resp)
                
            if resp.status_code >= 400:
                logger.warning("mcp.http_error", tool=name, status_code=resp.status_code, request_id=request_id)
                raise httpx.HTTPStatusError(f"HTTP Error {resp.status_code}", request=resp.request, response=resp)

            data = resp.json()
            if "error" in data:
                logger.error("mcp.rpc_error", tool=name,
                              error=data['error'], request_id=request_id)
                raise Exception(f"MCP Error: {data['error']}")

            logger.info("mcp.success", tool=name, request_id=request_id)
            return data["result"]
        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            logger.error("mcp.unknown_error", tool=name, error=str(e), request_id=request_id)
            raise

    def _mock_call(self, name: str, arguments: Dict[str, Any]) -> Any:
        if name == "get_addresses":
            return []
        if name == "search_products":
            # Without Swiggy credentials, don't fabricate availability, prices, or SKUs.
            return {"products": []}
        if name == "get_cart":
            return {"items": [], "bill": {"total": 0}}
        if name in {"update_cart", "clear_cart", "checkout"}:
            raise ValueError("A real Swiggy connection is required for cart and checkout actions")
        if name == "track_order":
            return {"status": "Live tracking requires a real Swiggy order", "eta_minutes": 0}
        if name == "get_orders":
            return []
        if name == "your_go_to_items":
            return {"items": []}
        if name == "get_order_details":
            return {"items": []}
        if name == "report_error":
            return {"success": True}
        return {}


class MCPClientPool:
    """Connection pooling for MCP clients"""
    def __init__(self):
        self._clients: Dict[str, MCPClient] = {}
        self._lock = asyncio.Lock()

    async def get_client(self, session_id: str) -> MCPClient:
        async with self._lock:
            if session_id not in self._clients:
                self._clients[session_id] = MCPClient(session_id)
            return self._clients[session_id]

    async def close_all(self):
        async with self._lock:
            for client in self._clients.values():
                await client.close()
            self._clients.clear()


mcp_client_pool = MCPClientPool()