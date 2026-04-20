"""
UI Analyst Agent — reads Vercel Analytics + Supabase metrics,
asks Claude for 3 UI improvement proposals, and emails them for approval.
"""

import os
import json
import smtplib
import requests
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from supabase import create_client
import anthropic

SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_KEY         = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY    = os.environ["ANTHROPIC_API_KEY"]
VERCEL_TOKEN         = os.environ.get("VERCEL_TOKEN", "")
VERCEL_PROJECT_ID    = os.environ.get("VERCEL_PROJECT_ID", "")
GMAIL_USER           = os.environ["GMAIL_USER"]
GMAIL_APP_PASSWORD   = os.environ["GMAIL_APP_PASSWORD"]
REPORT_EMAIL         = os.environ.get("REPORT_EMAIL", GMAIL_USER)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
claude   = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

VERCEL_ANALYTICS_BASE = "https://vercel.com/api/v2/web/analytics"


# ── 1. Metrics collection ────────────────────────────────────────────────────

def fetch_vercel_metrics() -> dict:
    """Fetch last-7-day page views and top paths from Vercel Analytics."""
    if not VERCEL_TOKEN or not VERCEL_PROJECT_ID:
        print("⚠ Vercel credentials not set — skipping analytics fetch")
        return {}

    now  = datetime.now(timezone.utc)
    from_ = int((now - timedelta(days=7)).timestamp() * 1000)
    to_   = int(now.timestamp() * 1000)

    headers = {"Authorization": f"Bearer {VERCEL_TOKEN}"}
    params  = {
        "projectId":   VERCEL_PROJECT_ID,
        "from":        from_,
        "to":          to_,
        "environment": "production",
        "limit":       20,
    }

    try:
        # Top pages by views
        r = requests.get(f"{VERCEL_ANALYTICS_BASE}/pages", headers=headers, params=params, timeout=10)
        r.raise_for_status()
        pages = r.json().get("data", [])

        # Overall stats (total visitors, bounce rate)
        r2 = requests.get(f"{VERCEL_ANALYTICS_BASE}/stats", headers=headers, params=params, timeout=10)
        r2.raise_for_status()
        stats = r2.json()

        return {"top_pages": pages[:15], "stats": stats}
    except Exception as e:
        print(f"⚠ Vercel API error: {e}")
        return {}


def fetch_supabase_metrics() -> dict:
    """Fetch content distribution and recent activity from Supabase."""

    # Articles per category
    cats = (
        supabase.from_("articles")
        .select("category")
        .eq("status", "published")
        .execute()
    )
    category_counts: dict[str, int] = {}
    for row in (cats.data or []):
        c = row.get("category") or "Sin categoría"
        category_counts[c] = category_counts.get(c, 0) + 1

    # Most recent 20 articles (title + category + published_at)
    recent = (
        supabase.from_("articles")
        .select("es_title, category, published_at, slug")
        .eq("status", "published")
        .order("published_at", desc=True)
        .limit(20)
        .execute()
    )

    # Total published
    total = (
        supabase.from_("articles")
        .select("id", count="exact")
        .eq("status", "published")
        .execute()
    )

    return {
        "total_articles": total.count,
        "category_distribution": category_counts,
        "recent_articles": recent.data or [],
    }


# ── 2. Claude analysis ───────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
Sos un experto en UX/UI especializado en sitios de noticias tech.
Tu trabajo es analizar métricas de uso de una webapp y proponer mejoras concretas de UI.
Respondés ÚNICAMENTE con un JSON válido, sin texto adicional ni markdown.
"""

USER_TEMPLATE = """\
Analizá las métricas del sitio "AI Hoy" (agregador de noticias de IA en español) \
y proponé exactamente 3 mejoras de UI ordenadas por impacto esperado.

MÉTRICAS DE VERCEL (últimos 7 días):
{vercel_metrics}

MÉTRICAS DE CONTENIDO (Supabase):
{supabase_metrics}

STACK ACTUAL: Next.js 16, Tailwind v4, dark mode (zinc-950), grilla editorial con cards lg/md/sm.

Devolvé un JSON con esta estructura exacta:
{{
  "fecha": "YYYY-MM-DD",
  "propuestas": [
    {{
      "id": 1,
      "titulo": "Nombre corto de la mejora",
      "problema": "Qué problema de UX/UI detectás en base a los datos",
      "hipotesis": "Por qué este cambio mejoraría la experiencia",
      "cambio_propuesto": "Descripción técnica concreta de qué cambiar (componente, clase CSS, comportamiento)",
      "archivos_afectados": ["web/components/ArticleCard.tsx"],
      "impacto_esperado": "alto | medio | bajo",
      "esfuerzo": "alto | medio | bajo"
    }}
  ]
}}
"""


def generate_proposals(vercel: dict, supa: dict) -> list[dict]:
    vercel_str = json.dumps(vercel, ensure_ascii=False, indent=2) if vercel else "No disponible"
    supa_str   = json.dumps(supa,   ensure_ascii=False, indent=2)

    msg = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": USER_TEMPLATE.format(vercel_metrics=vercel_str, supabase_metrics=supa_str)
        }]
    )

    raw = msg.content[0].text.strip()
    data = json.loads(raw)
    return data.get("propuestas", [])


# ── 3. Email ─────────────────────────────────────────────────────────────────

IMPACT_COLOR = {"alto": "#22c55e", "medio": "#f59e0b", "bajo": "#94a3b8"}
EFFORT_COLOR = {"alto": "#ef4444", "medio": "#f59e0b", "bajo": "#22c55e"}

def build_email_html(proposals: list[dict]) -> str:
    today = datetime.now().strftime("%d/%m/%Y")
    cards = ""
    for p in proposals:
        impact_c = IMPACT_COLOR.get(p.get("impacto_esperado", ""), "#94a3b8")
        effort_c = EFFORT_COLOR.get(p.get("esfuerzo", ""),           "#94a3b8")
        files    = ", ".join(p.get("archivos_afectados", []))
        cards += f"""
        <div style="background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:24px;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-size:12px;color:#71717a;">Propuesta #{p['id']}</span>
            <div>
              <span style="background:{impact_c}22;color:{impact_c};padding:2px 10px;border-radius:99px;font-size:11px;margin-right:6px;">
                Impacto {p.get('impacto_esperado','')}
              </span>
              <span style="background:{effort_c}22;color:{effort_c};padding:2px 10px;border-radius:99px;font-size:11px;">
                Esfuerzo {p.get('esfuerzo','')}
              </span>
            </div>
          </div>
          <h2 style="color:#f4f4f5;font-size:18px;margin:0 0 12px;">{p['titulo']}</h2>
          <p style="color:#a1a1aa;font-size:13px;margin:0 0 8px;"><strong style="color:#71717a;">Problema:</strong> {p['problema']}</p>
          <p style="color:#a1a1aa;font-size:13px;margin:0 0 8px;"><strong style="color:#71717a;">Hipótesis:</strong> {p['hipotesis']}</p>
          <p style="color:#a1a1aa;font-size:13px;margin:0 0 12px;"><strong style="color:#71717a;">Cambio:</strong> {p['cambio_propuesto']}</p>
          <p style="color:#52525b;font-size:11px;margin:0;">Archivos: {files}</p>
        </div>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background:#09090b;font-family:-apple-system,sans-serif;padding:32px;max-width:640px;margin:0 auto;">
      <div style="margin-bottom:32px;">
        <h1 style="color:#f4f4f5;font-size:24px;margin:0;">
          <span style="color:#60a5fa;">AI</span> Hoy — Propuestas UI
        </h1>
        <p style="color:#71717a;font-size:13px;margin:4px 0 0;">Generadas el {today} · Respondé a este mail para aprobar o rechazar</p>
      </div>
      {cards}
      <p style="color:#3f3f46;font-size:11px;text-align:center;margin-top:32px;">
        Generado por ui_analyst.py · AI Hoy
      </p>
    </body>
    </html>
    """


def send_email(proposals: list[dict]) -> None:
    html = build_email_html(proposals)
    today = datetime.now().strftime("%d/%m/%Y")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"AI Hoy — {len(proposals)} propuestas UI · {today}"
    msg["From"]    = GMAIL_USER
    msg["To"]      = REPORT_EMAIL
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_USER, REPORT_EMAIL, msg.as_string())

    print(f"✅ Email enviado a {REPORT_EMAIL}")


# ── 4. Main ──────────────────────────────────────────────────────────────────

def main():
    print("📊 Fetching Vercel Analytics...")
    vercel = fetch_vercel_metrics()

    print("🗃 Fetching Supabase metrics...")
    supa = fetch_supabase_metrics()
    print(f"   Total artículos: {supa['total_articles']}")
    print(f"   Categorías: {list(supa['category_distribution'].keys())}")

    print("🤖 Asking Claude for proposals...")
    proposals = generate_proposals(vercel, supa)
    print(f"   {len(proposals)} propuestas generadas")

    for p in proposals:
        print(f"   [{p['impacto_esperado'].upper()}] {p['titulo']}")

    print("📧 Sending email...")
    send_email(proposals)


if __name__ == "__main__":
    main()
