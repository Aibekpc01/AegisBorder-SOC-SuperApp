# Назначение файла: Готовит конфигурацию окружения для размещения на Oracle.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Generate server-local secrets, without printing or replacing them."""

import argparse
import os
import re
import secrets
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Create server-local .env.oracle")
    parser.add_argument(
        "--domain", required=True, help="DNS hostname only, without https:// or path"
    )
    args = parser.parse_args()
    hostname = args.domain.lower()
    if len(hostname) > 253 or not re.fullmatch(
        r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", hostname
    ):
        raise SystemExit("Provide a DNS hostname without protocol, port or path")
    target = Path(__file__).resolve().parents[1] / ".env.oracle"
    try:
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        raise SystemExit(".env.oracle already exists; existing passwords preserved") from None
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        stream.write("AEGIS_DOMAIN=" + hostname + "\n")
        for name in ("DB_PASSWORD", "ADMIN_PASSWORD", "AUDIT_KEY"):
            stream.write(f"{name}={secrets.token_hex(32)}\n")
    print("Created .env.oracle on this machine. Passwords were not printed or uploaded.")


if __name__ == "__main__":
    main()
