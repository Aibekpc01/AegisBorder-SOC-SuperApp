/* Назначение файла: Публичная главная страница и переходы к рабочему приложению.
 * Композиция: первый экран «Цифровой рубеж» → возможности → интерактивный пример → порядок работы →
 * польза → технологии и надёжность → призыв к действию → каталог модулей → о проекте.
 * Все цифры на странице проверяемы по исходному коду; примеры подписаны как учебные.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Cpu,
  DatabaseZap,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  GraduationCap,
  KeyRound,
  Layers,
  LockKeyhole,
  Network,
  Play,
  ScrollText,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Usb,
  UserCog,
  Users,
  WifiOff,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { EmblemPair } from "./emblems";
import { ModuleMenu, ModuleCatalog } from "./module-menu";
import { BRAND_NAME, BRAND_TAGLINE } from "../lib/brand";
import { modules } from "../lib/modules";
import { useScrollReveal } from "../lib/use-scroll-reveal";
import { OverviewShowcase } from "./project-experience";
import { FrontierScene } from "./landing/frontier-scene";
import { SignalPipeline } from "./landing/signal-pipeline";
import "../styles/landing.css";

const examples = [
  {
    title: "Подозрительные входы",
    Icon: Fingerprint,
    subtitle: "Пять неудачных попыток за минуту",
    rule: "≥ 5 ошибок входа / 60 секунд",
    risk: 70,
    text: "Алгоритм объединяет попытки одной учётной записи в заданном временном окне. Оператор проверяет причину и принимает решение.",
    events: [
      "08:14:02 · Учебная попытка входа отклонена",
      "08:14:17 · Повторная ошибка авторизации",
      "08:14:43 · Достигнут порог корреляции",
    ],
    route: "bruteforce",
  },
  {
    title: "Неизвестный USB",
    Icon: Usb,
    subtitle: "Подключение неразрешённого устройства",
    rule: "Устройство отсутствует в разрешённом списке",
    risk: 75,
    text: "Событие содержит признак разрешённости USB. Неизвестное устройство создаёт инцидент; разрешённое не вызывает это правило.",
    events: [
      "09:20:01 · Получено событие подключения",
      "09:20:01 · Проверен признак разрешённости",
      "09:20:01 · Сформировано предупреждение",
    ],
    route: "usb",
  },
  {
    title: "Массовое копирование",
    Icon: Layers,
    subtitle: "Необычный объём обращений к файлам",
    rule: "Объём копирования превышает порог правила",
    risk: 80,
    text: "Анализируется объём синтетической операции. В рабочем полигоне доступны доказательства, рекомендации и отчёт по фактическим данным.",
    events: [
      "10:03:01 · Учебная операция копирования",
      "10:03:02 · Превышен допустимый объём",
      "10:03:02 · Событие связано с инцидентом",
    ],
    route: "mass_copy",
  },
];

const capabilities = [
  {
    Icon: Activity,
    title: "События в одном месте",
    text: "Поиск, фильтры и обновление ленты. Каждое событие можно открыть и изучить.",
    path: "events",
  },
  {
    Icon: ShieldCheck,
    title: "От сигнала до решения",
    text: "Инциденты, доказательства, ответственные, комментарии и история расследования.",
    path: "incidents",
  },
  {
    Icon: Cpu,
    title: "Объяснимый анализ",
    text: "Детерминированные правила и отдельный модуль аномалий на синтетических данных.",
    path: "anomalies",
  },
  {
    Icon: FlaskConical,
    title: "Обучение через практику",
    text: "15 учебных ситуаций, собственный сеанс и пошаговая помощь без специальных знаний.",
    path: "scenarios",
  },
];

const flow = [
  [
    "Событие",
    "Синтетическое действие поступает в единый обработчик, проходит проверку и сохраняется в базе.",
  ],
  [
    "Анализ",
    "Правила проверяют признаки, количество событий и временные окна. Причина срабатывания видна оператору.",
  ],
  [
    "Расследование",
    "Оператор изучает доказательства, добавляет выводы и меняет статус инцидента.",
  ],
  [
    "Отчёт",
    "Результат расследования сохраняется. По инциденту можно сформировать PDF с русским текстом.",
  ],
];

/** Факты первого экрана. Источники: lib/modules.ts, app/command/scenarios.py, app/command/rbac.py. */
const facts = [
  { value: String(modules.length), label: "направлений платформы" },
  { value: "15", label: "учебных сценариев атак" },
  { value: "11", label: "ролей с серверной иерархией" },
  { value: "0", label: "внешних CDN и счётчиков в интерфейсе" },
];

const benefits = [
  {
    Icon: Activity,
    audience: "Оператору",
    title: "Видно, что произошло и почему",
    points: [
      "Единая лента событий с поиском и фильтрами",
      "Объяснение срабатывания каждого правила",
      "Доказательства и хронология в карточке инцидента",
    ],
  },
  {
    Icon: UserCog,
    audience: "Руководителю",
    title: "Контроль без ручных сводок",
    points: [
      "Статусы, ответственные и сроки по каждому случаю",
      "Журнал действий с проверкой целостности",
      "PDF-отчёт по расследованию в один шаг",
    ],
  },
  {
    Icon: GraduationCap,
    audience: "Подразделению",
    title: "Подготовка без риска",
    points: [
      "15 сценариев на синтетических данных",
      "Академия, справка и пошаговые подсказки",
      "Режим демонстрации для показа и разбора",
    ],
  },
];

const reliability = [
  {
    Icon: KeyRound,
    title: "Защищённый вход",
    text: "Пароли хранятся в виде Argon2-хешей. Сеанс — в HttpOnly-cookie с SameSite=Strict, лимиты попыток по адресу и логину.",
  },
  {
    Icon: UserCog,
    title: "Роли и иерархия",
    text: "Права проверяет сервер: пользователь не может изменить роль выше собственной. Разделы скрываются по полномочиям.",
  },
  {
    Icon: ScrollText,
    title: "Журнал с цепочкой подписей",
    text: "Каждое действие фиксируется и подписывается HMAC-SHA256 вместе с предыдущей записью. Изменение старой записи разрывает цепочку и видно при проверке.",
  },
  {
    Icon: WifiOff,
    title: "Закрытый контур",
    text: "Интерфейс не загружает ни одного внешнего шрифта, CDN или счётчика. Приложение и база разворачиваются локально одной командой Docker Compose.",
  },
  {
    Icon: DatabaseZap,
    title: "Надёжное хранение",
    text: "PostgreSQL 16 и версионируемые миграции Alembic. Документы сохраняют историю версий и защищены от конфликтов правок.",
  },
  {
    Icon: FileCheck2,
    title: "Проверено тестами",
    text: "Серверные тесты pytest, клиентские Vitest и сквозные сценарии Playwright покрывают вход, роли, инциденты, документы и интеграции.",
  },
];

export function Landing() {
  const landingRef = useScrollReveal<HTMLDivElement>();
  const [example, setExample] = useState(0),
    [step, setStep] = useState(0);
  const current = examples[example];
  return (
    <div className="super-landing fr-landing" ref={landingRef}>
      <a className="skip-link" href="#landing-main">
        Перейти к содержимому
      </a>
      <header className="landing-nav fr-nav">
        <Link to="/" className="landing-brand">
          <EmblemPair className="landing-emblems" publicMode />
          <b>
            {BRAND_NAME}
            <small>РАССЛЕДОВАНИЕ И ЗАЩИТА ИНФОРМАЦИИ</small>
          </b>
        </Link>
        <nav aria-label="Разделы главной страницы">
          <a href="#capabilities">Возможности</a>
          <a href="#practice">Полигон</a>
          <a href="#workflow">Как это работает</a>
          <a href="#reliability">Надёжность</a>
          <Link to="/app/team">Чат</Link>
        </nav>
        <div className="row">
          <ModuleMenu />
          <ThemeToggle />
          <Link className="btn btn-outline" to="/app">
            Рабочая панель <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <main id="landing-main">
        <section className="landing-hero fr-hero" aria-labelledby="fr-hero-title">
          <FrontierScene />
          <div className="fr-hero-inner">
            <div className="fr-hero-copy">
              <div className="fr-hero-lockup">
                <EmblemPair className="hero-identity-emblems" publicMode />
                <span className="landing-kicker">
                  <span className="online-dot" /> Учебный контур киберзащиты
                </span>
              </div>
              <h1 id="fr-hero-title">
                <span className="fr-h1-brand">{BRAND_NAME}</span>
                <span className="fr-h1-line">Цифровой рубеж</span>
                <span className="fr-h1-line fr-h1-accent">под контролем.</span>
              </h1>
              <p className="hero-mission">{BRAND_TAGLINE}</p>
              <p className="hero-description">
                Начните с понятного учебного примера: неизвестная флешка, ошибки
                при входе или необычное копирование файлов. Система объяснит, что
                заметила, а человек примет решение.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary fr-btn-lg" to="/app">
                  Открыть Supperapp <ArrowRight size={17} />
                </Link>
                <Link className="btn btn-outline fr-btn-lg" to="/app/commission">
                  <Play size={16} /> Запустить демонстрацию
                </Link>
              </div>
              <div className="hero-assurances">
                <span>
                  <Check size={14} /> Вымышленные учебные данные
                </span>
                <span>
                  <LockKeyhole size={14} /> Защищённый доступ
                </span>
                <span>
                  <ShieldCheck size={14} /> Личный доступ участников
                </span>
              </div>
              <div className="landing-team-entry">
                <Link to="/app/team">
                  <Users size={15} /> Чат участников
                </Link>
                <Link to="/app/help">
                  <BookOpen size={15} /> Учебник по всем разделам
                </Link>
              </div>
            </div>
            <SignalPipeline />
          </div>
          <dl className="fr-facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <a className="hero-explore" href="#capabilities">
            Изучить возможности <ArrowDown size={15} />
          </a>
        </section>

        <section id="capabilities" className="landing-capabilities">
          <div className="landing-section-heading">
            <div>
              <span className="landing-kicker">ЕДИНОЕ РАБОЧЕЕ ПРОСТРАНСТВО</span>
              <h2>
                Каждый инструмент —<br />
                часть расследования.
              </h2>
            </div>
            <p>
              Уже реализованные функции используют API и сохраняемые данные.
              Нужные действия доступны после входа.
            </p>
          </div>
          <div className="capability-grid">
            {capabilities.map(({ Icon, title, text, path }, i) => (
              <Link key={path} className="capability-card" to={"/app/" + path}>
                <div className="row between">
                  <span className="fr-icon-tile">
                    <Icon size={22} />
                  </span>
                  <small>0{i + 1}</small>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <span>
                  Открыть раздел <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="landing-preview" id="practice">
          <div className="landing-section-heading">
            <div>
              <span className="landing-kicker">ПОПРОБУЙТЕ ИНТЕРФЕЙС</span>
              <h2>
                Увидеть сигнал.
                <br />
                Понять причину.
              </h2>
            </div>
            <p>
              Выберите ситуацию и изучите наглядный пример. Для реального
              запуска с сохранением событий откройте защищённый полигон.
            </p>
          </div>
          <div className="preview-console">
            <aside>
              <span className="preview-overline">УЧЕБНЫЙ ПРИМЕР</span>
              {examples.map((item, i) => (
                <button
                  key={item.title}
                  className={example === i ? "active" : ""}
                  aria-pressed={example === i}
                  onClick={() => setExample(i)}
                >
                  <item.Icon size={19} />
                  <span>
                    {item.title}
                    <small>{item.subtitle}</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
              <p>
                Этот просмотр не выполняет серверных действий и не показывает
                данные пользователей.
              </p>
            </aside>
            <div className="preview-detail" key={current.route}>
              <div className="row between">
                <span className="preview-overline">ДЕМОНСТРАЦИОННЫЙ ИНЦИДЕНТ</span>
                <span className="badge">Пример · не запись из базы</span>
              </div>
              <div className="preview-incident">
                <div>
                  <h3>{current.title}</h3>
                  <p>{current.subtitle}</p>
                </div>
                <div className="preview-risk">
                  <strong>
                    {current.risk}
                    <small>/100</small>
                  </strong>
                  <span>Иллюстративный риск</span>
                </div>
              </div>
              <div className="preview-columns">
                <div>
                  <h4>Хронология примера</h4>
                  <ol>
                    {current.events.map((event) => (
                      <li key={event}>
                        <span />
                        {event}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="preview-explanation">
                  <h4>
                    <Sparkles size={16} /> Почему нужен анализ
                  </h4>
                  <p>{current.text}</p>
                  <code>{current.rule}</code>
                </div>
              </div>
              <Link className="btn btn-primary" to="/app/scenarios">
                Открыть учебный полигон <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-flow">
          <div className="landing-section-heading">
            <div>
              <span className="landing-kicker">ПОНЯТНО С ПЕРВОГО ДНЯ</span>
              <h2>
                Четыре шага
                <br />к обоснованному решению.
              </h2>
            </div>
            <p>
              Нажмите на шаг: схема объясняет, что делает система и где
              требуется решение человека.
            </p>
          </div>
          <div className="flow-steps">
            {flow.map(([title], i) => (
              <button
                key={title}
                className={step === i ? "active" : ""}
                aria-pressed={step === i}
                onClick={() => setStep(i)}
              >
                <span>0{i + 1}</span>
                <b>{title}</b>
                <ArrowRight size={19} />
              </button>
            ))}
          </div>
          <div className="flow-description" role="status">
            <ShieldCheck size={24} />
            <div>
              <h3>{flow[step][0]}</h3>
              <p>{flow[step][1]}</p>
            </div>
            <Link to="/app/help">
              Открыть наглядную инструкцию <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section className="fr-value" aria-labelledby="fr-value-title">
          <div className="landing-section-heading">
            <div>
              <span className="landing-kicker">ПРАКТИЧЕСКАЯ ПОЛЬЗА</span>
              <h2 id="fr-value-title">
                Одна система —<br />
                три уровня пользы.
              </h2>
            </div>
            <p>
              Supperapp сокращает путь от сигнала до решения и делает каждый шаг
              проверяемым: для того, кто ведёт расследование, кто за него
              отвечает и кто только учится.
            </p>
          </div>
          <div className="fr-value-grid">
            {benefits.map(({ Icon, audience, title, points }) => (
              <article key={audience} className="fr-value-card fr-reveal">
                <span className="fr-icon-tile">
                  <Icon size={22} />
                </span>
                <small>{audience}</small>
                <h3>{title}</h3>
                <ul>
                  {points.map((point) => (
                    <li key={point}>
                      <Check size={15} /> {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <OverviewShowcase publicMode />

        <section id="reliability" className="fr-tech" aria-labelledby="fr-tech-title">
          <div className="landing-section-heading">
            <div>
              <span className="landing-kicker">ТЕХНОЛОГИИ И НАДЁЖНОСТЬ</span>
              <h2 id="fr-tech-title">
                Инженерная основа,
                <br />
                которой можно доверять.
              </h2>
            </div>
            <p>
              Каждое утверждение ниже реализовано в исходном коде; ключевые
              механизмы покрыты автотестами. Подробности — в документации проекта.
            </p>
          </div>
          <div className="fr-tech-grid">
            {reliability.map(({ Icon, title, text }) => (
              <article key={title} className="fr-tech-card fr-reveal">
                <Icon size={20} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="landing-integrations fr-reveal">
            <div>
              <Network size={26} />
              <span className="landing-kicker">ИНТЕГРАЦИИ И РАЗВИТИЕ</span>
              <h3>Архитектура для корпоративной среды</h3>
              <p>
                События из сторонних продуктов поступают в единый процесс: приём →
                проверка → обнаружение → расследование. Создайте приёмник в центре
                интеграций и настройте отправку через API или корпоративный агент.
                Почтовый анализ и цифровой двойник уже доступны локально.
              </p>
              <Link className="btn btn-outline" to="/app/integrations">
                <ServerCog size={16} /> Открыть центр интеграций
              </Link>
            </div>
            <div className="integration-list">
              {[
                ["REST API / OpenAPI", "Реализовано"],
                ["WebSocket событий", "Реализовано"],
                [
                  "Почтовая безопасность и цифровой двойник",
                  "Протестировано локально",
                ],
                ["Приём событий Kaspersky / DLP / Microsoft 365", "API-приёмник"],
              ].map(([title, status]) => (
                <div key={title}>
                  <span className="online-dot" />
                  <b>{title}</b>
                  <span>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <span className="landing-kicker">ОТ ЗНАКОМСТВА — К ПРАКТИКЕ</span>
          <h2>
            Проверьте возможности
            <br />
            системы самостоятельно.
          </h2>
          <p>
            Пошаговая демонстрация: ситуация → события → инцидент →
            расследование → отчёт.
          </p>
          <div className="row wrap fr-cta-actions">
            <Link className="btn btn-primary fr-btn-lg" to="/app/commission">
              <Play size={17} /> Запустить демонстрацию <ArrowRight size={17} />
            </Link>
            <Link className="btn btn-outline fr-btn-lg" to="/app/scenarios">
              <FlaskConical size={17} /> Открыть полигон
            </Link>
          </div>
          <small>Для запуска потребуется ваша учебная учётная запись.</small>
        </section>
        <ModuleCatalog />
        <section className="landing-about" id="about">
          <div>
            <span className="landing-kicker">О ПРОЕКТЕ</span>
            <h2>Технологии, понятные оператору.</h2>
            <p>
              {BRAND_NAME} —{" "}
              {BRAND_TAGLINE.charAt(0).toLowerCase() + BRAND_TAGLINE.slice(1)}.
            </p>
            <p>
              Используются синтетические события. Продукт не заявляет
              официального одобрения государственного органа. Реальные служебные
              системы не подключены.
            </p>
            <Link className="btn btn-outline" to="/app/help">
              Инструкция нового сотрудника <ArrowRight size={16} />
            </Link>
          </div>
          <div className="about-branding">
            <EmblemPair className="about-emblems" publicMode />
            <strong>{BRAND_NAME}</strong>
            <small>ОБУЧЕНИЕ · АНАЛИЗ · РАССЛЕДОВАНИЕ</small>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <span>
          <EmblemPair className="footer-emblems" publicMode /> {BRAND_NAME}
        </span>
        <p>
          Демонстрационный проект. Синтетические данные. Не является официальным
          сайтом КНБ РК.
        </p>
        <a href="#landing-main" aria-label="Вернуться к началу страницы">
          <ArrowDown size={17} style={{ transform: "rotate(180deg)" }} />
        </a>
      </footer>
    </div>
  );
}
