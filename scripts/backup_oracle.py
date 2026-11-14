# Назначение файла: Создаёт резервную копию серверной базы и проверяет параметры подключения.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Create a PostgreSQL custom-format backup; keep .env.oracle separately."""

import argparse
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def backup(root, project="aegis-oracle", env_file=".env.oracle", compose_files=None):
    root = Path(root).resolve()
    command = ["docker", "compose", "-p", project, "--env-file", env_file]
    for filename in compose_files or ["compose.oracle.yaml"]:
        command.extend(["-f", filename])
    command.extend(["exec", "-T", "db", "pg_dump", "-U", "aegis", "-d", "aegisborder", "-Fc"])
    folder = root / "backups"
    folder.mkdir(exist_ok=True)
    name = "oracle-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".dump"
    target = folder / name
    temporary = folder / (name + ".partial")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as output:
            subprocess.run(
                command,
                cwd=root,
                stdout=output,
                check=True,
            )
        if temporary.stat().st_size == 0:
            raise RuntimeError("Backup is empty")
        temporary.replace(target)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return target


def main(argv=None):
    parser = argparse.ArgumentParser(description="Create a private PostgreSQL backup without changing the database")
    parser.add_argument("--project", default="aegis-oracle", help="Existing Docker Compose project name")
    parser.add_argument("--env-file", default=".env.oracle", help="Existing Compose environment file; contents are not printed")
    parser.add_argument("--compose-file", action="append", help="Compose file; repeat in the same order as the running deployment")
    args = parser.parse_args(argv)
    target = backup(Path(__file__).resolve().parents[1], args.project, args.env_file, args.compose_file)
    print("Backup created: " + str(target))


if __name__ == "__main__":
    main()
