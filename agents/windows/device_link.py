# Назначение файла: Обслуживает локальную связь устройства с браузером для Python-варианта агента.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Site enrollment token protected with current-user Windows DPAPI."""
import base64
import ctypes
import json
import platform
from urllib.parse import urlsplit
from urllib.request import Request, build_opener


def dpapi(data, decrypt=False):
    if platform.system() != "Windows":
        raise RuntimeError("Windows DPAPI is required")
    from ctypes import wintypes

    class Blob(ctypes.Structure):
        _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_ubyte))]

    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = Blob()
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    function = crypt.CryptUnprotectData if decrypt else crypt.CryptProtectData
    function.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
                         ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    function.restype = wintypes.BOOL
    if not function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(target)):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        kernel.LocalFree(target.data)


def validate_link(endpoint):
    from uuid import UUID
    u = urlsplit(endpoint)
    if u.username or u.password or u.query or u.fragment:
        raise ValueError("Invalid device URL")
    if not u.hostname or (u.scheme != "https" and not (u.scheme == "http" and u.hostname in ("127.0.0.1", "localhost"))):
        raise ValueError("Device enrollment requires HTTPS")
    prefix = "/api/v1/dlp/agents/"
    if not u.path.startswith(prefix) or str(UUID(u.path[len(prefix):])) != u.path[len(prefix):]:
        raise ValueError("Invalid device endpoint")
    return endpoint


def import_enrollment(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    endpoint = validate_link(data["endpoint"])
    if not isinstance(data.get("token"), str) or len(data["token"]) < 40:
        raise ValueError("Invalid enrollment key")
    return {"device_endpoint": endpoint, "device_token": base64.b64encode(dpapi(data["token"].encode())).decode()}


def token(config):
    return dpapi(base64.b64decode(config["device_token"]), decrypt=True).decode()


def heartbeat(config, snapshot, pending, opener=None):
    try:
        from .endpoint_agent import NoRedirect
    except ImportError:
        from endpoint_agent import NoRedirect
    endpoint = validate_link(config["device_endpoint"])
    payload = {"installation_id": config["installation_id"], "hostname": platform.node()[:80],
               "os": platform.platform()[:120], "status": snapshot.get("status", {}),
               "collection_error": snapshot.get("collection_error", False), "pending": pending}
    request = Request(endpoint + "/heartbeat", data=json.dumps(payload).encode(), method="POST",
                      headers={"Authorization": "Bearer " + token(config), "Content-Type": "application/json"})
    with (opener or build_opener(NoRedirect())).open(request, timeout=20) as response:
        if response.status != 200 or not json.loads(response.read(10000)).get("accepted"):
            raise RuntimeError("Heartbeat was not acknowledged")
