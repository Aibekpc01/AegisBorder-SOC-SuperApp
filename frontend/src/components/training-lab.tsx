import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileKey,
  FlaskConical,
  HardDrive,
  KeyRound,
  Layers,
  Monitor,
  Network,
  Play,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  Usb,
  FileText,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { VisualGuide } from "./visual-guide";
import { BlockGuide } from "./block-guide";
import { api, type Row } from "../api";
import { date, riskLabel } from "../lib/utils";

const metadata: Record<
  string,
  { group: string; Icon: typeof Shield; count: number; task: string }
> = {
  bruteforce: {
    group: "Доступ",
    Icon: KeyRound,
    count: 6,
    task: "Найдите момент, когда серия ошибок входа сменилась успешной авторизацией.",
  },
  "night-login": {
    group: "Доступ",
    Icon: KeyRound,
    count: 1,
    task: "Проверьте, почему время входа отличается от учебного графика.",
  },
  restricted: {
    group: "Данные",
    Icon: FileKey,
    count: 1,
    task: "Найдите попытку обращения к закрытому ресурсу.",
  },
  usb: {
    group: "Устройства",
    Icon: Usb,
    count: 1,
    task: "Проверьте, было ли USB-устройство разрешено.",
  },
  server: {
    group: "Устройства",
    Icon: Server,
    count: 1,
    task: "Изучите длительность отсутствия сигнала сервера.",
  },
  activity: {
    group: "Устройства",
    Icon: Monitor,
    count: 1,
    task: "Сравните загрузку CPU и количество процессов с порогами правила.",
  },
  "critical-files": {
    group: "Данные",
    Icon: FileKey,
    count: 1,
    task: "Определите, почему изменённый файл считается критическим.",
  },
  copy: {
    group: "Данные",
    Icon: HardDrive,
    count: 3,
    task: "Сложите количество скопированных файлов за временное окно.",
  },
  logs: {
    group: "Данные",
    Icon: FileText,
    count: 1,
    task: "Выясните, какой журнал был удалён и почему это важно.",
  },
  network: {
    group: "Сеть",
    Icon: Network,
    count: 3,
    task: "Найдите соединения с адресами вне учебного разрешённого списка.",
  },
  privileges: {
    group: "Доступ",
    Icon: Shield,
    count: 1,
    task: "Проверьте согласование перехода к роли администратора.",
  },
  repeated: {
    group: "Доступ",
    Icon: Layers,
    count: 3,
    task: "Найдите повторяющиеся нарушения за пять минут.",
  },
  behavior: {
    group: "Доступ",
    Icon: Activity,
    count: 1,
    task: "Сравните объём операции с обычным учебным профилем.",
  },
  settings: {
    group: "Устройства",
    Icon: Shield,
    count: 1,
    task: "Проверьте, какая защита отключена и было ли согласование.",
  },
  complex: {
    group: "Доступ",
    Icon: Layers,
    count: 7,
    task: "Соберите цепочку: ошибки входа → успешный вход → закрытый ресурс.",
  },
};
type Props = {
  scenarios: Row[];
  busy: boolean;
  canRun: boolean;
  onRun: (id: string) => Promise<Row | null>;
  onOpenIncident: (id: number) => void;
  onNavigate: (path: string) => void;
};
export function TrainingLab({
  scenarios,
  busy,
  canRun,
  onRun,
  onOpenIncident,
  onNavigate,
}: Props) {
  const [chosen, setChosen] = useState("bruteforce"),
    [group, setGroup] = useState("Все"),
    [search, setSearch] = useState(""),
    [showGuide, setShowGuide] = useState(false),
    [result, setResult] = useState<Row | null>(null),
    [expanded, setExpanded] = useState<number | null>(null),
    [activeStep, setActiveStep] = useState(0);
  const selected = scenarios.find((s) => s.id === chosen),
    meta = metadata[chosen] || metadata.bruteforce,
    Icon = meta.Icon;
  const output = useQuery({
    queryKey: ["training-run", result?.run_id],
    queryFn: () => api("/scenario-runs/" + result?.run_id),
    enabled: !!result?.run_id,
  });
  const resultArea = useRef<HTMLElement>(null);
  useEffect(() => {
    if (result)
      resultArea.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
  }, [result]);
  const filtered = scenarios.filter(
    (s) =>
      (group === "Все" || metadata[s.id]?.group === group) &&
      `${s.name} ${s.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function launch() {
    setActiveStep(1);
    const value = await onRun(chosen);
    if (value) {
      setResult(value);
      setExpanded(null);
      setActiveStep(2);
    }
  }
  function choose(id: string) {
    setChosen(id);
    setResult(null);
    setExpanded(null);
    setActiveStep(0);
  }
  return (
    <div className="training-lab">
      <section className="lab-hero">
        <div>
          <span className="eyebrow">
            <FlaskConical size={13} /> ИНТЕРАКТИВНЫЙ УЧЕБНЫЙ ПОЛИГОН
          </span>
          <h2>
            Попробуйте себя
            <br />в роли SOC-аналитика
          </h2>
          <p>
            Выберите ситуацию, запустите проверку и исследуйте результат.
            <br />
            Каждая тренировка работает с настоящими записями в учебной базе.
          </p>
          <div className="row wrap">
            <Button variant="outline" onClick={() => setShowGuide(!showGuide)}>
              <BookOpen size={16} />
              {showGuide ? "Скрыть схему" : "Как это работает"}
            </Button>
            <span className="lab-safe">
              <Shield size={14} /> Безопасно: только синтетические события
            </span>
          </div>
        </div>
        <div className="lab-hero-illustration" aria-hidden="true">
          <div className="orbital orbital-one" />
          <div className="orbital orbital-two" />
          <div className="lab-shield">
            <Shield size={64} />
            <span>УЧЕБНЫЙ КОНТУР</span>
          </div>
          <div className="floating-node node-a">
            <Monitor size={21} />
          </div>
          <div className="floating-node node-b">
            <Activity size={21} />
          </div>
          <div className="floating-node node-c">
            <KeyRound size={21} />
          </div>
          <div className="floating-node node-d">
            <Server size={21} />
          </div>
        </div>
      </section>
      {showGuide && <VisualGuide compact onNavigate={onNavigate} />}
      <div className="lab-layout">
        <section className="lab-catalog">
          <div className="lab-section-heading">
            <div>
              <h2>Выберите учебную ситуацию</h2>
              <p>{scenarios.length} сценариев · от простого к комплексному</p>
            </div>
            <span className="badge">ШАГ 01</span>
          </div>
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Поиск учебной ситуации"
              placeholder="Найти ситуацию…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div
            className="lab-filters"
            role="group"
            aria-label="Категории сценариев"
          >
            {["Все", "Доступ", "Устройства", "Данные", "Сеть"].map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                aria-pressed={group === g}
                className={group === g ? "active" : ""}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="lab-scenario-list">
            {filtered.map((s) => {
              const m = metadata[s.id] || metadata.bruteforce,
                I = m.Icon;
              return (
                <button
                  key={s.id}
                  disabled={busy}
                  className={
                    "lab-scenario " + (chosen === s.id ? "selected" : "")
                  }
                  aria-pressed={chosen === s.id}
                  onClick={() => choose(s.id)}
                >
                  <span className={"lab-scenario-icon group-" + m.group}>
                    <I size={21} />
                  </span>
                  <span>
                    <b>{s.name}</b>
                    <small>
                      {m.group} · {m.count}{" "}
                      {m.count === 1
                        ? "событие"
                        : m.count < 5
                          ? "события"
                          : "событий"}{" "}
                      · {s.priority === 1 ? "базовый" : "расширенный"}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
            {!filtered.length && (
              <div className="empty">
                <Search size={25} />
                <p>
                  Ничего не найдено. Выберите другую категорию или измените
                  поиск.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setGroup("Все");
                  }}
                >
                  Сбросить фильтры
                </Button>
              </div>
            )}
          </div>
          <BlockGuide
            title="Каталог ситуаций"
            text="Выбирайте тренировку по категории или найдите её поиском."
            steps="Нажмите карточку: справа появятся описание и задача. Фильтры меняют только список, они не запускают сценарий."
          />
        </section>
        <section className="lab-workbench">
          <div className="lab-detail-title">
            <div className="lab-detail-icon">
              <Icon size={28} />
            </div>
            <div>
              <span className="eyebrow">ВАША ТРЕНИРОВКА</span>
              <h2>{selected?.name || "Выберите ситуацию"}</h2>
            </div>
          </div>
          <p className="lab-description">{selected?.description}</p>
          <div className="lab-task">
            <Sparkles size={18} />
            <div>
              <b>Что нужно найти</b>
              <p>{meta.task}</p>
            </div>
          </div>
          <div className="lab-flow" role="group" aria-label="Этапы тренировки">
            {[
              ["Ситуация", FlaskConical],
              ["Проверка", Activity],
              ["Результат", ShieldAlert],
              ["Расследование", Search],
            ].map(([name, Component], i) => {
              const I = Component as typeof Shield;
              return (
                <button
                  key={String(name)}
                  className={activeStep === i ? "active" : ""}
                  onClick={() => setActiveStep(i)}
                  aria-pressed={activeStep === i}
                >
                  <I size={20} />
                  <small>{String(name)}</small>
                  {i < 3 && <ChevronRight className="flow-arrow" size={14} />}
                </button>
              );
            })}
          </div>
          <div className="lab-step-caption">
            {
              [
                "Слева можно выбрать любую ситуацию. Описание и задача изменятся вместе с выбором.",
                "Нажмите кнопку запуска: сервер сохранит события и применит правила обнаружения.",
                "После запуска ниже появятся реальные события и объяснимые предупреждения.",
                "Откройте инцидент: изучите доказательства, запишите вывод и сформируйте PDF.",
              ][activeStep]
            }
          </div>
          <Button
            className="lab-launch"
            disabled={busy || !canRun || !selected}
            onClick={launch}
          >
            <Play size={18} />
            {busy
              ? "Обработка событий…"
              : result
                ? "Повторить тренировку"
                : "Запустить сценарий"}
          </Button>
          {!canRun && (
            <p>
              Наблюдатель может изучать инструкции. Для запуска требуется роль
              аналитика или демонстрационного пользователя.
            </p>
          )}
          <BlockGuide
            title="Тренировка"
            text="Сервер обработает синтетические события по текущим правилам и покажет доказательства."
            steps="Изучите цель, запустите сценарий и раскройте события в результате. Можно повторить тренировку; правила могут связать новые доказательства с существующим инцидентом."
          />
        </section>
      </div>
      {result && (
        <section className="lab-results" aria-live="polite" ref={resultArea}>
          <div className="lab-section-heading">
            <div>
              <span className="eyebrow">
                РЕЗУЛЬТАТ ЗАПУСКА #{result.run_id}
              </span>
              <h2>Проверка завершена — исследуйте доказательства</h2>
              <p>
                События получены с сервера. Нажмите на запись, чтобы раскрыть
                подробности.
              </p>
            </div>
            <span className="badge">
              <CheckCircle2 size={14} /> Сохранено в базе
            </span>
          </div>
          <div className="lab-result-stats">
            <div>
              <Activity size={19} />
              <strong>{result.events.length}</strong>
              <span>событий</span>
            </div>
            <div>
              <ShieldAlert size={19} />
              <strong>{result.incidents.length}</strong>
              <span>инцидентов</span>
            </div>
            <div>
              <Shield size={19} />
              <strong>
                {Math.max(
                  0,
                  ...(output.data?.incidents || []).map((i: Row) => i.risk),
                )}
              </strong>
              <span>максимальный риск</span>
            </div>
          </div>
          {output.isLoading && <p>Загрузка сохранённых доказательств…</p>}
          {output.error && (
            <p role="alert" className="error">
              {output.error.message}
            </p>
          )}
          <div className="lab-evidence-grid">
            <div>
              <h3>Хронология событий</h3>
              <div className="lab-timeline">
                {output.data?.events.map((e: Row, index: number) => (
                  <div className="lab-timeline-item" key={e.id}>
                    <span className="timeline-marker">{index + 1}</span>
                    <div className="timeline-card">
                      <button
                        className="timeline-toggle"
                        aria-expanded={expanded === e.id}
                        onClick={() =>
                          setExpanded(expanded === e.id ? null : e.id)
                        }
                      >
                        <div>
                          <b>{e.detail}</b>
                          <small>
                            {date(e.time)} · {e.device}
                          </small>
                        </div>
                        {expanded === e.id ? <X size={15} /> : <PlusIcon />}
                      </button>
                      {expanded === e.id && (
                        <div className="event-inspector">
                          <p>
                            Учётная запись: <b>{e.account}</b>
                          </p>
                          <p>
                            Уровень: <b>{e.severity}</b>
                          </p>
                          <p>Источник: {e.source}</p>
                          {Object.entries(e.features).map(([k, v]) => (
                            <p key={k}>
                              <code>{k}</code>: <b>{String(v)}</b>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>Обнаруженные инциденты</h3>
              {output.data?.incidents.map((incident: Row) => (
                <article className="lab-alert" key={incident.id}>
                  <div className="row between">
                    <span className="badge red">
                      {riskLabel(incident.risk)} риск
                    </span>
                    <strong>
                      {incident.risk}
                      <small>/100</small>
                    </strong>
                  </div>
                  <h3>{incident.title}</h3>
                  <p>{incident.explanation}</p>
                  <Button onClick={() => onOpenIncident(incident.id)}>
                    Начать расследование <ArrowRight size={16} />
                  </Button>
                </article>
              ))}
              {output.data && !output.data.incidents.length && (
                <div className="lab-task">
                  <CheckCircle2 size={22} />
                  <p>
                    Правила не обнаружили совпадений. Проверьте их текущие
                    пороги и состояние в разделе «Умный анализ».
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
function PlusIcon() {
  return <span className="expand-plus">+</span>;
}
