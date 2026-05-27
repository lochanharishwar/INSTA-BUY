import hashlib
import sys
import os
import re
import structlog
import asyncio
from redis import Redis
from youtube_transcript_api import YouTubeTranscriptApi
from recipe_scrapers import scrape_me
import trafilatura
from app.config import settings
import urllib.parse as urlparse

logger = structlog.get_logger()

try:
    redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None

CACHE_TTL = 86400  # 24 hours
CACHE_TTL_SHORT = 3600  # 1 hour for less stable content

# ─── Background Transcription Registry ────────────────────────────────
# Stores pending background transcription futures keyed by video_id.
# The agent layer polls / awaits these to enrich state when ready.
_background_tasks: dict[str, asyncio.Task] = {}

# SSE emitter — injected by main.py at startup (same pattern as agent.py)
_emit_sse = None


def set_sse_emitter(emitter):
    """Called by main.py to wire in the push_sse function."""
    global _emit_sse
    _emit_sse = emitter


# ─── Measurement keywords for fast-pass heuristic ────────────────────
_MEASUREMENT_KEYWORDS = {
    # Volume
    "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
    "cup", "cups", "ml", "litre", "liter", "litres", "liters", "fl oz",
    # Weight
    "grams", "gram", "gm", "gms", "g", "kg", "kgs", "kilogram", "kilograms",
    "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
    # Count / informal
    "piece", "pieces", "bunch", "bunches", "handful", "handfuls",
    "pinch", "pinches", "dash", "clove", "cloves", "sprig", "sprigs",
    "inch", "inches", "nos", "no.", "large", "medium", "small",
    # Indian-specific measures
    "katori", "glass", "chammach",
}

# Pre-compiled pattern: digit/fraction followed by a measurement keyword
_MEASURE_RE = re.compile(
    r"(?:^|\s)(\d+[\d/.\-–—]*)\s*("
    + "|".join(re.escape(kw) for kw in sorted(_MEASUREMENT_KEYWORDS, key=len, reverse=True))
    + r")\b",
    re.IGNORECASE,
)

# Ingredient-section header patterns (common in YouTube descriptions)
_INGREDIENT_HEADER_RE = re.compile(
    r"^[#*\-–—\s]*(?:ingredients?|what you.?ll need|grocery list|shopping list|you.?ll need)\s*[:|\-–—]?\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def get_video_id(url):
    url_data = urlparse.urlparse(url)
    query = urlparse.parse_qs(url_data.query)
    if "v" in query:
        return query["v"][0]
    elif "youtu.be" in url_data.netloc:
        return url_data.path.lstrip("/")
    return None


def _get_yt_dlp_path() -> str:
    venv_scripts = os.path.join(os.path.dirname(sys.executable))
    candidates = [
        os.path.join(venv_scripts, "yt-dlp.exe"),
        os.path.join(venv_scripts, "yt-dlp"),
        "yt-dlp",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return "yt-dlp"


# ─── Fast Metadata Fetch ─────────────────────────────────────────────

async def _get_youtube_metadata(url: str) -> tuple[str, str]:
    """
    Fetch video title and description using yt-dlp --print.
    Returns (title, description) separately for fast-pass analysis.
    """
    try:
        import subprocess
        yt_dlp_bin = _get_yt_dlp_path()

        # Run yt-dlp in a thread to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                [yt_dlp_bin, "--print", "title", "--print", "description",
                 "--no-playlist", "--no-download", url],
                check=True, capture_output=True, text=True, timeout=10,
                encoding="utf-8",
            ),
        )
        output = result.stdout.strip()
        # First line = title, rest = description
        lines = output.split("\n", 1)
        title = lines[0].strip() if lines else ""
        description = lines[1].strip() if len(lines) > 1 else ""
        return title, description
    except Exception as e:
        logger.warning("extract.youtube.metadata_failed", error=str(e))
        return "", ""


# ─── Fast-Pass Ingredient Parser ─────────────────────────────────────

def _fast_pass_parse(description: str) -> tuple[str | None, float]:
    """
    Attempt to extract ingredient list from a YouTube video description
    using regex heuristics.  Returns (extracted_text, confidence).

    Confidence is calculated from:
      - Presence of an ingredient-section header          (+30%)
      - Number of lines with measurement keywords         (scaled to 50%)
      - Consistent line-break formatting (list-like)      (+20%)

    Returns (None, 0.0) if confidence < 0.80.
    """
    if not description or len(description.strip()) < 20:
        return None, 0.0

    confidence = 0.0
    lines = description.split("\n")
    total_lines = len(lines)

    # ── Step 1: Find ingredient section header ──────────────────────
    header_match = _INGREDIENT_HEADER_RE.search(description)
    ingredient_section_start = 0
    if header_match:
        confidence += 0.30
        # Find the line index of the header
        header_pos = header_match.start()
        char_count = 0
        for idx, line in enumerate(lines):
            char_count += len(line) + 1  # +1 for newline
            if char_count > header_pos:
                ingredient_section_start = idx + 1
                break

    # ── Step 2: Analyse lines for measurement keywords ──────────────
    candidate_lines: list[str] = []
    measure_hit_count = 0
    consecutive_list_lines = 0
    max_consecutive = 0
    list_pattern = re.compile(r"^[\s\-•*·▸▹►▻→‣⁃✓✔☑\d.)]+")

    for i in range(ingredient_section_start, total_lines):
        line = lines[i].strip()
        if not line:
            # End-of-section blank line resets consecutive counter
            if consecutive_list_lines > max_consecutive:
                max_consecutive = consecutive_list_lines
            consecutive_list_lines = 0
            continue

        # Stop if we hit a new section (instructions, method, etc.)
        if re.match(
            r"^[#*\-–—\s]*(?:method|instructions?|directions?|steps?|procedure|how to|for the|notes?)\s*[:|\-–—]?\s*$",
            line, re.IGNORECASE,
        ):
            break

        has_measure = bool(_MEASURE_RE.search(line))
        has_list_prefix = bool(list_pattern.match(line))

        if has_measure or has_list_prefix:
            candidate_lines.append(line)
            if has_measure:
                measure_hit_count += 1
            consecutive_list_lines += 1
        else:
            if consecutive_list_lines > max_consecutive:
                max_consecutive = consecutive_list_lines
            consecutive_list_lines = 0

    if consecutive_list_lines > max_consecutive:
        max_consecutive = consecutive_list_lines

    num_candidates = len(candidate_lines)
    if num_candidates == 0:
        return None, 0.0

    # ── Step 3: Score measurement density ───────────────────────────
    # If ≥3 lines have measurement keywords → scale up to 60%
    if measure_hit_count >= 8:
        confidence += 0.60  # Very high density — strong standalone signal
    elif measure_hit_count >= 6:
        confidence += 0.50
    elif measure_hit_count >= 3:
        confidence += 0.30 + 0.20 * ((measure_hit_count - 3) / 3)
    elif measure_hit_count >= 1:
        confidence += 0.10 * measure_hit_count

    # ── Step 4: Score list-like formatting consistency ──────────────
    if max_consecutive >= 5:
        confidence += 0.20
    elif max_consecutive >= 3:
        confidence += 0.10

    confidence = min(confidence, 1.0)

    logger.info(
        "extract.fast_pass.scored",
        confidence=round(confidence, 2),
        measure_hits=measure_hit_count,
        candidate_lines=num_candidates,
        max_consecutive=max_consecutive,
        has_header=bool(header_match),
    )

    if confidence >= 0.80:
        extracted = "\n".join(candidate_lines)
        return extracted, confidence

    return None, confidence


# ─── Cache Helpers ────────────────────────────────────────────────────

def _cache_get(key: str) -> str | None:
    if redis_client:
        try:
            return redis_client.get(key)
        except Exception:
            pass
    return None


def _cache_set(key: str, value: str, ttl: int = CACHE_TTL):
    if redis_client:
        try:
            redis_client.setex(key, ttl, value)
        except Exception:
            pass


# ─── Public API ───────────────────────────────────────────────────────

async def extract_content(url_or_text: str, input_type: str) -> tuple[str, str]:
    """
    Extract raw text content from a URL or plain text.
    Uses a 4-tier fallback for YouTube: subtitles → metadata → faster-whisper → OpenAI Whisper.
    Uses multi-strategy fallback for Instagram Reels.
    All results are cached in Redis for 24 hours.
    """
    cache_key = f"extract:{hashlib.sha256(url_or_text.encode()).hexdigest()}"
    cached = _cache_get(cache_key)
    if cached:
        return cached, "cache"

    content = ""
    source = ""

    if input_type == "youtube":
        content, source = await _extract_youtube(url_or_text)
    elif input_type == "instagram":
        from app.pipeline.instagram import extract_instagram
        content, source = await extract_instagram(url_or_text)
    elif input_type == "blog":
        content, source = _extract_blog(url_or_text)
    else:
        content = url_or_text
        source = "text"

    if content:
        _cache_set(cache_key, content, CACHE_TTL)

    if not content:
        raise Exception("Could not extract any content from the provided input.")

    return content, source


# ─── YouTube Extraction  (rewritten for sub-second TTFB) ─────────────

async def _extract_youtube(url: str) -> tuple[str, str]:
    """
    Priority-ordered YouTube extraction:
      1. Metadata fast-fetch (yt-dlp --print title --print description)
      2. Fast-pass heuristic parse of description for ingredients
      3. If fast-pass confident ≥80% → return immediately, BYPASS audio
      4. Else → try subtitle API (fast, free)
      5. Else → offload audio transcription (Whisper) to background task
         and return metadata immediately with a "processing_audio" status
    """
    video_id = get_video_id(url)
    if not video_id:
        raise Exception("Invalid YouTube URL — could not extract video ID.")

    errors: list[str] = []

    # ── Phase 1: Metadata fetch (sub-second) ────────────────────────
    logger.info("extract.youtube.phase1_metadata", video_id=video_id)
    title, description = await _get_youtube_metadata(url)

    metadata_text = ""
    if title or description:
        metadata_text = f"TITLE: {title}\n\nDESCRIPTION:\n{description}"
        logger.info(
            "extract.youtube.metadata_fetched",
            video_id=video_id,
            title_len=len(title),
            desc_len=len(description),
        )

    # ── Phase 2: Fast-pass description parse ────────────────────────
    if description:
        logger.info("extract.youtube.phase2_fast_pass", video_id=video_id)
        fast_text, confidence = _fast_pass_parse(description)

        if fast_text and confidence >= 0.80:
            final = (
                f"VIDEO METADATA:\n{metadata_text}\n\n"
                f"INGREDIENTS (from description, confidence={confidence:.0%}):\n{fast_text}"
            )
            logger.info(
                "extract.youtube.fast_pass_hit",
                video_id=video_id,
                confidence=round(confidence, 2),
                word_count=len(final.split()),
            )
            return final, "description_fast_pass"

        logger.info(
            "extract.youtube.fast_pass_miss",
            video_id=video_id,
            confidence=round(confidence, 2),
        )

    # ── Phase 3: Subtitle API (fast, free) ──────────────────────────
    try:
        logger.info("extract.youtube.phase3_subtitles", video_id=video_id)
        transcript_list = YouTubeTranscriptApi().fetch(
            video_id, languages=["en", "hi", "ta", "te", "kn", "mr"]
        )
        content = " ".join([snippet.text for snippet in transcript_list])
        if content.strip():
            final_content = f"VIDEO METADATA:\n{metadata_text}\n\nTRANSCRIPT:\n{content}"
            logger.info(
                "extract.youtube.subtitles",
                video_id=video_id,
                word_count=len(final_content.split()),
            )
            return final_content, "subtitle_api"
    except Exception as e:
        errors.append(f"subtitle_api: {str(e)[:100]}")
        logger.info(
            "extract.youtube.subtitles_failed",
            video_id=video_id,
            error=str(e)[:100],
        )

    # ── Phase 4: Metadata-only fallback (if sufficient) ─────────────
    if metadata_text and len(metadata_text.strip().split()) > 20:
        logger.info("extract.youtube.using_metadata_fallback", video_id=video_id)

        # Kick off background audio transcription to enrich later
        _schedule_background_transcription(video_id, url, metadata_text)

        return f"VIDEO METADATA (FALLBACK):\n{metadata_text}", "metadata_fallback"

    # ── Phase 5: Foreground audio transcription (last resort) ───────
    # Only reached when metadata is too thin to be useful at all.
    logger.info("extract.youtube.phase5_audio_foreground", video_id=video_id)
    content, source = await _transcribe_audio(video_id, url, metadata_text, errors)
    if content:
        return content, source

    # All tiers failed
    raise Exception(
        f"All transcription methods failed for video {video_id}. "
        f"Errors: {'; '.join(errors)}. "
        f"Try pasting the recipe text directly."
    )


# ─── Background Audio Transcription ──────────────────────────────────

def _schedule_background_transcription(
    video_id: str, url: str, metadata_text: str
) -> None:
    """
    Schedule heavy audio transcription (faster-whisper / OpenAI Whisper)
    as a non-blocking background task. Stores the asyncio.Task in the
    module-level registry so the agent layer can await enrichment later.
    """
    if video_id in _background_tasks:
        logger.info("extract.background.already_scheduled", video_id=video_id)
        return

    async def _bg_work():
        try:
            logger.info("extract.background.started", video_id=video_id)

            # Emit SSE so the frontend shows "Deep audio analysis in progress…"
            if _emit_sse:
                # We don't have session_id here, so we use a broadcast-style
                # event keyed by video_id; the agent layer re-emits per-session.
                pass  # SSE is emitted from the agent layer via poll/await

            content, source = await _transcribe_audio(
                video_id, url, metadata_text, errors=[]
            )
            if content:
                # Cache the enriched transcript
                cache_key = f"extract:{hashlib.sha256(url.encode()).hexdigest()}"
                _cache_set(cache_key, content, CACHE_TTL)
                logger.info(
                    "extract.background.completed",
                    video_id=video_id,
                    source=source,
                    word_count=len(content.split()),
                )
                return content, source
            else:
                logger.warning("extract.background.no_content", video_id=video_id)
                return None, "background_failed"
        except Exception as e:
            logger.error(
                "extract.background.failed", video_id=video_id, error=str(e)[:200]
            )
            return None, "background_error"

    task = asyncio.create_task(_bg_work())
    _background_tasks[video_id] = task

    # Auto-cleanup on completion
    def _cleanup(t):
        _background_tasks.pop(video_id, None)

    task.add_done_callback(_cleanup)


async def get_background_result(video_id: str) -> tuple[str, str] | None:
    """
    Await a pending background transcription task.
    Returns (content, source) or None if no task exists.
    Used by the agent layer to poll/enrich state asynchronously.
    """
    task = _background_tasks.get(video_id)
    if task is None:
        return None
    try:
        return await task
    except Exception:
        return None


def has_pending_transcription(video_id: str) -> bool:
    """Check if a background transcription is running for this video."""
    task = _background_tasks.get(video_id)
    return task is not None and not task.done()


# ─── Audio Transcription (shared by foreground & background paths) ───

async def _transcribe_audio(
    video_id: str, url: str, metadata_text: str, errors: list[str]
) -> tuple[str, str]:
    """
    Try faster-whisper (local, free) then OpenAI Whisper API (paid).
    This is the heavy path — separated so it can be called from both
    foreground and background contexts.
    """
    # Tier A: yt-dlp + faster-whisper (local, free)
    try:
        import subprocess
        import tempfile

        loop = asyncio.get_event_loop()

        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = os.path.join(tmpdir, "audio.m4a")
            yt_dlp_bin = _get_yt_dlp_path()

            logger.info("extract.youtube.ytdlp", binary=yt_dlp_bin, video_id=video_id)
            await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    [yt_dlp_bin, "-f", "bestaudio[ext=m4a]/bestaudio",
                     "--no-playlist", "-o", audio_path, url],
                    check=True, capture_output=True, timeout=120,
                ),
            )

            from faster_whisper import WhisperModel

            def _run_whisper():
                model = WhisperModel("base", device="cpu", compute_type="int8")
                segments, info = model.transcribe(audio_path, beam_size=5)
                return " ".join([segment.text for segment in segments])

            content = await loop.run_in_executor(None, _run_whisper)

            if content.strip():
                final_content = (
                    f"VIDEO METADATA:\n{metadata_text}\n\nTRANSCRIPT:\n{content}"
                )
                logger.info(
                    "extract.youtube.faster_whisper",
                    video_id=video_id,
                    word_count=len(final_content.split()),
                )
                return final_content, "faster_whisper"
    except Exception as e:
        errors.append(f"faster_whisper: {str(e)[:100]}")
        logger.info(
            "extract.youtube.faster_whisper_failed",
            video_id=video_id,
            error=str(e)[:100],
        )

    # Tier B: OpenAI Whisper API (paid, reliable)
    if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "your_openai_key_here":
        try:
            import subprocess
            import tempfile

            loop = asyncio.get_event_loop()

            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, "audio.m4a")
                yt_dlp_bin = _get_yt_dlp_path()

                if not os.path.exists(audio_path):
                    await loop.run_in_executor(
                        None,
                        lambda: subprocess.run(
                            [yt_dlp_bin, "-f", "bestaudio[ext=m4a]/bestaudio",
                             "--no-playlist", "-o", audio_path, url],
                            check=True, capture_output=True, timeout=120,
                        ),
                    )

                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                with open(audio_path, "rb") as audio_file:
                    transcription = await client.audio.transcriptions.create(
                        model="whisper-1", file=audio_file
                    )
                content = transcription.text
                if content.strip():
                    logger.info(
                        "extract.youtube.whisper_api",
                        video_id=video_id,
                        word_count=len(content.split()),
                    )
                    return content, "whisper_api"
        except Exception as e:
            errors.append(f"whisper_api: {str(e)[:100]}")
            logger.info(
                "extract.youtube.whisper_api_failed",
                video_id=video_id,
                error=str(e)[:100],
            )

    return "", "all_audio_failed"


# ─── Blog Extraction (unchanged) ─────────────────────────────────────

def _extract_blog(url: str) -> tuple[str, str]:
    """Extract recipe from a blog URL. Tries structured scraper first, falls back to trafilatura."""
    try:
        scraper = scrape_me(url)
        content = (
            f"Title: {scraper.title()}\n"
            f"Ingredients: {', '.join(scraper.ingredients())}\n"
            f"Instructions: {scraper.instructions()}"
        )
        if content.strip():
            return content, "scraper"
    except Exception:
        pass

    try:
        downloaded = trafilatura.fetch_url(url)
        content = trafilatura.extract(downloaded) if downloaded else ""
        if content and content.strip():
            return content, "trafilatura"
    except Exception:
        pass

    raise Exception("Could not extract content from the provided blog URL.")


async def _extract_blog_async(url: str) -> tuple[str, str]:
    """Async wrapper for blog extraction."""
    return _extract_blog(url)