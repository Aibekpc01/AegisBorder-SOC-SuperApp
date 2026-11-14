# agents/windows-native/

Нативный Aegis DLP на C#/.NET Framework: служба, трей, локальный HTTP-мост и установка. EXE получается через build.ps1.

Общая карта: [SOURCE_GUIDE.md](../../SOURCE_GUIDE.md).

Файлы непосредственно в этой папке:

- [AegisDLP.cs](AegisDLP.cs) — Исходник Windows-приложения Aegis DLP: служба, сбор состояния, локальное подтверждение браузера, политики, трей и установка.
- [build.ps1](build.ps1) — Компилирует AegisDLP.cs в Windows EXE. После изменения комментариев пересборка для работы текущего EXE не нужна.
- [collect.ps1](collect.ps1) — Собирает доступные Windows сведения о состоянии устройства для нативного агента.
