/* Назначение файла: Интерактивная схема «одна система для всех уровней» на главной странице.
 * Показывает иерархию департамент → дивизион → подразделения и демонстрационный маршрут заявки.
 * Только локальные демонстрационные данные: без API, без служебных сведений.
 * Решение: HTML-карточки + SVG-линии в одной системе координат (1000×400) — без библиотек анимации;
 * переходы CSS и таймер; при prefers-reduced-motion шаги переключаются без движения.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Anchor, ArrowRight, Flag, Landmark, Pause, Play, RotateCcw, Ship, type LucideIcon } from "lucide-react";

type UnitId = "dept" | "division" | "eurasia" | "erkosai" | "isatai" | "kotyaevka";
type Unit = {
  id: UnitId;
  name: string;
  kind: string;
  Icon: LucideIcon;
  x: number; // координаты центра в системе 1000×400
  y: number;
  level: string;
  workspace: string;
  interaction: string;
};

const units: Unit[] = [
  {
    id: "dept",
    name: "Департамент ПС по Атырауской области",
    kind: "Департамент",
    Icon: Landmark,
    x: 500,
    y: 52,
    level: "Уровень 1 · вышестоящий орган",
    workspace: "Сводная картина по подчинённым управлениям, согласование заявок, отчёты.",
    interaction: "Получает заявки, которые дивизион передал на следующий уровень, и возвращает решение.",
  },
  {
    id: "division",
    name: "Дивизион береговой охраны",
    kind: "Управление",
    Icon: Anchor,
    x: 500,
    y: 186,
    level: "Уровень 2 · подчинённое управление",
    workspace: "Входящие заявки подразделений, задачи и согласования, документы, чат.",
    interaction: "Рассматривает заявки подразделений; при необходимости направляет их в департамент.",
  },
  ...(
    [
      ["eurasia", "Пограничная застава «Евразия»", "Застава", Flag, 125],
      ["erkosai", "Пограничная застава «Еркосай батыр»", "Застава", Flag, 375],
      ["isatai", "Пограничная застава «Исатай Батыр»", "Застава", Flag, 625],
      ["kotyaevka", "Группа малых катеров «Котяевка»", "ГМК", Ship, 875],
    ] as const
  ).map(([id, name, kind, Icon, x]) => ({
    id,
    name,
    kind,
    Icon,
    x,
    y: 330,
    level: "Уровень 3 · подразделение дивизиона",
    workspace: "Своё рабочее пространство: заявки, документы, задачи и чат подразделения.",
    interaction: "Направляет заявки в дивизион и получает ответ в то же рабочее пространство.",
  })),
];
const byId = Object.fromEntries(units.map((u) => [u.id, u])) as Record<UnitId, Unit>;

/** Линия от вышестоящего узла к подчинённому: вертикаль, скругление, горизонталь, вертикаль. */
function link(from: Unit, to: Unit) {
  if (from.x === to.x) return `M${from.x} ${from.y + 34} V${to.y - 34}`;
  const mid = 262;
  const dir = to.x > from.x ? 1 : -1;
  return `M${from.x} ${from.y + 34} V${mid - 12} Q${from.x} ${mid} ${from.x + 12 * dir} ${mid} H${to.x - 12 * dir} Q${to.x} ${mid} ${to.x} ${mid + 12} V${to.y - 34}`;
}
const links: { id: string; from: UnitId; to: UnitId }[] = [
  { id: "dept-division", from: "dept", to: "division" },
  ...(["eurasia", "erkosai", "isatai", "kotyaevka"] as const).map((u) => ({ id: "division-" + u, from: "division" as UnitId, to: u })),
];

/** Шаги демонстрации: где заявка, какие линии активны, статус для трекера. */
const steps: { at: UnitId; active: string[]; status: string; note: string }[] = [
  { at: "eurasia", active: [], status: "Создана", note: "Сотрудник заставы «Евразия» создаёт административную заявку в своём рабочем пространстве." },
  { at: "division", active: ["division-eurasia"], status: "На рассмотрении", note: "Заявка появляется у уполномоченного сотрудника дивизиона береговой охраны." },
  { at: "dept", active: ["dept-division"], status: "На согласовании", note: "Дивизион передаёт заявку на следующий уровень — в департамент." },
  { at: "eurasia", active: ["dept-division", "division-eurasia"], status: "Решение получено", note: "Решение возвращается инициатору: статус и комментарий видны на заставе." },
];

const pct = (x: number, y: number): CSSProperties => ({ left: `${x / 10}%`, top: `${y / 4}%` });

/** Опорные точки маршрута заявки по линиям схемы для каждого шага. */
const route: [number, number][][] = [
  [[125, 330]],
  [[125, 262], [500, 262], [500, 186]],
  [[500, 52]],
  [[500, 186], [500, 262], [125, 262], [125, 330]],
];
const HOP_MS = 320;

export function OrgWorkflow() {
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<UnitId>("eurasia");
  const [pos, setPos] = useState<[number, number] | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // Пакет проходит опорные точки шага по очереди; при сниженной анимации сразу встаёт в конечную точку.
  useEffect(() => {
    if (step < 0) {
      setPos(null);
      return;
    }
    const points = route[step];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPos(points[points.length - 1]);
      return;
    }
    const timers = points.map((p, i) => window.setTimeout(() => setPos(p), i * HOP_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [step]);

  // Автопоказ: шаг каждые 1,9 с; остановка на последнем шаге.
  useEffect(() => {
    if (!playing) return;
    timer.current = window.setTimeout(() => {
      setStep((s) => s + 1);
      // На последнем шаге показ завершается сразу, кнопка становится «Показать снова».
      if (step + 1 >= steps.length - 1) setPlaying(false);
    }, step < 0 ? 50 : 1900);
    return () => window.clearTimeout(timer.current);
  }, [playing, step]);

  const current = step >= 0 ? steps[step] : null;
  const unit = byId[selected];
  const start = () => {
    setStep(-1);
    setPlaying(true);
  };

  return (
    <div className="org-flow fr-reveal">
      <div className="org-stage" aria-label="Схема подразделений (пример)">
        <svg className="org-links" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true">
          {links.map((l) => (
            <path
              key={l.id}
              d={link(byId[l.from], byId[l.to])}
              className={current?.active.includes(l.id) ? "is-active" : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {units.map((u, i) => (
          <button
            key={u.id}
            type="button"
            className={
              "org-node org-" + (u.y < 100 ? "l1" : u.y < 250 ? "l2" : "l3") +
              (current?.at === u.id ? " is-current" : "") +
              (selected === u.id ? " is-selected" : "")
            }
            style={{ "--x": `${u.x / 10}%`, "--y": `${u.y / 4}%`, "--d": `${i * 90}ms` } as CSSProperties}
            aria-pressed={selected === u.id}
            onClick={() => setSelected(u.id)}
          >
            <span className="org-node-icon">
              <u.Icon size={16} />
            </span>
            <span className="org-node-text">
              <small>{u.kind}</small>
              <b>{u.name.replace(/^(Пограничная застава|Группа малых катеров) /, "")}</b>
            </span>
          </button>
        ))}
        {pos && <span className="org-packet" style={pct(pos[0], pos[1])} aria-hidden="true" />}
      </div>

      <aside className="org-side">
        <div className="org-ticket">
          <div className="row between">
            <span className="org-tag">Пример заявки</span>
            <span className={"org-status" + (step === steps.length - 1 ? " is-done" : "")}>
              {current ? current.status : "Ожидает запуска"}
            </span>
          </div>
          <h3>Административная заявка · ДЕМО-0427</h3>
          <ol className="org-steps">
            {steps.map((s, i) => (
              <li key={s.status} className={i < step ? "is-past" : i === step ? "is-now" : ""}>
                <span>{i + 1}</span>
                {byId[s.at].kind}: {s.status.toLowerCase()}
              </li>
            ))}
          </ol>
          <p className="org-note" aria-live="polite">
            {current ? current.note : "Нажмите кнопку, чтобы увидеть маршрут заявки между уровнями."}
          </p>
          <div className="org-controls">
            <button type="button" className="btn btn-primary" onClick={playing ? () => setPlaying(false) : start}>
              {playing ? <Pause size={15} /> : <Play size={15} />}
              {playing ? "Пауза" : step >= 0 ? "Показать снова" : "Посмотреть, как работает"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              aria-label="Следующий шаг"
              disabled={step >= steps.length - 1}
              onClick={() => {
                setPlaying(false);
                setStep((s) => s + 1);
              }}
            >
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="Сбросить"
              onClick={() => {
                setPlaying(false);
                setStep(-1);
              }}
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        <div className="org-info" aria-live="polite">
          <span className="org-tag">Пример рабочего пространства</span>
          <h3>{unit.name}</h3>
          <dl>
            <dt>Положение</dt>
            <dd>{unit.level}</dd>
            <dt>Рабочее пространство</dt>
            <dd>{unit.workspace}</dd>
            <dt>Взаимодействие</dt>
            <dd>{unit.interaction}</dd>
          </dl>
        </div>
      </aside>

      <p className="org-disclaimer">
        Демонстрационная схема: структура и порядок согласования показаны для примера и не отражают официальный
        регламент. Служебные сведения не используются; доступ к данным определяется ролями и правами в системе.
      </p>
    </div>
  );
}
