"""
Post new articles to @AIHoyES on X/Twitter.
Runs after the pipeline — tweets articles published in the last 2 hours.
"""

import os
import time
import hmac
import hashlib
import base64
import urllib.parse
import uuid
from datetime import datetime, timezone, timedelta

import requests
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

API_KEY             = os.environ["TWITTER_API_KEY"]
API_SECRET          = os.environ["TWITTER_API_SECRET"]
ACCESS_TOKEN        = os.environ["TWITTER_ACCESS_TOKEN"]
ACCESS_TOKEN_SECRET = os.environ["TWITTER_ACCESS_TOKEN_SECRET"]

SITE_URL = "https://ai-hoy.vercel.app"
MAX_TWEETS = 5  # max per run to stay well under monthly limit


supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── OAuth 1.0a signing ──────────────────────────────────────────────────────

def _percent_encode(s: str) -> str:
    return urllib.parse.quote(str(s), safe="")


def _sign_request(method: str, url: str, params: dict) -> str:
    """Return Authorization header value for OAuth 1.0a."""
    nonce     = uuid.uuid4().hex
    timestamp = str(int(time.time()))

    oauth_params = {
        "oauth_consumer_key":     API_KEY,
        "oauth_nonce":            nonce,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp":        timestamp,
        "oauth_token":            ACCESS_TOKEN,
        "oauth_version":          "1.0",
    }

    all_params = {**params, **oauth_params}
    sorted_params = "&".join(
        f"{_percent_encode(k)}={_percent_encode(v)}"
        for k, v in sorted(all_params.items())
    )

    base_string = "&".join([
        method.upper(),
        _percent_encode(url),
        _percent_encode(sorted_params),
    ])

    signing_key = f"{_percent_encode(API_SECRET)}&{_percent_encode(ACCESS_TOKEN_SECRET)}"
    signature = base64.b64encode(
        hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1).digest()
    ).decode()

    oauth_params["oauth_signature"] = signature
    header = "OAuth " + ", ".join(
        f'{_percent_encode(k)}="{_percent_encode(v)}"'
        for k, v in sorted(oauth_params.items())
    )
    return header


def post_tweet(text: str) -> bool:
    url = "https://api.twitter.com/2/tweets"
    auth_header = _sign_request("POST", url, {})
    resp = requests.post(
        url,
        json={"text": text},
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    if resp.status_code in (200, 201):
        tweet_id = resp.json().get("data", {}).get("id")
        print(f"  ✓ tweeted (id={tweet_id})")
        return True
    print(f"  ✗ error {resp.status_code}: {resp.text[:200]}")
    return False


# ── Article helpers ─────────────────────────────────────────────────────────

CATEGORY_TAGS = {
    "Modelos y LLMs":        "#IA #LLMs",
    "Herramientas y Productos": "#IA #Tech",
    "Investigación":         "#IA #Research",
    "Empresas y Negocios":   "#IA #Negocios",
    "Política y Ética":      "#IA #Ética",
    "Robótica":              "#IA #Robótica",
    "Agentes de IA":         "#IA #Agentes",
    "Diseño e IA":           "#IA #Diseño",
}


def build_tweet(article: dict) -> str:
    title = article["es_title"]
    slug  = article.get("slug")
    cat   = article.get("category", "")
    tags  = CATEGORY_TAGS.get(cat, "#IA")
    link  = f"{SITE_URL}/articulo/{slug}" if slug else article["source_url"]

    # Twitter counts URLs as 23 chars regardless of length
    url_chars   = 23
    tag_chars   = len(f"\n\n{tags}")
    max_title   = 280 - url_chars - tag_chars - 2  # 2 for "\n\n" before link

    if len(title) > max_title:
        title = title[:max_title - 1] + "…"

    return f"{title}\n\n{link}\n\n{tags}"


def get_recent_articles() -> list[dict]:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    result = (
        supabase.from_("articles")
        .select("id, slug, source_url, es_title, category, tweeted_at")
        .eq("status", "published")
        .is_("tweeted_at", "null")
        .gte("published_at", cutoff)
        .order("published_at", ascending=False)
        .limit(MAX_TWEETS)
        .execute()
    )
    return result.data or []


def mark_tweeted(article_id: str):
    supabase.from_("articles").update(
        {"tweeted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", article_id).execute()


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    articles = get_recent_articles()
    print(f"Found {len(articles)} articles to tweet")

    if not articles:
        print("Nothing to tweet.")
        return

    ok = 0
    for article in articles:
        print(f"Tweeting: {article['es_title'][:60]}...")
        tweet = build_tweet(article)
        if post_tweet(tweet):
            mark_tweeted(article["id"])
            ok += 1
        time.sleep(2)  # avoid rate limiting

    print(f"\nDone: {ok}/{len(articles)} tweeted")


if __name__ == "__main__":
    main()
