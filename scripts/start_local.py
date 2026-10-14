"""Локальный запуск без Docker. Секреты читаются из .env без вывода."""

import argparse
import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description="Локальный запуск AegisBorder SOC")
parser.add_argument("--port", type=int, default=8000)
args = parser.parse_args()
os.chdir(root)
load_dotenv(root / ".env")
os.environ.setdefault("DATABASE_URL", "sqlite:///./aegisborder_local.db")
subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
subprocess.run(
    [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(args.port),
        "--no-proxy-headers",
    ],
    check=True,
)
