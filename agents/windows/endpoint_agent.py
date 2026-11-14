# Назначение файла: Python-вариант агента: собирает состояние устройства, отправляет heartbeat и события серверу.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Aegis DLP Windows pilot: offline telemetry and password-gated local policies."""
import argparse
import getpass
import hashlib
import json
import os
import platform
import sqlite3
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

try:
    from . import device_link, usb_policy
    from .local_security import authenticate, new_password, save_json
except ImportError:  # Direct execution from the downloaded package.
    import device_link
    import usb_policy
    from local_security import authenticate, new_password, save_json

STATUS_SCRIPT = r"""
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$status = Get-MpComputerStatus
$cpu = $null; $memory = $null
try {
    $cpu = [double](Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
    $os = Get-CimInstance Win32_OperatingSystem
    $memory = [Math]::Round(100 * (1 - $os.FreePhysicalMemory / $os.TotalVisibleMemorySize), 1)
} catch {}
$usb = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices\{53f5630d-b6bf-11d0-94f2-00a0c91efb8b}' -ErrorAction SilentlyContinue
$threats = @(Get-MpThreatDetection | Select-Object -Last 100 | ForEach-Object {
    @{id=[string]$_.DetectionID; threat_id=[string]$_.ThreatID; action_success=[bool]$_.ActionSuccess;
      time=if ($_.InitialDetectionTime) {$_.InitialDetectionTime.ToUniversalTime().ToString('o')} else {$null}}
})
@{status=@{antivirus=[bool]$status.AntivirusEnabled; realtime=[bool]$status.RealTimeProtectionEnabled;
            service=[bool]$status.AMServiceEnabled; signatures_age=$status.AntivirusSignatureAge;
            cpu_percent=$cpu; memory_percent=$memory;
            usb_read_denied=if ($null -ne $usb.Deny_Read) {[bool]$usb.Deny_Read} else {$null};
            usb_write_denied=if ($null -ne $usb.Deny_Write) {[bool]$usb.Deny_Write} else {$null}};
  threats=$threats} | ConvertTo-Json -Depth 5 -Compress
"""


def validate_endpoint(endpoint):
    u = urlsplit(endpoint)
    if u.username or u.password or u.query or u.fragment:
        raise ValueError("Endpoint cannot contain credentials, query or fragment")
    if not u.hostname or (u.scheme != "https" and not (u.scheme == "http" and u.hostname in ("localhost", "127.0.0.1"))):
        raise ValueError("HTTPS is required, except local testing")
    if u.path.startswith("/api/v1/dlp/agents/") and u.path.endswith("/events"):
        device_link.validate_link(endpoint[:-7])
        return endpoint
    if not u.path.startswith("/api/v1/integrations/receivers/") or not u.path.endswith("/events"):
        raise ValueError("Use the generic receiver events endpoint")
    return endpoint


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def queue_open(path):
    db = sqlite3.connect(path)
    db.execute("CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, payload TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0)")
    return db


def enqueue(db, events):
    # Keep sent IDs as a durable deduplication ledger for repeated Defender history.
    if db.execute("SELECT count(*) FROM events WHERE sent=0").fetchone()[0] + len(events) > 10000:
        raise RuntimeError("Offline queue limit reached; administrator action required")
    for event in events:
        db.execute("INSERT OR IGNORE INTO events(id,payload) VALUES (?,?)", (event["external_id"], json.dumps(event, ensure_ascii=False)))
    db.commit()


def translate(snapshot, device, account, now=None):
    now = now or datetime.now(timezone.utc).isoformat()
    status = snapshot["status"]
    events = [{"external_id": "defender-status-" + hashlib.sha256((device + now[:16]).encode()).hexdigest()[:40],
               "time": now, "device": device[:80], "account": account[:80], "source": "Aegis DLP",
               "type": "endpoint_security_status", "detail": "Состояние Microsoft Defender; отсутствие обнаружений не доказывает отсутствие угроз",
               "features": status}]
    for threat in snapshot.get("threats") or []:
        if not threat.get("time") or not threat.get("id"):
            continue
        # State is part of the ID: a later successful remediation is also reported.
        key = f"{device}:{threat['id']}:{threat.get('action_success')}"
        events.append({"external_id": "defender-threat-" + hashlib.sha256(key.encode()).hexdigest()[:40],
                       "time": threat["time"], "device": device[:80], "account": account[:80],
                       "source": "Aegis DLP", "type": "malware_detected",
                       "detail": "Microsoft Defender зарегистрировал обнаружение; проверьте состояние обработки",
                       "features": {"threat_id": str(threat.get("threat_id", "")), "action_success": bool(threat.get("action_success"))}})
    return events


def collect():
    if platform.system() != "Windows":
        raise RuntimeError("Defender collection requires Windows 10/11")
    result = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", STATUS_SCRIPT],
                            capture_output=True, encoding="utf-8-sig", timeout=60, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError("Cannot read Microsoft Defender. Check availability and Windows permissions; no clean verdict issued")
    return json.loads(result.stdout)


def send_pending(db, endpoint, token, opener=None):
    validate_endpoint(endpoint)
    if not token:
        raise ValueError("Set AEGIS_CONNECTOR_TOKEN for the device; never use the administrator password")
    rows = db.execute("SELECT id,payload FROM events WHERE sent=0 ORDER BY rowid LIMIT 100").fetchall()
    if not rows:
        return 0
    data = json.dumps([json.loads(row[1]) for row in rows], ensure_ascii=False).encode()
    if len(data) > 200000:
        raise RuntimeError("Batch exceeds receiver limit")
    request = Request(endpoint, data=data, method="POST", headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    with (opener or build_opener(NoRedirect())).open(request, timeout=20) as response:
        if response.status != 201:
            raise RuntimeError("Receiver did not confirm the batch")
        result = json.loads(response.read(10000))
    if result.get("created", 0) + result.get("duplicates", 0) != len(rows):
        raise RuntimeError("Incomplete acknowledgement; queued events retained")
    db.executemany("UPDATE events SET sent=1 WHERE id=?", [(row[0],) for row in rows])
    db.commit()
    return len(rows)


def unlock(config, data_dir):
    authenticate(config, getpass.getpass("Aegis DLP password: "), data_dir / "login.json")


def main():
    parser = argparse.ArgumentParser(description="Aegis DLP pilot — visible Defender telemetry and offline queue")
    parser.add_argument("action", choices=["init", "show-settings", "once", "run", "quick-scan", "change-password", "usb-block", "usb-restore"])
    parser.add_argument("--data-dir", type=Path, default=Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "AegisBorderEndpoint")
    parser.add_argument("--endpoint")
    parser.add_argument("--enrollment", type=Path)
    args = parser.parse_args()
    args.data_dir.mkdir(parents=True, exist_ok=True)
    path = args.data_dir / "settings.json"
    if args.action == "init":
        previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
        if previous:
            unlock(previous, args.data_dir)
        endpoint = validate_endpoint(args.endpoint) if args.endpoint else None
        password = getpass.getpass("New settings password (12+ characters): ")
        hashed = new_password(password, getpass.getpass("Repeat settings password: "))
        from uuid import uuid4
        config = {"endpoint": endpoint, "password_hash": hashed}
        if args.enrollment:
            config.update(device_link.import_enrollment(args.enrollment))
            config["installation_id"] = (previous or {}).get("installation_id") or str(uuid4())
        save_json(path, config)
        print("Configuration saved. Protect the data directory with Windows ACLs before a pilot.")
        return
    config = json.loads(path.read_text(encoding="utf-8"))
    if args.action in ("change-password", "usb-block", "usb-restore"):
        unlock(config, args.data_dir)
        if args.action == "change-password":
            password = getpass.getpass("New Aegis DLP password (12+ characters): ")
            config["password_hash"] = new_password(password, getpass.getpass("Repeat password: "))
            save_json(path, config)
        elif args.action == "usb-block":
            usb_policy.block(args.data_dir / "usb-backup.json", save_json)
            print("Removable disk read/write/execute denied. Reconnect devices or restart Windows. Verify on the pilot machine.")
        else:
            usb_policy.restore(args.data_dir / "usb-backup.json")
            print("Previous local disk policy restored. Domain policies can still restrict access.")
        return
    if args.action == "show-settings":
        unlock(config, args.data_dir)
        print("Endpoint:", config.get("device_endpoint") or config["endpoint"])
        return
    if args.action == "quick-scan":
        unlock(config, args.data_dir)
        if platform.system() != "Windows":
            raise RuntimeError("Windows is required")
        subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; Start-MpScan -ScanType QuickScan"], check=True, creationflags=subprocess.CREATE_NO_WINDOW)
        return
    print("Aegis DLP pilot is running visibly. Ctrl+C stops it. No files or keystrokes are collected.")
    with queue_open(args.data_dir / "queue.sqlite") as db:
        while True:
            snapshot = {"status": {}, "collection_error": True}
            try:
                snapshot = collect()
                enqueue(db, translate(snapshot, platform.node(), getpass.getuser()))
            except (RuntimeError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
                print("Collection unavailable:", type(error).__name__)
            try:
                if config.get("device_endpoint"):
                    pending = db.execute("SELECT count(*) FROM events WHERE sent=0").fetchone()[0]
                    device_link.heartbeat(config, snapshot, pending)
                    count = send_pending(db, config["device_endpoint"] + "/events", device_link.token(config))
                else:
                    count = send_pending(db, config["endpoint"], os.getenv("AEGIS_CONNECTOR_TOKEN", "")) if config.get("endpoint") else 0
                print("Acknowledged events:", count)
            except Exception as error:
                print("Delivery unavailable; queued events retained:", type(error).__name__)
            if args.action == "once":
                break
            time.sleep(30 if config.get("device_endpoint") else 60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Agent stopped by operator")
