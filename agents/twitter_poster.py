"""
Post new articles to @AIHoyES on X/Twitter.
Runs after the pipeline — tweets up to MAX_TWEETS unposted articles.
"""

import os
import time
from datetime import datetime, timezone

import tweepy
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

client = tweepy.Client(
    consumer_key=os.environ["TWITTER_API_KEY"],
    consumer_secret=os.environ["TWITTER_API_SECRET"],
    access_token=os.environ["TWITTER_ACCESS_TOKEN"],
    access_token_secret=os.environ["TWITTER_ACCESS_TOKEN_SECRET"],
)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

SITE_URL  = "https://ai-hoy.vercel.app"
MAX_TWEETS = 5

CATEGORY_TAGS = {
    "Modelos y LLMs":           "#IA #LLMs",
    "Herramientas y Productos": "#IA #Tech",
    "Investigación":            "#IA #Research",
    "Empresas y Negocios":      "#IA #Negocios",
    "Política y Ética":         "#IA #Ética",
    "Robótica":                 "#IA #Robótica",
    "Agentes de IA":            "#IA #Agentes",
    "Diseño e IA":              "#IA #Diseño",
}


def build_tweet(article: dict) -> str:
    title = article["es_title"]
    slug  = article.get("slug")
    cat   = article.get("category", "")
    tags  = CATEGORY_TAGS.get(cat, "#IA")
    link  = f"{SITE_URL}/articulo/{slug}" if slug else article["source_url"]

    url_chars = 23  # Twitter counts all URLs as 23 chars
    max_title = 280 - url_chars - len(f"\n\n{tags}") - 2

    if len(title) > max_title:
        title = title[:max_title - 1] + "…"

    return f"{title}\n\n{link}\n\n{tags}"


def get_articles() -> list[dict]:
    result = (
        supabase.from_("articles")
        .select("id, slug, source_url, es_title, category")
        .eq("status", "published")
        .is_("tweeted_at", "null")
        .order("published_at", desc=True)
        .limit(MAX_TWEETS)
        .execute()
    )
    return result.data or []


def mark_tweeted(article_id: str):
    supabase.from_("articles").update(
        {"tweeted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", article_id).execute()


def main():
    articles = get_articles()
    print(f"Found {len(articles)} articles to tweet")

    if not articles:
        print("Nothing to tweet.")
        return

    ok = 0
    for article in articles:
        print(f"Tweeting: {article['es_title'][:60]}...")
        tweet = build_tweet(article)
        try:
            response = client.create_tweet(text=tweet)
            print(f"  ✓ tweeted (id={response.data['id']})")
            mark_tweeted(article["id"])
            ok += 1
        except tweepy.TweepyException as e:
            print(f"  ✗ {e}")
        time.sleep(2)

    print(f"\nDone: {ok}/{len(articles)} tweeted")


if __name__ == "__main__":
    main()
