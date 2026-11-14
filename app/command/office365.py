# Назначение файла: Разбор единого журнала аудита Office 365 (Microsoft 365) и правила обнаружения для него.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Office 365: почта Exchange/Outlook, SharePoint, OneDrive, Teams, Entra ID и Purview DLP.

Источник данных — Office 365 Management Activity API (единый журнал аудита). Агент
scripts/pull_office365_audit.py забирает записи и отправляет их в приёмник интеграции «m365».
Здесь запись превращается в событие Aegis: тип события выбирается по сервису и операции,
а признаки (внешний адресат, архив, число писем) передаются правилам обнаружения.

Темы и тексты писем не сохраняются: для анализа достаточно факта операции, адресных доменов
и расширений вложений.
"""

from datetime import datetime, timezone

SOURCE = "Microsoft 365"
DEVICE = "Microsoft365"

WORKLOADS = {
    "Exchange": "Почта Exchange / Outlook",
    "SharePoint": "SharePoint",
    "OneDrive": "OneDrive",
    "MicrosoftTeams": "Teams",
    "AzureActiveDirectory": "Entra ID: входы и каталог",
    "SecurityComplianceCenter": "Purview: DLP и eDiscovery",
}

# Расширения архивов, включая архивы почты Outlook (.pst/.ost).
ARCHIVE_EXTENSIONS = {"zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "cab", "iso", "pst", "ost"}

FORWARD_PARAMETERS = {"ForwardTo", "ForwardAsAttachmentTo", "RedirectTo", "ForwardingSmtpAddress", "ForwardingAddress"}
EXPORT_OPERATIONS = {"New-MailboxExportRequest", "New-ComplianceSearchAction", "SearchExported"}
SEND_OPERATIONS = {"Send", "SendAs", "SendOnBehalf"}
DELETE_OPERATIONS = {"HardDelete", "SoftDelete", "MoveToDeletedItems"}
DOWNLOAD_OPERATIONS = {"FileDownloaded", "FileSyncDownloadedFull", "FileCopied"}
UPLOAD_OPERATIONS = {"FileUploaded", "FileSyncUploadedFull"}
SHARE_OPERATIONS = {"AnonymousLinkCreated", "AnonymousLinkUsed", "SharingInvitationCreated", "AddedToSecureLink", "SharingSet"}

# Формат совпадает с RULES в scenarios.py: id, название, тип события, порог, окно (с), риск, описание.
OFFICE365_RULES = [
    ("o365-mail-forward", "Пересылка почты за пределы организации", "mail_forward_rule", 1, 60, 80,
     "Создано правило пересылки или перенаправления писем на внешний адрес."),
    ("o365-mailbox-export", "Экспорт почтового ящика", "mailbox_export", 1, 60, 85,
     "Запущен экспорт почтового ящика или результатов поиска eDiscovery."),
    ("o365-mail-archive-out", "Архив отправлен по почте наружу", "mail_sent", 1, 60, 75,
     "Письмо с вложением-архивом отправлено внешнему получателю."),
    ("o365-archive-download", "Массовая загрузка архивов", "archive_download", 5, 600, 75,
     "Не менее пяти архивов скачано из SharePoint или OneDrive за 10 минут."),
    ("o365-archive-upload", "Выгрузка архивов в облако", "archive_upload", 3, 600, 55,
     "Не менее трёх архивов загружено в SharePoint или OneDrive за 10 минут."),
    ("o365-external-share", "Внешняя ссылка на файл", "external_share", 1, 60, 65,
     "Создана анонимная ссылка или приглашение внешнему пользователю."),
    ("o365-mail-bulk-access", "Массовый доступ к почте", "mailbox_bulk_access", 1, 60, 75,
     "За одну операцию прочитано не менее 500 писем."),
    ("o365-mass-delete", "Массовое удаление писем", "mail_deleted", 1, 60, 70,
     "За одну операцию удалено не менее 50 писем."),
    ("o365-teams-guest", "Внешний гость в Teams", "teams_guest_added", 1, 60, 55,
     "В команду Teams добавлен внешний гость."),
    ("o365-dlp", "Срабатывание DLP Office 365", "dlp_match", 1, 60, 70,
     "Политика защиты от утечек Microsoft Purview обнаружила конфиденциальные данные."),
]
RULE_IDS = {rule[0] for rule in OFFICE365_RULES}


def predicate(rule_id, features):
    """Дополнительное условие правила Office 365 сверх совпадения типа события."""
    if rule_id in ("o365-mail-forward", "o365-external-share"):
        return features.get("external") is True
    if rule_id == "o365-mail-archive-out":
        return features.get("external") is True and features.get("archive") is True
    if rule_id == "o365-mail-bulk-access":
        return features.get("items", 0) >= 500
    if rule_id == "o365-mass-delete":
        return features.get("items", 0) >= 50
    return True


def is_unified_audit(raw):
    """Запись единого журнала аудита отличается полями Workload и Operation."""
    return isinstance(raw, dict) and "Workload" in raw and "Operation" in raw


def _domain(address):
    address = str(address or "").strip().lower()
    return address.rsplit("@", 1)[1] if "@" in address else ""


def _external(user, addresses):
    own = _domain(user)
    domains = {_domain(a) for a in addresses if _domain(a)}
    return bool(own) and any(d != own for d in domains)


def _extension(name):
    name = str(name or "").lower().split("?")[0]
    return name.rsplit(".", 1)[1] if "." in name else ""


def _has_archive(attachments):
    # В аудите Exchange вложения передаются строкой вида «report.zip (2048b); photo.png (512b)».
    parts = attachments if isinstance(attachments, list) else str(attachments or "").split(";")
    return any(_extension(str(p).split(" (")[0].strip()) in ARCHIVE_EXTENSIONS for p in parts)


def _parameters(raw):
    return {
        str(p.get("Name")): str(p.get("Value", ""))
        for p in raw.get("Parameters") or []
        if isinstance(p, dict) and p.get("Name")
    }


def _time(value):
    # CreationTime в журнале аудита задаётся в UTC без указания пояса.
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def classify(raw):
    """Возвращает (тип события, признаки, описание) для записи журнала аудита."""
    workload = str(raw.get("Workload", ""))
    operation = str(raw.get("Operation", ""))
    user = str(raw.get("UserId", ""))
    label = WORKLOADS.get(workload, workload or "Office 365")
    features = {"workload": workload, "operation": operation[:60]}
    if raw.get("ClientIP"):
        features["ip"] = str(raw["ClientIP"])[:64]
    target = str(raw.get("SourceFileName") or raw.get("ObjectId") or "")[:200]

    if operation == "DlpRuleMatch":
        return "dlp_match", features, f"{label}: сработала политика DLP"
    if operation in EXPORT_OPERATIONS:
        return "mailbox_export", features, f"{label}: экспорт данных ({operation})"

    if workload == "Exchange":
        params = _parameters(raw)
        forward = [v for k, v in params.items() if k in FORWARD_PARAMETERS]
        if forward:
            addresses = [a.strip(" []\"'") for v in forward for a in v.replace(",", ";").split(";")]
            features["external"] = _external(user, addresses)
            return "mail_forward_rule", features, f"{label}: правило пересылки ({operation})"
        if operation in SEND_OPERATIONS:
            item = raw.get("Item") or {}
            features["archive"] = _has_archive(item.get("Attachments") or raw.get("Attachments"))
            features["external"] = _external(user, raw.get("Recipients") or [])
            return "mail_sent", features, f"{label}: отправлено письмо ({operation})"
        if operation == "MailItemsAccessed":
            features["items"] = int(raw.get("OperationCount") or 1)
            return "mailbox_bulk_access", features, f"{label}: доступ к письмам ({features['items']})"
        if operation in DELETE_OPERATIONS:
            affected = raw.get("AffectedItems") or []
            features["items"] = len(affected) if isinstance(affected, list) else int(raw.get("OperationCount") or 1)
            return "mail_deleted", features, f"{label}: удалено писем — {features['items']}"
        return "mail_activity", features, f"{label}: {operation}"

    if workload in ("SharePoint", "OneDrive"):
        # SourceFileExtension приходит без точки («zip»); если его нет — берём из имени файла.
        given = str(raw.get("SourceFileExtension") or "").lower().lstrip(".")
        extension = given or _extension(target)
        features["archive"] = extension in ARCHIVE_EXTENSIONS
        if operation in DOWNLOAD_OPERATIONS:
            kind = "archive_download" if features["archive"] else "file_download"
            return kind, features, f"{label}: скачан файл {target}"
        if operation in UPLOAD_OPERATIONS:
            kind = "archive_upload" if features["archive"] else "file_upload"
            return kind, features, f"{label}: загружен файл {target}"
        if operation in SHARE_OPERATIONS:
            guest = str(raw.get("TargetUserOrGroupType", "")).lower() == "guest"
            features["external"] = operation.startswith("Anonymous") or guest
            return "external_share", features, f"{label}: доступ к файлу открыт ({operation})"
        if operation in ("FileDeleted", "FileRecycled"):
            return "file_deleted", features, f"{label}: удалён файл {target}"
        return "file_activity", features, f"{label}: {operation}"

    if workload == "MicrosoftTeams":
        if operation == "MemberAdded":
            members = raw.get("Members") or []
            features["external"] = any("#ext#" in str(m.get("UPN", "")).lower() for m in members if isinstance(m, dict))
            if features["external"]:
                return "teams_guest_added", features, f"{label}: добавлен внешний гость"
        return "teams_activity", features, f"{label}: {operation}"

    if workload == "AzureActiveDirectory":
        if operation == "UserLoginFailed":
            return "login_failed", features, f"{label}: неудачный вход"
        if operation == "UserLoggedIn":
            return "office_login", features, f"{label}: вход в Office 365"
        return "directory_change", features, f"{label}: {operation}"

    return "office_activity", features, f"{label}: {operation}"


def normalize(raw):
    """Готовит словарь для EventInput из записи единого журнала аудита."""
    kind, features, detail = classify(raw)
    return {
        "external_id": str(raw.get("Id") or "")[:80],
        "time": _time(raw.get("CreationTime")),
        "device": DEVICE,
        "account": str(raw.get("UserId") or "unknown")[:80],
        "source": SOURCE,
        "type": kind,
        "detail": detail[:3000],
        "features": features,
    }


def workload_of(event):
    """Сервис события для сводки; записи аудита каталога Graph относятся к Entra ID."""
    return (event.features or {}).get("workload") or "AzureActiveDirectory"
