"""Create a PostgreSQL custom-format backup; keep .env.oracle separately."""

import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    folder = root / "backups"
    folder.mkdir(exist_ok=True)
    name = "oracle-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".dump"
    target = folder / name
    temporary = folder / (name + ".partial")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as output:
            subprocess.run(
                [
                    "docker",
                    "compose",
                    "-p",
                    "aegis-oracle",
                    "--env-file",
                    ".env.oracle",
                    "-f",
                    "compose.oracle.yaml",
                    "exec",
                    "-T",
                    "db",
                    "pg_dump",
                    "-U",
                    "aegis",
                    "-d",
                    "aegisborder",
                    "-Fc",
                ],
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
    print("Backup created: " + str(target))


if __name__ == "__main__":
    main()
