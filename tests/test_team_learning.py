# Назначение файла: Проверяет подсистему team_learning. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import uuid

from sqlalchemy import select

from app.command.models import User, UserProfile
from app.command.superapp_models import TeamMessage

BASE = "/api/v1/superapp"


def create_account(client, name, role):
    response = client.post(
        "/api/v1/users", json={"username": name, "password": "team-test-password-123", "role": role}
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def login(client, name):
    client.post("/api/v1/auth/logout")
    assert (
        client.post(
            "/api/v1/auth/login", json={"username": name, "password": "team-test-password-123"}
        ).status_code
        == 200
    )


def message(text="Учебное обсуждение", channel="general", **kwargs):
    return {"text": text, "channel": channel, "client_id": str(uuid.uuid4()), **kwargs}


def test_shared_chat_deduplication_channels_and_no_private_profile_fields(admin):
    analyst = create_account(admin, "team_analyst", "analyst")
    with admin.factory() as db:
        profile = db.get(UserProfile, analyst)
        profile.full_name = "Учебный аналитик"
        profile.email = "private@example.test"
        profile.phone = "+70000000000"
        db.commit()
    payload = message()
    response = admin.post(BASE + "/team/messages", json=payload)
    assert response.status_code == 201, response.text
    original = response.json()
    assert admin.post(BASE + "/team/messages", json=payload).json()["id"] == original["id"]
    assert (
        admin.post(BASE + "/team/messages", json={**payload, "text": "Другая запись"}).status_code
        == 409
    )
    login(admin, "team_analyst")
    assert admin.get(BASE + "/team/messages").json()["messages"][0]["id"] == original["id"]
    assert admin.get(BASE + "/team/messages?channel=learning").json()["messages"] == []
    member = next(m for m in admin.get(BASE + "/team").json()["members"] if m["id"] == analyst)
    assert member["full_name"] == "Учебный аналитик"
    assert "email" not in member and "phone" not in member and "ip" not in member
    assert admin.get("/api/v1/audit/verify").json()["valid"]


def test_demo_chat_isolation_and_read_only_observer(admin):
    for name, role in (
        ("chat_demo_a", "demo"),
        ("chat_demo_b", "demo"),
        ("chat_observer", "observer"),
    ):
        create_account(admin, name, role)
    shared = admin.post(BASE + "/team/messages", json=message("Общая учебная запись")).json()
    login(admin, "chat_demo_a")
    assert len(admin.get(BASE + "/team").json()["members"]) == 1
    assert admin.get(BASE + "/team/messages").json()["messages"] == []
    private = admin.post(BASE + "/team/messages", json=message("Личная учебная запись")).json()
    login(admin, "chat_demo_b")
    assert admin.get(BASE + "/team/messages").json()["messages"] == []
    login(admin, "chat_observer")
    items = admin.get(BASE + "/team/messages").json()["messages"]
    assert [m["id"] for m in items] == [shared["id"]]
    assert private["id"] not in [m["id"] for m in items]
    assert admin.post(BASE + "/team/messages", json=message()).status_code == 403


def test_chat_validation_and_literal_text(admin):
    assert admin.post(BASE + "/team/messages", json=message("   ")).status_code == 422
    assert admin.post(BASE + "/team/messages", json=message("x" * 2001)).status_code == 422
    assert admin.post(BASE + "/team/messages", json=message(private=True)).status_code == 422
    assert admin.get(BASE + "/team/messages?channel=other").status_code == 422
    text = "<script>window.example=true</script>"
    response = admin.post(BASE + "/team/messages", json=message(text))
    assert response.status_code == 201 and response.json()["text"] == text


def test_chat_pagination_is_bounded_and_ordered(admin):
    with admin.factory() as db:
        author = db.scalar(select(User).where(User.username == "admin"))
        for index in range(105):
            db.add(
                TeamMessage(
                    author_id=author.id,
                    client_id=str(uuid.uuid4()),
                    channel="general",
                    private=False,
                    text=str(index),
                )
            )
        db.commit()
    latest = admin.get(BASE + "/team/messages").json()
    assert len(latest["messages"]) == 100 and latest["has_older"]
    assert latest["messages"][0]["text"] == "5" and latest["messages"][-1]["text"] == "104"
    older = admin.get(
        BASE + "/team/messages", params={"before": latest["messages"][0]["id"]}
    ).json()
    assert len(older["messages"]) == 5 and not older["has_older"]


def test_expanded_learning_material_and_server_grading(admin):
    courses = admin.get(BASE + "/academy").json()
    assert len(courses) == 12 and len({c["id"] for c in courses}) == 12
    assert all(len(c["sections"]) == 3 for c in courses)
    assert all(
        chapter["example"] and chapter["checklist"] for c in courses for chapter in c["sections"]
    )
    assert all("answer" not in question for c in courses for question in c["questions"])
    response = admin.post(BASE + "/academy/passwords", json={"answers": [1, 1]})
    assert response.status_code == 201 and response.json()["payload"]["passed"]
    assert response.json()["payload"]["course_version"] == 1
    assert (
        admin.post(BASE + "/academy/passwords", json={"answers": [0, 0]}).json()["payload"]["score"]
        == 0
    )
