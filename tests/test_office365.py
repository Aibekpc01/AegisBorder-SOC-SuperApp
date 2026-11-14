# Назначение файла: Проверяет разбор журнала аудита Office 365 и правила для почты, архивов и внешнего доступа.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

from datetime import datetime, timedelta, timezone

from app.command.office365 import OFFICE365_RULES, classify, normalize

BASE = "/api/v1/integrations"
USER = "operator@aegis.example"


def record(n, workload, operation, minutes=0, **extra):
    time = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=minutes)
    return {"Id": f"o365-{n}", "CreationTime": time.isoformat(), "Workload": workload,
            "Operation": operation, "UserId": USER, **extra}


def receiver(admin):
    response = admin.post(BASE + "/connectors", json={"name": "Office 365", "provider": "m365"})
    assert response.status_code == 201, response.text
    data = response.json()
    return data["endpoint"], {"Authorization": "Bearer " + data["token"]}


def rule_ids(admin):
    return {i["rule_id"] for i in admin.get("/api/v1/incidents").json()}


def test_classify_covers_all_office_services():
    forward = record(1, "Exchange", "New-InboxRule",
                     Parameters=[{"Name": "ForwardTo", "Value": "drop@outside.example"}])
    assert classify(forward)[0] == "mail_forward_rule" and classify(forward)[1]["external"] is True
    internal = record(2, "Exchange", "Set-InboxRule",
                      Parameters=[{"Name": "RedirectTo", "Value": "chief@aegis.example"}])
    assert classify(internal)[1]["external"] is False
    mail = record(3, "Exchange", "Send", Recipients=["x@outside.example"],
                  Item={"Attachments": "plan.zip (2048b); photo.png (100b)"})
    assert classify(mail)[0] == "mail_sent" and classify(mail)[1]["archive"] is True
    assert classify(record(4, "OneDrive", "FileDownloaded", SourceFileExtension="7z"))[0] == "archive_download"
    assert classify(record(5, "SharePoint", "FileDownloaded", SourceFileExtension="docx"))[0] == "file_download"
    assert classify(record(6, "SharePoint", "AnonymousLinkCreated"))[1]["external"] is True
    guest = record(7, "MicrosoftTeams", "MemberAdded", Members=[{"UPN": "guest_mail.com#EXT#@aegis.example"}])
    assert classify(guest)[0] == "teams_guest_added"
    assert classify(record(8, "AzureActiveDirectory", "UserLoginFailed"))[0] == "login_failed"
    assert classify(record(9, "SecurityComplianceCenter", "DlpRuleMatch"))[0] == "dlp_match"
    assert classify(record(10, "Exchange", "New-MailboxExportRequest"))[0] == "mailbox_export"
    # CreationTime без часового пояса трактуется как UTC; тема письма не сохраняется.
    event = normalize(record(11, "Exchange", "Send", Item={"Subject": "секрет"}))
    assert event["time"].tzinfo is not None
    assert "секрет" not in str(event)


def test_rules_are_seeded_and_listed(admin):
    ids = {r["id"] for r in admin.get("/api/v1/detection-rules").json()}
    assert {r[0] for r in OFFICE365_RULES} <= ids


def test_office365_records_create_explainable_incidents(admin):
    endpoint, headers = receiver(admin)
    batch = [
        record(1, "Exchange", "New-InboxRule", Parameters=[{"Name": "ForwardTo", "Value": "drop@outside.example"}]),
        record(2, "Exchange", "Send", Recipients=["x@outside.example"], Item={"Attachments": "base.rar (9000b)"}),
        record(3, "SharePoint", "AnonymousLinkCreated", ObjectId="https://tenant/sites/hq/plan.docx"),
        record(4, "Exchange", "MailItemsAccessed", OperationCount=800),
        record(5, "SecurityComplianceCenter", "DlpRuleMatch"),
        record(6, "Exchange", "New-MailboxExportRequest"),
        *[record(10 + i, "OneDrive", "FileDownloaded", SourceFileExtension="zip", SourceFileName=f"a{i}.zip")
          for i in range(5)],
    ]
    response = admin.post(endpoint, json=batch, headers=headers)
    assert response.status_code == 201, response.text
    assert response.json()["created"] == len(batch)
    assert {
        "o365-mail-forward", "o365-mail-archive-out", "o365-external-share",
        "o365-mail-bulk-access", "o365-dlp", "o365-mailbox-export", "o365-archive-download",
    } <= rule_ids(admin)
    assert admin.get("/api/v1/audit/verify").json()["valid"]


def test_normal_activity_does_not_raise_incidents(admin):
    endpoint, headers = receiver(admin)
    batch = [
        record(1, "Exchange", "Send", Recipients=["colleague@aegis.example"], Item={"Attachments": "plan.zip"}),
        record(2, "Exchange", "New-InboxRule", Parameters=[{"Name": "ForwardTo", "Value": "deputy@aegis.example"}]),
        record(3, "Exchange", "MailItemsAccessed", OperationCount=20),
        *[record(10 + i, "OneDrive", "FileDownloaded", SourceFileExtension="zip") for i in range(4)],
    ]
    assert admin.post(endpoint, json=batch, headers=headers).status_code == 201
    assert not {i for i in rule_ids(admin) if i.startswith("o365-")}


def test_monitor_reports_services_and_live_receiver(admin):
    endpoint, headers = receiver(admin)
    assert admin.get("/api/v1/superapp/m365").json()["connected"] is False
    admin.post(endpoint, json=[record(1, "MicrosoftTeams", "MessageSent"),
                               record(2, "Exchange", "Send", Recipients=["a@aegis.example"])], headers=headers)
    monitor = admin.get("/api/v1/superapp/m365").json()
    assert monitor["connected"] is True and monitor["mode"] == "live"
    counts = {w["id"]: w["events"] for w in monitor["workloads"]}
    assert counts["MicrosoftTeams"] == 1 and counts["Exchange"] == 1
    assert len(monitor["rules"]) == len(OFFICE365_RULES)


def test_legacy_graph_directory_audit_still_accepted(admin):
    endpoint, headers = receiver(admin)
    graph = {"id": "graph-1", "activityDateTime": datetime.now(timezone.utc).isoformat(),
             "initiatedBy": {"user": {"userPrincipalName": USER}}, "activityDisplayName": "Update user"}
    response = admin.post(endpoint, json=[graph], headers=headers)
    assert response.status_code == 201 and response.json()["created"] == 1
