/* Назначение файла: Отображает обзор состояния SOC и переходы к разделам, которым требуется внимание.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronRight,
  Cpu,
  EyeOff,
  Layers,
  MoreHorizontal,
  Network,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type Row } from "../api";
import { date, riskLabel } from "../lib/utils";
import { InfrastructureScene, useInfrastructure } from "./ultra-visuals";

const widgetNames: Record<string, string> = {
  infrastructure: "Инфраструктура",
  signals: "Приоритетные сигналы",
  timeline: "Поток событий",
  risks: "Распределение рисков",
  activity: "Последние события",
  components: "Компоненты системы",
};
const defaults = Object.keys(widgetNames);
function Counter({ value }: { value: number }) {
  const previous = useRef(value),
    [display, setDisplay] = useState(value);
  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      from === value
    ) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 420);
      setDisplay(
        Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3))),
      );
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span aria-label={value.toLocaleString("ru-RU")}>
      <span aria-hidden="true">{display.toLocaleString("ru-RU")}</span>
    </span>
  );
}
export function UltraDashboard({
  dashboard,
  incidents,
  events,
  health,
  userId,
  onIncident,
}: {
  dashboard: Row;
  incidents: Row[];
  events: Row[];
  health?: Row;
  userId: number;
  onIncident: (id: number) => void;
}) {
  const infrastructure = useInfrastructure();
  const [widgets, setWidgets] = useState<string[]>(() => {
    try {
      const x = JSON.parse(
        localStorage.getItem(`aegis-ultra-widgets-${userId}`) || "null",
      );
      return Array.isArray(x)
        ? x.filter(
            (v, i) =>
              typeof v === "string" &&
              defaults.includes(v) &&
              x.indexOf(v) === i,
          )
        : defaults;
    } catch {
      return defaults;
    }
  });
  const [menu, setMenu] = useState<string | null>(null);
  const [customize, setCustomize] = useState(false);
  const save = (next: string[]) => {
    setWidgets(next);
    try {
      localStorage.setItem(
        `aegis-ultra-widgets-${userId}`,
        JSON.stringify(next),
      );
    } catch {
      /* Interface preference is optional. */
    }
    setMenu(null);
  };
  const active = incidents
    .filter(
      (i) => !["Закрыт", "Ложное срабатывание", "Устранён"].includes(i.status),
    )
    .sort((a, b) => b.risk - a.risk);
  const counts = [
    {
      name: "Критический",
      value: active.filter((i) => i.risk >= 85).length,
      color: "#df7082",
    },
    {
      name: "Высокий",
      value: active.filter((i) => i.risk >= 65 && i.risk < 85).length,
      color: "#e6b86b",
    },
    {
      name: "Средний",
      value: active.filter((i) => i.risk >= 40 && i.risk < 65).length,
      color: "#7189af",
    },
    {
      name: "Низкий",
      value: active.filter((i) => i.risk < 40).length,
      color: "#54b89b",
    },
  ];
  const panel = (key: string, children: ReactNode, caption: string) => (
    <section className={`ultra-widget ultra-widget-${key}`} key={key}>
      <div className="ultra-widget-heading">
        <div>
          <h2>{widgetNames[key]}</h2>
          <p>{caption}</p>
        </div>
        <div className="ultra-context">
          <button
            className="icon-btn"
            aria-label={`Настроить виджет: ${widgetNames[key]}`}
            aria-expanded={menu === key}
            onClick={() => setMenu(menu === key ? null : key)}
          >
            <MoreHorizontal size={18} />
          </button>
          {menu === key && (
            <div className="ultra-context-menu">
              <button
                disabled={widgets.indexOf(key) === 0}
                onClick={() => {
                  const n = [...widgets],
                    i = n.indexOf(key);
                  [n[i - 1], n[i]] = [n[i], n[i - 1]];
                  save(n);
                }}
              >
                <ArrowUp size={14} />
                Переместить выше
              </button>
              <button
                disabled={widgets.indexOf(key) === widgets.length - 1}
                onClick={() => {
                  const n = [...widgets],
                    i = n.indexOf(key);
                  [n[i + 1], n[i]] = [n[i], n[i + 1]];
                  save(n);
                }}
              >
                <ArrowDown size={14} />
                Переместить ниже
              </button>
              <button onClick={() => save(widgets.filter((w) => w !== key))}>
                <EyeOff size={14} />
                Скрыть с панели
              </button>
            </div>
          )}
        </div>
      </div>
      {children}
    </section>
  );
  const render: Record<string, () => ReactNode> = {
    infrastructure: () =>
      panel(
        "infrastructure",
        <InfrastructureScene
          compact
          graph={infrastructure.data}
          pending={infrastructure.isPending}
          error={infrastructure.error}
        />,
        "Цифровой контур · связи из сохранённых событий",
      ),
    signals: () =>
      panel(
        "signals",
        <div className="ultra-signals">
          {active.slice(0, 4).map((i) => (
            <button key={i.id} onClick={() => onIncident(i.id)}>
              <span
                className={`ultra-signal-dot ${i.risk >= 85 ? "critical" : "warning"}`}
              />
              <div>
                <small>
                  ИНЦИДЕНТ #{i.id} · {i.status}
                </small>
                <h3>{i.title}</h3>
                <p>{i.device}</p>
              </div>
              <strong
                className={i.risk >= 85 ? "ultra-critical" : "ultra-warning"}
              >
                {i.risk}
                <small>/100</small>
              </strong>
              <ChevronRight size={15} />
            </button>
          ))}
          {!active.length && (
            <div className="ultra-empty">
              <Check size={28} />
              <h3>Нет открытых сигналов</h3>
              <p>Новые результаты появятся после обработки событий.</p>
              <Link to="/app/scenarios">
                Открыть учебный полигон <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
          <Link className="ultra-panel-link" to="/app/incidents">
            Все инциденты <ArrowUpRight size={15} />
          </Link>
        </div>,
        "Сначала — ситуации с наибольшим риском",
      ),
    timeline: () =>
      panel(
        "timeline",
        <>
          <div className="ultra-chart">
            {dashboard.timeline?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard.timeline}>
                  <defs>
                    <linearGradient
                      id="ultra-chart-fill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop stopColor="#43b7bf" stopOpacity={0.28} />
                      <stop offset="1" stopColor="#43b7bf" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1c2e42" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#6f859f"
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                  />
                  <YAxis
                    stroke="#6f859f"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    fontSize={10}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#112236",
                      border: "1px solid #28405d",
                      borderRadius: 8,
                    }}
                  />
                  <Area
                    dataKey="events"
                    name="События"
                    stroke="#43b7bf"
                    fill="url(#ultra-chart-fill)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="ultra-empty">
                <Activity size={25} />
                <p>Пока нет событий для графика</p>
              </div>
            )}
          </div>
          <div className="ultra-chart-caption">
            <span>Время UTC · последние 1 000 событий</span>
            <Link to="/app/events">Открыть мониторинг →</Link>
          </div>
        </>,
        "Число сохранённых событий по времени",
      ),
    risks: () =>
      panel(
        "risks",
        <div className="ultra-risk-distribution">
          <div className="ultra-risk-total">
            <strong>{active.length}</strong>
            <span>
              открытых
              <br />
              ситуаций
            </span>
          </div>
          {counts.map((c) => (
            <div className="ultra-risk-row" key={c.name}>
              <span>
                <i style={{ background: c.color }} />
                {c.name}
              </span>
              <b>{c.value}</b>
              <div>
                <span
                  style={{
                    width: `${active.length ? (c.value / active.length) * 100 : 0}%`,
                    background: c.color,
                  }}
                />
              </div>
            </div>
          ))}
          <small>Риск — приоритет проверки, не вероятность атаки.</small>
        </div>,
        "По оценкам доступных открытых инцидентов",
      ),
    activity: () =>
      panel(
        "activity",
        <div className="ultra-activity-list">
          {events.slice(0, 5).map((e) => (
            <Link
              key={e.id}
              to={`/app/events?q=${encodeURIComponent(e.device || "")}`}
            >
              <span className="ultra-activity-icon">
                <Activity size={15} />
              </span>
              <div>
                <b>{e.type}</b>
                <small>
                  {e.device} · {e.source}
                </small>
              </div>
              <time>{date(e.time)}</time>
              <ArrowUpRight size={14} />
            </Link>
          ))}
          {!events.length && (
            <div className="ultra-empty">
              <Layers size={25} />
              <p>Лента появится после приёма событий.</p>
            </div>
          )}
        </div>,
        "Последние записи из API мониторинга",
      ),
    components: () =>
      panel(
        "components",
        <div className="ultra-component-list">
          <div>
            <Cpu size={17} />
            <span>
              Приложение<small>Проверка API /health</small>
            </span>
            <b
              className={
                health?.status === "ok" ? "ultra-success" : "ultra-warning"
              }
            >
              {health?.status === "ok" ? "Доступно" : "Нет подтверждения"}
            </b>
          </div>
          <div>
            <Layers size={17} />
            <span>
              База данных<small>{health?.database || "Тип не получен"}</small>
            </span>
            <b
              className={
                health?.status === "ok" ? "ultra-success" : "ultra-warning"
              }
            >
              {health?.status === "ok" ? "Доступна" : "Нет подтверждения"}
            </b>
          </div>
          <div>
            <Network size={17} />
            <span>
              Источники событий
              <small>По текущей выборке, не статус соединения</small>
            </span>
            <b>{new Set(events.map((e) => e.source)).size}</b>
          </div>
          <p>
            Состояние отдельных внешних подключений — в{" "}
            <Link className="ultra-inline-link" to="/app/integrations">центре интеграций ↗</Link>
          </p>
        </div>,
        "Только подтверждённые ответы сервера",
      ),
  };
  return (
    <div className="ultra-dashboard">
      <div className="ultra-dashboard-toolbar">
        <span>
          <i />
          Оперативная сводка <small>Обновляется по данным сервера</small>
        </span>
        <div>
          <button
            className="btn btn-ghost"
            aria-expanded={customize}
            onClick={() => setCustomize(!customize)}
          >
            <Layers size={14} />
            Виджеты
          </button>
          <button
            className="icon-btn"
            aria-label="Восстановить виджеты панели"
            onClick={() => save(defaults)}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      {customize && (
        <div className="ultra-widget-picker">
          {defaults.map((key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={widgets.includes(key)}
                onChange={() =>
                  save(
                    widgets.includes(key)
                      ? widgets.filter((x) => x !== key)
                      : [...widgets, key],
                  )
                }
              />
              {widgetNames[key]}
            </label>
          ))}
        </div>
      )}
      <div className="ultra-kpis">
        {[
          {
            label: "События",
            value: dashboard.events,
            icon: Activity,
            path: "events",
            caption: "Записи в базе",
          },
          {
            label: "Открытые инциденты",
            value: dashboard.open_incidents,
            icon: ShieldAlert,
            path: "incidents",
            caption: "Ожидают решения",
          },
          {
            label: "Максимальный риск",
            value: dashboard.risk,
            icon: Cpu,
            path: "incidents",
            caption: riskLabel(dashboard.risk),
          },
          {
            label: "Устройства в схеме",
            value: infrastructure.data?.nodes.length,
            icon: Network,
            path: "twin",
            caption: "По доступным данным",
          },
        ].map((m, i) => (
          <Link to={`/app/${m.path}`} className="ultra-kpi" key={m.label}>
            <span className="ultra-kpi-label">
              <m.icon size={16} />
              {m.label}
              <ArrowUpRight size={13} />
            </span>
            <strong>
              {m.value === undefined ? (
                "—"
              ) : (
                <Counter value={Number(m.value)} />
              )}
              {i === 2 && <small>/100</small>}
            </strong>
            <span className="ultra-kpi-caption">
              <i className={i === 1 && m.value ? "warning" : ""} />
              {m.caption}
            </span>
          </Link>
        ))}
      </div>
      <div className="ultra-widget-grid">{widgets.map((k) => render[k]())}</div>
      {!widgets.length && (
        <div className="ultra-empty">
          <p>Все виджеты скрыты. Восстановите нужные через кнопку «Виджеты».</p>
        </div>
      )}
    </div>
  );
}
