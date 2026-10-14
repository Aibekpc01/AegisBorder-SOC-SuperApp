"""Локальная политика сетевого доступа: без внешней передачи IP и выдуманной геолокации."""

import ipaddress
import os

from .models import Setting

DEFAULT_POLICY = {
    "block_anonymizers": True,
    "restrict_to_trusted": False,
    "trusted_cidrs": [],
    "blocked_cidrs": [],
    "networks": [],
}


def policy(db):
    row = db.get(Setting, "access_policy")
    return row.value if row else dict(DEFAULT_POLICY)


def address_in(value, cidrs):
    try:
        ip = ipaddress.ip_address(value)
        return any(ip in ipaddress.ip_network(c, strict=False) for c in cidrs)
    except ValueError:
        return False


def connection(request):
    peer = request.scope.get("client")
    peer_ip = str(peer[0])[:100] if peer else ""
    ip = peer_ip
    source = "Адрес соединения сервера"
    # Forwarding is accepted only from administrator-configured trusted proxies.
    trusted = [x.strip() for x in os.getenv("TRUSTED_PROXY_CIDRS", "").split(",") if x.strip()]
    if trusted and address_in(peer_ip, trusted):
        chain = [
            x.strip() for x in request.headers.get("x-forwarded-for", "").split(",") if x.strip()
        ] + [peer_ip]
        for hop in reversed(chain):
            try:
                ipaddress.ip_address(hop)
            except ValueError:
                break
            if not address_in(hop, trusted):
                ip = hop
                source = "Заголовок доверенного прокси"
                break
    return {"ip": ip or "Не определён", "peer_ip": peer_ip or "Не определён", "ip_source": source}


def evaluate(ip, config):
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        address = None
    matched = [n for n in config.get("networks", []) if address_in(ip, [n["cidr"]])]
    matched.sort(key=lambda n: ipaddress.ip_network(n["cidr"]).prefixlen, reverse=True)
    location = next((n for n in matched if n.get("country") or n.get("city")), None)
    anonymous = next((n for n in matched if n["kind"] in ("vpn", "proxy", "tor", "hosting")), None)
    blocked = address_in(ip, config.get("blocked_cidrs", [])) or any(
        n["kind"] == "blocked" for n in matched
    )
    trusted = address_in(ip, config.get("trusted_cidrs", [])) or any(
        n["kind"] == "trusted" for n in matched
    )
    reasons = []
    if blocked:
        reasons.append("IP-адрес находится в запрещённой сети")
    if config.get("block_anonymizers", True) and anonymous:
        reasons.append("Сеть отмечена как VPN, прокси, Tor или хостинг в локальном справочнике")
    if config.get("restrict_to_trusted") and not trusted:
        reasons.append("Вход разрешён только из доверенных сетей")
    return {
        "allowed": not reasons,
        "reason": "; ".join(reasons) or "Действующие сетевые правила разрешают доступ",
        "ip": ip,
        "network_kind": anonymous["kind"]
        if anonymous
        else "trusted"
        if trusted
        else "local"
        if address and not address.is_global
        else "unknown",
        "anonymizer_status": "Есть запись в локальном справочнике"
        if anonymous
        else "Не установлено: данных о VPN нет",
        "network_label": matched[0]["label"]
        if matched
        else "Локальная / внутренняя сеть"
        if address and not address.is_global
        else "Сеть не классифицирована",
        "country": location.get("country", "") if location else "",
        "city": location.get("city", "") if location else "",
        "location_source": "Справочник администратора: приблизительное расположение сети"
        if location
        else "Географическое положение не определено",
        "checked_by": "Локальная CIDR-политика; полное обнаружение VPN не гарантируется",
    }


def inspect(db, request):
    info = connection(request)
    return {**info, "network": evaluate(info["ip"], policy(db))}
