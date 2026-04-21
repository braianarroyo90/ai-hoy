"""
youtube_auth.py — Correr UNA SOLA VEZ localmente para autenticarse con YouTube.
Abre el browser, pedís permiso, guarda token.json.
Después copiás el contenido de token.json como secret YOUTUBE_TOKEN_JSON en GitHub.
"""

import json
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES       = ["https://www.googleapis.com/auth/youtube.upload"]
SECRETS_FILE = Path(__file__).parent / "client_secrets.json"
TOKEN_FILE   = Path(__file__).parent / "token.json"

if not SECRETS_FILE.exists():
    print(f"ERROR: No se encontró {SECRETS_FILE}")
    print("Descargá el client_secrets.json desde Google Cloud Console y colocalo en agents/")
    exit(1)

print("Abriendo browser para autenticarte con YouTube...")
flow = InstalledAppFlow.from_client_secrets_file(str(SECRETS_FILE), SCOPES)
creds = flow.run_local_server(port=0)

TOKEN_FILE.write_text(creds.to_json())
print(f"\nToken guardado en {TOKEN_FILE}")

print("\n" + "="*60)
print("COPIÁ ESTE CONTENIDO COMO SECRET 'YOUTUBE_TOKEN_JSON' EN GITHUB:")
print("="*60)
print(TOKEN_FILE.read_text())
print("="*60)
print("\nPasos:")
print("1. GitHub repo → Settings → Secrets and variables → Actions")
print("2. New repository secret")
print("3. Name: YOUTUBE_TOKEN_JSON")
print("4. Secret: pegá el JSON de arriba")
