import {
  Activity,
  BookOpen,
  BrainCircuit,
  Building2,
  FileText,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Mail,
  Monitor,
  Network,
  Presentation,
  ScanLine,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Workflow,
} from "lucide-react";
export const modules = [
  {
    id: 1,
    name: "Command Center",
    group: "Мониторинг",
    Icon: LayoutDashboard,
    path: "",
    status: "Протестирован",
    description:
      "Оперативная панель с данными базы и переходами к событиям и инцидентам.",
  },
  {
    id: 2,
    name: "Мониторинг событий",
    group: "Мониторинг",
    Icon: Activity,
    path: "events",
    status: "Протестирован",
    description:
      "Поиск, фильтры, подробности и живое обновление синтетических событий.",
  },
  {
    id: 3,
    name: "Центр инцидентов",
    group: "Мониторинг",
    Icon: ShieldAlert,
    path: "incidents",
    status: "Протестирован",
    description:
      "Жизненный цикл, ответственный, доказательства, комментарии и аудит.",
  },
  {
    id: 4,
    name: "Aegis AI",
    group: "Анализ",
    Icon: BrainCircuit,
    status: "Не начат",
    description:
      "Планируется локальный объяснимый помощник. Языковая модель не подключена.",
  },
  {
    id: 5,
    name: "Обнаружение аномалий",
    group: "Анализ",
    Icon: ScanLine,
    path: "anomalies",
    status: "Протестирован",
    description:
      "Отдельный Isolation Forest на синтетическом профиле с версиями и ограничениями.",
  },
  {
    id: 6,
    name: "Корреляция событий",
    group: "Анализ",
    Icon: Workflow,
    path: "analysis",
    status: "Протестирован",
    description:
      "Детерминированные правила, временные окна, пороги и объяснения риска.",
  },
  {
    id: 7,
    name: "Почтовая безопасность",
    group: "Интеграции",
    Icon: Mail,
    status: "Не начат",
    description:
      "Планируется анализ синтетических сообщений без подключения реальной почты.",
  },
  {
    id: 8,
    name: "Microsoft 365 Monitor",
    group: "Интеграции",
    Icon: Building2,
    status: "Не начат",
    description:
      "Адаптер ещё не реализован. Учётные данные Microsoft 365 не запрашиваются.",
  },
  {
    id: 9,
    name: "Контроль рабочих станций",
    group: "Мониторинг",
    Icon: Monitor,
    path: "assets",
    status: "Протестирован",
    description:
      "Учебный инвентарь и связанные события; удалённое управление отсутствует.",
  },
  {
    id: 10,
    name: "Цифровой двойник",
    group: "Анализ",
    Icon: Network,
    status: "Не начат",
    description:
      "Планируется интерактивная схема тестовых устройств, сегментов и связей.",
  },
  {
    id: 11,
    name: "Визуальное расследование",
    group: "Анализ",
    Icon: GitBranch,
    path: "investigations",
    status: "В разработке",
    description:
      "Работают расследования и хронология. Граф связей пока не реализован.",
  },
  {
    id: 12,
    name: "Киберполигон",
    group: "Обучение",
    Icon: FlaskConical,
    path: "scenarios",
    status: "Протестирован",
    description:
      "15 различных ситуаций с событиями, обнаружением и собственными сеансами.",
  },
  {
    id: 13,
    name: "Aegis Workspace",
    group: "Рабочее пространство",
    Icon: FileText,
    path: "workspace",
    status: "Протестирован",
    description:
      "Редактор, таблицы, автосохранение, версии, заметки и статусы документов.",
  },
  {
    id: 14,
    name: "Задачи и согласования",
    group: "Рабочее пространство",
    Icon: ListChecks,
    status: "Не начат",
    description:
      "В Workspace есть статусы документов; отдельный модуль задач ещё не реализован.",
  },
  {
    id: 15,
    name: "Аналитика безопасности",
    group: "Анализ",
    Icon: Search,
    path: "reports",
    status: "В разработке",
    description:
      "Работают панель и PDF инцидентов. Расширенная аналитика находится в плане.",
  },
  {
    id: 16,
    name: "Центр интеграций",
    group: "Интеграции",
    Icon: Network,
    status: "Не начат",
    description:
      "Kaspersky, DLP «Киберщит», Windows Event Log: начать с документированных тестовых форматов.",
  },
  {
    id: 17,
    name: "Конструктор правил",
    group: "Анализ",
    Icon: SlidersHorizontal,
    path: "analysis",
    status: "В разработке",
    description:
      "Администратор меняет существующие пороги. Визуальный конструктор новых правил ещё не создан.",
  },
  {
    id: 18,
    name: "Академия безопасности",
    group: "Обучение",
    Icon: BookOpen,
    path: "help",
    status: "В разработке",
    description:
      "Есть интерактивные инструкции. Курсы, оценки и сертификаты пока отсутствуют.",
  },
  {
    id: 19,
    name: "Пользователи и настройки",
    group: "Рабочее пространство",
    Icon: Users,
    path: "settings",
    status: "Протестирован",
    description:
      "Профили, фото, роли, история входов и политика доступа согласно правам.",
  },
  {
    id: 20,
    name: "Режим комиссии",
    group: "Обучение",
    Icon: Presentation,
    path: "commission",
    status: "Протестирован",
    description:
      "Пошаговая самостоятельная проверка: ситуация, события, расследование и отчёт.",
  },
] as const;
export const moduleGroups = [
  "Мониторинг",
  "Анализ",
  "Рабочее пространство",
  "Обучение",
  "Интеграции",
];
