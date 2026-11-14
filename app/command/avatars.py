# Назначение файла: Обрабатывает изображения профиля и подготовку аватаров для интерфейса.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Local procedural avatars; no photos or personal data leave the server."""
import hashlib
from io import BytesIO

from PIL import Image, ImageDraw


def generated_avatar(user_id, variant):
    seed = hashlib.sha256(f"aegis-avatar-v1:{user_id}:{variant}".encode()).digest()
    palettes = [("#102c45", "#67e8d1", "#204c68"), ("#232346", "#c4b5fd", "#544373"),
                ("#32271a", "#fcd97c", "#655238"), ("#10333b", "#7dd3fc", "#25596a"),
                ("#342139", "#f9a8d4", "#76466d"), ("#182e29", "#a3e6ae", "#396248")]
    bg, ink, shade = palettes[seed[0] % len(palettes)]
    im = Image.new("RGB", (256, 256), bg)
    draw = ImageDraw.Draw(im)
    draw.ellipse((12, 12, 244, 244), outline=shade, width=3)
    if seed[1] % 2:
        draw.rounded_rectangle((55, 59, 201, 193), radius=32, fill=shade, outline=ink, width=5)
        draw.line((128, 59, 128, 33), fill=ink, width=5)
        draw.ellipse((120, 24, 136, 40), fill=ink)
    else:
        draw.ellipse((53, 47, 203, 205), fill=shade, outline=ink, width=5)
        draw.rounded_rectangle((64, 93, 192, 142), radius=15, fill=bg)
    for x in (91, 157):
        draw.ellipse((x-8, 105, x+8, 121), fill=ink)
    if seed[2] % 2:
        draw.arc((97, 133, 159, 167), 0, 180, fill=ink, width=5)
    else:
        draw.rounded_rectangle((107, 154, 149, 161), radius=3, fill=ink)
    draw.rounded_rectangle((92, 211, 164, 221), radius=5, fill=ink)
    out = BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()
