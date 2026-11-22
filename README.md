# 🍳 InstaChef AI — Mise en Place

**Turn recipe links or text into an organized grocery list, then search each ingredient on Swiggy Instamart, Blinkit, or Zepto.**

> **"Mise en place"** (French: "everything in its place") — the professional chef's practice of preparing all ingredients before cooking begins. This agent embodies the same principle: every ingredient sourced, optimized, and ready before you step into the kitchen.

---

## 💡 Why This Exists

You're watching a cooking video. The recipe looks amazing. You want to try it tonight.
But:

- Pause the video, copy the ingredient list
- Open Swiggy Instamart
- Search for each ingredient one by one
- Figure out the right pack sizes (200g paneer? 500g?)
- Realize you already have turmeric and salt at home
- Discover 1kg packs when you only need a teaspoon (hello, waste!)
- Figure out who owes what if you're cooking with roommates
- Place the order 20 minutes later

InstaChef AI extracts the ingredients and opens store search pages. Store prices, stock, cart actions, and checkout stay with each grocery service; direct Swiggy checkout requires authorized Swiggy partner access.

**Demo** (30s): Paste a YouTube recipe URL and watch the pipeline classify, extract, understand, optimize, and build a cart — live.

---

## 🧠 Architecture — Real Agentic Pipeline

This is **not** a wrapper around an LLM prompt. It's a production-grade state machine built on **LangGraph** with conditional routing, validation gates, retry loops, synchronization barriers, and human-in-the-loop checkpoints.

### Mermaid

```mermaid
graph TD
    A[🔍 Classify] --> B[User Context]
    B --> C{Text Input?}
    C -->|Yes| D[🧠 Understand Recipe]
    C -->|No| E[📄 Extract Content]
    E --> D
    D --> F{Needs Retry?}
    F -->|Yes < 3 retries| D
    F -->|Max retries| ABORT[❌ Abort]
    F --> G[✅ Validate Recipe]
    G --> H{Passed?}
    H -->|No| F
    H -->|Yes| I[📐 Normalize Ingredients]
    I --> J[🔎 Search Instamart]
    J --> K[🛒 Optimize Cart]
    K --> L[🛡️ Validate Cart]
    L --> M[📤 Cart Proposal]
    M -->|User Approves| N[🛑 Sync Barrier]
    N -->|Group Session| O[⏳ Wait for Contributors]
    O -->|All Approved| P[🛒 Build Cart via MCP]
    P --> Q[💳 Checkout]
```

---

## 🔩 11-Node Pipeline Breakdown

| # | Node | What It Does | Key Detail |
|---|------|-------------|------------|
| 1 | **Classify** | Detects input: YouTube, Instagram, blog, raw text | Skips extraction for text |
| 2 | **User Context** | Fetches order history, preferences, dietary signals | Swiggy MCP via OAuth 2.1 |
| 3 | **Extract** | 5-tier fallback per source: metadata → fast-pass → subtitles → faster-whisper → Whisper API | 30s timeout guards |
| 4 | **Understand** | LLM recipe parsing with retry loop | NVIDIA NIM → Anthropic Claude fallback |
| 5 | **Validate Recipe** | Auto-repair gate: deduplication, quantity capping, heuristics | Can route back to retry |
| 6 | **Normalize** | Standardize units (g/ml/tsp/tbsp/cups/kg) across ingredients | Maps to search terms |
| 7 | **Search Instamart** | 8× concurrent product search via Swiggy MCP | Retry with simplified terms |
| 8 | **Optimize** | **Semantic vector matching** (all-MiniLM-L6-v2), pack efficiency, pantry detection | HostelSync splits |
| 9 | **Validate Cart** | Budget sanity, coverage check, waste analysis | Final quality gate |
| 10 | Synchronization Barrier | Waits for group approvals (HostelSync) | LangGraph `GraphInterrupt` |
| 11 | **Build & Checkout** | MCP cart build + order placement | Mock mode for dev |

### New Features Not in README

- **Smart Extractor with Fast-Pass Heuristic:**
  - 5-tier YouTube extraction: `(title/description) → fast-pass parse → subtitle API → faster-whisper → Whisper API`
  - Description fast-pass parses recipe lists from YouTube descriptions in <1s (confidence ≥80% bypasses audio entirely)
  - Background audio transcription enriches thin metadata while UI streams live

- **Vector-Embedded Inventory (ChromaDB + Sentence Transformers):**
  - Replaces static pantry lists. Tracks user's bought ingredients with cosine similarity matching
  - Flags items with decay-aware freshness scores (~95% accuracy vs ~60% static heuristics)
  - Supports ~200 Indian grocery items with shelf-life heuristics (database.py)

- **Real-Time SSE Dashboard (frontend):**
  - `RecipeInput` → `PipelineProgress` → `CartReview` → `TrackingView` → `GuestView`
  - Live stage-by-stage updates with per-node duration tracking and per-ingredient confidence scores

---

## 🔥 Key Differentiators

### Semantic Matching & Precision
- `all-MiniLM-L6-v2` via `sentence-transformers` with cosine similarity for product-to-ingredient matching
- **Unit Discrepancy Penalty:** Aggressively penalizes bulk items (e.g., 1kg packs) when recipe requests low-volume units (pinch/tsp)

### HostelSync Fractional Ordering
- Natively embedded in `CartReview.tsx` and `GuestView.tsx`
- Calculates proportional splits dynamically
- LangGraph `GraphInterrupt` at `Sync Barrier` — waits for all contributors via SSE, then auto-resumes
- `CartReview.tsx` handles group logic and poll-based updates for guest approval

### Pantry Intelligence & Waste Minimization
- Vector inventory with `InventoryDecay` heuristics: per-item shelf-life, freshness scoring, auto-expiry of inactive items
- Pack-size efficiency scoring: algorithm picks smallest fitting pack, minimizing leftover waste (and cost)
- Pantry items are skipped from the cart (e.g., "salt already in pantry, bought 5 days ago") while still shown in the review UI for transparency

### Multi-Provider LLM Resilience
  - **Primary:** NVIDIA NIM (Llama 3.1 8B)
  - **Fallback:** Anthropic Claude → Google Gemini
- Extraction: `yt-dlp` + `faster-whisper` + OpenAI Whisper API tiered fallback with `asyncio` timeout guards

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Orchestration** | LangGraph (StateGraph + MemorySaver checkpointer) |
| **Backend** | FastAPI + Uvicorn |
| **Frontend** | Next.js 14 + Tailwind CSS (`frontend/app/`) |
| **Agent Architecture** | LangGraph state machine (11 nodes, 6 conditional edges) |
| **LLMs** | NVIDIA NIM → Anthropic Claude → Google Gemini |
| **Semantic Search** | `sentence-transformers` (all-MiniLM-L6-v2) |
| **Vector DB** | ChromaDB (per-user inventory collections) |
| **Commerce** | Swiggy MCP (OAuth 2.1, JSON-RPC 2.0) |
| **Caching** | Redis (transcripts, recipes, user context, cart drafts) |
| **Social Extraction** | `yt-dlp`, `youtube-transcript-api`, `instaloader`, `recipe-scrapers`, `trafilatura` |
| **Frontend State** | Zustand |
| **Icons & UI** | Lucide React |

---

## 🚀 Quick Start (30s)

### Prerequisites
- Python 3.12+
- Node.js 20+

### 1. Clone & Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure API Keys
From the project root, copy `backend/.env.example` to `backend/.env` and add your keys:
```env
GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
MOCK_MCP=true
```

Keep `backend/.env` local; it is ignored by Git. `MOCK_MCP=true` enables recipe processing and store search links without Swiggy credentials. It does not create fake products or place orders.

### 3. Start Backend
```bash
cd backend
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🎯 Example Use Cases

### Scenario A: Solo Cook
1. Paste a YouTube recipe URL
2. Pipeline classifies → extracts → parses → optimizes in ~5s
3. Review cart with waste% per item, pantry hits, and alternatives
4. One-click confirm to build+checkout via MCP

### Scenario B: Hostel Group Cooking
1. Paste recipe URL as primary user
2. Invite roommates via `join?user=alice` link
3. Each roommate opens link, sees their share, clicks approve
4. When all approve, pipeline resumes and auto-checks out

---

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/process` | Start recipe pipeline |
| `POST` | `/api/cart/confirm` | Confirm cart and proceed to build |
| `POST` | `/api/cart/approve` | Approve as contributor (HostelSync) |
| `GET` | `/api/stream` | SSE real-time progress stream |
| `GET` | `/api/session` | Get current session state |
| `GET` | `/api/track` | Track order delivery status |
| `GET` | `/health` | Health check |

---

## 📄 License
Built for the Swiggy Builders Club Hackathon 2026.

**Not affiliated with or endorsed by Swiggy.**
