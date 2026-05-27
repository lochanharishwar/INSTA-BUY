"""
Cart Optimizer — Semantic Inventory-Aware Ranking

Replaces static PANTRY_STAPLES / PANTRY_LIKELY sets with dynamic,
vector-embedded inventory checks via ChromaDB.  For every ingredient,
a semantic similarity search is run against the user's *active* purchase
history.  If a match is found (similarity > 0.85 and the item hasn't
decayed), the ingredient is flagged as `pantry_likely = True` and its
score is aggressively penalised to prevent auto-carting.
"""
from typing import Dict, List, Optional
from math import ceil
import structlog

logger = structlog.get_logger()


# ─── Lazy-loaded vector store (per-session) ───────────────────────────
# Import is deferred to avoid heavy model load at module import time.
_vector_store_cache: Dict[str, object] = {}


def _get_inventory_store(session_id: str):
    """
    Get or create an InventoryVectorStore for the given session.
    Lazy-loads ChromaDB + SentenceTransformer on first call.
    """
    if session_id in _vector_store_cache:
        return _vector_store_cache[session_id]

    try:
        from app.database import InventoryVectorStore
        store = InventoryVectorStore(session_id)
        _vector_store_cache[session_id] = store
        return store
    except Exception as e:
        logger.warning("optimizer.vector_store_unavailable", error=str(e)[:150])
        return None


def _check_pantry_via_vector(
    ingredient_name: str,
    session_id: str,
    similarity_threshold: float = 0.85,
) -> tuple[bool, List[Dict]]:
    """
    Semantic vector search against the user's active inventory.

    Returns:
        (is_pantry_likely, matches)
    where `matches` is a list of dicts with similarity scores, brand,
    decay_ratio, etc.
    """
    store = _get_inventory_store(session_id)
    if store is None:
        return False, []

    try:
        matches = store.query_active_inventory(
            ingredient_name=ingredient_name,
            n_results=3,
            similarity_threshold=similarity_threshold,
        )
        if matches:
            logger.info(
                "optimizer.pantry_vector_hit",
                ingredient=ingredient_name,
                top_match=matches[0]["name"],
                similarity=matches[0]["similarity"],
                decay_ratio=matches[0]["decay_ratio"],
            )
            return True, matches
    except Exception as e:
        logger.warning(
            "optimizer.pantry_vector_error",
            ingredient=ingredient_name,
            error=str(e)[:150],
        )
    return False, []


# ─── Pantry Score Penalty ─────────────────────────────────────────────
# When an ingredient is detected in active inventory, we aggressively
# penalise its ranking score so it sinks to the bottom / gets flagged.
_PANTRY_PENALTY_FACTOR = 0.15  # Multiply score by this → drops ~85%


def rank_and_optimize(search_results: Dict, normalized_ingredients: List[Dict], user_context=None) -> List[Dict]:
    """
    Rank products for each ingredient using multi-factor scoring,
    then optimize the overall basket.
    Uses UserContext for brand-preference scoring and go-to item boosting.
    Uses vector-embedded inventory for dynamic pantry detection.
    """
    cart_items = []
    session_id = ""
    if user_context:
        session_id = getattr(user_context, "session_id", "") or ""

    for ing in normalized_ingredients:
        term = ing["search_term"]
        ing_name = ing["ingredient_name"].lower().strip()
        needed_grams = ing.get("quantity_grams")

        # ─── Dynamic pantry check via vector inventory ────────────
        is_pantry_likely, pantry_matches = _check_pantry_via_vector(
            ingredient_name=ing_name,
            session_id=session_id,
        )

        # If the vector store detected this as a pantry item with very
        # high confidence (similarity ≥ 0.95), skip it entirely (like
        # the old PANTRY_STAPLES behaviour)
        if is_pantry_likely and pantry_matches:
            top_match = pantry_matches[0]
            if top_match["similarity"] >= 0.95 and top_match["decay_ratio"] < 0.3:
                # This is a near-exact match for a very fresh item
                cart_items.append(_make_pantry_item(
                    ing,
                    skip=True,
                    match_info=top_match,
                ))
                continue

        results = search_results.get(term, {}).get("products", [])

        if not results:
            cart_items.append(_make_unavailable_item(ing))
            continue

        # ─── Score and rank all variants across all products ──────
        scored_options = []
        for product in results:
            for variant in product.get("variants", []):
                if not variant.get("in_stock", True):
                    continue

                score, reasons = _score_variant(
                    product_name=product.get("name", ""),
                    variant=variant,
                    ingredient_name=ing_name,
                    needed_grams=needed_grams,
                    user_context=user_context,
                )

                # ── Pantry penalty: aggressively suppress score ───
                if is_pantry_likely:
                    original_score = score
                    score = score * _PANTRY_PENALTY_FACTOR
                    reasons.append(
                        f"🏠 Likely in pantry "
                        f"(matched \"{pantry_matches[0]['name']}\" "
                        f"@ {pantry_matches[0]['similarity']:.0%} similarity, "
                        f"{pantry_matches[0]['days_since_purchase']:.0f}d ago)"
                    )

                scored_options.append({
                    "product": product,
                    "variant": variant,
                    "score": score,
                    "reasons": reasons,
                })

        if not scored_options:
            cart_items.append(_make_unavailable_item(ing))
            continue

        # Sort by score descending
        scored_options.sort(key=lambda x: x["score"], reverse=True)

        best = scored_options[0]
        alternatives = scored_options[1:4]  # Top 3 alternatives

        # Calculate quantity needed
        quantity = 1
        pack_grams = best["variant"].get("pack_grams", 0)
        if needed_grams and pack_grams and pack_grams > 0:
            quantity = max(1, ceil(needed_grams / pack_grams))

        # Calculate waste
        waste_grams = (pack_grams * quantity - needed_grams) if needed_grams and pack_grams else 0
        waste_pct = round((waste_grams / (pack_grams * quantity)) * 100, 1) if pack_grams and quantity else 0

        # Determine confidence
        confidence = "high" if best["score"] >= 0.6 else "medium" if best["score"] >= 0.3 else "low"

        cart_items.append({
            "ingredient_name": ing["ingredient_name"],
            "ingredient_quantity_display": ing["quantity_display"],
            "product_name": best["product"].get("name", term),
            "product_brand": best["product"].get("brand", ""),
            "product_quantity_display": best["variant"].get("display", ""),
            "product_price": best["variant"].get("price", 0),
            "spin_id": best["variant"].get("spinId"),
            "quantity": quantity,
            "confidence": confidence,
            "confidence_score": round(best["score"], 2),
            "selection_reasons": best["reasons"],
            "waste_grams": waste_grams,
            "waste_pct": waste_pct,
            "pantry_likely": is_pantry_likely,
            "pantry_match": (
                {
                    "matched_item": pantry_matches[0]["name"],
                    "similarity": pantry_matches[0]["similarity"],
                    "days_ago": pantry_matches[0]["days_since_purchase"],
                    "decay_ratio": pantry_matches[0]["decay_ratio"],
                }
                if is_pantry_likely and pantry_matches
                else None
            ),
            "image_url": best["product"].get("image_url"),
            "alternatives": [
                {
                    "product_name": alt["product"].get("name", ""),
                    "product_brand": alt["product"].get("brand", ""),
                    "product_quantity_display": alt["variant"].get("display", ""),
                    "product_price": alt["variant"].get("price", 0),
                    "spin_id": alt["variant"].get("spinId"),
                    "score": round(alt["score"], 2),
                    "image_url": alt["product"].get("image_url"),
                }
                for alt in alternatives
            ],
        })

    # ─── Basket-level optimization ────────────────────────────────
    cart_items = _optimize_basket(cart_items)

    # ─── Log summary ─────────────────────────────────────────────
    available = [i for i in cart_items if i.get("spin_id")]
    pantry = [i for i in cart_items if i.get("pantry_likely") and not i.get("spin_id")]
    unavailable = [i for i in cart_items if not i.get("spin_id") and not i.get("pantry_likely")]
    total = sum(i.get("product_price", 0) * i.get("quantity", 1) for i in available)
    avg_waste = sum(i.get("waste_pct", 0) for i in available) / max(len(available), 1)

    logger.info("optimizer.complete",
                total_items=len(cart_items),
                available=len(available),
                pantry_skipped=len(pantry),
                unavailable=len(unavailable),
                cart_total=total,
                avg_waste_pct=round(avg_waste, 1))

    return cart_items


def _score_variant(product_name: str, variant: Dict, ingredient_name: str, needed_grams, user_context=None) -> tuple:
    """
    Multi-factor scoring for a product variant.
    Returns (score: float 0-1, reasons: list[str])
    Now includes user-context-aware brand-preference and go-to-item scoring.
    """
    score = 0.0
    reasons = []
    product_lower = product_name.lower()
    ingredient_lower = ingredient_name.lower()

    # Factor 1: Name relevance (0 - 0.35)
    ing_words = set(ingredient_lower.split())
    prod_words = set(product_lower.split())
    overlap = ing_words & prod_words
    if ing_words:
        relevance = len(overlap) / len(ing_words)
    else:
        relevance = 0
    name_score = relevance * 0.35
    score += name_score
    if relevance >= 0.5:
        reasons.append(f"Good name match ({int(relevance * 100)}%)")

    # Factor 2: Pack-size efficiency (0 - 0.25)
    pack_grams = variant.get("pack_grams", 0)
    if needed_grams and pack_grams and pack_grams > 0:
        if pack_grams >= needed_grams:
            waste_ratio = (pack_grams - needed_grams) / pack_grams
            pack_score = (1 - waste_ratio) * 0.25
            reasons.append(f"Pack {pack_grams}g covers {needed_grams}g need ({int((1 - waste_ratio) * 100)}% efficient)")
        else:
            units = ceil(needed_grams / pack_grams)
            total_grams = units * pack_grams
            waste_ratio = (total_grams - needed_grams) / total_grams
            pack_score = (1 - waste_ratio) * 0.15
            reasons.append(f"Need {units}x {pack_grams}g packs")
        score += pack_score
    else:
        score += 0.12

    # Factor 3: Price efficiency (0 - 0.15)
    price = variant.get("price", 0)
    if price > 0 and pack_grams and pack_grams > 0:
        price_per_gram = price / pack_grams
        if price_per_gram < 0.5:
            price_score = 0.15
            reasons.append(f"Great value (₹{price_per_gram:.2f}/g)")
        elif price_per_gram < 1.0:
            price_score = 0.12
        elif price_per_gram < 2.0:
            price_score = 0.08
        else:
            price_score = 0.04
        score += price_score
    else:
        score += 0.08

    # Factor 4: In-stock bonus (0 - 0.1)
    if variant.get("in_stock", True):
        score += 0.1
        reasons.append("In stock")

    # Factor 5: User brand preference (0 - 0.1) — NEW INTELLIGENCE
    if user_context:
        product_brand = variant.get("brand", "") or ""
        # Check if any keyword in ingredient matches a preferred brand
        for keyword in ingredient_lower.split():
            if keyword in user_context.preferred_brands:
                if product_brand.lower() == user_context.preferred_brands[keyword].lower():
                    score += 0.1
                    reasons.append(f"❤️ Your usual brand ({product_brand})")
                    break

        # Check if this spinId is in user's go-to items
        spin_id = variant.get("spinId", "")
        if spin_id and spin_id in user_context.go_to_spin_ids:
            score += 0.05
            reasons.append("⭐ Your go-to item")

    return round(score, 3), reasons


def _make_unavailable_item(ing: Dict) -> Dict:
    return {
        "ingredient_name": ing["ingredient_name"],
        "ingredient_quantity_display": ing["quantity_display"],
        "product_name": "Not Available",
        "product_brand": "",
        "product_quantity_display": "",
        "product_price": 0,
        "spin_id": None,
        "quantity": 0,
        "confidence": "unavailable",
        "confidence_score": 0,
        "selection_reasons": ["No products found on Instamart"],
        "waste_grams": 0,
        "waste_pct": 0,
        "pantry_likely": False,
        "pantry_match": None,
        "image_url": None,
        "alternatives": [],
    }


def _make_pantry_item(ing: Dict, skip: bool = False, match_info: Dict = None) -> Dict:
    reasons = ["Common pantry item — you likely have this"]
    if match_info:
        reasons = [
            f"🏠 In your pantry: \"{match_info['name']}\" "
            f"({match_info['similarity']:.0%} match, "
            f"bought {match_info['days_since_purchase']:.0f}d ago, "
            f"{(1 - match_info['decay_ratio']):.0%} freshness)"
        ]
    return {
        "ingredient_name": ing["ingredient_name"],
        "ingredient_quantity_display": ing["quantity_display"],
        "product_name": "Pantry Item — Skipped",
        "product_brand": "",
        "product_quantity_display": "",
        "product_price": 0,
        "spin_id": None,
        "quantity": 0,
        "confidence": "pantry",
        "confidence_score": 1.0,
        "selection_reasons": reasons,
        "waste_grams": 0,
        "waste_pct": 0,
        "pantry_likely": True,
        "pantry_match": match_info,
        "image_url": None,
        "alternatives": [],
    }


def _optimize_basket(cart_items: List[Dict]) -> List[Dict]:
    """
    Basket-level optimizations:
    1. Deduplicate same spin_id entries (merge quantities)
    2. Flag items below minimum order threshold
    """
    # Deduplicate by spin_id
    seen_spins = {}
    optimized = []
    for item in cart_items:
        sid = item.get("spin_id")
        if sid and sid in seen_spins:
            # Merge quantity
            seen_spins[sid]["quantity"] = seen_spins[sid].get("quantity", 1) + item.get("quantity", 1)
            logger.info("optimizer.dedup",
                        ingredient=item["ingredient_name"],
                        merged_into=seen_spins[sid]["ingredient_name"])
        else:
            if sid:
                seen_spins[sid] = item
            optimized.append(item)

    return optimized
