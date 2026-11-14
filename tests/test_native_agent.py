# Назначение файла: Проверяет подсистему native_agent. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Run the compiled EXE without installing a service or changing Windows policies."""
import hashlib
import hmac
import json
import os
import socket
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from uuid import uuid4

import httpx
import pytest

pytestmark = pytest.mark.skipif(os.name != "nt", reason="Windows .NET Framework runtime")
EXE = Path(__file__).resolve().parents[1] / "agents/windows-native/bin/AegisDLP.exe"


def test_real_windows_loopback_bridge_cors_and_response_body(tmp_path):
    import ctypes
    if not ctypes.windll.shell32.IsUserAnAdmin():
        pytest.skip("HTTP.sys test listener needs an elevated Windows test runner")
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", 17645)) == 0:
            pytest.skip("Do not interfere with an already running Aegis service")
    calls = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            calls.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
            payload = b'{"paired":true}'
            self.send_response(200)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    source = tmp_path / "bridge.json"
    source.write_text(json.dumps({"root": str(tmp_path / "bridge-root"), "config": {
        "endpoint": origin + f"/api/v1/dlp/agents/{uuid4()}", "token": "test-only-key-" + "x" * 48,
        "installation_id": str(uuid4())}}))
    process = subprocess.Popen([str(EXE), "--test-bridge", str(source)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        with httpx.Client(base_url="http://127.0.0.1:17645", timeout=3) as client:
            for _ in range(20):
                try:
                    if client.options("/pair", headers={"Origin": origin}).status_code == 204:
                        break
                except httpx.TransportError:
                    time.sleep(.1)
            response = client.post("/pair", headers={"Origin": "https://wrong.example"}, json={"code": "ABCD1234"})
            assert response.status_code == 403
            response = client.options("/pair", headers={"Origin": origin})
            assert response.headers["Access-Control-Allow-Origin"] == origin
            assert response.headers["Access-Control-Allow-Private-Network"] == "true"
            response = client.post("/pair", headers={"Origin": origin}, json={"code": "ABCD1234"})
            assert response.status_code == 200 and response.json() == {"paired": True}
            assert int(response.headers["Content-Length"]) == len(response.content)
            assert calls == [{"code": "ABCD1234", "source": "loopback"}]
    finally:
        process.communicate(timeout=15)
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_native_crypto_self_test_needs_no_python_installation_or_service():
    result = subprocess.run([str(EXE), "--self-test"], capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr.decode(errors="replace")


@pytest.mark.parametrize("scenario", ["normal", "tampered", "offline-retry"])
def test_native_queue_transport_and_signed_policy_rejects_tampering(tmp_path, scenario):
    tampered = scenario == "tampered"
    availability = {"online": scenario != "offline-retry"}
    token = "native-test-key-" + "x" * 48
    calls = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            assert self.headers["Authorization"] == "Bearer " + token
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            calls.append((self.path, body))
            if not availability["online"]:
                payload, status = {"detail": "Simulated offline server"}, 503
            elif self.path.endswith("/heartbeat"):
                policy = '{"usb_mode":"audit","version":1}'
                key = hashlib.sha256((token + ":policy").encode()).digest()
                signature = hmac.new(key, policy.encode(), hashlib.sha256).hexdigest()
                payload = {"accepted": True, "policy_json": policy, "policy_signature": "bad" if tampered else signature, "commands": []}
                status = 200
            else:
                payload, status = {"created": len(body), "duplicates": 0}, 201
            data = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    root = tmp_path / "native-test"
    config = {"endpoint": f"http://127.0.0.1:{server.server_port}/api/v1/dlp/agents/{uuid4()}", "token": token, "installation_id": str(uuid4())}
    test_input = tmp_path / "input.json"
    test_input.write_text(json.dumps({"root": str(root), "config": config, "snapshot": {"status": {"antivirus": True}, "threats": []}}))
    try:
        result = subprocess.run([str(EXE), "--test-cycle", str(test_input)], capture_output=True, timeout=30)
        assert result.returncode == (1 if tampered or scenario == "offline-retry" else 0), result.stderr.decode(errors="replace")
        if scenario == "offline-retry":
            queued = list((root / "Private/Queue").glob("*.dat"))
            assert len(queued) == 1 and b"antivirus" not in queued[0].read_bytes()
            availability["online"] = True
            result = subprocess.run([str(EXE), "--test-cycle", str(test_input)], capture_output=True, timeout=30)
            assert result.returncode == 0, result.stderr.decode(errors="replace")
        heartbeat = next(body for path, body in calls if path.endswith("/heartbeat"))
        assert heartbeat["agent_version"] == "2.0.0-native" and heartbeat["service_mode"] is False
        state = json.loads((root / "status.json").read_text(encoding="utf-8-sig"))
        assert state["policy_version"] == (0 if tampered else 1)
        assert bool(state["policy_error"]) is tampered
        assert b"native-test-key" not in (root / "Private/config.dat").read_bytes()
        if not tampered:
            assert not list((root / "Private/Queue").glob("*.dat"))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
