"""
test_video.py — Genera un video de prueba SIN Supabase ni YouTube.
Resultado: agents/test_output.mp4
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from pathlib import Path
from video_generator import (
    ensure_font, generate_script, generate_tts, get_audio_duration,
    create_bg_frame, create_text_overlay, create_scene_video, concat_videos,
    generate_scene_image,
)

# Artículo de prueba (sin necesitar Supabase)
ARTICLE = {
    "es_title": "OpenAI lanza GPT-5 con capacidades de razonamiento avanzado",
    "es_summary": "OpenAI presentó GPT-5, su modelo más avanzado hasta la fecha, con mejoras significativas en razonamiento matemático, ciencias y comprensión del lenguaje.",
    "es_body": """OpenAI anunció oficialmente el lanzamiento de GPT-5, el sucesor de GPT-4o.
    El nuevo modelo supera a sus predecesores en benchmarks de razonamiento matemático con un 87% de precisión
    en problemas del nivel universitario. GPT-5 también incorpora capacidades multimodales mejoradas,
    permitiendo analizar imágenes y audio con mayor precisión. La empresa afirma que este modelo es
    significativamente más seguro gracias a nuevas técnicas de alineamiento. El acceso estará disponible
    inicialmente para usuarios de ChatGPT Plus y la API de OpenAI.""",
    "category": "Modelos y LLMs",
    "og_image": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/512px-OpenAI_Logo.svg.png",
    "slug": "openai-lanza-gpt5",
    "tags": ["openai", "gpt-5", "llm"],
}

import tempfile
import anthropic

ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not ANTHROPIC_KEY:
    print("ERROR: Necesitás la variable ANTHROPIC_API_KEY")
    print("Ejecutá: export ANTHROPIC_API_KEY=tu_key")
    sys.exit(1)

import video_generator
video_generator.claude = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

OUTPUT = Path(__file__).parent / "test_output.mp4"

def main():
    print("=== TEST VIDEO GENERATOR ===\n")
    ensure_font()

    import requests
    workdir = Path(tempfile.mkdtemp())
    print(f"Directorio temporal: {workdir}\n")

    # 1. Guión
    print("1. Generando guión con Claude...")
    script = generate_script(ARTICLE)
    print(f"   Título: {script['titulo_video']}")
    print(f"   Escenas: {len(script['escenas'])}\n")

    # 2. Imagen de fondo
    print("2. Descargando imagen de fondo...")
    bg_path = None
    try:
        r = requests.get(ARTICLE["og_image"], timeout=10)
        if r.status_code == 200:
            p = workdir / "bg.jpg"
            p.write_bytes(r.content)
            bg_path = str(p)
            print(f"   OK: {len(r.content)/1024:.0f}KB\n")
    except Exception as e:
        print(f"   Sin imagen (usando fondo sólido): {e}\n")

    # 3. Escenas
    from video_generator import generate_scene_image, create_bg_frame, create_text_overlay
    import time as _time

    escenas = script["escenas"]
    visual_prompts = script.get("prompts_visuales", [])
    print(f"3. Descargando {len(escenas)} imágenes Pollinations (secuencial)...")
    for i, p in enumerate(visual_prompts):
        print(f"   Prompt {i+1}: {p[:70]}")
    scene_imgs = []
    for i, _ in enumerate(escenas):
        if i > 0:
            _time.sleep(4)
        prompt = visual_prompts[i] if i < len(visual_prompts) else "AI technology abstract"
        img = generate_scene_image(prompt, ARTICLE["es_title"], workdir, i)
        scene_imgs.append(img)
        print(f"   Escena {i+1}: {'OK' if img else 'fallback bokeh'}")

    scene_videos = []
    scene_durations = []
    for i, scene in enumerate(escenas):
        print(f"\n   Procesando escena {i+1}/5: '{scene['texto_pantalla']}'")

        scene_img = scene_imgs[i]

        print(f"     → Fondo...", end=" ", flush=True)
        bg_frame = create_bg_frame(scene_img, bg_path, ARTICLE["category"], workdir, i)
        print(f"OK")

        print(f"     → Texto overlay...", end=" ", flush=True)
        txt_frame = create_text_overlay(scene, ARTICLE["category"], workdir, i)
        print(f"OK")

        audio_path = workdir / f"audio_{i:02d}.mp3"
        print(f"     → TTS...", end=" ", flush=True)
        generate_tts(scene["narracion"], str(audio_path))
        duration = get_audio_duration(str(audio_path))
        print(f"{duration:.1f}s")

        print(f"     → Video (Ken Burns)...", end=" ", flush=True)
        scene_video = workdir / f"scene_{i:02d}.mp4"
        create_scene_video(bg_frame, txt_frame, audio_path, duration, scene_video, idx=i)
        print(f"OK")
        scene_videos.append(scene_video)
        scene_durations.append(duration)

    # 4. Concat con transiciones xfade
    print(f"\n4. Montando video con transiciones xfade...")
    concat_videos(scene_videos, scene_durations, OUTPUT)
    size_mb = OUTPUT.stat().st_size / 1_048_576
    print(f"   Listo: {OUTPUT}")
    print(f"   Tamaño: {size_mb:.1f} MB")
    print(f"\n✅ Abrí el archivo para verlo:")
    print(f"   open '{OUTPUT}'")

if __name__ == "__main__":
    main()
