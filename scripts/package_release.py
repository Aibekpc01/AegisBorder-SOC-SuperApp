# Назначение файла: Собирает поставку приложения по разрешённому списку файлов и добавляет сведения для проверки комплекта.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Package only allowlisted source/runtime files; never include local data or secrets."""

import argparse
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_IMAGE = "aegisborder-superapp:0.3.0-local"
DB_IMAGE = (
    "postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea"
)


def selected_files():
    files = []
    for folder in ("app", "migrations", "scripts", "docs", "frontend/src", "frontend/e2e", "tests", "deploy"):
        for path in (ROOT / folder).rglob("*"):
            if path.is_file() and not any(
                part in {"__pycache__", "node_modules", "test-results"} for part in path.parts
            ):
                if path.name == "Caddyfile" or path.suffix.lower() in {
                    ".py",
                    ".tsx",
                    ".ts",
                    ".css",
                    ".html",
                    ".js",
                    ".md",
                    ".svg",
                    ".png",
                    ".json",
                    ".bat",
                    ".ps1",
                }:
                    files.append(path)
    for name in (
        "README.md",
        "Dockerfile",
        "compose.yaml",
        "compose.offline.yaml",
        "compose.public-demo.yaml",
        "compose.oracle.yaml",
        "render.yaml",
        ".env.example",
        ".env.oracle.example",
        ".dockerignore",
        ".gitignore",
        "alembic.ini",
        "pyproject.toml",
        "requirements.lock-linux.txt",
        "requirements.lock-windows.txt",
        "frontend/package.json",
        "frontend/package-lock.json",
        "frontend/index.html",
        "frontend/tsconfig.json",
        "frontend/vite.config.ts",
        "frontend/vitest.config.ts",
        "frontend/playwright.config.ts",
        "frontend/eslint.config.js",
    ):
        path = ROOT / name
        if path.is_file():
            files.append(path)
    return sorted(set(files))


def digest(path):
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Сборка локального релизного пакета SuperApp")
    parser.add_argument("--with-images", action="store_true")
    args = parser.parse_args()
    if not (ROOT / "app/web/index.html").is_file():
        raise SystemExit("Сначала соберите frontend и скопируйте dist в app/web")
    destination = ROOT / "release"
    destination.mkdir(exist_ok=True)
    archive = destination / "AegisBorder-SuperApp-0.3.0.zip"
    files = selected_files()
    manifest = {p.relative_to(ROOT).as_posix(): digest(p) for p in files}
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for path in files:
            bundle.write(path, path.relative_to(ROOT).as_posix())
        bundle.writestr("MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    artifacts = {archive.name: digest(archive)}
    if args.with_images:
        subprocess.run(["docker", "tag", "aegisborder_soc_v02-app:latest", APP_IMAGE], check=True)
        images = destination / "docker-images.tar"
        subprocess.run(["docker", "save", "-o", str(images), APP_IMAGE, DB_IMAGE], check=True)
        artifacts[images.name] = digest(images)
    (destination / "SHA256SUMS.json").write_text(json.dumps(artifacts, indent=2), encoding="utf-8")
    print("Пакет создан в release. .env, базы, дампы и личные данные не включены.")
    print(
        "Docker-образы включены."
        if args.with_images
        else "Docker-образы не включены; для изолированной сети используйте --with-images."
    )


if __name__ == "__main__":
    main()
