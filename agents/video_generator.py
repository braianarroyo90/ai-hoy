"""
Video Generator Agent
Genera YouTube Shorts a partir de artículos publicados de AI Hoy.
Formato: 1080x1920 vertical, ~60 segundos
Pipeline: Artículo → Claude guión → Edge TTS → Pillow frames → FFmpeg → YouTube
"""

import os
import re
import json
import asyncio
import textwrap
import tempfile
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List
from concurrent.futures import ThreadPoolExecutor, as_completed

import anthropic
import requests
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from supabase import create_client
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import edge_tts

sys.path.insert(0, str(Path(__file__).parent.parent))
from core.config_loader import get_config, feature_enabled

# ── Configuración ────────────────────────────────────────────────────
SUPABASE_URL  = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

AGENTS_DIR    = Path(__file__).parent
SECRETS_FILE  = AGENTS_DIR / "client_secrets.json"
TOKEN_FILE    = AGENTS_DIR / "token.json"
FONT_FILE     = AGENTS_DIR / "Roboto-Bold.ttf"

VIDEOS_PER_RUN = 2
W, H           = 1080, 1920
YT_SCOPES      = ["https://www.googleapis.com/auth/youtube.upload"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None
claude   = anthropic.Anthropic(api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None

# ── Colores por categoría ────────────────────────────────────────────
CATEGORY_COLORS = {
    "Modelos y LLMs":           (59,  130, 246),
    "Herramientas y Productos": (139,  92, 246),
    "Investigación":            (6,   182, 212),
    "Empresas y Negocios":      (245, 158,  11),
    "Política y Ética":         (239,  68,  68),
    "Robótica":                 (16,  185, 129),
    "Agentes de IA":            (249, 115,  22),
    "Diseño e IA":              (236,  72, 153),
}
DEFAULT_COLOR = (59, 130, 246)

# ── Font ─────────────────────────────────────────────────────────────
FONT_URLS = [
    "https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf",
    "https://github.com/googlefonts/roboto/raw/refs/heads/main/fonts/ttf/Roboto-Bold.ttf",
]

def ensure_font():
    if FONT_FILE.exists():
        return
    for url in FONT_URLS:
        try:
            r = requests.get(url, timeout=20)
            if r.status_code == 200 and len(r.content) > 10_000:
                FONT_FILE.write_bytes(r.content)
                print(f"  Font descargada: {FONT_FILE.name}")
                return
        except Exception:
            continue
    print("  WARN: no se pudo descargar la font, usando default")

def get_font(size: int) -> ImageFont.FreeTypeFont:
    # Try downloaded font, then system fonts, then default
    candidates = [
        str(FONT_FILE),
        "/usr/share/fonts/truetype/roboto/Roboto-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

# ── Supabase ─────────────────────────────────────────────────────────
def get_articles() -> list[dict]:
    res = (supabase.table("articles")
           .select("id, es_title, es_summary, es_body, og_image, category, slug, tags")
           .eq("status", "published")
           .is_("video_url", "null")
           .order("published_at", desc=True)
           .limit(VIDEOS_PER_RUN)
           .execute())
    return res.data or []

def mark_video(article_id: str, video_url: str):
    supabase.table("articles").update({
        "video_url": video_url,
        "video_generated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", article_id).execute()

# ── Generación de guión con Claude ───────────────────────────────────
SCRIPT_SYSTEM = """Sos un guionista de noticias de IA para YouTube Shorts en español.
Dado un artículo, generá un guión para un Short de 50-60 segundos.

Reglas:
- Exactamente 5 escenas, cada una con 8-12 segundos de narración
- Narración fluida, energética y periodística
- Escena 1: gancho impactante (la noticia más importante)
- Escenas 2-4: desarrollo del tema con datos concretos
- Escena 5: conclusión con "Seguí AI Hoy para más noticias de IA"
- texto_pantalla: máximo 6 palabras en mayúsculas, impactante
- Sin emojis en la narración

Respondé SOLO con JSON válido sin markdown:
{
  "titulo_video": "...",
  "descripcion_youtube": "descripción de 100-150 palabras con hashtags al final",
  "tags_youtube": ["shorts", "inteligenciaartificial", "ia", "noticias"],
  "prompts_visuales": [
    "prompt en inglés para imagen de fondo escena 1 — específico al contenido del artículo, sin personas, sin texto, fotorrealista",
    "prompt en inglés para imagen de fondo escena 2",
    "prompt en inglés para imagen de fondo escena 3",
    "prompt en inglés para imagen de fondo escena 4",
    "prompt en inglés para imagen de fondo escena 5"
  ],
  "escenas": [
    {"numero": 1, "texto_pantalla": "...", "narracion": "..."},
    {"numero": 2, "texto_pantalla": "...", "narracion": "..."},
    {"numero": 3, "texto_pantalla": "...", "narracion": "..."},
    {"numero": 4, "texto_pantalla": "...", "narracion": "..."},
    {"numero": 5, "texto_pantalla": "...", "narracion": "..."}
  ]
}

Reglas para prompts_visuales:
- Cada prompt describe una escena visualmente distinta relacionada al artículo
- En inglés, sin personas, sin caras, sin texto en la imagen
- Ejemplos: "glowing microchip macro, blue light rays, dark background" / "empty server room with blinking lights, cold blue atmosphere" / "abstract data visualization, orange particles flowing"
- Variá el tema visual entre escenas (no repitas el mismo concepto 5 veces)"""

def generate_script(article: dict) -> dict:
    user_msg = (
        f"Título: {article['es_title']}\n"
        f"Categoría: {article['category']}\n"
        f"Resumen: {article['es_summary']}\n"
        f"Cuerpo: {article['es_body'][:1500]}"
    )
    resp = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        system=SCRIPT_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    raw = resp.content[0].text.strip()
    raw = re.sub(r"^```json\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    return json.loads(raw)

# ── TTS con Edge TTS ─────────────────────────────────────────────────
async def _tts_async(text: str, path: str, voice: str):
    comm = edge_tts.Communicate(text, voice, rate="+10%")
    await comm.save(path)

def generate_tts(text: str, path: str, voice: str):
    asyncio.run(_tts_async(text, path, voice))

def get_audio_duration(path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())

# ── Creación de frames con Pillow ────────────────────────────────────
def _wrap_text(draw: ImageDraw.Draw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if bbox[2] - bbox[0] > max_width and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines

# ── Imagen por escena con Pollinations AI ────────────────────────────
# 5 conceptos visuales distintos por categoría — uno por escena
SCENE_CONCEPTS = {
    "Modelos y LLMs": [
        "glowing server racks in dark data center, blue lights, no people",
        "abstract floating geometric shapes, deep space, digital particles, blue",
        "macro circuit board with light trails, green copper traces, dark background",
        "holographic transparent screens, light refractions, sci-fi control room, no people",
        "binary code rain, matrix style, deep black background, blue glow",
    ],
    "Herramientas y Productos": [
        "sleek minimalist product on dark background, purple ambient light",
        "floating 3D interface elements, hologram, dark room, purple glow",
        "abstract software code on dark screen, syntax highlighting, close up",
        "futuristic keyboard and peripherals, neon purple light, dark studio",
        "glowing app icons floating in void, abstract digital products",
    ],
    "Investigación": [
        "science laboratory glassware with colorful liquids, dramatic lighting, no people",
        "particle accelerator tunnel, circular lights, long exposure, cyan",
        "mathematical equations projected on dark wall, light beams",
        "telescope pointed at star field, cosmic nebula, deep space photography",
        "micro photography of crystal structures, abstract science, teal and blue",
    ],
    "Empresas y Negocios": [
        "skyscraper glass facades reflecting sunset, golden light, upward angle",
        "abstract stock market graph with golden data streams, dark background",
        "modern office building exterior at night, amber lights, no people",
        "global network map with golden connection lines, earth from space",
        "luxury boardroom table with city view, golden hour light, empty room",
    ],
    "Política y Ética": [
        "grand courthouse columns at night, dramatic red and blue lighting",
        "scales of justice statue close up, dramatic shadows, no people",
        "abstract binary code forming a shield, red and blue, dark background",
        "empty parliament hall at night, red ambient light, architecture",
        "digital fingerprint dissolving into particles, red and dark tones",
    ],
    "Robótica": [
        "robotic arm industrial close up, sparks, dark workshop, green tones",
        "macro shot of mechanical gears, oil reflections, metallic texture",
        "drone flying over dark landscape, green LED lights, long exposure",
        "abstract exoskeleton mechanical design, technical blueprint aesthetic",
        "circuit board macro, solder points glowing, green on black",
    ],
    "Agentes de IA": [
        "abstract network of glowing orange nodes connected by light threads",
        "spider web of data connections, warm orange light, dark void",
        "multiple screens in dark room showing dashboards, amber light, no people",
        "autonomous vehicle sensors visualization, orange radar waves, night",
        "drone swarm forming pattern, long exposure trails, dark sky, orange",
    ],
    "Diseño e IA": [
        "abstract generative art, colorful fluid simulation, pink and purple",
        "digital canvas with brush strokes dissolving into pixels, pink tones",
        "neon color palette swatches floating, abstract art studio, dark",
        "3D render abstract sculpture, smooth curves, pink and magenta light",
        "macro paint drops in water, high speed photography, vivid colors",
    ],
}
_DEFAULT_CONCEPTS = [
    "abstract AI technology, blue particles, dark background",
    "futuristic digital landscape, glowing nodes, dark void",
    "data visualization abstract, colorful streams, dark background",
    "macro circuit board, light reflections, dark studio",
    "deep space with digital elements, cosmic technology",
]

def generate_scene_image(prompt: str, article_title: str, workdir: Path, idx: int) -> Optional[str]:
    import urllib.parse, time
    full = (
        f"{prompt}, no people, no faces, no humans, no text, "
        f"photorealistic, 4k, cinematic, dark moody atmosphere"
    )
    encoded = urllib.parse.quote(full)
    seed = (idx * 97 + abs(hash(article_title[:20])) % 500) % 9999
    url = (
        f"https://image.pollinations.ai/prompt/{encoded}"
        f"?width=1080&height=1920&nologo=true&seed={seed}"
    )
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=90, headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code == 200 and len(r.content) > 20_000:
                p = workdir / f"scene_bg_{idx:02d}.jpg"
                p.write_bytes(r.content)
                Image.open(p).verify()
                return str(p)
            elif r.status_code == 429:
                wait = 15 * (attempt + 1)
                print(f" [429 → espera {wait}s]", end="", flush=True)
                time.sleep(wait)
            else:
                print(f" [pollinations {r.status_code}]", end="")
                break
        except Exception as e:
            print(f" [error: {e}]", end="")
            break
    return None

# ── Fondo bokeh procedural (fallback cinematográfico) ─────────────────
def create_cinematic_bg(category: str, seed: int = 0) -> Image.Image:
    """Backdrop estilo noticiero: oscuro con luces bokeh y grid tecnológico."""
    import random
    rng = random.Random(seed + hash(category) % 10000)
    cr, cg, cb = CATEGORY_COLORS.get(category, DEFAULT_COLOR)

    # Base oscura con degradé sutil
    base = Image.new("RGB", (W, H))
    bd = ImageDraw.Draw(base)
    for y in range(H):
        t = y / H
        bd.line([(0, y), (W, y)], fill=(
            int(6 + cr * 0.12 * (1 - t * 0.6)),
            int(6 + cg * 0.12 * (1 - t * 0.6)),
            int(12 + cb * 0.18 * (1 - t * 0.5)),
        ))

    # Capa bokeh: círculos desenfocados de distintos tamaños
    bokeh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bk = ImageDraw.Draw(bokeh)
    for _ in range(35):
        x = rng.randint(-100, W + 100)
        y = rng.randint(-100, H + 100)
        r = rng.randint(20, 220)
        a = rng.randint(10, 55)
        mix = rng.random()
        col = (int(cr * mix + 200 * (1 - mix)), int(cg * mix + 200 * (1 - mix)), int(cb * mix + 220 * (1 - mix)))
        bk.ellipse([x - r, y - r, x + r, y + r], fill=(*col, a))
    bokeh = bokeh.filter(ImageFilter.GaussianBlur(radius=45))
    base = Image.alpha_composite(base.convert("RGBA"), bokeh).convert("RGB")

    # Grid tecnológico muy sutil
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 90):
        gd.line([(x, 0), (x, H)], fill=(cr, cg, cb, 12))
    for y in range(0, H, 90):
        gd.line([(0, y), (W, y)], fill=(cr, cg, cb, 12))
    # Puntos en las intersecciones
    for x in range(0, W, 90):
        for y in range(0, H, 90):
            gd.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(cr, cg, cb, 30))
    grid = grid.filter(ImageFilter.GaussianBlur(radius=0.8))
    base = Image.alpha_composite(base.convert("RGBA"), grid).convert("RGB")

    # Viñeta: oscurecer bordes
    vign = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vign)
    steps = 120
    for i in range(steps):
        t = i / steps
        a = int(180 * t * t)
        margin = int(i * 4.5)
        vd.rectangle([margin, margin, W - margin, H - margin], outline=(0, 0, 0, a))
    vign = vign.filter(ImageFilter.GaussianBlur(radius=8))
    base = Image.alpha_composite(base.convert("RGBA"), vign).convert("RGB")

    return base

def _load_bg(image_path: Optional[str]) -> Optional[Image.Image]:
    if image_path and Path(image_path).exists():
        try:
            img = Image.open(image_path).convert("RGB")
            bg_w, bg_h = img.size
            if (bg_w / bg_h) > (W / H):
                new_w = int(bg_h * W / H)
                left = (bg_w - new_w) // 2
                img = img.crop((left, 0, left + new_w, bg_h))
            else:
                new_h = int(bg_w * H / W)
                top = (bg_h - new_h) // 2
                img = img.crop((0, top, bg_w, top + new_h))
            return img.resize((W, H), Image.LANCZOS)
        except Exception:
            pass
    return None

def create_bg_frame(scene_bg_path: Optional[str], article_bg_path: Optional[str], category: str, workdir: Path, idx: int) -> Path:
    """Capa de fondo: imagen + gradiente. Se le aplica Ken Burns en FFmpeg."""

    bg_img = _load_bg(scene_bg_path) or _load_bg(article_bg_path)
    if bg_img is None:
        # Fallback cinematográfico — mucho mejor que un gradiente plano
        bg_img = create_cinematic_bg(category, seed=idx)

    # Sin blur — Ken Burns se encarga del movimiento
    canvas = bg_img.convert("RGBA")

    # Gradiente oscuro en la mitad inferior para que el texto sea legible
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(H):
        t = y / H
        if t < 0.4:
            alpha = int(30 * t / 0.4)
        else:
            alpha = int(30 + 190 * ((t - 0.4) / 0.6))
        od.line([(0, y), (W, y)], fill=(0, 0, 0, min(alpha, 210)))
    canvas = Image.alpha_composite(canvas, overlay)

    out = workdir / f"bg_{idx:02d}.png"
    canvas.convert("RGB").save(str(out), "PNG")
    return out


def create_text_overlay(scene: dict, category: str, workdir: Path, idx: int, total: int = 5, handle: str = "@AIHoyES") -> Path:
    """Capa de texto: RGBA transparente, queda estática mientras el fondo se mueve."""
    color = CATEGORY_COLORS.get(category, DEFAULT_COLOR)
    cr, cg, cb = color

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    # ── Puntos de progreso tipo stories ──
    dot_r, dot_gap = 8, 26
    dots_total_w = total * dot_r * 2 + (total - 1) * (dot_gap - dot_r * 2)
    dot_x0 = (W - dots_total_w) // 2
    dot_y = 58
    for i in range(total):
        x = dot_x0 + i * dot_gap
        if i == idx:
            draw.ellipse([x - 3, dot_y - 3, x + dot_r * 2 + 3, dot_y + dot_r * 2 + 3],
                         fill=(cr, cg, cb, 255))
        else:
            draw.ellipse([x, dot_y, x + dot_r * 2, dot_y + dot_r * 2],
                         fill=(255, 255, 255, 70))

    # ── Logo "AI HOY" arriba izquierda ──
    logo_font = get_font(40)
    draw.text((55, 42), "AI", font=logo_font, fill=(255, 255, 255, 240))
    ai_bbox = draw.textbbox((55, 42), "AI", font=logo_font)
    draw.text((ai_bbox[2] + 7, 42), "HOY", font=logo_font, fill=(cr, cg, cb, 255))

    # ── Bloque de texto inferior ──
    block_top = H - 460
    block_pad = 40

    # Fondo semi-transparente detrás del texto (mejora legibilidad)
    bg_rect = Image.new("RGBA", (W - block_pad * 2, 350), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg_rect)
    for y in range(350):
        alpha = int(160 * (y / 350))
        bg_draw.line([(0, y), (W, y)], fill=(0, 0, 0, alpha))
    canvas.alpha_composite(bg_rect, (block_pad, block_top - 20))
    draw = ImageDraw.Draw(canvas)

    # Línea de acento vertical
    draw.rectangle([50, block_top, 57, block_top + 280], fill=(cr, cg, cb, 220))

    # Categoría
    cat_font = get_font(32)
    draw.text((75, block_top + 4), category.upper(), font=cat_font, fill=(cr, cg, cb, 220))

    # Texto principal
    text = scene["texto_pantalla"].upper()
    font = get_font(92)
    lines = _wrap_text(draw, text, font, W - 130)
    line_h = 92 + 12
    y_pos = block_top + 50

    for line in lines:
        for dx, dy in [(0, 4), (4, 4), (-4, 4), (0, 8)]:
            draw.text((75 + dx, y_pos + dy), line, font=font, fill=(0, 0, 0, 130))
        draw.text((75, y_pos), line, font=font, fill=(255, 255, 255, 255))
        y_pos += line_h

    # Handle sutil
    handle_font = get_font(30)
    hb = draw.textbbox((0, 0), handle, font=handle_font)
    draw.text(((W - (hb[2] - hb[0])) // 2, H - 72), handle,
              font=handle_font, fill=(255, 255, 255, 90))

    out = workdir / f"text_{idx:02d}.png"
    canvas.save(str(out), "PNG")
    return out

# ── Descarga de imagen de fondo del artículo ─────────────────────────
def download_bg_image(url: Optional[str], workdir: Path) -> Optional[str]:
    if not url:
        return None
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200 and len(r.content) > 10_000:
            p = workdir / "bg.jpg"
            p.write_bytes(r.content)
            return str(p)
    except Exception:
        pass
    return None

# ── FFmpeg ───────────────────────────────────────────────────────────
# Movimientos Ken Burns por escena: variedad visual
_KB_MOVES = [
    # (zoom_expr, x_expr, y_expr)
    ("zoom+0.0003", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"),        # zoom in centro
    ("1.05",        "if(lte(x+0.4,iw-iw/zoom),x+0.4,iw-iw/zoom)",  # paneo derecha
                    "ih/2-(ih/zoom/2)"),
    ("zoom+0.0003", "iw/4-(iw/zoom/4)", "ih/2-(ih/zoom/2)"),        # zoom in desde izq
    ("1.05",        "iw/2-(iw/zoom/2)",
                    "if(lte(y+0.3,ih-ih/zoom),y+0.3,ih-ih/zoom)"),  # paneo hacia abajo
    ("zoom+0.0002", "iw/2-(iw/zoom/2)", "ih-(ih/zoom)"),             # zoom in desde abajo
]

def create_scene_video(bg_frame: Path, text_frame: Path, audio: Path, duration: float, out: Path, idx: int = 0):
    fps = 25
    n = int(duration * fps)
    z_expr, x_expr, y_expr = _KB_MOVES[idx % len(_KB_MOVES)]

    # Sin fade — las transiciones las maneja xfade al concatenar
    filter_complex = (
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,"
        f"crop={W}:{H},"
        f"zoompan=z='{z_expr}':x='{x_expr}':y='{y_expr}':d={n}:s={W}x{H}:fps={fps}[bg];"
        f"[bg][1:v]overlay=0:0[v]"
    )

    subprocess.run([
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(bg_frame),
        "-loop", "1", "-i", str(text_frame),
        "-i", str(audio),
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-map", "2:a",
        "-c:v", "libx264", "-preset", "fast",
        "-c:a", "aac", "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-t", str(duration),
        "-r", str(fps),
        str(out),
    ], check=True, capture_output=True)

# Transiciones xfade por par de escenas
_XFADE_TRANSITIONS = ["fade", "slideleft", "dissolve", "slideright", "fadeblack"]

def concat_videos(parts: List[Path], durations: List[float], out: Path):
    if len(parts) == 1:
        import shutil
        shutil.copy(parts[0], out)
        return

    T = 0.4  # duración de cada transición en segundos
    inputs = []
    for p in parts:
        inputs += ["-i", str(p)]

    # xfade encadenado: cada transición toma el output anterior + el siguiente clip
    filter_v = []
    cumulative = 0.0
    for i in range(len(parts) - 1):
        transition = _XFADE_TRANSITIONS[i % len(_XFADE_TRANSITIONS)]
        offset = cumulative + durations[i] - T - (i * T)
        in_a = f"[xf{i-1}]" if i > 0 else "[0:v]"
        in_b = f"[{i+1}:v]"
        out_label = f"[xf{i}]" if i < len(parts) - 2 else "[vout]"
        filter_v.append(
            f"{in_a}{in_b}xfade=transition={transition}:duration={T}:offset={max(offset,0):.3f}{out_label}"
        )
        cumulative += durations[i]

    # Audio: concat simple de todas las pistas
    audio_inputs = "".join(f"[{i}:a]" for i in range(len(parts)))
    filter_a = f"{audio_inputs}concat=n={len(parts)}:v=0:a=1[aout]"

    filter_complex = ";".join(filter_v) + ";" + filter_a

    subprocess.run([
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264", "-preset", "fast",
        "-c:a", "aac", "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        str(out),
    ], check=True, capture_output=True)

# ── YouTube ──────────────────────────────────────────────────────────
def get_youtube_service():
    creds = None

    # En GitHub Actions, el token viene de la variable de entorno
    token_json_env = os.environ.get("YOUTUBE_TOKEN_JSON")
    if token_json_env:
        import json as _json
        token_data = _json.loads(token_json_env)
        TOKEN_FILE.write_text(_json.dumps(token_data))

    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), YT_SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_FILE.write_text(creds.to_json())
        else:
            # Solo funciona localmente (requiere browser)
            flow = InstalledAppFlow.from_client_secrets_file(str(SECRETS_FILE), YT_SCOPES)
            creds = flow.run_local_server(port=0)
            TOKEN_FILE.write_text(creds.to_json())

    return build("youtube", "v3", credentials=creds)

def upload_to_youtube(yt, video_path: Path, script: dict) -> str:
    body = {
        "snippet": {
            "title": script["titulo_video"][:100],
            "description": script["descripcion_youtube"],
            "tags": script.get("tags_youtube", ["ia", "inteligenciaartificial", "shorts"])[:30],
            "categoryId": "25",  # News & Politics
            "defaultLanguage": "es",
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(str(video_path), mimetype="video/mp4", resumable=True)
    request = yt.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    while response is None:
        _, response = request.next_chunk()

    video_id = response["id"]
    return f"https://www.youtube.com/shorts/{video_id}"

# ── Pipeline por artículo ────────────────────────────────────────────
def process_article(article: dict, yt, voice: str, handle: str) -> str:
    print(f"\n[VIDEO] {article['es_title'][:70]}...")

    with tempfile.TemporaryDirectory() as tmpdir:
        workdir = Path(tmpdir)

        # 1. Guión con Claude
        print("  Generando guión...")
        script = generate_script(article)
        print(f"  Título video: {script['titulo_video'][:60]}")

        # 2. Imagen de fondo
        bg_path = download_bg_image(article.get("og_image"), workdir)

        # 3. Descargar imágenes secuencialmente (Pollinations rate-limita paralelas)
        import time as _time
        escenas = script["escenas"]
        visual_prompts = script.get("prompts_visuales", [])
        print(f"  Descargando {len(escenas)} imágenes de Pollinations...")
        scene_imgs = []
        for i, _ in enumerate(escenas):
            if i > 0:
                _time.sleep(4)
            prompt = visual_prompts[i] if i < len(visual_prompts) else f"AI technology abstract scene {i+1}"
            img = generate_scene_image(prompt, article["es_title"], workdir, i)
            scene_imgs.append(img)
            print(f"    Escena {i+1}: {'OK' if img else 'fallback bokeh'}")

        # 4. Escenas: TTS + dos capas + Ken Burns
        scene_videos = []
        scene_durations = []
        for i, scene in enumerate(escenas):
            print(f"  Escena {i+1}/5: {scene['texto_pantalla'][:30]}...")

            scene_img = scene_imgs[i]
            bg_frame  = create_bg_frame(scene_img, bg_path, article["category"], workdir, i)
            txt_frame = create_text_overlay(scene, article["category"], workdir, i, handle=handle)

            audio_path = workdir / f"audio_{i:02d}.mp3"
            generate_tts(scene["narracion"], str(audio_path), voice)
            duration = get_audio_duration(str(audio_path))

            scene_video = workdir / f"scene_{i:02d}.mp4"
            create_scene_video(bg_frame, txt_frame, audio_path, duration, scene_video, idx=i)
            scene_videos.append(scene_video)
            scene_durations.append(duration)

        # 5. Concatenar con transiciones xfade
        print("  Montando video final con transiciones...")
        final_video = workdir / "final.mp4"
        concat_videos(scene_videos, scene_durations, final_video)
        size_mb = final_video.stat().st_size / 1_048_576
        print(f"  Video listo: {size_mb:.1f} MB")

        # 5. Subir a YouTube
        print("  Subiendo a YouTube...")
        video_url = upload_to_youtube(yt, final_video, script)
        print(f"  Publicado: {video_url}")

        # 6. Marcar en Supabase
        mark_video(article["id"], video_url)
        print("  Supabase actualizado")

        return video_url

# ── Entry point ──────────────────────────────────────────────────────
def main():
    if not feature_enabled("video_shorts"):
        print("Feature 'video_shorts' desactivada para este sitio.")
        return

    config = get_config()
    voice  = config.get("tts_voice", "es-AR-TomasNeural")
    handle = config["youtube"]["channel"]

    ensure_font()

    articles = get_articles()
    if not articles:
        print(f"[{config['name']}] No hay artículos nuevos para generar videos.")
        return

    print(f"[{config['name']}] Generando {len(articles)} video(s)...")
    yt = get_youtube_service()

    for article in articles:
        try:
            process_article(article, yt, voice, handle)
        except Exception as e:
            print(f"  ERROR en '{article['es_title'][:40]}': {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    main()
