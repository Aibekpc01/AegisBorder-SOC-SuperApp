# Назначение файла: Проверяет подсистему endpoint_agent. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import json
from io import BytesIO

import pytest

from agents.windows.endpoint_agent import (
    enqueue,
    queue_open,
    send_pending,
    translate,
    validate_endpoint,
)


def sample():
    return {"status": {"antivirus": True, "realtime": True, "service": True, "signatures_age": 0},
            "threats": [{"id": "test-only-detection", "threat_id": "123", "time": "2026-10-15T10:00:00Z", "action_success": False}]}


def test_offline_queue_is_persistent_deduplicated_and_contains_no_files(tmp_path):
    events = translate(sample(), "TEST-DEVICE", "operator", "2026-10-15T10:00:01Z")
    dbpath = tmp_path / "queue.sqlite"
    with queue_open(dbpath) as db:
        enqueue(db, events)
        enqueue(db, events)
    with queue_open(dbpath) as db:
        assert db.execute("SELECT count(*) FROM events WHERE sent=0").fetchone()[0] == 2
    assert len(events[1]["external_id"]) <= 80
    assert events[1]["type"] == "malware_detected"
    assert "Resources" not in json.dumps(events) and "password" not in json.dumps(events)
    changed = sample()
    changed["threats"][0]["action_success"] = True
    assert translate(changed, "TEST-DEVICE", "operator")[1]["external_id"] != events[1]["external_id"]


class Response(BytesIO):
    status = 201


class Opener:
    def __init__(self, count):
        self.count = count
    def open(self, request, timeout):
        assert request.headers["Authorization"] == "Bearer test-key"
        assert timeout == 20
        return Response(json.dumps({"created": self.count, "duplicates": 0}).encode())


def test_delivery_only_acknowledges_complete_batch_and_preserves_id_ledger(tmp_path):
    endpoint = "https://example.invalid/api/v1/integrations/receivers/1/events"
    events = translate(sample(), "TEST-DEVICE", "operator")
    with queue_open(tmp_path / "queue.sqlite") as db:
        enqueue(db, events)
        with pytest.raises(RuntimeError):
            send_pending(db, endpoint, "test-key", Opener(1))
        assert db.execute("SELECT count(*) FROM events WHERE sent=0").fetchone()[0] == 2
        assert send_pending(db, endpoint, "test-key", Opener(2)) == 2
        enqueue(db, events)
        assert db.execute("SELECT count(*) FROM events WHERE sent=0").fetchone()[0] == 0


@pytest.mark.parametrize("url", ["http://example.invalid/api/v1/integrations/receivers/1/events", "https://key@example.invalid/api/v1/integrations/receivers/1/events", "https://example.invalid/other", "https://example.invalid/api/v1/integrations/receivers/1/events?token=key"])
def test_receiver_rejects_unsafe_transport_or_credential_urls(url):
    with pytest.raises(ValueError):
        validate_endpoint(url)
