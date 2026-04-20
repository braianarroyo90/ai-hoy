"""
Redactor Agent — uses Claude API to rewrite each curated article in Spanish.
Produces: es_title, es_summary (teaser), es_body (3-4 paragraphs), tags, category, slug.
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
    "Eres el editor de un sitio de noticias de IA en español para audiencia hispanohablante. "
    "Respondés ÚNICAMENTE con un objeto JSON válido, sin texto adicional, "
    "sin bloques de código markdown, sin explicaciones."
)

USER_TEMPLATE = """\
Procesá esta noticia de IA y devolvé SOLO un JSON con estas claves:

"es_title": título atractivo en español, máx 90 caracteres
"es_summary": resumen teaser de 2 oraciones para la portada, sin clickbait
"es_body": artículo completo en español de 3-4 párrafos (250-400 palabras). \
Explicá qué pasó, el contexto técnico, por qué importa para la industria y qué viene después. \
Escribí como periodista tecnológico, no como robot. No menciones la fuente original por nombre.
"tags": array de 3-5 strings en minúsculas (ej: ["openai", "gpt-4", "modelos"])
"category": exactamente una de: {categories}

Noticia:
Título: {title}
Fuente: {source}
Contenido: {content}"""


def slugify(text: str, article_id: str) -> str:
    text = text.lower()
    text = re.sub(r"[àáâãäå]", "a", text)
    text = re.sub(r"[èéêë]", "e", text)
    text = re.sub(r"[ìíîï]", "i", text)
    text = re.sub(r"[òóôõö]", "o", text)
    text = re.sub(r"[ùúûü]", "u", text)
    text = re.sub(r"[ñ]", "n", text)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text.strip())
    return f"{text[:60]}-{article_id[:8]}"


def extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(text)


def redact():
    print("=== Redactor v4 starting ===", flush=True)
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    client   = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

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
                max_tokens=1200,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            if not message.content:
                raise ValueError("Empty content from Claude API")

            raw = message.content[0].text
            print(f"    raw[:200]: {raw[:200]}", flush=True)

            result = extract_json(raw)
            slug   = slugify(result.get("es_title", title), article["id"])

            supabase.table("articles").update({
                "es_title":   result.get("es_title", title),
                "es_summary": result.get("es_summary", ""),
                "es_body":    result.get("es_body", ""),
                "tags":       result.get("tags", []),
                "category":   result.get("category", "Modelos y LLMs"),
                "slug":       slug,
                "status":     "published",
            }).eq("id", article["id"]).execute()

            print(f"    Published OK — slug: {slug}", flush=True)

        except Exception as e:
            import traceback
            print(f"  ERROR {type(e).__name__}: {e}", flush=True)
            traceback.print_exc(file=sys.stdout)
            supabase.table("articles").update({"status": "error"}).eq("id", article["id"]).execute()

    print("Redactor done.", flush=True)


if __name__ == "__main__":
    redact()
