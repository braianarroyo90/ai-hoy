"""
Genera guión e imágenes de Pollinations para probar en Runway.
Resultado: agents/runway_test/scene_00.jpg ... scene_04.jpg
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))

import anthropic
import video_generator
video_generator.claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

from video_generator import generate_script, generate_scene_image, ensure_font
from pathlib import Path

ensure_font()

ARTICLE = {
    "es_title": "OpenAI lanza GPT-5 con capacidades de razonamiento avanzado",
    "es_summary": "OpenAI presentó GPT-5, su modelo más avanzado, con mejoras en razonamiento matemático y comprensión del lenguaje.",
    "es_body": "OpenAI anunció GPT-5, superando a GPT-4o en benchmarks de razonamiento matemático con 87% de precisión.",
    "category": "Modelos y LLMs",
    "og_image": "",
    "slug": "test",
    "tags": ["openai", "gpt-5"],
}

outdir = Path(__file__).parent / "runway_test"
outdir.mkdir(exist_ok=True)

print("Generando guión con Claude...")
script = generate_script(ARTICLE)
prompts = script.get("prompts_visuales", [])

print(f"\nPrompts visuales generados:")
for i, p in enumerate(prompts):
    print(f"  {i+1}. {p}")

print(f"\nBajando {len(prompts)} imágenes de Pollinations...")
for i, prompt in enumerate(prompts):
    print(f"\n  Escena {i+1}: {prompt[:70]}")
    img = generate_scene_image(prompt, ARTICLE["es_title"], outdir, i)
    print(f"  → {'OK: ' + str(img) if img else 'fallback'}")
    if i < len(prompts) - 1:
        time.sleep(4)

print(f"\n✅ Imágenes guardadas en: {outdir}")
print(f"   Abrí la carpeta con: open '{outdir}'")
