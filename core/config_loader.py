"""
config_loader.py — Carga el config del sitio activo.

Uso:
    from core.config_loader import get_config
    config = get_config()
    print(config["name"])  # "AI Hoy"

El sitio activo se determina por la variable de entorno SITE_ID.
Si no está seteada, usa "ai-hoy" como default.
"""

import json
import os
from pathlib import Path

_cache: dict | None = None

def get_config() -> dict:
    global _cache
    if _cache is not None:
        return _cache

    site_id = os.environ.get("SITE_ID", "ai-hoy")
    root = Path(__file__).parent.parent
    config_path = root / "sites" / site_id / "config.json"

    if not config_path.exists():
        raise FileNotFoundError(
            f"No se encontró config para el sitio '{site_id}' en {config_path}\n"
            f"Sitios disponibles: {[d.name for d in (root / 'sites').iterdir() if d.is_dir()]}"
        )

    with open(config_path) as f:
        _cache = json.load(f)

    return _cache


def feature_enabled(feature: str) -> bool:
    return get_config().get("features", {}).get(feature, False)
