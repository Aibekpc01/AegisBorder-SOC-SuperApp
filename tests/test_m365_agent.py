import json
import sys

import pytest

from scripts import pull_m365_audit as agent


def prepare(monkeypatch, tmp_path):
    for name in ("M365_TENANT_ID", "M365_CLIENT_ID"):
        monkeypatch.setenv(name, "00000000-0000-0000-0000-000000000001")
    monkeypatch.setenv("M365_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv("AEGIS_CONNECTOR_TOKEN", "test-receiver-key")
    state = tmp_path / "checkpoint.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "agent",
            "--endpoint",
            "https://aegis.example.test/api/v1/integrations/receivers/1/events",
            "--state",
            str(state),
        ],
    )
    return state


def test_batches_respect_count_and_size():
    rows = [{"id": i, "text": "x" * 1100} for i in range(301)]
    chunks = list(agent.batches(rows))
    assert [row for chunk in chunks for row in chunk] == rows
    assert all(len(chunk) <= 200 and len(json.dumps(chunk).encode()) <= 190_000 for chunk in chunks)
    with pytest.raises(ValueError):
        list(agent.batches([{"text": "x" * 200_000}]))


def test_sync_updates_checkpoint_only_after_ack(monkeypatch, tmp_path):
    state = prepare(monkeypatch, tmp_path)
    calls = []

    def request(url, token=None, data=None, form=False):
        calls.append(url)
        if form:
            return {"access_token": "graph-token"}
        if url.startswith("https://graph.microsoft.com"):
            assert token == "graph-token"
            return {
                "value": [
                    {
                        "id": "1",
                        "activityDateTime": "2026-10-15T00:00:00Z",
                        "initiatedBy": {"user": {"userPrincipalName": "test@example.test"}},
                        "activityDisplayName": "Add user",
                    }
                ]
            }
        assert token == "test-receiver-key"
        assert json.loads(data)[0]["id"] == "1"
        assert not state.exists()
        return {"created": 1, "duplicates": 0}

    monkeypatch.setattr(agent, "request_json", request)
    agent.main()
    assert state.exists() and len(calls) == 3


def test_sync_failure_preserves_checkpoint_and_does_not_forward_key(monkeypatch, tmp_path):
    state = prepare(monkeypatch, tmp_path)
    old = "2026-10-14T00:00:00+00:00"
    state.write_text(old)
    calls = []

    def request(url, token=None, data=None, form=False):
        calls.append(url)
        if form:
            return {"access_token": "graph-token"}
        return {"value": [], "@odata.nextLink": "https://attacker.example.test/steal-token"}

    monkeypatch.setattr(agent, "request_json", request)
    with pytest.raises(SystemExit):
        agent.main()
    assert state.read_text() == old
    assert all("attacker" not in url for url in calls)
