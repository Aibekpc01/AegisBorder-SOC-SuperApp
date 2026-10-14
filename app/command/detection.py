"""Корреляция фактических событий: окна, пороги, дедупликация и объяснения."""

from datetime import timedelta, timezone

from sqlalchemy import select, text

from .models import Alert, Event, Incident, IncidentEvent, Rule
from .schemas import EventInput


def predicate(rule, event):
    f = event.features
    if rule.id == "night-login":
        hour = f.get(
            "local_hour",
            (event.time.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=5)))).hour,
        )
        return hour < 8 or hour >= 20
    if rule.id == "restricted":
        return f.get("restricted") is True
    if rule.id in ("usb", "network"):
        return f.get("approved") is False
    if rule.id == "server":
        return f.get("kind") == "server" and f.get("gap_seconds", 0) >= 120
    if rule.id == "activity":
        return f.get("cpu", 0) >= 90 and f.get("processes", 0) >= 50
    if rule.id == "critical-files":
        return f.get("critical") is True
    if rule.id == "privileges":
        return f.get("new_role") == "admin" and f.get("approved") is False
    if rule.id == "behavior":
        return (
            f.get("unusual") is True
            and f.get("baseline", 0) > 0
            and f.get("volume", 0) >= 5 * f["baseline"]
        )
    if rule.id == "settings":
        return f.get("protection_enabled") is False and f.get("approved") is False
    return True


def analyze(db, event):
    candidates = db.scalars(select(Rule).where(Rule.enabled.is_(True))).all()
    created = []
    for rule in candidates:
        # complex shares brute-force evidence, then escalates the same incident.
        if rule.id == "complex":
            continue
        start = event.time - timedelta(seconds=rule.window)
        peers = db.scalars(
            select(Event)
            .where(
                Event.owner_id == event.owner_id,
                Event.demo_id == event.demo_id,
                Event.device == event.device,
                Event.account == event.account,
                Event.source == event.source,
                Event.time >= start,
                Event.time <= event.time,
            )
            .order_by(Event.time, Event.id)
        ).all()
        matched = [x for x in peers if x.type == rule.event_type and predicate(rule, x)]
        if len(matched) < rule.threshold:
            continue
        if rule.id == "copy" and sum(x.features.get("files", 0) for x in matched) < 500:
            continue
        risk = rule.risk
        reasons = [
            rule.description,
            f"Устройство: {event.device}. Учётная запись: {event.account}. Совпадений: {len(matched)}; окно: {rule.window} с.",
        ]
        if rule.id == "bruteforce":

            def order_key(item):
                return (item.time.replace(tzinfo=timezone.utc), item.id)

            threshold_event = matched[rule.threshold - 1]
            successes = [
                x
                for x in peers
                if x.type == "login_success" and order_key(x) > order_key(threshold_event)
            ]
            restricted = [
                x
                for x in peers
                if successes
                and x.type == "file_denied"
                and x.features.get("restricted") is True
                and order_key(x) > order_key(successes[0])
            ]
            if successes:
                risk = min(100, risk + 15)
                matched += successes
                reasons.append("После ошибок произошёл успешный вход: +15 к риску.")
            if successes and restricted:
                risk = min(100, risk + 15)
                matched += restricted
                reasons.append("Затем запрошен закрытый ресурс: +15 к риску.")
        inc = db.scalar(
            select(Incident)
            .join(IncidentEvent, IncidentEvent.incident_id == Incident.id)
            .where(
                Incident.rule_id == rule.id,
                IncidentEvent.event_id.in_([peer.id for peer in matched]),
            )
            .order_by(Incident.id.desc())
            .limit(1)
        )
        if not inc:
            inc = db.scalar(
                select(Incident)
                .where(
                    Incident.owner_id == event.owner_id,
                    Incident.demo_id == event.demo_id,
                    Incident.device == event.device,
                    Incident.account == event.account,
                    Incident.rule_id == rule.id,
                    Incident.created >= event.received - timedelta(seconds=300),
                    Incident.status.not_in(["Закрыт", "Ложное срабатывание"]),
                )
                .order_by(Incident.id.desc())
                .limit(1)
            )
        if not inc:
            inc = Incident(
                title=rule.name,
                risk=risk,
                explanation=" ".join(reasons),
                device=event.device,
                account=event.account,
                rule_id=rule.id,
                owner_id=event.owner_id,
                demo_id=event.demo_id,
                recommendations=[
                    "Проверить хронологию событий",
                    "Уточнить, было ли действие согласовано",
                    "Зафиксировать вывод расследования",
                ],
            )
            db.add(inc)
            db.flush()
            db.add(
                Alert(
                    incident_id=inc.id,
                    rule_id=rule.id,
                    evidence={"threshold": rule.threshold, "window": rule.window, "risk": risk},
                )
            )
            created.append(inc.id)
        else:
            inc.risk = max(inc.risk, risk)
            inc.explanation = " ".join(reasons)
        linked = set(
            db.scalars(select(IncidentEvent.event_id).where(IncidentEvent.incident_id == inc.id))
        )
        for peer in matched:
            if peer.id not in linked:
                db.add(IncidentEvent(incident_id=inc.id, event_id=peer.id))
                linked.add(peer.id)
        event.severity = "Критическая" if risk >= 85 else "Высокая" if risk >= 65 else "Средняя"
        db.flush()
    return created


def ingest(db, data, owner_id, demo_id=None, run_id=None):
    normalized = EventInput.model_validate(data)
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(8142026004)"))
    existing = db.scalar(select(Event).where(Event.external_id == normalized.external_id))
    if existing:
        if existing.owner_id != owner_id or existing.demo_id != demo_id:
            from fastapi import HTTPException

            raise HTTPException(409, "Идентификатор события уже используется")
        return existing, [], True
    payload = normalized.model_dump()
    payload["time"] = normalized.time.astimezone(timezone.utc)
    event = Event(**payload, owner_id=owner_id, demo_id=demo_id, run_id=run_id)
    db.add(event)
    db.flush()
    return event, analyze(db, event), False
