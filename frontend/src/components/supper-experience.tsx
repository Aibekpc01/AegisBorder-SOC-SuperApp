/* Назначение файла: Содержит дополнительные презентационные элементы суперприложения.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Globe2,
  Layers,
  Newspaper,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "../api";
import { date, publicationDate } from "../lib/utils";
import { BRAND_NAME } from "../lib/brand";
import { Dialog } from "./ui/dialog";
import operator from "../assets/story/operator.webp";
import hacker from "../assets/story/hacker.webp";
import "../supper-experience.css";

type Slide = {
  label: string;
  title: string;
  text: string;
  points: string[];
  path: string;
  action: string;
  image?: string;
};
const journey: Slide[] = [
  {
    label: "01 / ОСНОВА · РЕАЛИЗОВАНО",
    title: "Из события — в понятный сигнал",
    text: "Проект начинался с учебного SOC: собрать события, проверить правила и объяснить, почему возникло предупреждение.",
    points: [
      "15 синтетических ситуаций",
      "Правила, временные окна и оценка риска",
      "Сохраняемые события и доказательства",
    ],
    path: "events",
    action: "Посмотреть события",
  },
  {
    label: "02 / РАССЛЕДОВАНИЕ · РЕАЛИЗОВАНО",
    title: "За каждым решением стоят факты",
    text: "К мониторингу добавились расследования: ответственный, хронология, граф доказательств и отчёт по результатам проверки.",
    points: [
      "Статусы и история решений",
      "Граф связанных событий",
      "Сохраняемый PDF-снимок",
    ],
    path: "incidents",
    action: "Открыть инциденты",
    image: operator,
  },
  {
    label: "03 / SUPERAPP · РЕАЛИЗОВАНО",
    title: "Команда работает в одном пространстве",
    text: "Документы, задачи, обучение и чат объединены вокруг расследования. Приложение показывает подключения к сайту и присутствие сотрудников.",
    points: [
      "Workspace с версиями документов",
      "Проверка задач и согласование документов",
      "Устройства, сотрудники и чат",
    ],
    path: "workspace",
    action: "Открыть рабочее пространство",
  },
  {
    label: "04 / CRM И QAINAR.KNB · ПЛАН",
    title: "Связать расследование с рабочими процессами",
    text: "Будущий этап: обмен карточками, задачами и статусами с CRM и Qainar.knb. Подключение потребует официального API и тестового контура.",
    points: [
      "Сопоставление сотрудников и ролей",
      "Передача согласованных карточек",
      "Контроль доставки и журнал обмена",
    ],
    path: "integrations",
    action: "Посмотреть основу интеграций",
  },
  {
    label: "05 / ЭКОСИСТЕМА · ПЛАН",
    title: "Подключать новые сервисы по понятным правилам",
    text: "Развитие универсального обмена: корпоративные источники, уведомления, учётные системы и двусторонние адаптеры.",
    points: [
      "Контракт данных и ограничение прав",
      "Повторные попытки и дедупликация",
      "Пилот, проверка и постепенный запуск",
    ],
    path: "integrations",
    action: "Перейти к интеграциям",
  },
];
const training: Slide[] = [
  {
    label: "01 / ЗАМЫСЕЛ МОШЕННИКА",
    title: "«Срочно подтвердите доступ»",
    text: "Учебный пример: сотруднику приходит письмо от якобы службы поддержки. Ссылка ведёт на поддельную страницу входа.",
    points: [
      "Давление срочностью",
      "Похожий, но чужой домен",
      "Просьба ввести пароль или код",
    ],
    path: "mail",
    action: "Проверить учебное письмо",
    image: hacker,
  },
  {
    label: "02 / ДЕЙСТВИЕ СОТРУДНИКА",
    title: "Остановиться и сообщить",
    text: "Сотрудник не открывает вложение и не передаёт пароль. Он сохраняет письмо и уведомляет ответственного по установленному каналу.",
    points: [
      "Сохранить адрес отправителя и ссылку",
      "Не отвечать мошеннику",
      "Передать факты оператору SOC",
    ],
    path: "team",
    action: "Открыть обсуждение",
  },
  {
    label: "03 / ОПЕРАТОР SOC",
    title: "Проверить цепочку событий",
    text: "Оператор сопоставляет письмо с попытками входа и сигналами системы. Подбор пароля можно воспроизвести в отдельном учебном сеансе ниже.",
    points: [
      "Изучить фактические события",
      "Проверить причину срабатывания",
      "Назначить проверку и записать вывод",
    ],
    path: "incidents",
    action: "Изучить инциденты",
    image: operator,
  },
  {
    label: "04 / РЕЗУЛЬТАТ",
    title: "От проверки — к согласованному решению",
    text: "Материалы расследования сохраняются в документе. Ответственный отправляет их на проверку, после чего формируется отчёт.",
    points: [
      "Документ и история версий",
      "Проверка ответственным",
      "PDF для обсуждения и обучения",
    ],
    path: "workspace",
    action: "Подготовить документ",
  },
];

export function ExperienceSlides({
  mode,
}: {
  mode: "evolution" | "demo" | "training";
}) {
  const slides = mode === "training" ? training : journey;
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  return (
    <section
      className={`supper-story supper-story-${mode}`}
      aria-label={
        mode === "evolution"
          ? "История и развитие приложения"
          : "Интерактивная демонстрация"
      }
    >
      <header>
        <span className="eyebrow">
          <Sparkles size={15} /> {BRAND_NAME}
        </span>
        <h2>
          {mode === "evolution"
            ? "Как развивалась платформа. Что дальше."
            : mode === "training"
              ? "Мошенник и оператор SOC: разбор по шагам"
              : "Один сигнал. Команда. Проверенное решение."}
        </h2>
        <p>
          {mode === "evolution"
            ? "Пройденные этапы и открытая дорожная карта будущих интеграций."
            : "Листайте примеры, затем попробуйте действующие инструменты ниже."}
        </p>
      </header>
      <div className="supper-slide" key={index} aria-live="polite">
        <div className="supper-slide-copy">
          <span className="eyebrow">{slide.label}</span>
          <h3>{slide.title}</h3>
          <p>{slide.text}</p>
          <ul>
            {slide.points.map((point) => (
              <li key={point}>
                <CheckCircle2 size={17} />
                {point}
              </li>
            ))}
          </ul>
          <Link className="btn" to={`/app/${slide.path}`}>
            {slide.action}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="supper-slide-art" aria-hidden="true">
          {slide.image ? (
            <img src={slide.image} alt="" loading="lazy" decoding="async" width={680} height={1020} />
          ) : (
            <div className="supper-orbit">
              <span />
              <span />
              <span />
              <ShieldCheck size={78} />
              <small>AEGIS / {String(index + 1).padStart(2, "0")}</small>
            </div>
          )}
        </div>
      </div>
      <nav className="supper-slide-nav" aria-label="Управление слайдами">
        <button
          className="btn btn-outline"
          aria-label="Предыдущий слайд"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          <ArrowLeft size={17} />
        </button>
        <div role="tablist" aria-label="Этапы">
          {slides.map((s, i) => (
            <button
              key={s.label}
              role="tab"
              aria-selected={i === index}
              aria-label={s.label}
              onClick={() => setIndex(i)}
            >
              {String(i + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
        <span>
          {index + 1} / {slides.length}
        </span>
        <button
          className="btn btn-outline"
          aria-label="Следующий слайд"
          disabled={index === slides.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          <ArrowRight size={17} />
        </button>
      </nav>
      {mode === "evolution" && (
        <div className="supper-roadmap">
          {journey.map((item, i) => (
            <button
              key={item.label}
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
            >
              <span>{i < 3 ? "Реализовано" : "Будущий этап"}</span>
              <strong>{item.title}</strong>
              <small>{item.points[0]}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

type News = {
  items: { title: string; url: string; published: string; source: string }[];
  updated_at: string | null;
  stale: boolean;
  error?: string;
};
export function CyberNews() {
  const query = useQuery({
    queryKey: ["cyber-news"],
    queryFn: () => api<News>("/news"),
    refetchInterval: 300000,
    retry: false,
  });
  return (
    <section className="supper-news panel">
      <header className="row between wrap">
        <div>
          <span className="eyebrow">
            <Newspaper size={15} /> КИБЕРБЕЗОПАСНОСТЬ В МИРЕ
          </span>
          <h2>Публикации и предупреждения</h2>
        </div>
        <button
          className="btn btn-outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Обновляем…" : "Обновить"}
        </button>
      </header>
      <p>
        Публикации CERT-EU на языке источника. Проверяем обновления каждые 5
        минут.{" "}
        {query.data?.updated_at &&
          `Последнее получение: ${date(query.data.updated_at)}.`}
      </p>
      {query.isPending && <p role="status">Получаем публикации…</p>}
      {(query.error || query.data?.stale) && (
        <p role="status">
          {query.data?.error || "Не удалось получить новости. Повторите позже."}
        </p>
      )}
      <div className="supper-news-grid">
        {query.data?.items.map((item) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              {item.source}
              <ArrowRight size={15} />
            </span>
            <h3>{item.title}</h3>
            <small>
              {publicationDate(item.published)}
            </small>
          </a>
        ))}
      </div>
      {query.data && !query.data.items.length && (
        <p>Публикации пока не получены.</p>
      )}
    </section>
  );
}

const workflows: Record<
  string,
  { title: string; text: string; steps: [string, string][] }
> = {
  workspace: {
    title: "Подготовьте материал, который можно проверить",
    text: "Откройте шаблон, заполните факты и назначьте ответственного. Автосохранение и версии помогают не потерять работу.",
    steps: [
      ["Черновик", "Выберите шаблон, добавьте факты и связь с инцидентом."],
      [
        "На проверке",
        "Назначьте ответственного и передайте документ на проверку.",
      ],
      [
        "Утверждён",
        "Аналитик или администратор подтверждает результат. Для правок верните документ в черновик.",
      ],
    ],
  },
  tasks: {
    title: "Кто делает, к какому сроку и кто проверяет",
    text: "Задача связывает конкретное действие с человеком и инцидентом. Завершение подтверждает постановщик или администратор.",
    steps: [
      ["Назначьте", "Опишите результат и срок, выберите исполнителя."],
      ["Проверьте", "Исполнитель переводит работу на проверку."],
      [
        "Подтвердите",
        "Проверьте результат, завершите задачу или верните в работу.",
      ],
    ],
  },
  "security-analytics": {
    title: "Начните с вопросов, а не с графиков",
    text: "Сколько ситуаций остаётся открытыми? Какие требуют внимания? На каких устройствах они повторяются? Фильтры ниже помогут найти ответ.",
    steps: [
      [
        "Выберите период",
        "Показатели пересчитываются по дате создания инцидента.",
      ],
      [
        "Найдите приоритет",
        "Критический риск — от 85 баллов, высокий — от 65.",
      ],
      [
        "Откройте факты",
        "Перейдите к инцидентам или выгрузите выбранный срез.",
      ],
    ],
  },
  settings: {
    title: "Настройте удобный способ работы",
    text: "Личные параметры ниже меняют интерфейс только в этом браузере. Общие настройки центра и сетевой доступ меняет администратор.",
    steps: [
      ["Внешний вид", "Выберите движение и плотность карточек."],
      ["Понятные инструкции", "Включите пояснения и начните со справки."],
      [
        "Доступ и профиль",
        "Обновите личные сведения. Роли и доступ настраивает администратор.",
      ],
    ],
  },
};
export function ServiceWorkflow({ page }: { page: string }) {
  const guide = workflows[page];
  if (!guide) return null;
  return (
    <section className="supper-workflow">
      <header>
        <span className="eyebrow">
          <Layers size={15} /> ПРОСТОЙ ПОРЯДОК РАБОТЫ
        </span>
        <h2>{guide.title}</h2>
        <p>{guide.text}</p>
      </header>
      <ol>
        {guide.steps.map(([title, text], i) => (
          <li key={title}>
            <b>{i + 1}</b>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

type Preferences = {
  motion: "system" | "reduced";
  density: "comfortable" | "compact";
  guidance: boolean;
};
const defaults: Preferences = {
  motion: "system",
  density: "comfortable",
  guidance: true,
};
export function PersonalExperience({
  userId,
  page,
}: {
  userId: number;
  page: string;
}) {
  const key = `aegis-experience-${userId}`;
  const [saved, setSaved] = useState("");
  const [value, setValue] = useState<Preferences>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "null");
      return {
        motion: data?.motion === "reduced" ? "reduced" : "system",
        density: data?.density === "compact" ? "compact" : "comfortable",
        guidance: data?.guidance !== false,
      };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = value.motion;
    root.dataset.density = value.density;
    root.dataset.guidance = String(value.guidance);
    return () => {
      delete root.dataset.motion;
      delete root.dataset.density;
      delete root.dataset.guidance;
    };
  }, [value]);
  function change(next: Preferences) {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setSaved("Личные настройки сохранены в этом браузере");
    } catch {
      setSaved(
        "Настройки применены; браузер не разрешил сохранить их после закрытия",
      );
    }
  }
  if (page !== "settings") return null;
  return (
    <section className="panel supper-preferences">
      <h2>
        <Settings2 size={22} /> Личные настройки интерфейса
      </h2>
      <div className="module-form-grid">
        <label>
          Движение и эффекты
          <select
            value={value.motion}
            onChange={(e) =>
              change({
                ...value,
                motion: e.target.value as Preferences["motion"],
              })
            }
          >
            <option value="system">С учётом настроек устройства</option>
            <option value="reduced">Минимум движения</option>
          </select>
          <small>Отключите движение, если анимация отвлекает.</small>
        </label>
        <label>
          Плотность отображения
          <select
            value={value.density}
            onChange={(e) =>
              change({
                ...value,
                density: e.target.value as Preferences["density"],
              })
            }
          >
            <option value="comfortable">Просторно — для знакомства</option>
            <option value="compact">Компактно — больше данных</option>
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={value.guidance}
            onChange={(e) => change({ ...value, guidance: e.target.checked })}
          />
          Показывать пошаговые пояснения
        </label>
      </div>
      <div className="row wrap">
        <button className="btn btn-outline" onClick={() => change(defaults)}>
          Вернуть рекомендуемые
        </button>
        <Link className="btn btn-outline" to="/app/help">
          Открыть справку
        </Link>
        <Link className="btn btn-outline" to="/app/participants">
          Сотрудники
        </Link>
      </div>
      {saved && <p role="status">{saved}</p>}
    </section>
  );
}

type ReportItem = {
  id: number;
  incident_id: number;
  created: string;
  snapshot: Record<string, unknown> & {
    title?: string;
    status?: string;
    risk?: number;
    conclusion?: string;
  };
};
type Incident = {
  id: number;
  title: string;
  risk: number;
  status: string;
  device: string;
  rule_id: string;
  created: string;
};
export function ReportsCenter({
  canCreate,
  onIncident,
}: {
  canCreate: boolean;
  onIncident: (id: number) => void;
}) {
  const client = useQueryClient();
  const reports = useQuery({
    queryKey: ["reports-center"],
    queryFn: () => api<ReportItem[]>("/reports"),
  });
  const incidents = useQuery({
    queryKey: ["report-incidents"],
    queryFn: () => api<Incident[]>("/incidents"),
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [preview, setPreview] = useState<ReportItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rows = (reports.data || []).filter((r) =>
    `${r.id} ${r.snapshot.title || ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <section className="panel supper-reports">
      <span className="eyebrow">РЕЗУЛЬТАТЫ РАБОТЫ</span>
      <h2>Отчёт, который легко найти и объяснить</h2>
      <p>
        PDF фиксирует состояние инцидента в момент создания. Новые выводы не
        меняют старый отчёт: сформируйте новый снимок после проверки.
      </p>
      <div className="supper-report-create">
        <label>
          1. Выберите инцидент
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Выберите из списка…</option>
            {incidents.data?.map((i) => (
              <option key={i.id} value={i.id}>
                #{i.id} · {i.title}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn"
          disabled={!canCreate || !selected || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const item = await api<ReportItem>(
                `/reports/${selected}`,
                "POST",
                {},
              );
              await client.invalidateQueries({ queryKey: ["reports-center"] });
              setPreview(item);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={16} />
          {busy ? "Формируем…" : "2. Сформировать отчёт"}
        </button>
      </div>
      {!canCreate && (
        <p>
          Ваша роль позволяет просматривать готовые отчёты. Новый отчёт создаёт
          оператор.
        </p>
      )}
      {(error || reports.error || incidents.error) && (
        <p role="alert">
          {error || reports.error?.message || incidents.error?.message}
        </p>
      )}
      <label>
        Найти сохранённый отчёт
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Номер или название инцидента"
        />
      </label>
      {reports.isPending && <p role="status">Загрузка отчётов…</p>}
      <div className="supper-report-grid">
        {rows.map((r) => (
          <article key={r.id}>
            <span className="eyebrow">ОТЧЁТ #{r.id}</span>
            <h3>{r.snapshot.title || `Инцидент #${r.incident_id}`}</h3>
            <p>{date(r.created)}</p>
            <div className="row wrap">
              <button className="btn btn-outline" onClick={() => setPreview(r)}>
                Сведения
              </button>
              <a
                className="btn"
                href={`/api/v1/reports/${r.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Скачать PDF
                <Download size={14} />
              </a>
              <button
                className="btn btn-outline"
                onClick={() => onIncident(r.incident_id)}
              >
                Инцидент
              </button>
            </div>
          </article>
        ))}
      </div>
      {!reports.isPending && !rows.length && (
        <p>
          Отчётов по запросу пока нет. Выберите инцидент выше, чтобы создать
          первый.
        </p>
      )}
      {preview && (
        <Dialog
          open
          title={`Отчёт #${preview.id}`}
          onClose={() => setPreview(null)}
        >
          <h3>{preview.snapshot.title}</h3>
          <p>
            Снимок от {date(preview.created)}. Полный материал и доказательства
            находятся в PDF.
          </p>
          <dl>
            <dt>Инцидент</dt>
            <dd>#{preview.incident_id}</dd>
            <dt>Статус на момент формирования</dt>
            <dd>{preview.snapshot.status || "См. PDF"}</dd>
            <dt>Риск на момент формирования</dt>
            <dd>{preview.snapshot.risk ?? "См. PDF"}</dd>
          </dl>
          <a
            className="btn"
            href={`/api/v1/reports/${preview.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть PDF
          </a>
        </Dialog>
      )}
    </section>
  );
}

export function SecurityAnalytics() {
  const query = useQuery({
    queryKey: ["superapp-incidents"],
    queryFn: () => api<Incident[]>("/incidents"),
  });
  const [days, setDays] = useState("all"),
    [device, setDevice] = useState(""),
    [status, setStatus] = useState("");
  const all = query.data || [];
  const items = all.filter(
    (i) =>
      (!device || i.device === device) &&
      (!status || i.status === status) &&
      (days === "all" ||
        new Date(
          i.created.endsWith("Z") || /[+-]\d\d:\d\d$/.test(i.created)
            ? i.created
            : i.created + "Z",
        ).getTime() >=
          Date.now() - Number(days) * 86400000),
  );
  const open = items.filter(
    (i) => !["Закрыт", "Устранён", "Ложное срабатывание"].includes(i.status),
  );
  function exportCsv() {
    const cell = (value: unknown) =>
      `"${String(value)
        .replace(/^(\s*[=+@-]|[\t\r])/, "'$&")
        .replaceAll('"', '""')}"`;
    const data = [
      ["ID", "Название", "Устройство", "Статус", "Риск", "Дата"],
      ...items.map((i) => [
        i.id,
        i.title,
        i.device,
        i.status,
        i.risk,
        i.created,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + data.map((row) => row.map(cell).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "aegis-security-analytics.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel supper-analytics">
      <h2>Что требует внимания сейчас</h2>
      <p>
        Срез до 500 доступных инцидентов. Период определяется датой создания;
        это данные приложения, а не измерение всей инфраструктуры.
      </p>
      <div className="module-form-grid">
        <label>
          Период
          <select value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="all">Вся доступная история</option>
            <option value="1">Последние 24 часа</option>
            <option value="7">7 дней</option>
            <option value="30">30 дней</option>
          </select>
        </label>
        <label>
          Устройство
          <select value={device} onChange={(e) => setDevice(e.target.value)}>
            <option value="">Все устройства</option>
            {[...new Set(all.map((i) => i.device))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Статус
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все статусы</option>
            {[...new Set(all.map((i) => i.status))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending && <p role="status">Получаем данные…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      <div className="supper-kpis">
        {[
          [items.length, "В выбранном срезе", "Количество инцидентов"],
          [open.length, "Требуют работы", "Без устранённых, закрытых и ложных"],
          [
            open.filter((i) => i.risk >= 85).length,
            "Критический риск",
            "Открытые, от 85 баллов",
          ],
          [
            open.filter((i) => i.risk >= 65 && i.risk < 85).length,
            "Высокий риск",
            "Открытые, от 65 до 84 баллов",
          ],
        ].map(([count, title, hint]) => (
          <article key={title}>
            <strong>{count}</strong>
            <h3>{title}</h3>
            <small>{hint}</small>
          </article>
        ))}
      </div>
      <div className="supper-report-grid">
        {(["status", "device", "rule_id"] as const).map((key) => {
          const groups = Object.entries(
            items.reduce<Record<string, number>>((a, i) => {
              a[i[key]] = (a[i[key]] || 0) + 1;
              return a;
            }, {}),
          ).sort((a, b) => b[1] - a[1]);
          return (
            <article key={key}>
              <h3>
                {
                  {
                    status: "Как движется работа",
                    device: "Где возникают ситуации",
                    rule_id: "Какие правила срабатывают",
                  }[key]
                }
              </h3>
              {groups.map(([name, count]) => (
                <div className="analytics-bar" key={name}>
                  <span>{name}</span>
                  <meter
                    min={0}
                    max={Math.max(items.length, 1)}
                    value={count}
                  />
                  <b>
                    {count} · {Math.round((count / items.length) * 100)}%
                  </b>
                </div>
              ))}
            </article>
          );
        })}
      </div>
      <p>
        {open.length
          ? `Сначала проверьте открытые ситуации с наибольшим риском. В выбранном срезе таких ситуаций: ${open.length}.`
          : "В выбранном срезе нет открытых ситуаций. Проверьте фильтры или запустите учебный пример."}
      </p>
      <div className="row wrap">
        <Link className="btn" to="/app/incidents">
          Открыть инциденты
          <ArrowRight size={16} />
        </Link>
        <button
          className="btn btn-outline"
          disabled={!items.length}
          onClick={exportCsv}
        >
          Скачать срез CSV
          <Download size={16} />
        </button>
        <button
          className="btn btn-outline"
          onClick={() => {
            setDays("all");
            setDevice("");
            setStatus("");
          }}
        >
          Сбросить фильтры
        </button>
      </div>
    </section>
  );
}

export function DashboardWelcome() {
  return (
    <section className="supper-command-hero">
      <div>
        <span className="eyebrow">
          <Globe2 size={15} /> ЕДИНОЕ ПРОСТРАНСТВО РАБОТЫ
        </span>
        <h2>
          Видеть главное.
          <br />
          <em>Действовать уверенно.</em>
        </h2>
        <p>
          Сигналы, команда и решения — от первого события до проверенного
          результата.
        </p>
        <div className="row wrap">
          <Link className="btn" to="/app/commission">
            Посмотреть, как это работает
            <ArrowRight size={16} />
          </Link>
          <Link className="btn btn-outline" to="/app/participants">
            Сотрудники
          </Link>
        </div>
      </div>
      <div className="supper-hero-core" aria-hidden="true">
        <span />
        <ShieldCheck size={96} />
        <small>AEGISBORDER / SUPERAPP</small>
      </div>
    </section>
  );
}
