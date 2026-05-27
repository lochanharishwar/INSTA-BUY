"""
Instagram Reels extractor — Multi-tier fallback architecture.
Strategy: GraphQL (best) → Public Page → RapidAPI → Instaloader fallback
Based on best practices from GitHub repos (seotanvirbd, Instaloader)
"""
import re
import httpx
import structlog
import json
import asyncio
from typing import Optional, Tuple
from app.config import settings

logger = structlog.get_logger()


async def extract_instagram(url: str) -> Tuple[str, str]:
    """
    Extract recipe content from an Instagram Reel URL.
    Uses multi-tier fallback strategy:
    1. GraphQL API (no auth required, most reliable)
    2. Public page scraping (og:description, JSON-LD)
    3. RapidAPI fallback (if configured)
    4. Instaloader fallback (if installed)
    """
    reel_id = _extract_reel_id(url)
    if not reel_id:
        raise Exception("Invalid Instagram URL — could not extract reel/post ID.")

    strategies = [
        ("graphql", _scrape_graphql),
        ("public_page", _scrape_public_page),
        ("rapidapi", _scrape_rapidapi_fallback),
        ("instaloader", _scrape_instaloader_fallback),
    ]

    last_error = None
    for strategy_name, strategy_func in strategies:
        if strategy_func is None:
            continue
        try:
            content = await strategy_func(url, reel_id)
            if content and len(content.strip()) > 20:
                logger.info("instagram.extraction_success", 
                           strategy=strategy_name, 
                           reel_id=reel_id, 
                           content_length=len(content))
                return content, strategy_name
        except Exception as e:
            last_error = str(e)[:100]
            logger.warning(f"instagram.{strategy_name}_failed", 
                          reel_id=reel_id, 
                          error=last_error)
            continue

    raise Exception(
        f"Could not extract content from Instagram reel {reel_id}. "
        f"Last error: {last_error}. "
        f"Try pasting the recipe caption or ingredients directly."
    )


def _extract_reel_id(url: str) -> Optional[str]:
    """Extract the shortcode from various Instagram URL formats."""
    patterns = [
        r"instagram\.com/reel/([A-Za-z0-9_-]+)",
        r"instagram\.com/reels/([A-Za-z0-9_-]+)",
        r"instagram\.com/p/([A-Za-z0-9_-]+)",
        r"instagram\.com/tv/([A-Za-z0-9_-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


async def _scrape_graphql(url: str, shortcode: str) -> Optional[str]:
    """
    GraphQL-based extraction - no auth required, most reliable.
    Based on seotanvirbd/Instagram-Reel-Scraper approach.
    """
    graphql_url = "https://www.instagram.com/graphql/query"
    
    variables = json.dumps({"shortcode": shortcode, "child_comment_count": 3, 
                           "fetch_comment_count": 50, "parent_comment_count": 24, 
                           "has_threaded_comments": True})
    
    params = {
        "query_hash": "b9605aadee6612bfa7786c3c2b3bfa3f0c2d0a4a9e3d5f0e3f8a3b5c9d0e1f2",
        "variables": variables,
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    }
    
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        try:
            response = await client.get(graphql_url, params=params, headers=headers)
            if response.status_code == 200:
                data = response.json()
                media = data.get("data", {}).get("shortcode_media", {})
                if media:
                    return _extract_graphql_content(media)
        except Exception:
            pass

    return None


def _extract_graphql_content(media: dict) -> str:
    """Extract content from GraphQL media response."""
    parts = []
    
    caption = media.get("caption", {})
    if isinstance(caption, dict):
        caption_text = caption.get("text", "")
        if caption_text:
            parts.append(caption_text)
    elif caption:
        parts.append(caption)
    
    if media.get("title"):
        parts.append(media["title"])
    
    if media.get("description"):
        parts.append(media["description"])
    
    if media.get("clips_metadata", {}).get("audio_title"):
        parts.append(f"Audio: {media['clips_metadata']['audio_title']}")
    
    return "\n\n".join(parts)


async def _scrape_public_page(url: str, shortcode: str = None) -> Optional[str]:
    """Scrape the public Instagram page for og:description and JSON-LD data."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    }
    
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)
        html = response.text

    parts = []
    
    og_desc_match = re.search(r'<meta\s+(?:property|name)="og:description"\s+content="([^"]*)"', html, re.IGNORECASE)
    if og_desc_match:
        parts.append(og_desc_match.group(1))
    
    og_title_match = re.search(r'<meta\s+(?:property|name)="og:title"\s+content="([^"]*)"', html, re.IGNORECASE)
    if og_title_match:
        parts.append(f"Title: {og_title_match.group(1)}")
    
    ld_matches = re.findall(r'<script type="application/ld\+json">(.+?)</script>', html, re.DOTALL)
    for ld_text in ld_matches:
        try:
            ld = json.loads(ld_text)
            if isinstance(ld, dict):
                for key in ["caption", "description", "articleBody", "text"]:
                    if ld.get(key):
                        parts.append(ld[key])
            elif isinstance(ld, list):
                for item in ld:
                    if isinstance(item, dict):
                        for key in ["caption", "description", "articleBody", "text"]:
                            if item.get(key):
                                parts.append(item[key])
        except json.JSONDecodeError:
            pass
    
    script_data = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
    for script in script_data:
        if '"caption"' in script or '"description"' in script:
            try:
                data = json.loads(script)
                if isinstance(data, dict):
                    for key in ["caption", "description"]:
                        if key in data:
                            parts.append(data[key])
            except json.JSONDecodeError:
                pass

    return "\n\n".join(parts) if parts else None


async def _scrape_rapidapi_fallback(url: str, shortcode: str = None) -> Optional[str]:
    """Fallback using RapidAPI Instagram scraper."""
    rapid_key = getattr(settings, "RAPIDAPI_KEY", None)
    if not rapid_key:
        return None
        
    headers = {
        "X-RapidAPI-Key": rapid_key,
        "X-RapidAPI-Host": "instagram-scraper-api2.p.rapidapi.com"
    }
    
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            response = await client.get(
                "https://instagram-scraper-api2.p.rapidapi.com/v1/post_info",
                params={"code_or_id_or_url": url},
                headers=headers
            )
            if response.status_code == 200:
                data = response.json()
                caption = data.get("data", {}).get("caption", {})
                if isinstance(caption, dict):
                    return caption.get("text", "")
                return caption
        except Exception as e:
            logger.warning("instagram.rapidapi_error", error=str(e)[:100])
    
    return None


async def _scrape_instaloader_fallback(url: str, shortcode: str = None) -> Optional[str]:
    """
    Fallback using Instaloader library.
    Instaloader is the most robust option but requires session or no-auth mode.
    """
    try:
        import tempfile
        import os
        
        from instaloader import Post
        
        with tempfile.TemporaryDirectory() as tmpdir:
            post = Post.from_shortcode(tmpdir, shortcode)
            
            parts = []
            
            if post.caption:
                parts.append(post.caption)
            
            if post.title:
                parts.append(post.title)
            
            return "\n\n".join(parts) if parts else None
            
    except ImportError:
        logger.info("instagram.installer_not_available", "Instaloader not installed")
        return None
    except Exception as e:
        logger.warning("instagram.instaloader_error", error=str(e)[:100])
        return None


async def _extract_reel_metadata(url: str) -> dict:
    """Extract additional metadata from Instagram Reel (likes, comments, etc)."""
    shortcode = _extract_reel_id(url)
    if not shortcode:
        return {}
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }
            response = await client.get(
                f"https://www.instagram.com/p/{shortcode}/?__a=1",
                headers=headers
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("graphql", {}).get("shortcode_media", {})
    except Exception:
        pass
    
    return {}