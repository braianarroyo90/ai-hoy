"""
radar_generator.py — Genera El Radar semanal.
Lee los artículos de la última semana desde Supabase,
pide a Claude un reporte de inteligencia editorial y lo guarda.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta
from supabase import create_client
import anthropic

sys.path.insert(0, str(Path(__file__).parent.parent))
from core.config_loader import get_config, feature_enabled

SUPABASE_URL  = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


def build_system_prompt(config: dict) -> str:
    voice = config["prompts"]["radar_voice"]
    return (
        f"{voice} "
        'Cada domingo generás "El Radar" — un reporte de inteligencia semanal con voz editorial propia. '
        "Tu tono es analítico, directo y perspicaz. No repetís noticias, las interpretás. "
        "Respondés ÚNICAMENTE con un JSON válido, sin texto adicional."
    )


RADAR_PROMPT = """Analizá los siguientes artículos de la semana en IA y generá El Radar semanal.

ARTÍCULOS DE LA SEMANA:
{articles_text}

Generá un JSON con esta estructura exacta:
{{
  "titulo": "El Radar — [rango de fechas, ej: 14 al 20 de abril]",
  "historia_semana": {{
    "titulo": "título impactante de la historia principal",
    "texto": "3 párrafos de análisis profundo sobre el desarrollo más importante. No resumas, interpretá. ¿Por qué importa? ¿Qué cambia?"
  }},
  "ganadores": [
    {{
      "nombre": "empresa o persona",
      "razon": "1 oración contundente explicando por qué ganó esta semana",
      "articulos": [{{"titulo": "título del artículo que lo respalda", "slug": "slug-exacto-del-articulo"}}]
    }},
    {{"nombre": "...", "razon": "...", "articulos": [{{"titulo": "...", "slug": "..."}}]}},
    {{"nombre": "...", "razon": "...", "articulos": [{{"titulo": "...", "slug": "..."}}]}}
  ],
  "perdedores": [
    {{
      "nombre": "empresa o persona",
      "razon": "1 oración contundente explicando por qué perdió esta semana",
      "articulos": [{{"titulo": "título del artículo que lo respalda", "slug": "slug-exacto-del-articulo"}}]
    }},
    {{"nombre": "...", "razon": "...", "articulos": [{{"titulo": "...", "slug": "..."}}]}}
  ],
  "tendencia": {{
    "titulo": "nombre de la tendencia emergente",
    "texto": "2 párrafos sobre un patrón que empezó a aparecer esta semana y que hay que seguir de cerca"
  }},
  "lo_que_viene": "2-3 oraciones sobre qué esperar la próxima semana. Concreto, no vago.",
  "pregunta_semana": "Una pregunta provocadora sobre el futuro de la IA que surge de las noticias de esta semana. Que invite a pensar."
}}"""


def get_week_articles(db) -> list[dict]:
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    result = db.table("articles") \
        .select("es_title, es_summary, category, published_at, source_name, slug") \
        .eq("status", "published") \
        .gte("published_at", week_ago) \
        .order("published_at", desc=True) \
        .limit(40) \
        .execute()
    return result.data or []


def format_articles(articles: list[dict]) -> str:
    lines = []
    for a in articles:
        date = a["published_at"][:10]
        slug = a.get("slug", "")
        lines.append(
            f"[{date}] [{a['category']}] {a['es_title']}\n"
            f"slug: {slug}\n"
            f"{a['es_summary']}\n"
        )
    return "\n".join(lines)


def generate_radar(articles: list[dict], system_prompt: str) -> dict:
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    articles_text = format_articles(articles)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": RADAR_PROMPT.format(articles_text=articles_text)
        }]
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def already_published_this_week(db) -> bool:
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    result = db.table("radar_reports") \
        .select("id") \
        .gte("published_at", week_ago) \
        .limit(1) \
        .execute()
    return len(result.data or []) > 0


def main():
    if not feature_enabled("radar"):
        print("Feature 'radar' desactivada para este sitio.")
        return

    config = get_config()

    if not all([SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_KEY]):
        print("ERROR: Faltan variables de entorno")
        sys.exit(1)

    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    system_prompt = build_system_prompt(config)

    force = "--force" in sys.argv
    if not force and already_published_this_week(db):
        print("Ya existe un Radar esta semana. Usá --force para regenerar.")
        return

    print(f"[{config['name']}] Leyendo artículos de la semana...")
    articles = get_week_articles(db)
    if len(articles) < 5:
        print(f"Solo {len(articles)} artículos esta semana — no es suficiente para el Radar.")
        return
    print(f"  {len(articles)} artículos encontrados")

    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=7)).date()
    week_end = now.date()

    print("Generando El Radar con Claude...")
    content = generate_radar(articles, system_prompt)
    print(f"  Título: {content['titulo']}")

    row = {
        "week_start": str(week_start),
        "week_end":   str(week_end),
        "title":      content["titulo"],
        "content":    content,
    }
    db.table("radar_reports").insert(row).execute()
    print(f"\n✅ Radar publicado: {content['titulo']}")


if __name__ == "__main__":
    main()
