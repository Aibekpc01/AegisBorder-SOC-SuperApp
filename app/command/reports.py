# Назначение файла: Формирует PDF-отчёты с данными расследования; отвечает за оформление и шрифты документа.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

from html import escape
from io import BytesIO
from pathlib import Path

from reportlab.lib.styles import getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def pdf(snapshot):
    font = next(
        (
            p
            for p in [
                Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
                Path("C:/Windows/Fonts/arial.ttf"),
            ]
            if p.exists()
        ),
        None,
    )
    if not font:
        raise RuntimeError("Не найден шрифт с поддержкой кириллицы")
    if "Aegis" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("Aegis", str(font)))
    styles = getSampleStyleSheet()
    for style in styles.byName.values():
        style.fontName = "Aegis"
    stream = BytesIO()
    document = SimpleDocTemplate(stream, title="AegisBorder SuperApp — отчёт", author="AegisBorder SuperApp")
    sections = [
        "AegisBorder SuperApp — учебный отчёт",
        f"Инцидент №{snapshot['id']}: {snapshot['title']}",
        f"Риск: {snapshot['risk']}/100. Статус: {snapshot['status']}",
        snapshot["explanation"],
        "Рекомендации: " + "; ".join(snapshot["recommendations"]),
        "Вывод расследования: " + snapshot.get("conclusion", "Не указан"),
        "Хронология",
    ]
    sections += [f"{e['time']} — {e['type']}: {e['detail']}" for e in snapshot.get("events", [])]
    sections += ["Комментарии"] + [c["text"] for c in snapshot.get("comments", [])]
    sections += [
        "Все данные синтетические. Документ не подтверждает наличие угроз в реальной инфраструктуре."
    ]
    story = []
    for section in sections:
        story.extend([Paragraph(escape(str(section)), styles["Normal"]), Spacer(1, 10)])
    document.build(story)
    return stream.getvalue()
