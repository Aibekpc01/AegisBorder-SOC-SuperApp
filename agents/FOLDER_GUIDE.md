# agents/

Исходники Windows-агентов. windows-native/ — нативная служба Aegis DLP 2.0; windows/ — Python-вариант.

Общая карта: [SOURCE_GUIDE.md](../SOURCE_GUIDE.md).

Файлы непосредственно в этой папке:

- [windows/](windows/FOLDER_GUIDE.md) — Python-вариант агента и установочные сценарии. Не следует смешивать его с требованиями к нативной службе 2.0.
- [windows-native/](windows-native/FOLDER_GUIDE.md) — Нативный Aegis DLP на C#/.NET Framework: служба, трей, локальный HTTP-мост и установка. EXE получается через build.ps1.
