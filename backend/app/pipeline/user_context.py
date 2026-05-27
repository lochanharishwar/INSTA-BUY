"""
User Context Intelligence Layer

Builds a rich user profile from Swiggy MCP data (order history, go-to items)
to enable context-aware, personalized cart optimization.

Now also populates a per-user vector-embedded inventory via ChromaDB so the
optimizer can semantically detect "pantry likely" items instead of relying
on a hardcoded set.
"""
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
import time
import structlog
from app.mcp.client import MCPClient

logger = structlog.get_logger()


@dataclass
class UserContext:
    """Rich user context built from Swiggy order history and preferences."""
    preferred_brands: Dict[str, str] = field(default_factory=dict)      # ingredient → brand
    recent_purchases: Dict[str, str] = field(default_factory=dict)      # ingredient → date
    go_to_spin_ids: Set[str] = field(default_factory=set)               # frequently ordered spinIds
    go_to_items: List[Dict] = field(default_factory=list)               # raw go-to items from Swiggy
    dietary_signals: List[str] = field(default_factory=list)            # detected from order history
    order_count: int = 0
    address_id: str = ""
    address_label: str = ""
    session_id: str = ""
    # ── New: vector inventory tracking ─────────────────────────────
    inventory_embedded: bool = False
    inventory_item_count: int = 0
    inventory_active_count: int = 0
    inventory_expired_count: int = 0


async def build_user_context(session_id: str) -> UserContext:
    """
    Build a UserContext by calling Swiggy MCP tools:
    1. get_addresses → resolve delivery address
    2. your_go_to_items → user's frequently ordered products
    3. get_orders → past 30 days of order history for brand preferences
       AND vector inventory embedding
    
    This context is injected into the optimizer to make the agent
    context-aware and personalized.
    """
    ctx = UserContext(session_id=session_id)
    client = MCPClient(session_id)

    # ─── Step 1: Resolve address ──────────────────────────────────
    try:
        addresses = await client.call_tool("get_addresses", {})
        home_addr = next(
            (a for a in addresses if a.get("label", "").lower() == "home"),
            addresses[0] if addresses else None
        )
        if home_addr:
            ctx.address_id = home_addr.get("id", "")
            ctx.address_label = home_addr.get("label", "Unknown")
        logger.info("user_context.address_resolved",
                     address_id=ctx.address_id, label=ctx.address_label)
    except Exception as e:
        logger.warning("user_context.address_failed", error=str(e)[:100])
        ctx.address_id = "mock_addr_1"

    # ─── Step 2: Fetch go-to items ────────────────────────────────
    try:
        go_to_data = await client.call_tool("your_go_to_items", {
            "addressId": ctx.address_id
        })
        go_to_items = go_to_data.get("items", []) if isinstance(go_to_data, dict) else []
        ctx.go_to_items = go_to_items
        ctx.go_to_spin_ids = {item.get("spinId", "") for item in go_to_items if item.get("spinId")}

        # Extract brand preferences from go-to items
        for item in go_to_items:
            name = item.get("name", "").lower()
            brand = item.get("brand", "")
            if brand:
                # Map product name keywords to brand preference
                for keyword in name.split():
                    if len(keyword) > 3:  # skip short words
                        ctx.preferred_brands[keyword] = brand

        logger.info("user_context.go_to_items",
                     count=len(go_to_items),
                     brands=len(ctx.preferred_brands))
    except Exception as e:
        logger.warning("user_context.go_to_failed", error=str(e)[:100])

    # ─── Step 3: Analyse recent orders (expanded to 30 days) ──────
    all_order_items: List[Dict] = []  # collected for vector embedding
    try:
        orders = await client.call_tool("get_orders", {})
        ctx.order_count = len(orders) if isinstance(orders, list) else 0

        # Analyze recent orders for patterns
        if isinstance(orders, list):
            for order in orders:  # Process ALL orders (up to 30 days)
                order_id = order.get("orderId", "")
                placed_at = order.get("placed_at", "unknown")
                placed_epoch = _parse_placed_at(placed_at)

                if order_id:
                    try:
                        details = await client.call_tool("get_order_details", {
                            "orderId": order_id
                        })
                        items = details.get("items", []) if isinstance(details, dict) else []
                        for item in items:
                            item_name = item.get("name", "").lower()
                            ctx.recent_purchases[item_name] = placed_at

                            # Collect for vector embedding
                            all_order_items.append({
                                "name": item.get("name", ""),
                                "brand": item.get("brand", ""),
                                "quantity": item.get("quantity", 1),
                                "price": item.get("price", 0),
                                "order_id": order_id,
                                "purchased_epoch": placed_epoch,
                            })

                            # Detect dietary signals
                            if any(kw in item_name for kw in ["chicken", "mutton", "fish", "egg"]):
                                if "non-vegetarian" not in ctx.dietary_signals:
                                    ctx.dietary_signals.append("non-vegetarian")
                            if any(kw in item_name for kw in ["paneer", "tofu", "soy"]):
                                if "vegetarian-leaning" not in ctx.dietary_signals:
                                    ctx.dietary_signals.append("vegetarian-leaning")
                    except Exception:
                        pass  # Skip individual order failures

        logger.info("user_context.orders_analyzed",
                     order_count=ctx.order_count,
                     recent_purchases=len(ctx.recent_purchases),
                     dietary_signals=ctx.dietary_signals)
    except Exception as e:
        logger.warning("user_context.orders_failed", error=str(e)[:100])

    # ─── Step 4: Embed purchases into vector inventory ────────────
    await _embed_inventory(session_id, ctx, all_order_items)

    return ctx


async def _embed_inventory(
    session_id: str,
    ctx: UserContext,
    order_items: List[Dict],
) -> None:
    """
    Embed collected order items into the per-user ChromaDB vector store
    and refresh decay calculations.
    """
    try:
        from app.database import InventoryVectorStore

        store = InventoryVectorStore(session_id)

        # Also embed go-to items (they're frequently bought → likely in pantry)
        go_to_as_items = [
            {
                "name": item.get("name", ""),
                "brand": item.get("brand", ""),
                "quantity": 1,
                "price": item.get("price", 0),
                "order_id": "go_to",
                # Treat go-to items as recently purchased (within last week)
                "purchased_epoch": time.time() - (3 * 86400),
            }
            for item in ctx.go_to_items
            if item.get("name")
        ]

        all_items = order_items + go_to_as_items
        embedded_count = store.upsert_items(all_items)

        # Refresh decay to mark expired items as inactive
        expired_count = store.refresh_decay()

        # Update context with inventory stats
        summary = store.get_inventory_summary()
        ctx.inventory_embedded = True
        ctx.inventory_item_count = summary.get("total", 0)
        ctx.inventory_active_count = summary.get("active", 0)
        ctx.inventory_expired_count = summary.get("expired", 0)

        logger.info(
            "user_context.inventory_embedded",
            session_id=session_id,
            embedded=embedded_count,
            total=ctx.inventory_item_count,
            active=ctx.inventory_active_count,
            expired=ctx.inventory_expired_count,
        )
    except Exception as e:
        logger.warning(
            "user_context.inventory_embed_failed",
            error=str(e)[:200],
        )
        ctx.inventory_embedded = False


def _parse_placed_at(placed_at: str) -> float:
    """
    Best-effort parse of the 'placed_at' field from order history.
    Handles relative strings like "2 days ago", "1 week ago", etc.
    Falls back to 7 days ago if unparseable.
    """
    now = time.time()
    placed_lower = placed_at.lower().strip()

    try:
        # Try "N days ago" pattern
        if "day" in placed_lower:
            import re
            m = re.search(r"(\d+)\s*day", placed_lower)
            if m:
                return now - int(m.group(1)) * 86400

        # Try "N week(s) ago"
        if "week" in placed_lower:
            import re
            m = re.search(r"(\d+)\s*week", placed_lower)
            if m:
                return now - int(m.group(1)) * 7 * 86400

        # Try "N month(s) ago"
        if "month" in placed_lower:
            import re
            m = re.search(r"(\d+)\s*month", placed_lower)
            if m:
                return now - int(m.group(1)) * 30 * 86400

        # Try ISO-like date
        if "-" in placed_lower or "/" in placed_lower:
            from datetime import datetime
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    dt = datetime.strptime(placed_lower, fmt)
                    return dt.timestamp()
                except ValueError:
                    continue
    except Exception:
        pass

    # Fallback: assume 7 days ago
    return now - 7 * 86400
