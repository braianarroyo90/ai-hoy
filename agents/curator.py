"""
Curator Agent — selects the best 'raw' articles and marks them 'curated'.
Deduplicates by title similarity and prioritizes by source quality + recency.
"""

import os
from difflib import SequenceMatcher
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

MAX_TO_PUBLISH_PER_RUN = 30

SOURCE_PRIORITY = {
    "OpenAI Blog":        10,
    "DeepMind Blog":      10,
    "Anthropic Blog":     10,
    "MIT Tech Review AI": 8,
    "VentureBeat AI":     7,
    "TechCrunch AI":      7,
    "The Verge AI":       6,
    "Wired AI":           6,
    "Ars Technica":       5,
}


def similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def deduplicate(articles: list[dict]) -> list[dict]:
    kept = []
    for article in articles:
        title = article["original_title"]
        is_dup = any(similar(title, k["original_title"]) > 0.75 for k in kept)
        if not is_dup:
            kept.append(article)
    return kept


def score(article: dict) -> float:
    source_score = SOURCE_PRIORITY.get(article.get("source_name", ""), 4)
    has_image    = 1 if article.get("og_image") else 0
    return source_score + has_image


def curate():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    raw = (
        supabase.table("articles")
        .select("*")
        .eq("status", "raw")
        .order("published_at", desc=True)
        .limit(100)
        .execute()
    )

    articles = raw.data
    print(f"Raw articles to evaluate: {len(articles)}")

    unique   = deduplicate(articles)
    ranked   = sorted(unique, key=score, reverse=True)
    selected = ranked[:MAX_TO_PUBLISH_PER_RUN]

    ids_selected = [a["id"] for a in selected]
    ids_rejected = [a["id"] for a in articles if a["id"] not in ids_selected]

    if ids_selected:
        supabase.table("articles").update({"status": "curated"}).in_("id", ids_selected).execute()
    if ids_rejected:
        supabase.table("articles").update({"status": "rejected"}).in_("id", ids_rejected).execute()

    print(f"Curated: {len(ids_selected)} | Rejected: {len(ids_rejected)}")


if __name__ == "__main__":
    curate()
