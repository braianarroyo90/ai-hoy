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
POSTHOG_PERSONAL_KEY = os.environ.get("POSTHOG_PERSONAL_API_KEY", "")
POSTHOG_PROJECT_ID   = os.environ.get("POSTHOG_PROJECT_ID", "")
GMAIL_USER           = os.environ["GMAIL_USER"]
GMAIL_APP_PASSWORD   = os.environ["GMAIL_APP_PASSWORD"]
REPORT_EMAIL         = os.environ.get("REPORT_EMAIL", GMAIL_USER)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
claude   = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

POSTHOG_BASE = "https://app.posthog.com"


# ── 1. Metrics collection ────────────────────────────────────────────────────

def fetch_posthog_metrics() -> dict:
    """Fetch last-7-day UX metrics from PostHog: top pages, bounce rate, devices, sessions."""
    if not POSTHOG_PERSONAL_KEY or not POSTHOG_PROJECT_ID:
        print("⚠ PostHog credentials not set — skipping analytics fetch")
        return {}

    now   = datetime.now(timezone.utc)
    from_ = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    to_   = now.strftime("%Y-%m-%d")

    headers = {"Authorization": f"Bearer {POSTHOG_PERSONAL_KEY}"}
    base    = f"{POSTHOG_BASE}/api/projects/{POSTHOG_PROJECT_ID}"

    try:
        # Top pages by pageview count
        r = requests.post(f"{base}/query/", headers=headers, timeout=15, json={
            "query": {
                "kind": "HogQLQuery",
                "query": f"""
                    SELECT properties.$pathname AS path, count() AS views
                    FROM events
                    WHERE event = '$pageview'
                      AND timestamp >= '{from_}' AND timestamp <= '{to_}'
                    GROUP BY path
                    ORDER BY views DESC
                    LIMIT 20
                """
            }
        })
        r.raise_for_status()
        top_pages = [{"path": row[0], "views": row[1]} for row in r.json().get("results", [])]

        # Device breakdown
        r2 = requests.post(f"{base}/query/", headers=headers, timeout=15, json={
            "query": {
                "kind": "HogQLQuery",
                "query": f"""
                    SELECT properties.$device_type AS device, count() AS sessions
                    FROM events
                    WHERE event = '$pageview'
                      AND timestamp >= '{from_}' AND timestamp <= '{to_}'
                    GROUP BY device
                    ORDER BY sessions DESC
                """
            }
        })
        r2.raise_for_status()
        devices = [{"device": row[0], "sessions": row[1]} for row in r2.json().get("results", [])]

        # Avg session duration (seconds)
        r3 = requests.post(f"{base}/query/", headers=headers, timeout=15, json={
            "query": {
                "kind": "HogQLQuery",
                "query": f"""
                    SELECT round(avg(session.$session_duration)) AS avg_duration_sec
                    FROM sessions
                    WHERE min_timestamp >= '{from_}' AND min_timestamp <= '{to_}'
                """
            }
        })
        r3.raise_for_status()
        avg_session = r3.json().get("results", [[0]])[0][0]

        # Bounce rate (sessions with only 1 pageview)
        r4 = requests.post(f"{base}/query/", headers=headers, timeout=15, json={
            "query": {
                "kind": "HogQLQuery",
                "query": f"""
                    SELECT
                        countIf(session.$pageview_count = 1) AS bounced,
                        count() AS total,
                        round(100 * countIf(session.$pageview_count = 1) / count(), 1) AS bounce_rate_pct
                    FROM sessions
                    WHERE min_timestamp >= '{from_}' AND min_timestamp <= '{to_}'
                """
            }
        })
        r4.raise_for_status()
        bounce_row  = r4.json().get("results", [[0, 0, 0]])[0]
        bounce_rate = {"bounced": bounce_row[0], "total": bounce_row[1], "bounce_rate_pct": bounce_row[2]}

        print(f"   PostHog: {len(top_pages)} páginas, bounce {bounce_rate['bounce_rate_pct']}%, sesión avg {avg_session}s")
        return {
            "period":           f"{from_} to {to_}",
            "top_pages":        top_pages,
            "devices":          devices,
            "avg_session_sec":  avg_session,
            "bounce_rate":      bounce_rate,
        }

    except Exception as e:
        print(f"⚠ PostHog API error: {e}")
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
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": USER_TEMPLATE.format(vercel_metrics=vercel_str, supabase_metrics=supa_str)
        }]
    )

    raw = msg.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
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
    print("📊 Fetching PostHog Analytics...")
    posthog = fetch_posthog_metrics()

    print("🗃 Fetching Supabase metrics...")
    supa = fetch_supabase_metrics()
    print(f"   Total artículos: {supa['total_articles']}")
    print(f"   Categorías: {list(supa['category_distribution'].keys())}")

    print("🤖 Asking Claude for proposals...")
    proposals = generate_proposals(posthog, supa)
    print(f"   {len(proposals)} propuestas generadas")

    for p in proposals:
        print(f"   [{p['impacto_esperado'].upper()}] {p['titulo']}")

    print("📧 Sending email...")
    send_email(proposals)


if __name__ == "__main__":
    main()
