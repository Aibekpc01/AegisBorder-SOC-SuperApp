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
    path: "assistant",
    group: "Анализ",
    Icon: BrainCircuit,
    status: "Протестирован локально",
    description:
      "Черновик по доказательствам инцидента; языковая модель не подключена.",
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
    path: "mail",
    group: "Интеграции",
    Icon: Mail,
    status: "Протестирован локально",
    description:
      "Локальный анализ учебных сообщений и личная история; реальная почта не подключена.",
  },
  {
    id: 8,
    name: "Microsoft 365 Monitor",
    path: "m365",
    group: "Интеграции",
    Icon: Building2,
    status: "Протестирован локально",
    description:
      "Мониторинг импортированных учебных событий; онлайн-адаптер Microsoft Graph не подключён.",
  },
  {
    id: 9,
    name: "Устройства",
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
    path: "twin",
    group: "Анализ",
    Icon: Network,
    status: "Протестирован локально",
    description:
      "Устройства, риски и связи с учётными записями по сохранённым событиям.",
  },
  {
    id: 11,
    name: "Визуальное расследование",
    group: "Анализ",
    Icon: GitBranch,
    path: "investigations",
    status: "Протестирован локально",
    description:
      "Граф доказательств, фильтрация хронологии и материалы Workspace.",
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
    path: "tasks",
    group: "Рабочее пространство",
    Icon: ListChecks,
    status: "Протестирован локально",
    description:
      "Задачи, ответственные, сроки, проверяемые переходы статусов и защита версий.",
  },
  {
    id: 15,
    name: "Аналитика безопасности",
    group: "Анализ",
    Icon: Search,
    path: "security-analytics",
    status: "Протестирован локально",
    description:
      "Распределения по статусам, устройствам и правилам; показатели риска и PDF.",
  },
  {
    id: 16,
    name: "Центр интеграций",
    path: "integrations",
    group: "Интеграции",
    Icon: Network,
    status: "Протестирован локально",
    description:
      "Приёмники событий Kaspersky, DLP, Microsoft 365 и SIEM: ключи, проверка, дедупликация, журнал и импорт JSON/CSV.",
  },
  {
    id: 17,
    name: "Конструктор правил",
    group: "Анализ",
    Icon: SlidersHorizontal,
    path: "rule-builder",
    status: "Протестирован локально",
    description:
      "Создание правил подсчёта по типу, порогу и окну; настройка существующих правил.",
  },
  {
    id: 18,
    name: "Академия безопасности",
    group: "Обучение",
    Icon: BookOpen,
    path: "academy",
    status: "Протестирован локально",
    description:
      "12 учебников, 36 глав с примерами, серверная проверка ответов и личная история результатов.",
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
    name: "Демонстрация проекта",
    group: "Обучение",
    Icon: Presentation,
    path: "commission",
    status: "Протестирован",
    description:
      "Интерактивные этапы, выбор ситуации, реальный результат проверки и путь до отчёта.",
  },
] as const;
export const moduleGroups = [
  "Мониторинг",
  "Анализ",
  "Рабочее пространство",
  "Обучение",
  "Интеграции",
];

export const platformNavigation = [
  ...modules,
  {
    id: 21,
    name: "Чат",
    group: "Рабочее пространство",
    Icon: Users,
    path: "team",
    status: "Протестирован локально",
    description:
      "Обсуждение киберинцидентов и совместных действий в сохраняемом чате. Личные учебные обсуждения изолированы.",
  },
] as const;
