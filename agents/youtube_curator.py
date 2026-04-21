"""
youtube_curator.py — Busca Shorts de IA en YouTube y los guarda en Supabase.
Requiere: YOUTUBE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
"""

import os
import sys
import requests
from datetime import datetime, timezone, timedelta
from supabase import create_client

YOUTUBE_API_KEY   = os.environ.get("YOUTUBE_API_KEY", "")
SUPABASE_URL      = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY      = os.environ.get("SUPABASE_SERVICE_KEY", "")

SEARCH_QUERIES = [
    "inteligencia artificial noticias",
    "AI news español",
    "openai novedades",
    "modelos IA 2024",
]

MAX_RESULTS_PER_QUERY = 8
KEEP_DAYS = 30


def search_shorts(query: str) -> list[dict]:
    published_after = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "key":             YOUTUBE_API_KEY,
        "q":               query,
        "part":            "snippet",
        "type":            "video",
        "videoDuration":   "short",
        "order":           "date",
        "publishedAfter":  published_after,
        "maxResults":      MAX_RESULTS_PER_QUERY,
        "relevanceLanguage": "es",
    }
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    items = r.json().get("items", [])

    results = []
    for item in items:
        vid_id = item["id"].get("videoId")
        if not vid_id:
            continue
        snippet = item["snippet"]
        results.append({
            "id":           vid_id,
            "title":        snippet.get("title", ""),
            "channel":      snippet.get("channelTitle", ""),
            "thumbnail":    snippet.get("thumbnails", {}).get("high", {}).get("url") or
                            snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
            "published_at": snippet.get("publishedAt"),
        })
    return results


def remove_old_shorts(db):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)).isoformat()
    db.table("youtube_shorts").delete().lt("published_at", cutoff).execute()


def main():
    if not YOUTUBE_API_KEY:
        print("ERROR: YOUTUBE_API_KEY no configurada")
        sys.exit(1)
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_KEY no configuradas")
        sys.exit(1)

    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    all_shorts: dict[str, dict] = {}
    for query in SEARCH_QUERIES:
        print(f"Buscando: '{query}'...")
        try:
            results = search_shorts(query)
            for s in results:
                all_shorts[s["id"]] = s
            print(f"  {len(results)} videos")
        except Exception as e:
            print(f"  Error: {e}")

    if not all_shorts:
        print("No se encontraron videos.")
        return

    rows = list(all_shorts.values())
    print(f"\nGuardando {len(rows)} videos únicos en Supabase...")
    db.table("youtube_shorts").upsert(rows, on_conflict="id").execute()

    remove_old_shorts(db)
    print(f"Limpieza: eliminados shorts con más de {KEEP_DAYS} días.")
    print("✅ Listo.")


if __name__ == "__main__":
    main()
