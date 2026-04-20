"""
Crawler Agent — fetches AI news from RSS feeds and stores raw articles in Supabase.
Skips articles already in DB (source_url is unique).
"""

import os
import feedparser
import requests
from datetime import datetime, timezone
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

RSS_FEEDS = [
    {"name": "TechCrunch AI",          "url": "https://techcrunch.com/tag/artificial-intelligence/feed/"},
    {"name": "VentureBeat AI",         "url": "https://venturebeat.com/ai/feed/"},
    {"name": "The Verge AI",           "url": "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml"},
    {"name": "MIT Tech Review AI",     "url": "https://www.technologyreview.com/feed/"},
    {"name": "Wired AI",               "url": "https://www.wired.com/feed/tag/ai/latest/rss"},
    {"name": "Ars Technica",           "url": "https://feeds.arstechnica.com/arstechnica/technology-lab"},
    {"name": "DeepMind Blog",          "url": "https://deepmind.google/blog/rss.xml"},
    {"name": "OpenAI Blog",            "url": "https://openai.com/blog/rss.xml"},
    {"name": "Hugging Face Blog",      "url": "https://huggingface.co/blog/feed.xml"},
    {"name": "Google AI Blog",         "url": "https://blog.google/technology/ai/rss/"},
    {"name": "The Batch",              "url": "https://www.deeplearning.ai/the-batch/feed.xml"},
    {"name": "Towards Data Science",   "url": "https://towardsdatascience.com/feed"},
    {"name": "AI News",                "url": "https://artificialintelligence-news.com/feed/"},
    {"name": "Anthropic Blog",         "url": "https://www.anthropic.com/rss.xml"},
    {"name": "Mistral Blog",           "url": "https://mistral.ai/news/rss"},
    {"name": "Scale AI Blog",          "url": "https://scale.com/blog/feed"},
    {"name": "Last Week in AI",        "url": "https://lastweekin.ai/feed"},
    {"name": "The AI Beat (VentureBeat)", "url": "https://venturebeat.com/category/ai/feed/"},
]

AI_KEYWORDS = [
    "artificial intelligence", "machine learning", "deep learning", "neural network",
    "large language model", "llm", "gpt", "claude", "gemini", "mistral", "openai",
    "anthropic", "deepmind", "generative ai", "diffusion model", "transformer",
    "chatbot", "ai agent", "rag", "fine-tuning", "benchmark", "multimodal",
]


def is_ai_related(title: str, summary: str) -> bool:
    text = (title + " " + summary).lower()
    return any(kw in text for kw in AI_KEYWORDS)


def get_og_image(url: str) -> str | None:
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        from html.parser import HTMLParser

        class OGParser(HTMLParser):
            image = None
            def handle_starttag(self, tag, attrs):
                if tag == "meta":
                    d = dict(attrs)
                    if d.get("property") == "og:image":
                        self.image = d.get("content")

        parser = OGParser()
        parser.feed(resp.text[:20000])
        return parser.image
    except Exception:
        return None


def parse_date(entry) -> str:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
    return datetime.now(timezone.utc).isoformat()


def crawl():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    inserted = 0

    for feed_meta in RSS_FEEDS:
        print(f"Fetching: {feed_meta['name']}")
        feed = feedparser.parse(feed_meta["url"])

        for entry in feed.entries[:20]:
            title   = entry.get("title", "").strip()
            url     = entry.get("link", "").strip()
            summary = entry.get("summary", entry.get("description", "")).strip()

            if not title or not url:
                continue
            if not is_ai_related(title, summary):
                continue

            og_image = get_og_image(url)

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
