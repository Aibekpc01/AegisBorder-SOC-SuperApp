"""Детерминированные входные события: результаты рассчитывает Detection Engine."""

from datetime import timedelta

from .models import utcnow

# id, название, тип события, порог, окно, базовый риск, объяснение.
RULES = [
    (
        "bruteforce",
        "Многократные ошибки входа",
        "login_failed",
        5,
        60,
        65,
        "Не менее пяти ошибок входа за минуту.",
    ),
    (
        "night-login",
        "Вход в необычное время",
        "login_success",
        1,
        60,
        55,
        "Вход вне учебного графика 08:00–20:00 по времени Казахстана (UTC+5).",
    ),
    (
        "restricted",
        "Доступ к закрытым файлам",
        "file_denied",
        1,
        60,
        70,
        "Попытка доступа к ресурсу с признаком ограниченного доступа.",
    ),
    (
        "usb",
        "Неизвестное USB-устройство",
        "usb_connected",
        1,
        60,
        60,
        "Устройство отсутствует в учебном списке разрешённых USB.",
    ),
    (
        "server",
        "Отключение сервера",
        "heartbeat_lost",
        1,
        180,
        85,
        "Разрыв синтетического heartbeat сервера не менее 120 секунд.",
    ),
    (
        "activity",
        "Необычная активность компьютера",
        "activity",
        1,
        60,
        65,
        "Учебный показатель CPU не менее 90% и не менее 50 процессов.",
    ),
    (
        "critical-files",
        "Изменение критических файлов",
        "file_changed",
        1,
        60,
        85,
        "Изменён файл, отмеченный как критический.",
    ),
    (
        "copy",
        "Массовое копирование файлов",
        "file_copy",
        3,
        60,
        75,
        "Не менее трёх операций и суммарно не менее 500 файлов за минуту.",
    ),
    (
        "logs",
        "Удаление журналов событий",
        "log_deleted",
        1,
        60,
        90,
        "Удалён журнал источника событий.",
    ),
    (
        "network",
        "Необычные сетевые подключения",
        "network",
        3,
        60,
        65,
        "Не менее трёх соединений с адресами вне учебного списка разрешённых.",
    ),
    (
        "privileges",
        "Неожиданное повышение прав",
        "role_changed",
        1,
        60,
        90,
        "Переход к роли администратора без признака согласования.",
    ),
    (
        "repeated",
        "Повторяющиеся нарушения",
        "policy_violation",
        3,
        300,
        70,
        "Три нарушения политики за пять минут.",
    ),
    (
        "behavior",
        "Нетипичные действия учётной записи",
        "account_action",
        1,
        60,
        70,
        "Нетипичная операция и объём не менее чем в пять раз выше учебного профиля.",
    ),
    (
        "settings",
        "Подозрительное изменение настроек",
        "config_changed",
        1,
        60,
        85,
        "Без согласования отключён синтетический контроль защиты.",
    ),
    (
        "complex",
        "Комплексный киберинцидент",
        "login_failed",
        5,
        60,
        65,
        "Корреляция ошибок входа, успешного входа и доступа к закрытому ресурсу.",
    ),
]


def catalog():
    return [
        dict(id=x[0], name=x[1], description=x[6], priority=1 if i < 9 else 2)
        for i, x in enumerate(RULES)
    ]


def generate(sid, run_id):
    if sid not in {x[0] for x in RULES}:
        raise ValueError("Сценарий не найден")
    start = utcnow() - timedelta(seconds=30)
    items = {
        "bruteforce": [("login_failed", {})] * 5 + [("login_success", {"local_hour": 10})],
        "night-login": [("login_success", {"local_hour": 2})],
        "restricted": [("file_denied", {"restricted": True, "resource": "учебный_архив"})],
        "usb": [("usb_connected", {"approved": False, "serial": "DEMO-USB-001"})],
        "server": [("heartbeat_lost", {"gap_seconds": 150, "kind": "server"})],
        "activity": [("activity", {"cpu": 96, "processes": 75})],
        "critical-files": [("file_changed", {"critical": True, "resource": "demo_config.ini"})],
        "copy": [("file_copy", {"files": 200})] * 3,
        "logs": [("log_deleted", {"log": "учебный журнал авторизации"})],
        "network": [("network", {"approved": False, "ip": f"192.0.2.{i}"}) for i in range(1, 4)],
        "privileges": [("role_changed", {"new_role": "admin", "approved": False})],
        "repeated": [("policy_violation", {"policy": "учебная политика доступа"})] * 3,
        "behavior": [("account_action", {"unusual": True, "volume": 600, "baseline": 100})],
        "settings": [("config_changed", {"protection_enabled": False, "approved": False})],
        "complex": [("login_failed", {})] * 5
        + [("login_success", {"local_hour": 10}), ("file_denied", {"restricted": True})],
    }[sid]
    return [
        dict(
            external_id=f"run-{run_id}-{i}",
            time=start + timedelta(seconds=i * 3),
            device="Сервер-01" if sid == "server" else "ПК-01",
            account="учебный_оператор",
            source="Учебный генератор",
            type=kind,
            detail={
                "login_failed": "Неудачная попытка входа",
                "login_success": "Успешный вход",
                "file_denied": "Отказ в доступе к закрытому ресурсу",
                "file_copy": "Копирование группы файлов",
            }.get(kind, dict((x[0], x[1]) for x in RULES)[sid]),
            features=data,
        )
        for i, (kind, data) in enumerate(items)
    ]
