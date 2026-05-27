"""
Database Layer — SQLAlchemy (relational) + ChromaDB (vector inventory)

The vector store tracks per-user grocery purchase history with semantic
embeddings, enabling the optimizer to detect "pantry likely" items via
similarity search instead of a hardcoded staples set.

InventoryDecay provides shelf-life heuristics so stale purchases are
automatically marked inactive and excluded from pantry checks.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings
import structlog
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

logger = structlog.get_logger()


# ═══════════════════════════════════════════════════════════════════════
# SECTION 1 — SQLAlchemy (unchanged from original)
# ═══════════════════════════════════════════════════════════════════════

# Neon URLs usually look like: postgresql://user:pass@ep-flat-water-123.us-east-2.aws.neon.tech/neondb
# asyncpg requires postgresql+asyncpg://
db_url = settings.DATABASE_URL
if db_url and db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Remove channel_binding if present as it can cause issues with some drivers
if "channel_binding" in db_url:
    import re
    db_url = re.sub(r'([?&])channel_binding=[^&]*', r'\1', db_url).rstrip('?&')

# Neon often requires SSL
# If sslmode is already in the URL, asyncpg will use it. 
# Otherwise, we force it for neon.tech domains.
engine_args = {
    "echo": False,
    "future": True,
    "pool_size": 10,
    "max_overflow": 20,
}

if db_url and "neon.tech" in db_url and "sslmode" not in db_url:
    engine_args["connect_args"] = {"ssl": "require"}

engine = create_async_engine(db_url if db_url else "sqlite+aiosqlite:///:memory:", **engine_args)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ═══════════════════════════════════════════════════════════════════════
# SECTION 2 — Inventory Decay Heuristics
# ═══════════════════════════════════════════════════════════════════════

# Shelf-life lookup in days, keyed by canonical ingredient keywords.
# If an item doesn't match any key, DEFAULT_SHELF_LIFE_DAYS is used.
_SHELF_LIFE_MAP: Dict[str, int] = {
    # ── Dairy (short shelf life) ──────────────────────────────────
    "milk":             4,
    "curd":             5,
    "yogurt":           5,
    "yoghurt":          5,
    "paneer":           5,
    "cheese":           14,
    "butter":           30,
    "cream":            7,
    "ghee":             90,

    # ── Produce (very short) ──────────────────────────────────────
    "tomato":           5,
    "onion":            21,
    "potato":           21,
    "garlic":           21,
    "ginger":           14,
    "green chilli":     7,
    "coriander leaves": 4,
    "curry leaves":     5,
    "lemon":            14,
    "lime":             14,
    "carrot":           14,
    "capsicum":         7,
    "spinach":          3,
    "palak":            3,
    "methi leaves":     3,
    "mushroom":         4,
    "broccoli":         5,
    "cabbage":          10,
    "cauliflower":      7,
    "beans":            5,
    "peas":             5,

    # ── Protein (short) ───────────────────────────────────────────
    "chicken":          2,
    "mutton":           2,
    "fish":             2,
    "prawns":           2,
    "shrimp":           2,
    "eggs":             21,
    "egg":              21,
    "tofu":             7,

    # ── Grains & pulses (long) ────────────────────────────────────
    "rice":             90,
    "basmati rice":     90,
    "wheat flour":      60,
    "atta":             60,
    "maida":            90,
    "besan":            90,
    "toor dal":         90,
    "moong dal":        90,
    "chana dal":        90,
    "urad dal":         90,
    "masoor dal":       90,
    "poha":             90,
    "rava":             90,
    "sooji":            90,
    "semolina":         90,
    "oats":             90,
    "pasta":            180,
    "noodles":          180,
    "bread":            5,

    # ── Oils & condiments (very long) ─────────────────────────────
    "oil":              180,
    "cooking oil":      180,
    "sunflower oil":    180,
    "mustard oil":      180,
    "olive oil":        180,
    "coconut oil":      180,
    "refined oil":      180,
    "vegetable oil":    180,
    "vinegar":          365,
    "soy sauce":        365,
    "ketchup":          180,

    # ── Spices (very long) ────────────────────────────────────────
    "salt":             365,
    "sugar":            365,
    "turmeric":         180,
    "turmeric powder":  180,
    "red chilli powder":180,
    "chilli powder":    180,
    "cumin seeds":      180,
    "cumin":            180,
    "mustard seeds":    180,
    "black pepper":     180,
    "garam masala":     180,
    "coriander powder": 180,
    "asafoetida":       365,
    "hing":             365,
    "cinnamon":         365,
    "cardamom":         365,
    "cloves":           365,
    "bay leaf":         365,
    "kasuri methi":     180,
    "saffron":          365,

    # ── Frozen ────────────────────────────────────────────────────
    "frozen peas":      90,
    "frozen corn":      90,
}

DEFAULT_SHELF_LIFE_DAYS = 30  # conservative fallback


@dataclass
class DecayResult:
    """Result of an inventory decay check for a single item."""
    item_name: str
    purchased_epoch: float
    shelf_life_days: int
    days_since_purchase: float
    decay_ratio: float          # 0.0 = just bought → 1.0 = fully expired
    is_active: bool             # True if decay_ratio < 1.0


class InventoryDecay:
    """
    Heuristic shelf-life calculator.

    Given an item name and purchase timestamp, returns a DecayResult
    indicating how "fresh" the item still is in the user's pantry.
    """

    def __init__(self, shelf_life_map: Dict[str, int] | None = None):
        self._map = shelf_life_map or _SHELF_LIFE_MAP

    def shelf_life_days(self, item_name: str) -> int:
        """Look up the shelf life for an item using word-boundary keyword matching."""
        name_lower = item_name.lower().strip()
        # Try exact match first
        if name_lower in self._map:
            return self._map[name_lower]

        # Tokenize the item name for word-boundary matching
        import re
        name_words = set(re.findall(r'\b[a-z]+\b', name_lower))

        # Try multi-word keys first (most specific), then single-word
        best_key = ""
        best_shelf = DEFAULT_SHELF_LIFE_DAYS
        for key in self._map:
            key_words = set(re.findall(r'\b[a-z]+\b', key))
            # All words of the key must appear in the item name
            if key_words and key_words.issubset(name_words):
                # Prefer: (1) more key words → more specific match
                #          (2) on tie, shorter shelf life → safer for perishables
                if (len(key_words) > len(best_key.split())
                        or (len(key_words) == len(best_key.split())
                            and self._map[key] < best_shelf)):
                    best_key = key
                    best_shelf = self._map[key]

        if best_key:
            return self._map[best_key]
        return DEFAULT_SHELF_LIFE_DAYS

    def check(self, item_name: str, purchased_epoch: float) -> DecayResult:
        """Check whether a purchased item is still active (not expired)."""
        shelf = self.shelf_life_days(item_name)
        now = time.time()
        elapsed_seconds = max(0.0, now - purchased_epoch)
        elapsed_days = elapsed_seconds / 86400.0
        decay_ratio = min(1.0, elapsed_days / shelf) if shelf > 0 else 1.0

        return DecayResult(
            item_name=item_name,
            purchased_epoch=purchased_epoch,
            shelf_life_days=shelf,
            days_since_purchase=round(elapsed_days, 1),
            decay_ratio=round(decay_ratio, 3),
            is_active=(decay_ratio < 1.0),
        )


# Singleton instance for the pipeline
inventory_decay = InventoryDecay()


# ═══════════════════════════════════════════════════════════════════════
# SECTION 3 — Inventory Vector Store (ChromaDB + all-MiniLM-L6-v2)
# ═══════════════════════════════════════════════════════════════════════

_chroma_client = None
_embedding_fn = None


def _get_embedding_function():
    """Lazy-load the SentenceTransformer embedding function for ChromaDB."""
    global _embedding_fn
    if _embedding_fn is not None:
        return _embedding_fn

    try:
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
        _embedding_fn = SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2",
        )
        logger.info("vector_store.embedding_loaded", model="all-MiniLM-L6-v2")
    except Exception as e:
        logger.error("vector_store.embedding_load_failed", error=str(e)[:200])
        _embedding_fn = None

    return _embedding_fn


def _get_chroma_client():
    """Lazy-init a persistent ChromaDB client."""
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client

    try:
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        _chroma_client = chromadb.Client(ChromaSettings(
            anonymized_telemetry=False,
        ))
        logger.info("vector_store.chroma_initialized", mode="in-memory")
    except Exception as e:
        logger.error("vector_store.chroma_init_failed", error=str(e)[:200])
        _chroma_client = None

    return _chroma_client


class InventoryVectorStore:
    """
    Per-user vector-embedded grocery inventory stored in ChromaDB.

    Each document is a purchased item string (e.g. "Basmati Rice 1kg").
    Metadata carries: purchased_epoch, shelf_life_days, is_active, brand,
    quantity, price, and order_id.

    The optimizer queries this collection with ingredient names to detect
    semantic matches (similarity > threshold) that are still 'active'.
    """

    COLLECTION_PREFIX = "user_inventory_"

    def __init__(self, session_id: str):
        self.session_id = session_id
        self._collection = None

    def _get_collection(self):
        """Get or create the per-user ChromaDB collection."""
        if self._collection is not None:
            return self._collection

        client = _get_chroma_client()
        ef = _get_embedding_function()
        if client is None or ef is None:
            return None

        collection_name = f"{self.COLLECTION_PREFIX}{self.session_id}"
        # ChromaDB collection names have constraints; sanitise
        collection_name = collection_name[:63].replace(" ", "_")

        self._collection = client.get_or_create_collection(
            name=collection_name,
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"},
        )
        return self._collection

    def upsert_items(self, items: List[Dict]) -> int:
        """
        Embed a batch of purchased items into the vector store.

        Each item dict should contain:
          - name: str (the product name, used as the document)
          - purchased_epoch: float
          - brand: str (optional)
          - quantity: int (optional)
          - price: float (optional)
          - order_id: str (optional)

        Returns the number of items upserted.
        """
        collection = self._get_collection()
        if collection is None:
            logger.warning("vector_store.upsert_skipped", reason="no_collection")
            return 0

        decay = inventory_decay
        ids = []
        documents = []
        metadatas = []

        for item in items:
            name = item.get("name", "").strip()
            if not name:
                continue

            purchased_epoch = item.get("purchased_epoch", time.time())
            decay_result = decay.check(name, purchased_epoch)

            # Use a stable ID: session + normalised name
            doc_id = f"{self.session_id}_{name.lower().replace(' ', '_')}"

            ids.append(doc_id)
            documents.append(name)
            metadatas.append({
                "purchased_epoch": purchased_epoch,
                "shelf_life_days": decay_result.shelf_life_days,
                "days_since_purchase": decay_result.days_since_purchase,
                "decay_ratio": decay_result.decay_ratio,
                "is_active": decay_result.is_active,
                "brand": item.get("brand", ""),
                "quantity": item.get("quantity", 1),
                "price": item.get("price", 0.0),
                "order_id": item.get("order_id", ""),
            })

        if not ids:
            return 0

        collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        logger.info(
            "vector_store.upserted",
            session_id=self.session_id,
            count=len(ids),
        )
        return len(ids)

    def refresh_decay(self) -> int:
        """
        Re-evaluate decay for all items in the collection and update
        their is_active flag. Call this at the start of each session
        to expire items that have passed their shelf life.

        Returns the number of items that changed to inactive.
        """
        collection = self._get_collection()
        if collection is None:
            return 0

        all_items = collection.get(include=["metadatas", "documents"])
        if not all_items or not all_items["ids"]:
            return 0

        decay = inventory_decay
        expired_count = 0
        update_ids = []
        update_metadatas = []

        for i, doc_id in enumerate(all_items["ids"]):
            meta = all_items["metadatas"][i]
            doc_name = all_items["documents"][i]
            purchased_epoch = meta.get("purchased_epoch", 0.0)

            result = decay.check(doc_name, purchased_epoch)

            # Only update if the state changed
            was_active = meta.get("is_active", True)
            if was_active and not result.is_active:
                expired_count += 1

            update_ids.append(doc_id)
            update_metadatas.append({
                **meta,
                "days_since_purchase": result.days_since_purchase,
                "decay_ratio": result.decay_ratio,
                "is_active": result.is_active,
            })

        if update_ids:
            collection.update(ids=update_ids, metadatas=update_metadatas)

        logger.info(
            "vector_store.decay_refreshed",
            session_id=self.session_id,
            total=len(update_ids),
            newly_expired=expired_count,
        )
        return expired_count

    def query_active_inventory(
        self,
        ingredient_name: str,
        n_results: int = 3,
        similarity_threshold: float = 0.85,
    ) -> List[Dict]:
        """
        Semantic search for an ingredient against the user's ACTIVE
        inventory items.

        Returns a list of matches with:
          - name, brand, similarity, decay_ratio, days_since_purchase, etc.

        Only items where is_active=True AND cosine similarity ≥ threshold
        are returned.
        """
        collection = self._get_collection()
        if collection is None:
            return []

        try:
            results = collection.query(
                query_texts=[ingredient_name],
                n_results=n_results,
                where={"is_active": True},
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            logger.warning(
                "vector_store.query_failed",
                ingredient=ingredient_name,
                error=str(e)[:150],
            )
            return []

        matches = []
        if results and results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                # ChromaDB cosine distance → similarity = 1 - distance
                distance = results["distances"][0][i]
                similarity = 1.0 - distance

                if similarity < similarity_threshold:
                    continue

                meta = results["metadatas"][0][i]
                matches.append({
                    "name": results["documents"][0][i],
                    "similarity": round(similarity, 3),
                    "brand": meta.get("brand", ""),
                    "decay_ratio": meta.get("decay_ratio", 0.0),
                    "days_since_purchase": meta.get("days_since_purchase", 0.0),
                    "shelf_life_days": meta.get("shelf_life_days", 30),
                    "purchased_epoch": meta.get("purchased_epoch", 0.0),
                })

        return matches

    def get_inventory_summary(self) -> Dict:
        """Return a quick summary of the user's inventory state."""
        collection = self._get_collection()
        if collection is None:
            return {"total": 0, "active": 0, "expired": 0}

        all_items = collection.get(include=["metadatas"])
        if not all_items or not all_items["ids"]:
            return {"total": 0, "active": 0, "expired": 0}

        total = len(all_items["ids"])
        active = sum(1 for m in all_items["metadatas"] if m.get("is_active", False))
        return {"total": total, "active": active, "expired": total - active}
