"""Run the isolated ULTRA preview; never connect to the deployment database."""
import os
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
preview = ROOT / "release" / "aegis-ultra"
preview.mkdir(parents=True, exist_ok=True)
access = ROOT / ".env.ultra-preview"
if access.exists():
    from dotenv import dotenv_values
    password = dotenv_values(access)["ADMIN_PASSWORD"]
else:
    password = secrets.token_urlsafe(30)
    access.write_text("ADMIN_PASSWORD=" + password + "\n", encoding="utf-8")
    access.chmod(0o600)
os.environ["DATABASE_URL"] = "sqlite:///" + (preview / "preview.sqlite").as_posix()
os.environ["ADMIN_PASSWORD"] = password
# The audit key must persist across preview restarts too.
keyfile = preview / "preview-audit.key"
if not keyfile.exists():
    keyfile.write_text(secrets.token_hex(32), encoding="ascii")
    keyfile.chmod(0o600)
os.environ["AUDIT_KEY"] = keyfile.read_text(encoding="ascii")
os.environ["PUBLIC_ORIGIN"] = "http://127.0.0.1:5174"
os.environ["PUBLIC_DEMO_MODE"] = "true"
import sys

sys.path.insert(0, str(ROOT))
from app.command.api import app
from app.command.db import Base, engine

Base.metadata.create_all(engine)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8011)
