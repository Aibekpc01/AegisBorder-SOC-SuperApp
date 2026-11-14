# Назначение файла: Настраивает публичный адрес приложения.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Read Quick Tunnel's public URL and update only PUBLIC_ORIGIN."""

import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
result = subprocess.run(
    [
        "docker",
        "compose",
        "-p",
        "aegis-public",
        "--env-file",
        ".env.public-demo",
        "-f",
        "compose.public-demo.yaml",
        "logs",
        "--tail",
        "80",
        "tunnel",
    ],
    cwd=root,
    capture_output=True,
    text=True,
    check=True,
)
urls = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", result.stdout + result.stderr)
if not urls:
    raise SystemExit("Tunnel URL is not ready; retry after tunnel connects")
url = urls[-1]
target = root / ".env.public-demo"
content = target.read_text(encoding="utf-8")
if not re.search(r"^PUBLIC_ORIGIN=", content, flags=re.MULTILINE):
    raise SystemExit("PUBLIC_ORIGIN is missing; existing credentials preserved")
target.write_text(
    re.sub(r"^PUBLIC_ORIGIN=.*$", "PUBLIC_ORIGIN=" + url, content, flags=re.MULTILINE),
    encoding="utf-8",
)
print(url)
