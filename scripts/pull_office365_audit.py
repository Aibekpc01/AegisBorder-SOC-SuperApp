# Назначение файла: Агент Office 365 — забирает единый журнал аудита (почта, SharePoint, OneDrive, Teams,
# Entra ID, DLP) через Office 365 Management Activity API и передаёт записи в приёмник Aegis «m365».
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Синхронизация аудита Office 365 → Aegis.

Требования на стороне Microsoft: регистрация приложения в Entra ID с разрешением
Office 365 Management APIs → ActivityFeed.Read (и ActivityFeed.ReadDlp для DLP), включённый аудит.

Переменные окружения: M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET, AEGIS_CONNECTOR_TOKEN.

Запуск один раз:      python scripts/pull_office365_audit.py --endpoint https://.../events
Непрерывный режим:    python scripts/pull_office365_audit.py --endpoint ... --watch 60

Задержка появления записей определяется Microsoft (обычно от нескольких минут); агент опрашивает
журнал с заданным интервалом, поэтому мониторинг работает в режиме, близком к реальному времени.
"""

import argparse
import json
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

CONTENT_TYPES = ("Audit.Exchange", "Audit.SharePoint", "Audit.AzureActiveDirectory", "Audit.General", "DLP.All")
MANAGE_HOST = "manage.office.com"
# Передаются только поля, нужные для анализа. Темы и тексты писем не отправляются.
FIELDS = (
    "Id", "CreationTime", "Workload", "Operation", "UserId", "ClientIP", "ObjectId",
    "SourceFileName", "SourceFileExtension", "TargetUserOrGroupType", "OperationCount",
    "Parameters", "Members", "Recipients",
)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def call(url, token=None, data=None, form=False, method=None):
    headers = {"Content-Type": "application/x-www-form-urlencoded" if form else "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = Request(url, data=data, headers=headers, method=method or ("POST" if data is not None else "GET"))
    with build_opener(NoRedirect).open(request, timeout=30) as response:
        body = response.read()
        return (json.loads(body) if body else None), response.headers


def manage_url(url):
    """Разрешены только адреса API управления Office 365 по HTTPS."""
    target = urlsplit(url)
    if target.scheme != "https" or target.hostname != MANAGE_HOST:
        raise ValueError("Unexpected content origin")
    return url


def check_endpoint(url):
    endpoint = urlsplit(url)
    local = endpoint.scheme == "http" and endpoint.hostname in ("localhost", "127.0.0.1")
    if (endpoint.scheme != "https" and not local) or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment:
        raise SystemExit("Use a clean HTTPS receiver URL; HTTP allowed only on localhost")


def trim(row):
    """Оставляет разрешённые поля и сводку вложений письма (имена файлов, без темы)."""
    out = {k: row[k] for k in FIELDS if k in row}
    item = row.get("Item")
    if isinstance(item, dict) and item.get("Attachments"):
        out["Item"] = {"Attachments": str(item["Attachments"])[:1000]}
    affected = row.get("AffectedItems")
    if isinstance(affected, list):
        out["AffectedItems"] = [{} for _ in affected[:5000]]
    return out


def batches(records, max_bytes=190_000):
    batch = []
    for row in records:
        if len(json.dumps([row]).encode()) > max_bytes:
            continue  # слишком большая запись пропускается, чтобы не блокировать остальные
        if batch and (len(batch) >= 200 or len(json.dumps(batch + [row]).encode()) > max_bytes):
            yield batch
            batch = []
        batch.append(row)
    if batch:
        yield batch


def token_for(tenant, client, secret):
    data = urlencode({
        "client_id": client, "client_secret": secret,
        "scope": f"https://{MANAGE_HOST}/.default", "grant_type": "client_credentials",
    }).encode()
    result, _ = call(f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token", data=data, form=True)
    return result["access_token"]


def ensure_subscriptions(feed, token):
    for content_type in CONTENT_TYPES:
        try:
            call(manage_url(f"{feed}/subscriptions/start?contentType={content_type}"), token=token, data=b"")
        except HTTPError as error:
            if error.code != 400:  # 400 — подписка уже включена
                raise


def sync_once(feed, token, endpoint, receiver_key, state):
    checkpoints = json.loads(state.read_text()) if state.exists() else {}
    now = datetime.now(timezone.utc)
    created = duplicates = 0
    for content_type in CONTENT_TYPES:
        # API отдаёт не более 24 часов за запрос; перекрытие 5 минут ловит поздние записи (дубли отсеет приёмник).
        since = datetime.fromisoformat(checkpoints.get(content_type, (now - timedelta(hours=1)).isoformat()))
        since = max(since - timedelta(minutes=5), now - timedelta(hours=23))
        url = manage_url(f"{feed}/subscriptions/content?" + urlencode({
            "contentType": content_type,
            "startTime": since.strftime("%Y-%m-%dT%H:%M:%S"),
            "endTime": now.strftime("%Y-%m-%dT%H:%M:%S"),
        }))
        for _ in range(100):
            blobs, headers = call(url, token=token)
            for blob in blobs or []:
                records, _ = call(manage_url(blob["contentUri"]), token=token)
                for batch in batches([trim(r) for r in records or []]):
                    result, _ = call(endpoint, token=receiver_key, data=json.dumps(batch).encode())
                    created += result["created"]
                    duplicates += result["duplicates"]
            url = headers.get("NextPageUri")
            if not url:
                break
            url = manage_url(url)
        else:
            raise ValueError("Pagination safety limit reached; checkpoint unchanged")
        # Контрольная точка сдвигается только после доставки всех записей этого типа.
        checkpoints[content_type] = now.isoformat()
        temporary = state.with_suffix(state.suffix + ".tmp")
        temporary.write_text(json.dumps(checkpoints), encoding="utf-8")
        temporary.replace(state)
    return created, duplicates


def main():
    parser = argparse.ArgumentParser(description="Sync Office 365 unified audit log to an Aegis m365 receiver")
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--state", type=Path, default=Path("office365-checkpoint.json"))
    parser.add_argument("--watch", type=int, default=0, help="poll interval in seconds (≥ 30); 0 = run once")
    args = parser.parse_args()
    check_endpoint(args.endpoint)
    if args.watch and args.watch < 30:
        raise SystemExit("Use --watch 30 or more seconds")
    try:
        tenant = str(uuid.UUID(os.environ["M365_TENANT_ID"]))
        client = str(uuid.UUID(os.environ["M365_CLIENT_ID"]))
        secret = os.environ["M365_CLIENT_SECRET"]
        receiver_key = os.environ["AEGIS_CONNECTOR_TOKEN"]
    except (KeyError, ValueError):
        raise SystemExit(
            "Set valid M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET and AEGIS_CONNECTOR_TOKEN locally"
        ) from None
    feed = f"https://{MANAGE_HOST}/api/v1.0/{tenant}/activity/feed"
    args.state.parent.mkdir(parents=True, exist_ok=True)
    while True:
        try:
            token = token_for(tenant, client, secret)
            ensure_subscriptions(feed, token)
            created, duplicates = sync_once(feed, token, args.endpoint, receiver_key, args.state)
            print(f"{datetime.now():%H:%M:%S} sync complete: created={created}, duplicates={duplicates}", flush=True)
        except (HTTPError, URLError, ValueError, KeyError, TypeError) as error:
            message = f"Sync failed ({type(error).__name__}); checkpoint unchanged. Check permissions, connectivity and receiver."
            if not args.watch:
                raise SystemExit(message) from None
            print(message, flush=True)
        if not args.watch:
            return
        time.sleep(args.watch)


if __name__ == "__main__":
    main()
