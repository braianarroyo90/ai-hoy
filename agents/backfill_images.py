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


def get_og_image(url: str) -> str | None:
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})

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
