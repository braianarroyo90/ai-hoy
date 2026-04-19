"""
Redactor Agent — uses Claude API to rewrite each curated article in Spanish.
Produces: es_title, es_summary (4 lines), tags, category.
"""

import os
import json
import anthropic
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

CATEGORIES = [
    "Modelos y LLMs", "Herramientas y Productos", "Investigación",
    "Empresas y Negocios", "Política y Ética", "Robótica", "Agentes de IA"
]

SYSTEM_PROMPT = """Eres el editor de un sitio de noticias de inteligencia artificial en español.
Tu trabajo es adaptar noticias del mundo de la IA al público hispanohablante.
Respondés siempre en JSON válido, sin texto adicional fuera del JSON."""

USER_TEMPLATE = """Procesá esta noticia de IA y devolvé un JSON con exactamente estas claves:

- "es_title": título en español, claro y atractivo (máx 90 caracteres)
- "es_summary": resumen en español de 3-4 oraciones que explique qué pasó, por qué importa y qué sigue. Sin clickbait.
- "tags": array de 3-5 tags en minúsculas (ej: ["openai", "gpt-4", "modelos"])
- "category": una de estas categorías exactas: {categories}

Noticia:
Título original: {title}
Fuente: {source}
Contenido: {content}"""


def redact():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    client   = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    curated = (
        supabase.table("articles")
        .select("*")
        .eq("status", "curated")
        .execute()
    )

    articles = curated.data
    print(f"Articles to redact: {len(articles)}")

    for article in articles:
        print(f"  Redacting: {article['original_title'][:70]}")
        try:
            prompt = USER_TEMPLATE.format(
                categories=", ".join(CATEGORIES),
                title=article["original_title"],
                source=article.get("source_name", ""),
                content=article.get("original_summary", "")[:800],
            )

            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=600,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            result = json.loads(message.content[0].text)

            supabase.table("articles").update({
                "es_title":   result.get("es_title"),
                "es_summary": result.get("es_summary"),
                "tags":       result.get("tags", []),
                "category":   result.get("category"),
                "status":     "published",
            }).eq("id", article["id"]).execute()

        except Exception as e:
            print(f"  ERROR on {article['id']}: {e}")
            supabase.table("articles").update({"status": "error"}).eq("id", article["id"]).execute()

    print("Redactor done.")


if __name__ == "__main__":
    redact()
