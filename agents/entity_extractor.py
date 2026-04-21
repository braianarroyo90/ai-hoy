"""
entity_extractor.py — Extrae entidades y relaciones de artículos para el Mapa de Poder.
Lee artículos publicados recientes, usa Claude para identificar empresas, personas,
modelos y productos, y guarda el grafo en Supabase.
"""

import os
import re
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

BATCH_SIZE = 10

SYSTEM_PROMPT = """Sos un analista de la industria de IA que extrae entidades y relaciones de noticias.
Respondés ÚNICAMENTE con JSON válido, sin texto adicional."""

USER_PROMPT = """Analizá este artículo de IA y extraé entidades y relaciones.

Tipos de entidad válidos: "company", "person", "model", "product"
Tipos de relación válidos: "created", "invested_in", "acquired", "competes_with", "partnered_with", "founded_by", "works_at", "released", "developed_by"

Artículo:
Título: {title}
Contenido: {content}

Devolvé SOLO este JSON:
{{
  "entities": [
    {{"id": "slug-en-minusculas-sin-espacios", "name": "Nombre Real", "type": "company|person|model|product", "description": "1 oración"}}
  ],
  "relations": [
    {{"from_id": "slug-origen", "to_id": "slug-destino", "relation_type": "tipo"}}
  ]
}}

Reglas:
- Solo entidades relevantes al mundo de la IA (no menciones genéricas)
- El id debe ser un slug único y consistente (ej: "openai", "sam-altman", "gpt-4")
- Máximo 6 entidades y 6 relaciones por artículo
- Si no hay relaciones claras, devolvé "relations": []"""


def slugify(text: str) -> str:
    text = text.lower()
    for a, b in [("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"),("ñ","n")]:
        text = text.replace(a, b)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    return re.sub(r"[\s]+", "-", text.strip())[:60]


def get_unprocessed_articles(db) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    existing = db.table("article_entities").select("article_id").execute()
    processed_ids = {r["article_id"] for r in (existing.data or [])}

    result = (
        db.table("articles")
        .select("id, es_title, es_summary, es_body, category")
        .eq("status", "published")
        .gte("published_at", since)
        .order("published_at", desc=True)
        .limit(100)
        .execute()
    )
    articles = result.data or []
    return [a for a in articles if a["id"] not in processed_ids]


def extract_entities(client: anthropic.Anthropic, article: dict) -> dict | None:
    content = (article.get("es_body") or article.get("es_summary") or "")[:1200]
    prompt = USER_PROMPT.format(title=article["es_title"], content=content)
    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw).strip()
        return json.loads(raw)
    except Exception as e:
        print(f"    Claude error: {e}")
        return None


def upsert_entities(db, entities: list[dict], article_id: str):
    for e in entities:
        if not e.get("id") or not e.get("name") or not e.get("type"):
            continue
        e["id"] = slugify(e["id"]) or slugify(e["name"])
        db.table("entities").upsert({
            "id":          e["id"],
            "name":        e["name"],
            "type":        e["type"],
            "description": e.get("description", ""),
            "last_seen":   datetime.now(timezone.utc).isoformat(),
        }, on_conflict="id").execute()

        # link article → entity
        try:
            db.table("article_entities").upsert(
                {"article_id": article_id, "entity_id": e["id"]},
                on_conflict="article_id,entity_id"
            ).execute()
        except Exception:
            pass

    # update article_count
    for e in entities:
        eid = e.get("id")
        if not eid:
            continue
        count_res = db.table("article_entities").select("article_id", count="exact").eq("entity_id", eid).execute()
        db.table("entities").update({"article_count": count_res.count or 0}).eq("id", eid).execute()


def upsert_relations(db, relations: list[dict], article_id: str):
    for r in relations:
        if not r.get("from_id") or not r.get("to_id") or not r.get("relation_type"):
            continue
        r["from_id"] = slugify(r["from_id"])
        r["to_id"]   = slugify(r["to_id"])
        try:
            db.table("entity_relations").upsert({
                "from_id":      r["from_id"],
                "to_id":        r["to_id"],
                "relation_type": r["relation_type"],
                "article_id":   article_id,
            }, on_conflict="from_id,to_id,relation_type,article_id").execute()
        except Exception:
            pass


def main():
    if not feature_enabled("entity_extractor"):
        print("Feature 'entity_extractor' desactivada para este sitio.")
        return

    config = get_config()
    if not all([SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_KEY]):
        print("ERROR: Faltan variables de entorno")
        sys.exit(1)

    db     = create_client(SUPABASE_URL, SUPABASE_KEY)
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    print(f"[{config['name']}] Entity Extractor starting...")
    articles = get_unprocessed_articles(db)
    articles = articles[:BATCH_SIZE]
    print(f"  {len(articles)} artículos para procesar")

    if not articles:
        print("  Nada nuevo.")
        return

    ok = 0
    for article in articles:
        print(f"  Extrayendo: {article['es_title'][:60]}...")
        result = extract_entities(client, article)
        if not result:
            continue

        entities  = result.get("entities", [])
        relations = result.get("relations", [])
        print(f"    {len(entities)} entidades, {len(relations)} relaciones")

        upsert_entities(db, entities, article["id"])
        upsert_relations(db, relations, article["id"])
        ok += 1

    print(f"\n✅ Listo: {ok}/{len(articles)} artículos procesados")


if __name__ == "__main__":
    main()
