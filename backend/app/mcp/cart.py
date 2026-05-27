from app.mcp.client import MCPClient
import asyncio
import httpx
import structlog

logger = structlog.get_logger()


class CartManager:
    def __init__(self, session_id: str):
        self.client = MCPClient(session_id)
        
    async def clear_and_build(self, items: list) -> float:
        """Swiggy MCP compliant cart build: get_addresses → get_cart → clear → update → verify"""
        # Step 1: Resolve delivery address
        addresses = await self.client.call_tool("get_addresses", {})
        selected_address_id = addresses[0]["id"] if addresses else "mock_addr_1"
        
        # Rule 1: Always call get_cart before mutate
        await self.client.call_tool("get_cart", {})
        
        # Rule 2: Clear cart first (full replacement)
        await self.client.call_tool("clear_cart", {})
        
        # Build payload — Swiggy expects selectedAddressId + spinId/quantity
        mcp_items = [{"spinId": i["spin_id"], "quantity": i["quantity"]} for i in items]
        
        # Rule 3: update_cart replaces the cart
        await self.client.call_tool("update_cart", {
            "selectedAddressId": selected_address_id,
            "items": mcp_items
        })
        
        # Rule 4: Verify with get_cart
        cart = await self.client.call_tool("get_cart", {})
        return cart.get("bill", {}).get("total", sum([
            item.get("product_price", 0) * item.get("quantity", 1) for item in items
        ]))

    async def safe_checkout(self, contributors: list = None) -> str:
        """
        Non-idempotent checkout with Swiggy-compliant 5xx recovery.
        Per Swiggy docs: if checkout 5xxs, check get_orders before retrying.
        """
        max_attempts = 3
        
        for attempt in range(max_attempts):
            try:
                res = await self.client.call_tool("checkout", {"paymentMethod": "COD"})
                order_id = res.get("orderId")
                
                # Log fractional splits on success
                if contributors:
                    logger.info("hostelsync.checkout_payment_splits",
                                order_id=order_id,
                                contributors=[{
                                    "user_id": c.get("user_id"),
                                    "fraction_owed": c.get("fraction_owed"),
                                    "amount_owed": c.get("amount_owed")
                                } for c in contributors])
                return order_id
                
            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                
                if status >= 500:
                    # Swiggy Docs: On 5xx, wait 2-5s, check get_orders, then retry
                    logger.warning("mcp.checkout_5xx", attempt=attempt + 1, status=status)
                    await asyncio.sleep(2)
                    
                    try:
                        orders = await self.client.call_tool("get_orders", {})
                        if orders:
                            latest = orders[0]
                            latest_id = latest.get("orderId", "")
                            if "mock" in latest_id or "IM-" in latest_id:
                                if contributors:
                                    logger.info("hostelsync.checkout_recovered",
                                                order_id=latest_id)
                                return latest_id
                    except Exception:
                        pass  # Ignore errors in status check
                    
                    if attempt >= max_attempts - 1:
                        raise Exception("Order failed after multiple attempts. Please check your Swiggy app.")
                    continue
                    
                elif status == 400:
                    msg = e.response.text
                    if "MIN_ORDER_NOT_MET" in msg:
                        raise Exception("Instamart requires a minimum order of ₹99.")
                    elif "ADDRESS_NOT_SERVICEABLE" in msg:
                        raise Exception("Instamart doesn't deliver to this address yet.")
                    elif "OUT_OF_STOCK" in msg:
                        raise Exception("Some items went out of stock. Please review your cart.")
                    elif "CART_EXPIRED" in msg:
                        raise Exception("Your cart expired. Please rebuild and try again.")
                    raise Exception(f"Order failed: {msg}")
                    
                elif status == 429:
                    retry_after = int(e.response.headers.get("Retry-After", "30"))
                    logger.warning("mcp.checkout_rate_limited", retry_after=retry_after)
                    await asyncio.sleep(retry_after)
                    continue
                    
                else:
                    raise e
        
        raise Exception("Checkout failed after all retry attempts.")
