# Назначение файла: Проверяет агент Office 365 (scripts/pull_office365_audit.py) без обращения к Microsoft.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import json

import pytest

from scripts import pull_office365_audit as agent


def test_only_office_management_host_is_followed():
    assert agent.manage_url("https://manage.office.com/api/v1.0/t/activity/feed/x")
    for bad in ("http://manage.office.com/x", "https://evil.example/x", "https://manage.office.com.evil.example/x"):
        with pytest.raises(ValueError):
            agent.manage_url(bad)


def test_receiver_must_be_clean_https():
    agent.check_endpoint("https://aegis.example/api/v1/integrations/receivers/1/events")
    agent.check_endpoint("http://127.0.0.1:8000/api/v1/integrations/receivers/1/events")
    for bad in ("http://aegis.example/x", "https://user:pw@aegis.example/x", "https://aegis.example/x?token=1"):
        with pytest.raises(SystemExit):
            agent.check_endpoint(bad)


def test_trim_drops_mail_subject_and_body():
    row = {"Id": "1", "Workload": "Exchange", "Operation": "Send", "UserId": "a@b.kz",
           "Item": {"Subject": "секретная тема", "Attachments": "plan.zip (10b)", "Body": "текст"},
           "AffectedItems": [{"Subject": "x"}] * 3, "Unrelated": "drop"}
    out = agent.trim(row)
    text = json.dumps(out, ensure_ascii=False)
    assert "секретная" not in text and "текст" not in text and "Unrelated" not in out
    assert out["Item"] == {"Attachments": "plan.zip (10b)"} and len(out["AffectedItems"]) == 3


def test_sync_advances_checkpoint_only_after_delivery(monkeypatch, tmp_path):
    state = tmp_path / "state.json"
    sent = []

    def fake_call(url, token=None, data=None, form=False, method=None):
        if "subscriptions/content" in url:
            return [{"contentUri": "https://manage.office.com/api/v1.0/t/activity/feed/audit/1"}], {}
        if "/audit/1" in url:
            return [{"Id": "r1", "Workload": "OneDrive", "Operation": "FileDownloaded"}], {}
        sent.append(json.loads(data))
        return {"created": len(sent[-1]), "duplicates": 0}, {}

    monkeypatch.setattr(agent, "call", fake_call)
    created, duplicates = agent.sync_once("https://manage.office.com/api/v1.0/t/activity/feed", "tok",
                                         "https://aegis.example/r", "key", state)
    assert created == len(agent.CONTENT_TYPES) and duplicates == 0
    assert set(json.loads(state.read_text())) == set(agent.CONTENT_TYPES)

    def failing(url, token=None, data=None, form=False, method=None):
        raise ValueError("receiver down")

    before = state.read_text()
    monkeypatch.setattr(agent, "call", failing)
    with pytest.raises(ValueError):
        agent.sync_once("https://manage.office.com/api/v1.0/t/activity/feed", "tok", "https://aegis.example/r", "key", state)
    assert state.read_text() == before
