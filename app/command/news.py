# Назначение файла: Получает и подготавливает новости для отображения в приложении.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Public CERT-EU advisories, fetched at most once per five minutes per process."""
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from fastapi import APIRouter, Depends

from .security import current

router = APIRouter(prefix="/api/v1/news", tags=["news"])
FEED = "https://cert.europa.eu/publications/security-advisories-rss"
lock = threading.Lock()
cache = {"items": [], "updated_at": None}
next_refresh = 0.0


def parse_feed(data):
    if len(data) > 2_000_000 or b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise ValueError("Unsupported feed")
    root = ElementTree.fromstring(data)
    result = []
    for item in root.findall(".//item")[:12]:
        link = (item.findtext("link") or "").strip()
        url = urlparse(link)
        if url.scheme != "https" or url.hostname not in ("cert.europa.eu", "www.cert.europa.eu"):
            continue
        result.append({"title": (item.findtext("title") or "Публикация CERT-EU")[:300],
                       "url": link, "published": (item.findtext("pubDate") or "")[:100],
                       "source": "CERT-EU"})
    if not result:
        raise ValueError("Empty feed")
    return result


def fetch_feed():
    request = Request(FEED, headers={"User-Agent": "AegisBorder-SuperApp/0.3"})
    with urlopen(request, timeout=6) as response:
        return parse_feed(response.read(2_000_001))


@router.get("")
def news(user=Depends(current)):
    global next_refresh
    with lock:
        if time.monotonic() >= next_refresh:
            try:
                items = fetch_feed()
                cache.update(items=items, updated_at=datetime.now(timezone.utc).isoformat(), error=None)
            except Exception:
                cache["error"] = "Источник временно недоступен. Сохранены последние полученные публикации."
            next_refresh = time.monotonic() + 300
        return {**cache, "stale": bool(cache.get("error")), "refresh_seconds": 300,
                "source_url": "https://cert.europa.eu/publications/security-advisories"}
