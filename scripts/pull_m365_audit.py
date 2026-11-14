# Назначение файла: Получает аудит Microsoft 365 и передаёт события в приложение при настроенных учётных данных.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""One authorised Microsoft Entra audit sync; schedule externally if required."""

import argparse
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request_json(url, token=None, data=None, form=False):
    headers = {"Content-Type": "application/x-www-form-urlencoded" if form else "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
    with build_opener(NoRedirect).open(request, timeout=30) as response:
        return json.load(response)


def batches(records, max_bytes=190_000):
    batch = []
    for row in records:
        if len(json.dumps([row]).encode()) > max_bytes:
            raise ValueError("An audit record exceeds receiver size; export selected fields")
        if batch and (len(batch) >= 200 or len(json.dumps(batch + [row]).encode()) > max_bytes):
            yield batch
            batch = []
        batch.append(row)
    if batch:
        yield batch


def main():
    parser = argparse.ArgumentParser(
        description="Sync Microsoft Entra directory audit to an Aegis m365 receiver"
    )
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--state", type=Path, default=Path("m365-checkpoint.json"))
    args = parser.parse_args()
    endpoint = urlsplit(args.endpoint)
    if (
        (
            endpoint.scheme != "https"
            and not (endpoint.scheme == "http" and endpoint.hostname in ("localhost", "127.0.0.1"))
        )
        or endpoint.username
        or endpoint.password
        or endpoint.query
        or endpoint.fragment
    ):
        raise SystemExit("Use a clean HTTPS receiver URL; HTTP allowed only on localhost")
    try:
        tenant = str(uuid.UUID(os.environ["M365_TENANT_ID"]))
        client = str(uuid.UUID(os.environ["M365_CLIENT_ID"]))
        secret = os.environ["M365_CLIENT_SECRET"]
        receiver_key = os.environ["AEGIS_CONNECTOR_TOKEN"]
    except (KeyError, ValueError):
        raise SystemExit(
            "Set valid M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET and AEGIS_CONNECTOR_TOKEN locally"
        ) from None
    start = datetime.now(timezone.utc)
    since = (
        datetime.fromisoformat(args.state.read_text().strip())
        if args.state.exists()
        else start - timedelta(hours=1)
    )
    if since.tzinfo is None:
        raise SystemExit("Checkpoint requires a timezone")
    since = (since - timedelta(minutes=5)).astimezone(timezone.utc).isoformat()
    try:
        token = request_json(
            f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            data=urlencode(
                {
                    "client_id": client,
                    "client_secret": secret,
                    "scope": "https://graph.microsoft.com/.default",
                    "grant_type": "client_credentials",
                }
            ).encode(),
            form=True,
        )["access_token"]
        url = "https://graph.microsoft.com/v1.0/auditLogs/directoryAudits?" + urlencode(
            {"$filter": f"activityDateTime ge {since}", "$top": "100"}
        )
        total = duplicates = 0
        for _ in range(50):
            target = urlsplit(url)
            if (
                target.scheme != "https"
                or target.netloc != "graph.microsoft.com"
                or not target.path.startswith("/v1.0/auditLogs/directoryAudits")
            ):
                raise ValueError("Unexpected pagination origin")
            page = request_json(url, token=token)
            # Only pass the supported audit fields; target resource details stay in Graph.
            records = [
                {
                    k: row.get(k)
                    for k in ("id", "activityDateTime", "initiatedBy", "activityDisplayName")
                }
                for row in page.get("value", [])
            ]
            for batch in batches(records):
                result = request_json(
                    args.endpoint, token=receiver_key, data=json.dumps(batch).encode()
                )
                total += result["created"]
                duplicates += result["duplicates"]
            url = page.get("@odata.nextLink")
            if not url:
                break
        else:
            raise ValueError("Pagination safety limit reached; checkpoint unchanged")
        # Only advance after every batch was acknowledged. Overlap + receiver dedup handles late records.
        args.state.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.state.with_suffix(args.state.suffix + ".tmp")
        temporary.write_text(start.isoformat(), encoding="utf-8")
        temporary.replace(args.state)
        print(f"Sync complete: created={total}, duplicates={duplicates}")
    except (HTTPError, URLError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(
            f"Sync failed ({type(error).__name__}); checkpoint unchanged. Check permissions, connectivity and receiver settings."
        ) from None


if __name__ == "__main__":
    main()
