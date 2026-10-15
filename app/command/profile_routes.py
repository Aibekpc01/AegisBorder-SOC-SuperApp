from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select

from .access import connection, evaluate, inspect, policy
from .db import get_db
from .models import LoginRecord, Setting, UserProfile, utcnow
from .profiles import permitted_user, sanitize_avatar, user_record
from .schemas import AccessPolicyInput, AddressInput, AvatarInput, LocationInput, ProfileInput
from .security import admin, audit, current
from .serialization import record

router = APIRouter(prefix="/api/v1")


def profile_row(db, user_id):
    row = db.get(UserProfile, user_id)
    if not row:
        row = UserProfile(user_id=user_id)
        db.add(row)
    return row


@router.get("/users/{user_id}/profile")
def get_profile(user_id: int, user=Depends(current), db=Depends(get_db)):
    row = permitted_user(db, user_id, user)
    return user_record(db, row, record)


@router.put("/users/{user_id}/profile")
def save_profile(user_id: int, data: ProfileInput, user=Depends(current), db=Depends(get_db)):
    target = permitted_user(db, user_id, user)
    profile = profile_row(db, target.id)
    for key, value in data.model_dump().items():
        setattr(profile, key, value)
    profile.updated = utcnow()
    audit(db, user.id, f"Обновлён профиль пользователя {target.username}")
    db.commit()
    return user_record(db, target, record)


@router.put("/users/{user_id}/avatar")
def avatar_upload(user_id: int, data: AvatarInput, user=Depends(current), db=Depends(get_db)):
    target = permitted_user(db, user_id, user)
    image = sanitize_avatar(data.image_data_url)
    profile = profile_row(db, target.id)
    profile.avatar_data = image
    profile.updated = utcnow()
    audit(db, user.id, f"Обновлено фото пользователя {target.username}")
    db.commit()
    return user_record(db, target, record)


@router.get("/users/{user_id}/avatar")
def avatar_get(user_id: int, user=Depends(current), db=Depends(get_db)):
    permitted_user(db, user_id, user)
    profile = db.get(UserProfile, user_id)
    if not profile or not profile.avatar_data:
        raise HTTPException(404, "Фото не загружено")
    return Response(profile.avatar_data, media_type="image/png")


@router.delete("/users/{user_id}/avatar")
def avatar_delete(user_id: int, user=Depends(current), db=Depends(get_db)):
    target = permitted_user(db, user_id, user)
    profile = db.get(UserProfile, user_id)
    if profile:
        profile.avatar_data = None
        profile.updated = utcnow()
        audit(db, user.id, f"Удалено фото пользователя {target.username}")
    db.commit()
    return {"ok": True}


@router.get("/users/{user_id}/logins")
def login_history(user_id: int, user=Depends(current), db=Depends(get_db)):
    permitted_user(db, user_id, user)
    return [
        record(row)
        for row in db.scalars(
            select(LoginRecord)
            .where(LoginRecord.user_id == user_id)
            .order_by(LoginRecord.id.desc())
            .limit(100)
        )
    ]


@router.get("/auth/connection")
def current_connection(request: Request, user=Depends(current), db=Depends(get_db)):
    return {
        **inspect(db, request),
        "user_id": user.id,
        "geolocation": "Передаётся браузером только по кнопке с разрешением пользователя",
    }


@router.post("/auth/location")
def share_location(
    data: LocationInput, request: Request, user=Depends(current), db=Depends(get_db)
):
    stamp = data.observed_at.astimezone(timezone.utc)
    if not utcnow() - timedelta(minutes=15) <= stamp <= utcnow() + timedelta(minutes=1):
        raise HTTPException(422, "Измерение устарело. Запросите местоположение повторно.")
    row = db.scalar(
        select(LoginRecord)
        .where(LoginRecord.session_id == request.state.session.id, LoginRecord.success.is_(True))
        .order_by(LoginRecord.id.desc())
        .limit(1)
    )
    if not row:
        raise HTTPException(
            409,
            "Этот сеанс открыт до включения истории входов. Выйдите и войдите снова, затем передайте местоположение.",
        )
    row.location = {
        **data.model_dump(mode="json"),
        "source": "Сообщено браузером с разрешением пользователя; независимо не проверено",
    }
    from .location import city_label
    row.location.update(city_label(data.latitude, data.longitude, data.accuracy))
    audit(db, user.id, "Пользователь передал местоположение браузера")
    db.commit()
    return row.location


@router.get("/access-policy")
def get_policy(user=Depends(admin), db=Depends(get_db)):
    return {
        **policy(db),
        "limitations": "IP может принадлежать NAT или прокси. Неизвестный VPN нельзя надёжно обнаружить без актуального справочника. Точные координаты по IP не устанавливаются.",
    }


@router.put("/access-policy")
def save_policy(data: AccessPolicyInput, request: Request, user=Depends(admin), db=Depends(get_db)):
    config = data.model_dump()
    if config["restrict_to_trusted"] and not (
        config["trusted_cidrs"] or any(n["kind"] == "trusted" for n in config["networks"])
    ):
        raise HTTPException(422, "Укажите хотя бы одну доверенную сеть")
    check = evaluate(connection(request)["ip"], config)
    if not check["allowed"]:
        raise HTTPException(
            422,
            "Эта настройка заблокирует ваше текущее соединение. Добавьте его сеть в доверенные и уберите из запрещённых.",
        )
    row = db.get(Setting, "access_policy")
    if not row:
        row = Setting(key="access_policy", value=config)
        db.add(row)
    else:
        row.value = config
    audit(db, user.id, "Изменена политика сетевого доступа и блокировки известных анонимайзеров")
    db.commit()
    return config


@router.post("/access-policy/check")
def check_policy(data: AddressInput, user=Depends(admin), db=Depends(get_db)):
    return evaluate(data.ip, policy(db))
