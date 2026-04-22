"""
Crawler Agent — fetches AI news from RSS feeds and stores raw articles in Supabase.
Skips articles already in DB (source_url is unique).
"""

import os
import sys
import feedparser
import requests
from datetime import datetime, timezone
from pathlib import Path
from supabase import create_client

sys.path.insert(0, str(Path(__file__).parent.parent))
from core.config_loader import get_config, feature_enabled

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]


def build_rss_feeds(config: dict) -> list[dict]:
    return [{"name": url.split("/")[2], "url": url} for url in config["rss_sources"]]


def build_keywords(config: dict) -> list[str]:
    topic_words = config["topic"].lower().split()
    categories  = [c.lower() for c in config["categories"]]
    base = ["artificial intelligence", "machine learning", "deep learning",
            "neural network", "llm", "gpt", "claude", "gemini", "openai",
            "anthropic", "generative ai", "transformer", "chatbot", "ai agent"]
    return list(set(base + topic_words + categories))


def is_relevant(title: str, summary: str, keywords: list[str]) -> bool:
    text = (title + " " + summary).lower()
    return any(kw in text for kw in keywords)


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def get_og_image(url: str) -> str | None:
    try:
        from html.parser import HTMLParser
        resp = requests.get(url, timeout=10, headers=HEADERS, allow_redirects=True)
        if resp.status_code != 200:
            return None

        class OGParser(HTMLParser):
            og_image      = None
            twitter_image = None
            def handle_starttag(self, tag, attrs):
                if tag != "meta":
                    return
                d = dict(attrs)
                prop    = d.get("property", "") or d.get("name", "")
                content = d.get("content", "")
                if prop == "og:image" and not self.og_image:
                    self.og_image = content
                if prop in ("twitter:image", "twitter:image:src") and not self.twitter_image:
                    self.twitter_image = content

        parser = OGParser()
        parser.feed(resp.text[:60000])
        return parser.og_image or parser.twitter_image
    except Exception:
        return None


def get_rss_image(entry) -> str | None:
    """Extract image from RSS/Atom entry media fields."""
    for field in ("media_content", "media_thumbnail"):
        items = getattr(entry, field, None)
        if items and isinstance(items, list) and items[0].get("url"):
            return items[0]["url"]
    for enc in getattr(entry, "enclosures", []):
        if enc.get("type", "").startswith("image/") and enc.get("href"):
            return enc["href"]
    return None


def parse_date(entry) -> str:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
    return datetime.now(timezone.utc).isoformat()


def crawl():
    if not feature_enabled("crawler"):
        print("Feature 'crawler' desactivada para este sitio.")
        return

    config   = get_config()
    rss_feeds = build_rss_feeds(config)
    keywords  = build_keywords(config)
    supabase  = create_client(SUPABASE_URL, SUPABASE_KEY)
    inserted  = 0

    print(f"[{config['name']}] Crawling {len(rss_feeds)} fuentes...")

    for feed_meta in rss_feeds:
        print(f"Fetching: {feed_meta['name']}")
        feed = feedparser.parse(feed_meta["url"])

        for entry in feed.entries[:20]:
            title   = entry.get("title", "").strip()
            url     = entry.get("link", "").strip()
            summary = entry.get("summary", entry.get("description", "")).strip()

            if not title or not url:
                continue
            if not is_relevant(title, summary, keywords):
                continue

            og_image = get_rss_image(entry) or get_og_image(url)

            row = {
                "source_url":        url,
                "source_name":       feed_meta["name"],
                "original_title":    title,
                "original_summary":  summary[:1000],
                "og_image":          og_image,
                "published_at":      parse_date(entry),
                "status":            "raw",
            }

            # upsert — skips if source_url already exists
            result = supabase.table("articles").upsert(
                row, on_conflict="source_url", ignore_duplicates=True
            ).execute()

            if result.data:
                inserted += 1
                print(f"  + {title[:80]}")

    print(f"\nCrawler done. {inserted} new articles inserted.")


if __name__ == "__main__":
    crawl()
