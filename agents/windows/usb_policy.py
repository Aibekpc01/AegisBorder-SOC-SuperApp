# Назначение файла: Применяет и восстанавливает локальные ограничения USB-накопителей в Python-варианте агента.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Explicit, reversible local removable-disk policy. Never executes on import."""
import platform

KEY = r"SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices\{53f5630d-b6bf-11d0-94f2-00a0c91efb8b}"
VALUES = ("Deny_Read", "Deny_Write", "Deny_Execute")


def registry():
    if platform.system() != "Windows":
        raise RuntimeError("Windows 10/11 is required")
    import ctypes
    import winreg
    if not ctypes.windll.shell32.IsUserAnAdmin():
        raise RuntimeError("Run explicitly as a Windows administrator")
    return winreg


def block(backup_path, save, backend=None):
    reg = backend or registry()
    if backup_path.exists():
        raise ValueError("A policy backup already exists; restore before applying again")
    previous = {}
    with reg.CreateKeyEx(reg.HKEY_LOCAL_MACHINE, KEY, 0, reg.KEY_READ | reg.KEY_WRITE) as key:
        for name in VALUES:
            try:
                value, kind = reg.QueryValueEx(key, name)
                if kind != reg.REG_DWORD:
                    raise ValueError("Unexpected existing policy type; no changes made")
                previous[name] = value
            except FileNotFoundError:
                previous[name] = None
        # Backup precedes any change, including a partially failed operation.
        save(backup_path, previous)
        for name in VALUES:
            reg.SetValueEx(key, name, 0, reg.REG_DWORD, 1)


def restore(backup_path, backend=None):
    import json
    previous = json.loads(backup_path.read_text(encoding="utf-8"))
    if set(previous) != set(VALUES) or any(v is not None and type(v) is not int for v in previous.values()):
        raise ValueError("Invalid policy backup")
    reg = backend or registry()
    with reg.CreateKeyEx(reg.HKEY_LOCAL_MACHINE, KEY, 0, reg.KEY_READ | reg.KEY_WRITE) as key:
        for name, value in previous.items():
            if value is None:
                try:
                    reg.DeleteValue(key, name)
                except FileNotFoundError:
                    pass
            else:
                reg.SetValueEx(key, name, 0, reg.REG_DWORD, value)
    backup_path.unlink()
