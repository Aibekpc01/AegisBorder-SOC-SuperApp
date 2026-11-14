# Назначение файла: Собирает архив исходников с пояснениями и SHA-256-манифестом; исключает рабочие .env, базы, зависимости и сборки.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Собирает исходники с пояснениями, без локальных данных и зависимостей."""

import hashlib
import json
import os
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = ("app", "agents", "frontend", "migrations", "scripts", "tests", "deploy", "docs")
SKIP = {"node_modules", "__pycache__", "dist", "bin", "obj", "test-results", "playwright-report", ".pytest_cache", ".ruff_cache", ".git", ".venv"}
EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".json", ".md", ".txt", ".cs", ".ps1", ".bat", ".svg", ".png", ".jpg", ".jpeg", ".ico", ".toml", ".yaml", ".yml", ".ini", ".mako"}
ROOT_FILES = ("README.md", "SOURCE_GUIDE.md", "Dockerfile", "compose.yaml", "compose.oracle.yaml", "compose.offline.yaml", "compose.public-demo.yaml", "render.yaml", "alembic.ini", "pyproject.toml", "requirements.txt", "requirements-dev.txt", "requirements.lock-linux.txt", "requirements.lock-windows.txt", ".env.example", ".env.oracle.example", ".gitignore", ".dockerignore", "Запустить.bat", "Запустить локально.bat", "Остановить.bat")


def source_files():
    """Берём код, настройки сборки и изображения; служебные каталоги пропускаем."""
    selected = {ROOT / name for name in ROOT_FILES if (ROOT / name).is_file()}
    for folder in FOLDERS:
        for directory, children, names in os.walk(ROOT / folder):
            children[:] = [name for name in children if name not in SKIP and not (Path(directory) / name).is_symlink()]
            for name in names:
                path = Path(directory) / name
                if path.is_symlink() or name.startswith(".env") or name.lower() in {"enrollment.json", "stage-input.json"}:
                    continue
                if path.suffix.lower() in EXTENSIONS or path.name == "Caddyfile":
                    selected.add(path)
    return sorted(selected)


def main():
    output = ROOT / "release" / "documented-source"
    output.mkdir(parents=True, exist_ok=True)
    archive = output / "AegisBorder_DLP_r7_source.zip"
    manifest = []
    # Корневая папка позволяет распаковать архив без смешивания с другими файлами.
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for path in source_files():
            relative = path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            bundle.writestr("AegisBorder_DLP_r7/" + relative, data)
            manifest.append({"path": relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
        bundle.writestr("AegisBorder_DLP_r7/SOURCE_MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"Archive: {archive}")
    print(f"Files: {len(manifest)}; size: {archive.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
