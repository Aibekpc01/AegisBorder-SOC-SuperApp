# Назначение файла: Проверяет подсистему workspace. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import pytest
from sqlalchemy import select

from app.command.models import DocumentVersion, WorkspaceDocument

BASE = "/api/v1/workspace/documents"


def new_doc(admin, **kwargs):
    response = admin.post(BASE, json={"title": "Материалы проверки", **kwargs})
    assert response.status_code == 201, response.text
    return response.json()


def payload(doc, **kwargs):
    return {
        key: kwargs.get(key, doc[key])
        for key in ("revision", "title", "content", "incident_id", "assignee_id", "status")
    }


def test_document_persistence_versions_search_and_comment(admin):
    doc = new_doc(admin)
    content = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": "Синтетическое доказательство",
                        "marks": [{"type": "bold"}],
                    }
                ],
            }
        ],
    }
    saved = admin.put(f"{BASE}/{doc['id']}", json=payload(doc, content=content))
    assert saved.status_code == 200, saved.text
    assert saved.json()["revision"] == 2
    assert admin.get(f"{BASE}/{doc['id']}").json()["content"] == content
    assert admin.get(BASE, params={"q": "доказательство"}).json()[0]["id"] == doc["id"]
    assert (
        admin.post(
            f"{BASE}/{doc['id']}/comments", json={"text": "Проверено оператором"}
        ).status_code
        == 201
    )
    assert admin.get(f"{BASE}/{doc['id']}").json()["comments"][0]["text"] == "Проверено оператором"
    versions = admin.get(f"{BASE}/{doc['id']}/versions").json()
    assert [v["revision"] for v in versions] == [2, 1]
    assert versions[1]["snapshot"]["content"] != content
    assert "digest" not in versions[0]
    # Неизменённый документ не создаёт лишнюю версию.
    assert admin.put(f"{BASE}/{doc['id']}", json=payload(saved.json())).json()["revision"] == 2
    assert any("Workspace" in a["action"] for a in admin.get("/api/v1/audit").json())


def test_document_conflict_and_approved_protection(admin):
    doc = new_doc(admin)
    assert (
        admin.put(f"{BASE}/{doc['id']}", json=payload(doc, status="Утверждён")).status_code == 409
    )
    review = admin.put(f"{BASE}/{doc['id']}", json=payload(doc, status="На проверке")).json()
    assert (
        admin.put(f"{BASE}/{doc['id']}", json=payload(doc, title="Устаревшая копия")).status_code
        == 409
    )
    approved = admin.put(f"{BASE}/{doc['id']}", json=payload(review, status="Утверждён")).json()
    assert (
        admin.put(f"{BASE}/{doc['id']}", json=payload(approved, title="Подмена")).status_code == 409
    )
    assert (
        admin.put(
            f"{BASE}/{doc['id']}", json=payload(approved, title="Подмена", status="Черновик")
        ).status_code
        == 409
    )
    draft = admin.put(f"{BASE}/{doc['id']}", json=payload(approved, status="Черновик")).json()
    assert draft["status"] == "Черновик"
    assert (
        admin.put(f"{BASE}/{doc['id']}", json=payload(draft, title="Дополнение")).status_code == 200
    )


@pytest.mark.parametrize(
    "node",
    [
        {"type": "image", "attrs": {"src": "https://external.invalid/pixel"}},
        {"type": "paragraph", "attrs": {"onclick": "alert(1)"}},
        {
            "type": "text",
            "text": "x",
            "marks": [{"type": "link", "attrs": {"href": "javascript:alert(1)"}}],
        },
        {"type": "table", "content": [{"type": "text", "text": "bad structure"}]},
    ],
)
def test_document_rejects_unsafe_content(admin, node):
    doc = new_doc(admin)
    content = {"type": "doc", "content": [node]}
    assert admin.put(f"{BASE}/{doc['id']}", json=payload(doc, content=content)).status_code == 422
    assert admin.get(f"{BASE}/{doc['id']}").json()["revision"] == 1


def test_table_and_literal_html_are_safe_data(admin):
    doc = new_doc(admin)
    content = {
        "type": "doc",
        "content": [
            {
                "type": "table",
                "content": [
                    {
                        "type": "tableRow",
                        "content": [
                            {
                                "type": "tableCell",
                                "attrs": {
                                    "colspan": 1,
                                    "rowspan": 1,
                                    "colwidth": None,
                                    "align": None,
                                },
                                "content": [
                                    {
                                        "type": "paragraph",
                                        "content": [
                                            {"type": "text", "text": "<script>alert(1)</script>"}
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }
        ],
    }
    response = admin.put(f"{BASE}/{doc['id']}", json=payload(doc, content=content))
    assert response.status_code == 200
    assert response.json()["content"] == content


def test_document_integrity_detects_database_tampering(admin):
    doc = new_doc(admin)
    with admin.factory() as db:
        db.get(WorkspaceDocument, doc["id"]).title = "Подмена без API"
        db.commit()
    assert admin.get(f"{BASE}/{doc['id']}").status_code == 409


def test_version_integrity_detects_database_tampering(admin):
    doc = new_doc(admin)
    with admin.factory() as db:
        version = db.scalar(select(DocumentVersion).where(DocumentVersion.document_id == doc["id"]))
        version.snapshot = {"title": "Подмена"}
        db.commit()
    assert admin.get(f"{BASE}/{doc['id']}/versions").status_code == 409


def test_demo_isolation_and_preservation_after_reset(admin):
    global_doc = new_doc(admin)
    for name in ("demo_one", "demo_two"):
        assert (
            admin.post(
                "/api/v1/users",
                json={"username": name, "password": "DemoTestPassword123!", "role": "demo"},
            ).status_code
            == 200
        )
    assert (
        admin.post(
            "/api/v1/auth/login", json={"username": "demo_one", "password": "DemoTestPassword123!"}
        ).status_code
        == 200
    )
    demo = admin.post("/api/v1/demo-sessions").json()
    run = admin.post("/api/v1/scenarios/bruteforce", json={"demo_id": demo["id"]}).json()
    doc = new_doc(admin, incident_id=run["incidents"][0])
    assert doc["demo_only"]
    assert admin.get(f"{BASE}/{global_doc['id']}").status_code == 404
    assert admin.post(f"/api/v1/demo-sessions/{demo['id']}/reset").status_code == 200
    saved = admin.get(f"{BASE}/{doc['id']}").json()
    assert saved["incident_id"] is None
    assert saved["demo_only"] and saved["revision"] == 2
    assert (
        admin.post(
            "/api/v1/auth/login", json={"username": "demo_two", "password": "DemoTestPassword123!"}
        ).status_code
        == 200
    )
    assert admin.get(BASE).json() == []
    assert admin.get(f"{BASE}/{doc['id']}").status_code == 404
    assert admin.get(f"{BASE}/{doc['id']}/versions").status_code == 404
    assert admin.put(f"{BASE}/{doc['id']}", json=payload(saved)).status_code == 404


def test_document_observer_read_only_and_assignee_access(admin):
    doc = new_doc(admin)
    users = {}
    for role in ("observer", "analyst"):
        response = admin.post(
            "/api/v1/users",
            json={"username": role + "_docs", "password": "DocsPassword123!", "role": role},
        )
        users[role] = response.json()["id"]
    assigned = admin.put(
        f"{BASE}/{doc['id']}", json=payload(doc, assignee_id=users["analyst"])
    ).json()
    admin.post(
        "/api/v1/auth/login", json={"username": "observer_docs", "password": "DocsPassword123!"}
    )
    assert not admin.get(f"{BASE}/{doc['id']}").json()["can_edit"]
    assert admin.post(BASE, json={"title": "Запрещено"}).status_code == 403
    assert admin.put(f"{BASE}/{doc['id']}", json=payload(assigned)).status_code == 403
    assert admin.post(f"{BASE}/{doc['id']}/comments", json={"text": "Запрещено"}).status_code == 403
    admin.post(
        "/api/v1/auth/login", json={"username": "analyst_docs", "password": "DocsPassword123!"}
    )
    assert admin.get(f"{BASE}/{doc['id']}").json()["can_edit"]
    assert (
        admin.put(
            f"{BASE}/{doc['id']}", json=payload(assigned, title="Проверено ответственным")
        ).status_code
        == 200
    )
