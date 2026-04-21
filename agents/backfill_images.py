"""
Backfill OG images for articles that don't have one.
Run once manually or via workflow_dispatch.
"""

import os
import time
import requests
from html.parser import HTMLParser
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

def scrape_og_image(url: str) -> str | None:
    """Try static HTML scraping first."""
    try:
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
                prop = d.get("property", "") or d.get("name", "")
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


def microlink_og_image(url: str) -> str | None:
    """Fallback: use Microlink API which handles JS-rendered sites."""
    try:
        r = requests.get(
            "https://api.microlink.io",
            params={"url": url, "meta": "true"},
            timeout=15,
        )
        if r.status_code != 200:
            return None
        data = r.json().get("data", {})
        image = data.get("image") or data.get("screenshot")
        if isinstance(image, dict):
            return image.get("url")
        return None
    except Exception:
        return None


def get_og_image(url: str) -> str | None:
    image = scrape_og_image(url)
    if image:
        return image
    return microlink_og_image(url)


def backfill():
    # Fetch all published articles without an image
    result = supabase.from_("articles") \
        .select("id, source_url") \
        .eq("status", "published") \
        .is_("og_image", "null") \
        .execute()

    articles = result.data or []
    print(f"Found {len(articles)} articles without image")

    updated = 0
    failed  = 0

    for i, article in enumerate(articles):
        print(f"[{i+1}/{len(articles)}] Fetching {article['source_url'][:60]}...")
        image = get_og_image(article["source_url"])

        if image:
            supabase.from_("articles") \
                .update({"og_image": image}) \
                .eq("id", article["id"]) \
                .execute()
            print(f"  ✓ {image[:60]}")
            updated += 1
        else:
            print(f"  ✗ no image found")
            failed += 1

        time.sleep(0.5)  # be polite

    print(f"\nDone: {updated} updated, {failed} no image found")


if __name__ == "__main__":
    backfill()
