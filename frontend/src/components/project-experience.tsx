/* Назначение файла: Показывает презентационный обзор проекта и пользовательских сценариев.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { PresenceBadge } from "./presence-workspace";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
  Download,
  FileText,
  FlaskConical,
  GraduationCap,
  Layers,
  MessageCircle,
  Monitor,
  Play,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { api } from "../api";
import { modules } from "../lib/modules";
import { explainers, glossary } from "../lib/explainers";
import { learningExamples } from "../lib/learning-examples";
import { date, roles } from "../lib/utils";
import { VisualGuide } from "./visual-guide";
import { BlockGuide } from "./block-guide";
import { Button } from "./ui/button";
import "../project-experience.css";
import { DefenseStory } from "./defense-story";

const story = [
  {
    title: "Учебное действие",
    Icon: Monitor,
    text: "Например, к компьютеру подключили неизвестную флешку. В тренировке это вымышленная запись, а не действие на настоящем устройстве.",
    example: "Что произошло → сохранённый факт",
  },
  {
    title: "Понятная проверка",
    Icon: ShieldCheck,
    text: "Система проверяет запись по условиям. Если правило сработало, появляется предупреждение с объяснением причины.",
    example: "Правило → причина предупреждения",
  },
  {
    title: "Решение человека",
    Icon: Users,
    text: "Ответственный проверяет контекст, смотрит доказательства и записывает вывод. Цвет индикатора сам по себе не доказывает нарушение.",
    example: "Факты → проверенный вывод",
  },
  {
    title: "Готовый результат",
    Icon: FileText,
    text: "Вывод сохраняется в материалах. Отчёт можно скачать и показать отдельно от приложения.",
    example: "Документ → результат для показа",
  },
];

export function OverviewShowcase({
  observer = false,
  publicMode = false,
}: {
  observer?: boolean;
  publicMode?: boolean;
}) {
  const [slide, setSlide] = useState(0),
    [auto, setAuto] = useState(false);
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(
      () => setSlide((i) => (i + 1) % story.length),
      5000,
    );
    return () => clearInterval(timer);
  }, [auto]);
  const active = story[slide];
  return (
    <>
      <section
        className={
          "experience-hero first-visit " +
          (publicMode ? "public-experience" : "")
        }
        aria-label="Первое знакомство с системой"
      >
        <div className="experience-copy">
          <span className="experience-kicker">
            <Sparkles size={16} /> AEGISBORDER / ОТ ДЕЙСТВИЯ К РЕШЕНИЮ
          </span>
          <h2>
            Сложные ситуации.
            <br />
            <em>Понятные решения.</em>
          </h2>
          <p>
            Система показывает факты, объясняет предупреждения и помогает
            команде довести проверку до результата. Начните с безопасного
            примера — специальные знания не нужны.
          </p>
          <div className="experience-actions">
            <Link
              className="btn btn-primary"
              to={observer ? "/app/academy" : "/app/commission"}
            >
              {publicMode
                ? "Посмотреть демонстрацию"
                : observer
                  ? "Начать с короткого урока"
                  : "Показать систему по шагам"}
              <ArrowRight size={17} />
            </Link>
            <Link className="btn btn-outline" to="/app/help">
              {publicMode ? "Учебник платформы" : "Посмотреть инструкцию"}
            </Link>
          </div>
          <div className="experience-pills">
            <span>
              <ShieldCheck size={14} /> Учебные данные
            </span>
            <span>
              <BookOpen size={14} /> Объяснения на каждом шаге
            </span>
            <Link to="/app/team">
              <Users size={14} /> Чат
            </Link>
          </div>
        </div>
        <div
          className="experience-stage"
          aria-label="Иллюстрация процесса, не результат запуска"
        >
          <div className="experience-orbit" aria-hidden="true" />
          <div className="experience-stage-label">
            ИНТЕРАКТИВНАЯ СХЕМА · УЧЕБНЫЙ ПРИМЕР
          </div>
          <div className="experience-core">
            <active.Icon size={43} />
            <span>AEGIS</span>
            <small>Человек принимает решение</small>
          </div>
          <div className="experience-flow">
            {story.map((item, index) => (
              <button
                key={item.title}
                aria-label={`Показать этап: ${item.title}`}
                aria-pressed={slide === index}
                onClick={() => {
                  setSlide(index);
                  setAuto(false);
                }}
              >
                <item.Icon size={21} />
                <span>{index + 1}</span>
              </button>
            ))}
          </div>
          <div className="experience-caption" key={slide}>
            <h3>{active.title}</h3>
            <p>{active.text}</p>
            <small>{active.example}</small>
          </div>
          <button
            className="experience-autoplay"
            aria-pressed={auto}
            onClick={() => setAuto((value) => !value)}
          >
            <Play size={14} />{" "}
            {auto ? "Остановить автопоказ" : "Автопоказ этапов"}
          </button>
        </div>
      </section>
      <DefenseStory publicMode={publicMode} />
    </>
  );
}

const demoChapters = [
  {
    title: "Выбрать ситуацию",
    Icon: Compass,
    text: "Выберите понятный пример: ошибки входа, неизвестную флешку или необычное копирование. Прочитайте, что будет проверяться.",
    result: "Вы знаете цель тренировки и ожидаемый порядок действий.",
  },
  {
    title: "Запустить проверку",
    Icon: Play,
    text: "Нажмите «Запустить проверку». Сервер сохранит учебные действия и применит правила. Помощник не выполняет этот шаг за вас.",
    result: "Появятся реальные записи учебного запуска в базе проекта.",
  },
  {
    title: "Изучить результат",
    Icon: Activity,
    text: "Сравните число событий и предупреждений. Если предупреждения нет, прочитайте результат: правило могло не сработать.",
    result: "Вы видите фактический результат выбранной тренировки.",
  },
  {
    title: "Открыть инцидент",
    Icon: Search,
    text: "Откройте созданную ситуацию. Посмотрите объяснение риска, граф доказательств и время связанных действий.",
    result: "У предупреждения есть понятное основание для проверки.",
  },
  {
    title: "Провести расследование",
    Icon: Users,
    text: "Назначьте ответственного, отметьте проверки, запишите вывод и сохраните его. При необходимости создайте задачу или материал.",
    result: "Решение человека записано и доступно для следующего этапа.",
  },
  {
    title: "Сформировать PDF",
    Icon: FileText,
    text: "После сохранения вывода создайте отчёт в карточке ситуации. В разделе отчётов скачайте PDF для показа.",
    result: "Готовый документ фиксирует результат проверки.",
  },
];
type Scenario = { id: string; name: string; description: string };
type DemoResult = {
  events: number[];
  incidents: number[];
  steps: string[];
  run_id: number;
};

export function DemonstrationLanding({
  scenarios,
  scenario,
  onSelect,
  onRun,
  onNewSession,
  onReset,
  onIncident,
  canRun,
  canReset = true,
  busy,
  session,
  progress,
  result,
  children,
}: {
  scenarios: Scenario[];
  scenario: string;
  onSelect: (id: string) => void;
  onRun: () => void;
  onNewSession: () => void;
  onReset: () => void;
  onIncident: (id: number) => void;
  canRun: boolean;
  canReset?: boolean;
  busy: boolean;
  session: number | null;
  progress: number;
  result: DemoResult | null;
  children: ReactNode;
}) {
  const [chapter, setChapter] = useState(0);
  const selected = scenarios.find((item) => item.id === scenario),
    active = demoChapters[chapter];
  return (
    <div className="experience-page">
      <section className="experience-banner">
        <div>
          <span className="experience-kicker">
            <PresentationMark /> ЖИВАЯ ДЕМОНСТРАЦИЯ ПРОЕКТА
          </span>
          <h2>
            От первого сигнала
            <br />
            до <em>понятного результата.</em>
          </h2>
          <p>
            Пройдите весь путь на одном безопасном примере: действие, проверка,
            решение человека и готовый отчёт. Каждый этап можно открыть и
            изучить отдельно.
          </p>
          <div className="experience-pills">
            <span>
              <FlaskConical size={15} /> {scenarios.length} учебных ситуаций
            </span>
            <span>
              <Layers size={15} /> 6 этапов работы
            </span>
            <span>
              <ShieldCheck size={15} /> Только вымышленные данные
            </span>
          </div>
        </div>
        <div className="demo-session-card">
          <Compass size={32} />
          <b>{session ? `Ваш сеанс #${session}` : "Ваш первый показ"}</b>
          <p>
            {progress === 6
              ? "Отчёт сформирован в этом сеансе."
              : "Этапы ниже объясняют процесс. Прогресс берётся из сохранённых действий."}
          </p>
          <progress
            max={6}
            value={progress}
            aria-label="Сохранённый прогресс демонстрации"
          />
          <small>Зафиксировано этапов: {progress} из 6</small>
        </div>
      </section>
      <div className="experience-section-title">
        <span>01 / ПОСМОТРИТЕ ПОРЯДОК РАБОТЫ</span>
        <h2>Один процесс. Шесть понятных шагов.</h2>
        <p>
          Нажимайте этапы: объяснение меняется, ваши данные остаются прежними.
        </p>
      </div>
      <div className="demo-chapter-grid">
        {demoChapters.map((item, index) => (
          <button
            className={chapter === index ? "selected" : ""}
            aria-pressed={chapter === index}
            key={item.title}
            onClick={() => setChapter(index)}
          >
            <item.Icon size={23} />
            <small>Этап {index + 1}</small>
            <b>{item.title}</b>
            {progress > index && (
              <span className="demo-saved">
                <CheckCircle2 size={13} /> Зафиксирован
              </span>
            )}
          </button>
        ))}
      </div>
      <article className="experience-slide" key={chapter}>
        <span className="experience-slide-icon">
          <active.Icon size={32} />
        </span>
        <div>
          <small>Этап {chapter + 1} из 6</small>
          <h3>{active.title}</h3>
          <p>{active.text}</p>
          <div className="experience-outcome">
            <CheckCircle2 size={17} />
            <span>{active.result}</span>
          </div>
        </div>
        <div className="experience-slide-controls">
          <Button
            variant="outline"
            disabled={chapter === 0}
            onClick={() => setChapter((i) => i - 1)}
            aria-label="Предыдущий этап демонстрации"
          >
            <ArrowLeft size={16} />
          </Button>
          <Button
            variant="outline"
            disabled={chapter === 5}
            onClick={() => setChapter((i) => i + 1)}
            aria-label="Следующий этап демонстрации"
          >
            <ArrowRight size={16} />
          </Button>
        </div>
      </article>
      <section className="experience-panel">
        <div className="experience-section-title">
          <span>02 / ПОПРОБУЙТЕ САМОСТОЯТЕЛЬНО</span>
          <h2>Выберите учебную ситуацию</h2>
          <p>
            Проверка сохранит данные в вашем учебном сеансе. Создание нового
            сеанса и сброс доступны отдельно.
          </p>
        </div>
        <div className="demo-scenario-picks">
          {["usb", "bruteforce", "copy"]
            .map((id) => scenarios.find((s) => s.id === id))
            .filter((s): s is Scenario => Boolean(s))
            .map((item) => (
              <button
                key={item.id}
                aria-pressed={scenario === item.id}
                onClick={() => onSelect(item.id)}
              >
                <FlaskConical size={20} />
                <b>{item.name}</b>
                <p>{item.description}</p>
              </button>
            ))}
        </div>
        <label>
          Учебная ситуация
          <select
            aria-label="Учебная ситуация"
            value={scenario}
            onChange={(e) => onSelect(e.target.value)}
          >
            {scenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <p>{selected?.description}</p>
        <div className="row wrap">
          <Button disabled={busy || !canRun || !selected} onClick={onRun}>
            <Play size={16} />
            {busy
              ? "Проверка выполняется…"
              : result
                ? "Повторить проверку"
                : "Запустить проверку"}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !canRun}
            onClick={onNewSession}
          >
            Новый сеанс
          </Button>
          {session && canReset && (
            <Button
              variant="outline"
              disabled={busy || !canRun}
              onClick={onReset}
            >
              Сбросить мои данные
            </Button>
          )}
        </div>
        {!canRun && (
          <p>
            Ваша роль позволяет смотреть материалы. Для запуска нужен участник с
            правом выполнения действий.
          </p>
        )}
        <BlockGuide title="Учебная ситуация" />
      </section>
      {result && (
        <section className="experience-panel demo-result" aria-live="polite">
          <span className="experience-kicker">
            <CheckCircle2 size={16} /> ФАКТИЧЕСКИЙ РЕЗУЛЬТАТ
          </span>
          <h2>Результат проверки</h2>
          <div className="demo-result-metrics">
            <div>
              <b>{result.events.length}</b>
              <span>Сохранено событий</span>
            </div>
            <div>
              <b>{result.incidents.length}</b>
              <span>Связанных инцидентов</span>
            </div>
            <div>
              <b>#{result.run_id}</b>
              <span>Учебный запуск</span>
            </div>
          </div>
          <p>
            {result.incidents.length
              ? "Появились ситуации для проверки. Откройте карточку и прочитайте основание предупреждения."
              : "Связанных предупреждений нет. Это результат текущих правил, а не обещание безопасности."}
          </p>
          <div className="row wrap">
            {result.incidents.map((id) => (
              <Button key={id} onClick={() => onIncident(id)}>
                Открыть инцидент #{id}
                <ChevronRight size={16} />
              </Button>
            ))}
          </div>
          <details className="editor-advanced">
            <summary>Какие этапы выполнила система</summary>
            {result.steps.map((step) => (
              <p key={step}>{step}</p>
            ))}
          </details>
        </section>
      )}
      <section className="experience-panel">
        <div className="experience-section-title">
          <span>03 / СОХРАНЁННЫЕ МАТЕРИАЛЫ</span>
          <h2>Ваши результаты</h2>
          <p>Ситуации выбранного сеанса доступны после обновления страницы.</p>
        </div>
        {children}
        <div className="experience-actions">
          <Link className="btn btn-outline" to="/app/workspace">
            Материалы проверки
          </Link>
          <Link className="btn btn-outline" to="/app/reports">
            Готовые отчёты
          </Link>
          <Link className="btn btn-outline" to="/app/team">
            Обсудить с командой
          </Link>
        </div>
      </section>
    </div>
  );
}

function PresentationMark() {
  return <Play size={16} />;
}

const extraNames: Record<string, string> = {
  "": "Главная панель",
  events: "Мониторинг событий",
  analysis: "Умный анализ",
  assets: "Устройства",
  scenarios: "Учебные сценарии",
  investigations: "Расследования",
  reports: "Отчёты",
  workspace: "Документы и рабочее пространство",
  users: "Пользователи и роли",
  audit: "История действий",
  settings: "Настройки",
  help: "Справка и обучение",
  commission: "Демонстрация проекта",
  development: "Развитие Supperapp",
  "scenario-builder": "Конструктор сценариев",
  team: "Чат",
};
function nameFor(path: string) {
  return extraNames[path] || modules.find((m) => m.path === path)?.name || path;
}
function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/markdown;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LearningCenter({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [slide, setSlide] = useState(0);
  const entries = Object.entries(explainers).filter(([path, guide]) =>
    (nameFor(path) + guide.description)
      .toLocaleLowerCase("ru")
      .includes(search.toLocaleLowerCase("ru")),
  );
  const guide = explainers[selected] || explainers[""],
    title = nameFor(selected);
  const slides = [
    { title: "Для чего этот раздел", text: guide.description },
    ...guide.steps.map((text, index) => ({
      title: `Шаг ${index + 1}: что делать`,
      text,
    })),
    { title: "Какой результат ожидать", text: guide.outcome },
  ];
  const example = learningExamples[selected] || learningExamples[""];
  return (
    <div className="experience-page">
      <section className="experience-banner">
        <div>
          <span className="experience-kicker">
            <BookOpen size={16} /> ВАШ ПУТЕВОДИТЕЛЬ ПО ПРОЕКТУ
          </span>
          <h2>
            Каждый раздел.
            <br />
            <em>Понятно с первого шага.</em>
          </h2>
          <p>
            Здесь собраны все экраны: назначение, действия и ожидаемый
            результат. Выберите раздел, листайте слайды и попробуйте пример.
          </p>
          <div className="experience-actions">
            <Button
              onClick={() =>
                downloadText(
                  "AegisBorder-путеводитель.md",
                  "# Путеводитель AegisBorder\n\n" +
                    Object.entries(explainers)
                      .map(
                        ([path, g]) =>
                          `## ${nameFor(path)}\n${g.description}\n\n${g.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nПример: ${learningExamples[path] || "Начните с пояснения раздела."}\n\nРезультат: ${g.outcome}`,
                      )
                      .join("\n\n"),
                )
              }
            >
              <Download size={16} /> Скачать учебник по сайту
            </Button>
            <Link className="btn btn-outline" to="/app/academy">
              Перейти к урокам
            </Link>
          </div>
        </div>
        <div className="experience-count">
          <BookOpen size={50} />
          <b>{Object.keys(explainers).length}</b>
          <span>разделов с объяснениями</span>
          <small>Всё работает внутри приложения</small>
        </div>
      </section>
      <section className="learning-library">
        <div className="learning-menu">
          <label className="experience-search">
            <Search size={17} />
            <input
              aria-label="Поиск раздела для обучения"
              placeholder="Например: задачи, риск, документы…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <nav aria-label="Разделы учебника">
            {entries.map(([path]) => (
              <button
                key={path}
                aria-pressed={selected === path}
                onClick={() => {
                  setSelected(path);
                  setSlide(0);
                }}
              >
                <Layers size={16} />
                <span>{nameFor(path)}</span>
                <ChevronRight size={14} />
              </button>
            ))}
          </nav>
          {!entries.length && <p>Раздел не найден. Попробуйте другое слово.</p>}
        </div>
        <article className="experience-panel learning-slide">
          <span className="experience-kicker">
            <Compass size={16} /> {title}
          </span>
          <div className="learning-slide-stage" key={selected + slide}>
            <span className="learning-slide-number">
              {String(slide + 1).padStart(2, "0")}
            </span>
            <h3>{slides[slide].title}</h3>
            <p>{slides[slide].text}</p>
          </div>
          <div className="learning-dots" aria-label="Слайды раздела">
            {slides.map((item, index) => (
              <button
                key={item.title}
                aria-label={`Слайд ${index + 1}: ${item.title}`}
                aria-pressed={slide === index}
                onClick={() => setSlide(index)}
              />
            ))}
          </div>
          <div className="row between wrap">
            <Button
              variant="outline"
              disabled={slide === 0}
              onClick={() => setSlide((i) => i - 1)}
            >
              <ArrowLeft size={16} /> Назад
            </Button>
            <small>
              Слайд {slide + 1} из {slides.length}
            </small>
            <Button
              variant="outline"
              disabled={slide === slides.length - 1}
              onClick={() => setSlide((i) => i + 1)}
            >
              Далее
              <ArrowRight size={16} />
            </Button>
          </div>
          <div className="experience-example">
            <b>
              <FlaskConical size={17} /> Попробуйте на примере
            </b>
            <p>{example}</p>
          </div>
          <Button onClick={() => onNavigate("/" + selected)}>
            Открыть этот раздел
            <ArrowRight size={16} />
          </Button>
        </article>
      </section>
      <section className="experience-panel">
        <div className="experience-section-title">
          <span>ОБЩАЯ СХЕМА РАБОТЫ</span>
          <h2>От учебного действия до отчёта</h2>
          <p>
            Нажмите значок, чтобы прочитать объяснение этапа и перейти к
            практике.
          </p>
        </div>
        <VisualGuide onNavigate={onNavigate} />
      </section>
      <section className="experience-panel">
        <div className="experience-section-title">
          <span>СЛОВАРЬ</span>
          <h2>Сложные слова — простое объяснение</h2>
        </div>
        <div className="experience-glossary">
          {glossary.map((item) => (
            <details key={item.term}>
              <summary>{item.term}</summary>
              <p>{item.text}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

type Chapter = {
  title: string;
  text: string;
  example: string;
  checklist: string[];
};
type Course = {
  id: string;
  title: string;
  category: string;
  duration: string;
  lesson: string;
  sections: Chapter[];
  questions: { text: string; options: string[] }[];
};
type Grade = {
  title: string;
  score: number;
  passed: boolean;
  correct: boolean[];
  certificate: string;
};

export function AcademyHub() {
  const [selected, setSelected] = useState("phishing"),
    [chapter, setChapter] = useState(0),
    [filter, setFilter] = useState("Все"),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Grade | null>(null);
  const client = useQueryClient(),
    courses = useQuery({
      queryKey: ["superapp-academy"],
      queryFn: () => api<Course[]>("/superapp/academy"),
    }),
    history = useQuery({
      queryKey: ["superapp-grades"],
      queryFn: () =>
        api<{ id: number; created: string; payload: Grade }[]>(
          "/superapp/history/academy",
        ),
    });
  const course = courses.data?.find((c) => c.id === selected),
    categories = [
      "Все",
      ...new Set(courses.data?.map((c) => c.category) || []),
    ];
  const current = course?.sections[chapter],
    passed = new Set(
      history.data?.filter((r) => r.payload.passed).map((r) => r.payload.title),
    );
  return (
    <div className="experience-page">
      <section className="experience-banner">
        <div>
          <span className="experience-kicker">
            <GraduationCap size={17} /> АКАДЕМИЯ БЕЗОПАСНОСТИ
          </span>
          <h2>
            Знания, которые
            <br />
            <em>легко применить.</em>
          </h2>
          <p>
            Короткие учебники, жизненные примеры и проверка себя. Учитесь в
            удобном порядке: от личного доступа до командного расследования.
          </p>
          <div className="experience-pills">
            <span>
              <BookOpen size={15} /> {courses.data?.length || 0} учебников
            </span>
            <span>
              <CheckCircle2 size={15} /> Пройдено: {passed.size}
            </span>
            <span>
              <ShieldCheck size={15} /> Без внешних сервисов
            </span>
          </div>
        </div>
        <div className="experience-count">
          <GraduationCap size={52} />
          <b>5–7</b>
          <span>минут на учебник</span>
          <small>Текст → пример → проверка себя</small>
        </div>
      </section>
      {(courses.error || history.error || error) && (
        <p className="error" role="alert">
          {error || courses.error?.message || history.error?.message}
        </p>
      )}
      <label className="experience-search">
        <Search size={18} />
        <input
          aria-label="Поиск учебника"
          placeholder="Пароли, флешки, документы, команда…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="learning-categories">
        {categories.map((category) => (
          <button
            key={category}
            aria-pressed={filter === category}
            onClick={() => setFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>
      {courses.isPending && <p role="status">Загрузка библиотеки…</p>}
      <div className="academy-catalog">
        {courses.data
          ?.filter(
            (c) =>
              (filter === "Все" || c.category === filter) &&
              (c.title + c.lesson)
                .toLocaleLowerCase("ru")
                .includes(search.toLocaleLowerCase("ru")),
          )
          .map((c) => (
            <button
              key={c.id}
              aria-pressed={selected === c.id}
              onClick={() => {
                setSelected(c.id);
                setChapter(0);
                setResult(null);
              }}
            >
              <span className="academy-book-icon">
                <BookOpen size={24} />
              </span>
              <small>{c.category}</small>
              <b>{c.title}</b>
              <p>{c.lesson}</p>
              <span>
                {passed.has(c.title) ? "Курс пройден" : c.duration}
                <ArrowRight size={16} />
              </span>
            </button>
          ))}
      </div>
      {course && (
        <article className="experience-panel academy-lesson" key={course.id}>
          <div className="row between wrap">
            <div>
              <span className="experience-kicker">
                УЧЕБНИК / {course.category}
              </span>
              <h3>{course.title}</h3>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                downloadText(
                  `AegisBorder-${course.id}.md`,
                  `# ${course.title}\n\n${course.lesson}\n\n` +
                    course.sections
                      .map(
                        (s) =>
                          `## ${s.title}\n${s.text}\n\nПример: ${s.example}\n\n${s.checklist.map((item) => `- ${item}`).join("\n")}`,
                      )
                      .join("\n\n"),
                )
              }
            >
              <Download size={16} /> Скачать учебник
            </Button>
          </div>
          <div className="academy-chapters">
            {course.sections.map((section, index) => (
              <button
                key={section.title}
                aria-pressed={chapter === index}
                onClick={() => setChapter(index)}
              >
                {index + 1}. {section.title}
              </button>
            ))}
          </div>
          {current && (
            <div className="academy-chapter" key={current.title}>
              <h4>{current.title}</h4>
              <p>{current.text}</p>
              <div className="experience-example">
                <b>
                  <FlaskConical size={17} /> Пример
                </b>
                <p>{current.example}</p>
              </div>
              <ul className="experience-checklist">
                {current.checklist.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={17} />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="row between">
                <Button
                  variant="outline"
                  disabled={chapter === 0}
                  onClick={() => setChapter((i) => i - 1)}
                >
                  <ArrowLeft size={16} /> Предыдущая глава
                </Button>
                <Button
                  variant="outline"
                  disabled={chapter === course.sections.length - 1}
                  onClick={() => setChapter((i) => i + 1)}
                >
                  Следующая глава
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}
          <form
            className="academy-quiz"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                const saved = await api<{ payload: Grade }>(
                  `/superapp/academy/${course.id}`,
                  "POST",
                  {
                    answers: course.questions.map((_, i) =>
                      Number(data.get(String(i))),
                    ),
                  },
                );
                setResult(saved.payload);
                await client.invalidateQueries({
                  queryKey: ["superapp-grades"],
                });
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Не удалось проверить ответы",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <h4>Проверьте себя</h4>
            <p>
              Выберите ответ на каждый вопрос. Проверка выполняется на сервере и
              сохраняется в вашей истории.
            </p>
            {course.questions.map((q, i) => (
              <fieldset key={q.text}>
                <legend>{q.text}</legend>
                {q.options.map((option, index) => (
                  <label className="module-radio" key={option}>
                    <input
                      type="radio"
                      name={String(i)}
                      value={index}
                      required
                      disabled={busy}
                    />
                    {option}
                  </label>
                ))}
              </fieldset>
            ))}
            <Button disabled={busy}>
              {busy ? "Проверка ответов…" : "Проверить ответы"}
            </Button>
          </form>
          {result && (
            <div className="academy-result" role="status">
              <CheckCircle2 size={22} />
              <div>
                <b>
                  {result.title}: {result.score}% ·{" "}
                  {result.passed ? "Курс пройден" : "Повторите материал"}
                </b>
                <p>
                  {result.correct
                    .map(
                      (ok, i) => `Вопрос ${i + 1}: ${ok ? "верно" : "ошибка"}`,
                    )
                    .join("; ")}
                </p>
                <small>{result.certificate}</small>
              </div>
            </div>
          )}
          <BlockGuide
            title="Учебник безопасности"
            text="Главы объясняют тему на примерах. Проверка фиксирует учебный результат, а не профессиональную квалификацию."
            steps="Прочитайте главы, сравните пример и памятку, затем выберите ответы и проверьте себя."
          />
        </article>
      )}
      <section className="experience-panel">
        <h2>Мои результаты</h2>
        {history.data?.length ? (
          history.data.map((r) => (
            <div className="academy-history" key={r.id}>
              <GraduationCap size={18} />
              <b>{r.payload.title}</b>
              <span>{r.payload.score}%</span>
              <small>{date(r.created)}</small>
            </div>
          ))
        ) : (
          <p>После первой проверки здесь появится сохранённый результат.</p>
        )}
      </section>
    </div>
  );
}

type Member = {
  online: boolean;
  id: number;
  username: string;
  role: string;
  full_name: string;
  department: string;
  position: string;
};
type TeamMessage = {
  id: number;
  author_id: number;
  channel: string;
  text: string;
  created: string;
  author: Member;
};
const channels = [
  { id: "general", title: "Общий чат" },
  { id: "demo", title: "Киберинциденты" },
  { id: "learning", title: "Вопросы и помощь" },
];

export function TeamProject({ user }: { user: { id: number; role: string } }) {
  const [search, setSearch] = useState(""),
    [channel, setChannel] = useState("general"),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [older, setOlder] = useState<TeamMessage[]>([]),
    [olderExhausted, setOlderExhausted] = useState(false);
  const chatLog = useRef<HTMLDivElement>(null),
    scrollToLatest = useRef(true);
  const pending = useRef<{ text: string; channel: string; id: string } | null>(
      null,
    ),
    client = useQueryClient();
  const team = useQuery({
    queryKey: ["project-team", user.id],
    queryFn: () => api<{ members: Member[]; mode: string }>("/presence/participants"),
    refetchInterval: 15000,
  });
  const messages = useQuery({
    queryKey: ["project-chat", user.id, channel],
    queryFn: () =>
      api<{ messages: TeamMessage[]; has_older: boolean }>(
        `/superapp/team/messages?channel=${channel}`,
      ),
    refetchInterval: 5000,
  });
  const merged = [
    ...new Map(
      [...older, ...(messages.data?.messages || [])].map((message) => [
        message.id,
        message,
      ]),
    ).values(),
  ].sort((a, b) => a.id - b.id);
  useEffect(() => {
    scrollToLatest.current = true;
  }, [channel]);
  useEffect(() => {
    if (messages.data && scrollToLatest.current && chatLog.current) {
      chatLog.current.scrollTop = chatLog.current.scrollHeight;
      scrollToLatest.current = false;
    }
  }, [messages.data]);
  return (
    <div className="experience-page">
      <div className="corporate-chat-heading">
        <div>
          <span className="eyebrow">РАБОЧЕЕ ОБСУЖДЕНИЕ</span>
          <h2>Чат</h2>
          <p>
            Обсуждайте киберинциденты, обменивайтесь выводами и согласовывайте
            следующие действия.
          </p>
        </div>
        <Link className="btn btn-outline" to="/app/tasks">
          Открыть задачи
        </Link>
      </div>
      {(error || team.error || messages.error) && (
        <p role="alert" className="error">
          {error || team.error?.message || messages.error?.message}
        </p>
      )}
      <div className="team-workspace">
        <section className="experience-panel">
          <h2>Участники чата</h2>
          <label className="experience-search">
            <Search size={17} />
            <input
              aria-label="Найти участника чата"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Имя или подразделение…"
            />
          </label>
          <div className="team-member-list" role="region" aria-label="Список участников команды" tabIndex={0}>
            {team.data?.members
              .filter((member) =>
                (member.full_name + member.username + member.department)
                  .toLocaleLowerCase("ru")
                  .includes(search.toLocaleLowerCase("ru")),
              )
              .map((member) => (
                <article key={member.id} className="team-member">
                  <span className="team-avatar">
                    {(member.full_name || member.username)
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div>
                    <h3>{member.full_name || member.username}</h3>
                    <p>{member.position || roles[member.role]}</p>
                    <small>
                      {member.department || "Подразделение не указано"}
                      {member.id === user.id ? " · Это вы" : ""}
                    </small>
                  </div>
                  <PresenceBadge online={member.online} />
                </article>
              ))}
          </div>
          {team.isPending && <p role="status">Загрузка участников…</p>}
        </section>
        <section className="experience-panel team-chat">
          <div className="row between wrap">
            <h2>
              <MessageCircle size={20} /> Сообщения
            </h2>
            <small>Обновление каждые 5 секунд</small>
          </div>
          <div className="learning-categories">
            {channels.map((item) => (
              <button
                key={item.id}
                aria-pressed={channel === item.id}
                disabled={busy}
                onClick={() => {
                  setChannel(item.id);
                  setOlder([]);
                  setOlderExhausted(false);
                  pending.current = null;
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
          <p>
            {["demo", "demo_viewer"].includes(user.role)
              ? "Это ваш личный учебный чат: сообщения других участников и общий чат недоступны."
              : "Сообщения видны участникам рабочего чата. Не отправляйте пароли, коды и служебные секреты."}
          </p>
          <div
            className="team-chat-log"
            ref={chatLog}
            role="log"
            aria-label="Сообщения команды"
          >
            {messages.data?.has_older && !olderExhausted && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (!merged.length) return;
                  setBusy(true);
                  try {
                    const page = await api<{
                      messages: TeamMessage[];
                      has_older: boolean;
                    }>(
                      `/superapp/team/messages?channel=${channel}&before=${merged[0].id}`,
                    );
                    setOlder((items) => [...page.messages, ...items]);
                    setOlderExhausted(!page.has_older);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Не удалось загрузить сообщения",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Показать более ранние сообщения
              </Button>
            )}
            {merged.map((message) => (
              <article
                key={message.id}
                className={
                  "team-message " + (message.author_id === user.id ? "own" : "")
                }
              >
                <div>
                  <b>{message.author.full_name || message.author.username}</b>
                  <small>{date(message.created)}</small>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
            {!merged.length && !messages.isPending && (
              <div className="team-chat-empty">
                <MessageCircle size={34} />
                <h3>Начните обсуждение</h3>
                <p>
                  Напишите учебный вопрос или договорённость по выбранной теме.
                </p>
              </div>
            )}
          </div>
          {["observer", "demo_viewer"].includes(user.role) ? (
            <p>
              Наблюдатель читает обсуждение. Отправлять сообщения могут
              участники с правом выполнения действий.
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const clean = text.trim();
                if (!clean) return;
                setBusy(true);
                setError("");
                const draft =
                  pending.current?.text === clean &&
                  pending.current.channel === channel
                    ? pending.current
                    : { text: clean, channel, id: crypto.randomUUID() };
                pending.current = draft;
                try {
                  await api("/superapp/team/messages", "POST", {
                    text: draft.text,
                    channel: draft.channel,
                    client_id: draft.id,
                  });
                  setText("");
                  pending.current = null;
                  scrollToLatest.current = true;
                  await client.invalidateQueries({
                    queryKey: ["project-chat", user.id, channel],
                  });
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Не удалось отправить сообщение",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Сообщение команде
                <textarea
                  value={text}
                  disabled={busy}
                  onChange={(e) => {
                    setText(e.target.value);
                    pending.current = null;
                  }}
                  maxLength={2000}
                  rows={3}
                  placeholder="Например: какой учебный сценарий покажем первым?"
                />
              </label>
              <div className="row between">
                <small>{text.length}/2000 · отправка только по кнопке</small>
                <Button disabled={busy || !text.trim()}>
                  <Send size={16} />
                  {busy ? "Отправка…" : "Отправить сообщение"}
                </Button>
              </div>
            </form>
          )}
          <BlockGuide
            title="Общий чат"
            text="Чат сохраняет сообщения в базе. Он не заменяет итоговый документ или статус задачи."
            steps="Выберите тему, напишите сообщение и отправьте его. Договорённости по выполнению фиксируйте также в задачах и материалах."
          />
        </section>
      </div>
    </div>
  );
}
