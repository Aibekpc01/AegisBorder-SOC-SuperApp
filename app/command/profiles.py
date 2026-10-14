import base64
import binascii
import warnings
from io import BytesIO

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select

from .models import LoginRecord, User, UserProfile


def permitted_user(db, user_id, actor):
    if actor.role != "admin" and actor.id != user_id:
        raise HTTPException(404, "Профиль не найден")
    row = db.get(User, user_id)
    if not row:
        raise HTTPException(404, "Пользователь не найден")
    return row


def sanitize_avatar(value):
    try:
        header, data = value.split(",", 1)
        if header not in (
            "data:image/png;base64",
            "data:image/jpeg;base64",
            "data:image/webp;base64",
        ):
            raise ValueError()
        raw = base64.b64decode(data, validate=True)
        if len(raw) > 2 * 1024 * 1024:
            raise HTTPException(413, "Фото должно быть не больше 2 МБ")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as image:
                if (
                    image.format not in ("PNG", "JPEG", "WEBP")
                    or image.width * image.height > 12_000_000
                ):
                    raise ValueError()
                image = ImageOps.exif_transpose(image).convert("RGBA")
                image.thumbnail((512, 512))
                clean = Image.new("RGBA", image.size)
                clean.paste(image)
                output = BytesIO()
                clean.save(output, format="PNG")
                return output.getvalue()
    except (
        ValueError,
        binascii.Error,
        UnidentifiedImageError,
        OSError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(
            422, "Загрузите корректное PNG, JPEG или WebP: до 2 МБ и 12 мегапикселей"
        ) from None


def user_record(db, row, serialize):
    result = serialize(row)
    profile = db.get(UserProfile, row.id)
    result["profile"] = (
        serialize(profile)
        if profile
        else {
            "full_name": "",
            "department": "",
            "position": "",
            "email": "",
            "phone": "",
            "bio": "",
        }
    )
    result["profile"]["has_avatar"] = bool(profile and profile.avatar_data)
    result["profile"]["avatar_version"] = profile.updated.isoformat() if profile else ""
    latest = db.scalar(
        select(LoginRecord)
        .where(LoginRecord.user_id == row.id, LoginRecord.success.is_(True))
        .order_by(LoginRecord.id.desc())
        .limit(1)
    )
    location = db.scalar(
        select(LoginRecord)
        .where(LoginRecord.user_id == row.id, LoginRecord.location.is_not(None))
        .order_by(LoginRecord.id.desc())
        .limit(1)
    )
    result["last_login"] = serialize(latest) if latest else None
    result["last_location"] = location.location if location else None
    return result
