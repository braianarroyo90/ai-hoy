"""
Redactor Agent — uses Claude API to rewrite each curated article in Spanish.
Produces: es_title, es_summary (4 lines), tags, category.
"""

import os
import re
import sys
import json
import anthropic
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

CATEGORIES = [
    "Modelos y LLMs", "Herramientas y Productos", "Investigación",
    "Empresas y Negocios", "Política y Ética", "Robótica", "Agentes de IA",
    "Diseño e IA"
]

SYSTEM_PROMPT = (
    "Eres el editor de un sitio de noticias de IA en español. "
    "Respondés ÚNICAMENTE con un objeto JSON válido, sin texto adicional, "
    "sin markdown, sin explicaciones."
)

USER_TEMPLATE = """\
Procesá esta noticia y devolvé SOLO un JSON (sin bloques de código) con estas claves:
"es_title": título en español, máx 90 caracteres
"es_summary": resumen de 3-4 oraciones en español, sin clickbait
"tags": array de 3-5 strings en minúsculas
"category": exactamente una de: {categories}

Noticia:
Título: {title}
Fuente: {source}
Contenido: {content}"""


def extract_json(text: str) -> dict:
    """Extract JSON from text, handling code fences and extra content."""
    text = text.strip()
    # Remove code fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    # Find first { ... } block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(text)


def redact():
    print("=== Redactor v3 starting ===", flush=True)
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    client   = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Retry previously errored articles
    supabase.table("articles").update({"status": "curated"}).eq("status", "error").execute()

    curated = (
        supabase.table("articles")
        .select("*")
        .eq("status", "curated")
        .execute()
    )

    articles = curated.data
    print(f"Articles to redact: {len(articles)}", flush=True)

    for article in articles:
        title = article["original_title"]
        print(f"  Redacting: {title[:70]}", flush=True)
        try:
            prompt = USER_TEMPLATE.format(
                categories=", ".join(CATEGORIES),
                title=title,
                source=article.get("source_name", ""),
                content=(article.get("original_summary") or "")[:800],
            )

            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=800,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            print(f"    stop_reason: {message.stop_reason}", flush=True)
            print(f"    content blocks: {len(message.content)}", flush=True)

            if not message.content:
                raise ValueError("Empty content from Claude API")

            raw = message.content[0].text
            print(f"    raw[:300]: {raw[:300]}", flush=True)

            result = extract_json(raw)

            supabase.table("articles").update({
                "es_title":   result.get("es_title", title),
                "es_summary": result.get("es_summary", ""),
                "tags":       result.get("tags", []),
                "category":   result.get("category", "Modelos y LLMs"),
                "status":     "published",
            }).eq("id", article["id"]).execute()

            print(f"    Published OK", flush=True)

        except Exception as e:
            import traceback
            print(f"  ERROR {type(e).__name__}: {e}", flush=True)
            traceback.print_exc(file=sys.stdout)
            supabase.table("articles").update({"status": "error"}).eq("id", article["id"]).execute()

    print("Redactor done.", flush=True)


if __name__ == "__main__":
    redact()
