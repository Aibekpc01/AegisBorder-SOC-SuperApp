/* Назначение файла: Показывает публичную главную страницу и переходы к рабочему приложению.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  Cpu,
  Fingerprint,
  FlaskConical,
  Layers,
  LockKeyhole,
  Network,
  Play,
  ShieldCheck,
  Sparkles,
  Usb,
  Users,
  BookOpen,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { EmblemPair } from "./emblems";
import { ModuleMenu, ModuleCatalog } from "./module-menu";
import { BRAND_NAME, BRAND_TAGLINE } from "../lib/brand";
import { useScrollReveal } from "../lib/use-scroll-reveal";
import { OverviewShowcase } from "./project-experience";

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
export function Landing() {
  const landingRef = useScrollReveal<HTMLDivElement>();
  const [example, setExample] = useState(0),
    [step, setStep] = useState(0);
  const current = examples[example];
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
  return (
    <div className="super-landing" ref={landingRef}>
      <a className="skip-link" href="#landing-main">
        Перейти к содержимому
      </a>
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <EmblemPair className="landing-emblems" publicMode />
          <b>
            {BRAND_NAME}
            <small>РАССЛЕДОВАНИЕ И ЗАЩИТА ИНФОРМАЦИИ</small>
          </b>
        </Link>
        <nav aria-label="Разделы главной страницы">
          <Link to="/app/team">Чат</Link>
          <a href="#capabilities">Возможности</a>
          <a href="#workflow">Как это работает</a>
          <a href="#practice">Полигон</a>
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
        <div className="landing-team-entry">
          <Link to="/app/team">
            <Users size={16} /> Чат
          </Link>
          <Link to="/app/help">
            <BookOpen size={16} /> Учебник по всем разделам
          </Link>
        </div>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="landing-kicker">
              <span className="online-dot" /> ИНТЕЛЛЕКТУАЛЬНАЯ ЗАЩИТА
              ИНФРАСТРУКТУРЫ
            </span>
            <h1>
              AegisBorder
              <br />
              <em>Supperapp</em>
            </h1>
            <p className="hero-mission">{BRAND_TAGLINE}</p>
            <p className="hero-description">
              Начните с понятного учебного примера: неизвестная флешка, ошибки
              при входе или необычное копирование файлов. Система объяснит, что
              заметила, а человек примет решение.
            </p>
            <a className="hero-explore" href="#capabilities">
              Изучить возможности <ArrowDown size={15} />
            </a>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/app">
                Открыть Supperapp <ArrowRight size={17} />
              </Link>
              <Link className="btn btn-outline" to="/app/commission">
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
          </div>
          <div
            className="hero-visual"
            aria-label="Иллюстрация учебной обработки событий"
          >
            <div className="ultra-public-core-heading">
              <b>AEGIS / ЯДРО ЗАЩИТЫ</b>
              <span>АРХИТЕКТУРА ПЛАТФОРМЫ</span>
            </div>
            <div className="hero-emblem-stage">
              <div className="identity-orbit" aria-hidden="true" />
              <EmblemPair className="hero-identity-emblems" publicMode />
              <span>Единое цифровое пространство защиты</span>
            </div>
            <div className="ultra-public-flow">
              <div>
                <Activity />
                <b>Наблюдать</b>
                <span>События и источники</span>
              </div>
              <div>
                <Cpu />
                <b>Понимать</b>
                <span>Анализ и доказательства</span>
              </div>
              <div>
                <ShieldCheck />
                <b>Решать</b>
                <span>Расследование и отчёт</span>
              </div>
            </div>
            <p className="ultra-public-note">
              Концептуальная схема. Оперативные показатели доступны после входа.
            </p>
          </div>
        </section>
        <OverviewShowcase publicMode />
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
                <span className="preview-overline">
                  ДЕМОНСТРАЦИОННЫЙ ИНЦИДЕНТ
                </span>
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
        <section id="capabilities" className="landing-capabilities">
          <div className="landing-section-heading">
            <div>
              <span className="landing-kicker">
                ЕДИНОЕ РАБОЧЕЕ ПРОСТРАНСТВО
              </span>
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
                  <Icon size={27} />
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
        <section className="landing-integrations">
          <div>
            <Network size={29} />
            <span className="landing-kicker">ИНТЕГРАЦИИ И РАЗВИТИЕ</span>
            <h2>
              Архитектура для
              <br />
              корпоративной среды.
            </h2>
            <p>
              События из сторонних продуктов поступают в единый процесс: приём →
              проверка → обнаружение → расследование. Создайте приёмник в центре
              интеграций и настройте отправку через API или корпоративный агент.
              Почтовый анализ и цифровой двойник уже доступны локально.
            </p>
            <Link className="btn btn-outline" to="/app/integrations">
              Открыть центр интеграций <ArrowRight size={16} />
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
          <Link className="btn btn-primary" to="/app/commission">
            <Play size={17} /> Запустить демонстрацию <ArrowRight size={17} />
          </Link>
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
            <a className="btn btn-outline" href="/app/help">
              Инструкция нового сотрудника <ArrowRight size={16} />
            </a>
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
          <EmblemPair className="footer-emblems" publicMode /> AegisBorder
          Supperapp
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
