"""Редактируемые материалы расследования. Храним проверенное дерево, не HTML."""

import hashlib
import hmac
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, update

from .db import get_db
from .models import DocumentComment, DocumentVersion, Incident, User, WorkspaceDocument, utcnow
from .security import audit, current, operator, secret, visible
from .serialization import record

router = APIRouter(prefix="/api/v1/workspace", tags=["Рабочее пространство"])
TEMPLATES = {
    "investigation": (
        "Материалы расследования",
        ["Описание ситуации", "Доказательства", "Выводы и рекомендации"],
    ),
    "memo": (
        "Служебная записка — учебный образец",
        ["Основание", "Результат проверки", "Предлагаемые действия"],
    ),
    "blank": ("Новый документ", []),
}
CHILDREN = {
    "doc": {
        "paragraph",
        "heading",
        "blockquote",
        "bulletList",
        "orderedList",
        "codeBlock",
        "horizontalRule",
        "table",
    },
    "paragraph": {"text", "hardBreak"},
    "heading": {"text", "hardBreak"},
    "codeBlock": {"text"},
    "blockquote": {"paragraph", "heading", "bulletList", "orderedList"},
    "bulletList": {"listItem"},
    "orderedList": {"listItem"},
    "listItem": {"paragraph", "heading", "bulletList", "orderedList", "blockquote"},
    "table": {"tableRow"},
    "tableRow": {"tableCell", "tableHeader"},
    "tableCell": {"paragraph", "heading", "bulletList", "orderedList", "blockquote"},
    "tableHeader": {"paragraph", "heading", "bulletList", "orderedList", "blockquote"},
    "text": set(),
    "hardBreak": set(),
    "horizontalRule": set(),
}


def validate_content(content):
    """Белый список узлов/атрибутов, ограничение размера и глубины; никаких URL/HTML."""
    try:
        size = len(json.dumps(content, ensure_ascii=False).encode())
    except (RecursionError, ValueError, TypeError):
        raise ValueError("Слишком сложное или недопустимое содержимое") from None
    if size > 200_000:
        raise ValueError("Документ превышает 200 КБ")
    count = 0
    texts = []

    def visit(node, depth=0):
        nonlocal count
        count += 1
        if count > 3000 or depth > 16 or not isinstance(node, dict):
            raise ValueError("Слишком сложный документ")
        kind = node.get("type")
        if kind not in CHILDREN or set(node) - {"type", "attrs", "content", "text", "marks"}:
            raise ValueError("Неподдерживаемый элемент документа")
        attrs = node.get("attrs", {})
        if not isinstance(attrs, dict):
            raise ValueError("Недопустимые атрибуты")
        allowed = {
            "heading": {"level"},
            "orderedList": {"start", "type"},
            "codeBlock": {"language"},
            "tableCell": {"colspan", "rowspan", "colwidth", "align"},
            "tableHeader": {"colspan", "rowspan", "colwidth", "align"},
        }
        if set(attrs) - allowed.get(kind, set()):
            raise ValueError("Недопустимый атрибут документа")
        if "align" in attrs and attrs["align"] not in (None, "left", "center", "right"):
            raise ValueError("Недопустимое выравнивание таблицы")
        if kind == "heading" and attrs.get("level") not in (1, 2, 3):
            raise ValueError("Недопустимый заголовок")
        for key in ("colspan", "rowspan"):
            if key in attrs and (type(attrs[key]) is not int or not 1 <= attrs[key] <= 20):
                raise ValueError("Недопустимый размер ячейки")
        if attrs.get("colwidth") is not None:
            widths = attrs["colwidth"]
            if (
                not isinstance(widths, list)
                or len(widths) > 20
                or any(type(v) is not int or not 0 <= v <= 2000 for v in widths)
            ):
                raise ValueError("Недопустимая ширина таблицы")
        if kind == "orderedList" and (
            type(attrs.get("start", 1)) is not int
            or not 1 <= attrs.get("start", 1) <= 10000
            or attrs.get("type") not in (None, "1", "a", "A", "i", "I")
        ):
            raise ValueError("Недопустимый список")
        if kind == "codeBlock" and attrs.get("language") is not None:
            raise ValueError("Язык кода не поддерживается")
        if "text" in node:
            if kind != "text" or not isinstance(node["text"], str) or not node["text"]:
                raise ValueError("Недопустимый текст")
            texts.append(node["text"])
        elif kind == "text":
            raise ValueError("Отсутствует текст")
        marks = node.get("marks", [])
        if not isinstance(marks, list) or len(marks) > 5:
            raise ValueError("Недопустимое форматирование")
        for mark in marks:
            if (
                kind != "text"
                or not isinstance(mark, dict)
                or set(mark) != {"type"}
                or mark["type"] not in {"bold", "italic", "strike", "code", "underline"}
            ):
                raise ValueError("Ссылки и произвольное HTML-форматирование запрещены")
        children = node.get("content", [])
        if not isinstance(children, list) or any(
            not isinstance(c, dict) or c.get("type") not in CHILDREN[kind] for c in children
        ):
            raise ValueError("Неверная структура документа")
        for child in children:
            visit(child, depth + 1)

    if content.get("type") != "doc":
        raise ValueError("Ожидается дерево документа")
    visit(content)
    return " ".join(texts)


class NewDocument(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    template: Literal["investigation", "memo", "blank"] = "investigation"
    title: str = Field(min_length=1, max_length=200)
    incident_id: int | None = Field(default=None, gt=0)


class SaveDocument(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    revision: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=200)
    content: dict
    incident_id: int | None = Field(default=None, gt=0)
    assignee_id: int | None = Field(default=None, gt=0)
    status: Literal["Черновик", "На проверке", "Утверждён"] = "Черновик"

    @field_validator("content")
    @classmethod
    def safe_content(cls, value):
        validate_content(value)
        return value


class Note(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    text: str = Field(min_length=1, max_length=5000)


def scope(query, user):
    if user.role in ("demo", "demo_viewer"):
        return query.where(WorkspaceDocument.owner_id == user.id)
    return query.where(
        (WorkspaceDocument.demo_only.is_(False)) | (WorkspaceDocument.owner_id == user.id)
    )


def document(db, doc_id, user):
    row = db.scalar(scope(select(WorkspaceDocument).where(WorkspaceDocument.id == doc_id), user))
    if not row:
        raise HTTPException(404, "Документ не найден")
    return row


def can_write(row, user):
    return user.role not in ("observer", "demo_viewer") and (
        user.role == "admin" or row.owner_id == user.id or row.assignee_id == user.id
    )


def signature(doc_id, revision, snapshot):
    payload = json.dumps(
        [doc_id, revision, snapshot], ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    return hmac.new(
        secret().encode(), ("workspace-v1:" + payload).encode(), hashlib.sha256
    ).hexdigest()


def snapshot(row):
    return {
        key: getattr(row, key)
        for key in ("title", "content", "incident_id", "assignee_id", "status", "demo_only")
    }


def check_integrity(db, row):
    version = db.scalar(
        select(DocumentVersion).where(
            DocumentVersion.document_id == row.id, DocumentVersion.revision == row.revision
        )
    )
    if not version or not hmac.compare_digest(
        version.digest, signature(row.id, row.revision, snapshot(row))
    ):
        raise HTTPException(409, "Проверка целостности документа не пройдена")


def add_version(db, row, user):
    data = snapshot(row)
    db.add(
        DocumentVersion(
            document_id=row.id,
            revision=row.revision,
            author_id=user.id,
            snapshot=data,
            digest=signature(row.id, row.revision, data),
        )
    )


def result(db, row, user, full=True):
    check_integrity(db, row)
    value = record(row)
    value["can_edit"] = can_write(row, user)
    value["can_approve"] = value["can_edit"] and user.role in ("admin", "analyst")
    if full:
        value["comments"] = [
            record(c)
            for c in db.scalars(
                select(DocumentComment)
                .where(DocumentComment.document_id == row.id)
                .order_by(DocumentComment.id)
            )
        ]
    else:
        value.pop("content")
        value.pop("plain_text")
    return value


def permitted_incident(db, incident_id, user):
    if incident_id is None:
        return None
    row = db.scalar(visible(select(Incident).where(Incident.id == incident_id), Incident, user))
    if not row:
        raise HTTPException(404, "Инцидент не найден")
    return row


@router.get("/templates")
def templates(user=Depends(current)):
    return [
        {"id": key, "title": value[0], "sections": value[1]} for key, value in TEMPLATES.items()
    ]


@router.get("/documents")
def documents(
    q: str = "", incident_id: int | None = None, user=Depends(current), db=Depends(get_db)
):
    if len(q) > 200:
        raise HTTPException(422, "Слишком длинный поисковый запрос")
    query = scope(select(WorkspaceDocument), user)
    if q:
        query = query.where(
            WorkspaceDocument.title.icontains(q) | WorkspaceDocument.plain_text.icontains(q)
        )
    if incident_id:
        query = query.where(WorkspaceDocument.incident_id == incident_id)
    return [
        result(db, row, user, False)
        for row in db.scalars(query.order_by(WorkspaceDocument.updated.desc()).limit(200))
    ]


@router.post("/documents", status_code=201)
def create(data: NewDocument, user=Depends(operator), db=Depends(get_db)):
    inc = permitted_incident(db, data.incident_id, user)
    content = {"type": "doc", "content": []}
    for heading in TEMPLATES[data.template][1]:
        content["content"].extend(
            [
                {
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": heading}],
                },
                {"type": "paragraph"},
            ]
        )
    if not content["content"]:
        content["content"].append({"type": "paragraph"})
    row = WorkspaceDocument(
        title=data.title,
        content=content,
        plain_text=validate_content(content),
        owner_id=user.id,
        assignee_id=user.id,
        incident_id=data.incident_id,
        demo_only=user.role in ("demo", "demo_viewer") or bool(inc and inc.demo_id),
        status="Черновик",
        revision=1,
    )
    db.add(row)
    db.flush()
    add_version(db, row, user)
    audit(db, user.id, f"Workspace: создан документ {row.id}, версия 1")
    db.commit()
    return result(db, row, user)


@router.get("/documents/{doc_id}")
def get_document(doc_id: int, user=Depends(current), db=Depends(get_db)):
    return result(db, document(db, doc_id, user), user)


@router.put("/documents/{doc_id}")
def save(doc_id: int, data: SaveDocument, user=Depends(operator), db=Depends(get_db)):
    row = document(db, doc_id, user)
    if not can_write(row, user):
        raise HTTPException(403, "Редактирование доступно автору, ответственному и администратору")
    check_integrity(db, row)
    if row.revision != data.revision:
        raise HTTPException(
            409,
            "Документ изменён в другом окне. Сохраните свою копию и загрузите актуальную версию.",
        )
    inc = permitted_incident(db, data.incident_id, user)
    # Демо-материалы не превращаются в общие при снятии связи с инцидентом.
    demo_only = row.demo_only or bool(inc and inc.demo_id)
    if demo_only and data.assignee_id not in (None, row.owner_id):
        raise HTTPException(403, "Учебный документ можно назначить только его владельцу")
    if data.assignee_id:
        target = db.get(User, data.assignee_id)
        if (
            not target
            or not target.active
            or target.role not in ("admin", "analyst", "demo")
            or (not demo_only and target.role == "demo")
        ):
            raise HTTPException(422, "Недопустимый ответственный")
    transitions = {
        "Черновик": {"Черновик", "На проверке"},
        "На проверке": {"Черновик", "На проверке", "Утверждён"},
        "Утверждён": {"Черновик", "Утверждён"},
    }
    if data.status not in transitions[row.status]:
        raise HTTPException(409, "Сначала отправьте документ на проверку")
    if (
        data.status == "Утверждён"
        and row.status != "Утверждён"
        and user.role not in ("admin", "analyst")
    ):
        raise HTTPException(403, "Утверждение доступно аналитику и администратору")
    changed_body = (
        row.content != data.content
        or row.title != data.title
        or row.incident_id != data.incident_id
        or row.assignee_id != data.assignee_id
    )
    if row.status == "Утверждён" and changed_body:
        raise HTTPException(
            409,
            "Перед редактированием верните утверждённый документ в черновик отдельным действием",
        )
    values = data.model_dump(exclude={"revision"})
    values.update(
        demo_only=demo_only,
        plain_text=validate_content(data.content),
        revision=row.revision + 1,
        updated=utcnow(),
    )
    if not changed_body and data.status == row.status:
        return result(db, row, user)
    updated = db.execute(
        update(WorkspaceDocument)
        .where(WorkspaceDocument.id == row.id, WorkspaceDocument.revision == data.revision)
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    if updated.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Версия документа устарела. Загрузите актуальную копию.")
    db.refresh(row)
    add_version(db, row, user)
    audit(db, user.id, f"Workspace: документ {row.id}, версия {row.revision}, статус {row.status}")
    db.commit()
    return result(db, row, user)


@router.get("/documents/{doc_id}/versions")
def versions(doc_id: int, user=Depends(current), db=Depends(get_db)):
    row = document(db, doc_id, user)
    check_integrity(db, row)
    values = []
    for version in db.scalars(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == doc_id)
        .order_by(DocumentVersion.revision.desc())
        .limit(100)
    ):
        if not hmac.compare_digest(
            version.digest, signature(doc_id, version.revision, version.snapshot)
        ):
            raise HTTPException(409, "Нарушена целостность истории версий")
        value = record(version)
        value.pop("digest")
        values.append(value)
    return values


@router.post("/documents/{doc_id}/comments", status_code=201)
def comment(doc_id: int, data: Note, user=Depends(operator), db=Depends(get_db)):
    row = document(db, doc_id, user)
    check_integrity(db, row)
    note = DocumentComment(document_id=doc_id, author_id=user.id, text=data.text)
    db.add(note)
    audit(db, user.id, f"Workspace: комментарий к документу {doc_id}")
    db.commit()
    return record(note)
