import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cpu, Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { api } from "../api";
import { useQuery } from "@tanstack/react-query";
import { EmblemPair } from "./emblems";
import { BRAND_NAME, BRAND_TAGLINE } from "../lib/brand";

export type Infrastructure = {
  nodes: {
    name: string;
    kind: string;
    status: string;
    events: number;
    risk: number;
    incidents: number[];
  }[];
  edges: { device: string; account: string }[];
  event_limit: number;
};

export function useInfrastructure() {
  return useQuery({
    queryKey: ["ultra-infrastructure"],
    queryFn: () => api<Infrastructure>("/superapp/twin"),
    staleTime: 15000,
  });
}

export function UltraIntro() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = () => setVisible(true);
    try {
      if (
        !localStorage.getItem("aegis-ultra-intro") &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        setVisible(true);
      }
    } catch {
      /* Storage may be disabled. Intro remains optional. */
    }
    window.addEventListener("aegis-replay-intro", show);
    return () => window.removeEventListener("aegis-replay-intro", show);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const close = () => {
      setVisible(false);
      try {
        localStorage.setItem("aegis-ultra-intro", "1");
      } catch {
        /* optional */
      }
    };
    const timer = setTimeout(close, 2400);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") e.preventDefault();
    };
    window.addEventListener("keydown", escape);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", escape);
    };
  }, [visible]);
  if (!visible) return null;
  return (
    <div
      className="ultra-intro"
      role="dialog"
      aria-modal="true"
      aria-label="Знакомство с AegisBorder"
    >
      <div className="ultra-intro-mark">
        <EmblemPair className="intro-emblems" publicMode />
        <span>{BRAND_NAME}</span>
        <small>{BRAND_TAGLINE}</small>
      </div>
      <div className="ultra-intro-scan" />
      <button
        autoFocus
        onClick={() => {
          setVisible(false);
          try {
            localStorage.setItem("aegis-ultra-intro", "1");
          } catch {
            /* optional */
          }
        }}
      >
        Пропустить вступление <X size={14} />
      </button>
    </div>
  );
}

export function DigitalCore({
  state = "idle",
}: {
  state?: "idle" | "working" | "anomaly" | "critical" | "complete";
}) {
  const labels = {
    idle: "Ожидание выбора",
    working: "Обработка запроса",
    anomaly: "Есть аномалии",
    critical: "Высокий риск",
    complete: "Результат готов",
  };
  return (
    <div
      className={`ultra-core ultra-core-${state}`}
      role="img"
      aria-label={`Ядро анализа: ${labels[state]}`}
    >
      <div className="ultra-core-orbit orbit-a" />
      <div className="ultra-core-orbit orbit-b" />
      <div className="ultra-core-orbit orbit-c" />
      <div className="ultra-core-center">
        <Cpu size={42} strokeWidth={1} />
        <span>AEGIS</span>
      </div>
      <span className="ultra-core-caption">
        <i />
        {labels[state]}
      </span>
    </div>
  );
}

export function InfrastructureScene({
  graph,
  pending,
  error,
  compact = false,
}: {
  graph?: Infrastructure;
  pending?: boolean;
  error?: Error | null;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [zoom, setZoom] = useState(1),
    [selected, setSelected] = useState<string | null>(null);
  const nodes = useMemo(() => {
    const devices = (graph?.nodes || []).map((n) => ({ ...n, device: true }));
    const accounts = [
      ...new Set((graph?.edges || []).map((e) => e.account)),
    ].map((name) => ({
      name,
      device: false,
      risk: 0,
      events: 0,
      incidents: [] as number[],
      kind: "Учётная запись",
      status: "Упоминается в событиях",
    }));
    const all = [...devices, ...accounts];
    return all.slice(0, 36).map((n, i) => {
      const count = Math.min(all.length, 36),
        angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = n.device ? 168 : 105;
      return {
        ...n,
        x: 310 + Math.cos(angle) * radius * 1.36,
        y: 215 + Math.sin(angle) * radius * 0.85,
        key: `${n.device ? "device" : "account"}:${n.name}`,
      };
    });
  }, [graph]);
  const current = nodes.find((n) => n.key === selected);
  return (
    <div className={`ultra-infrastructure ${compact ? "compact" : ""}`}>
      <div className="ultra-scene-toolbar">
        <span>
          <i /> Связи по событиям
        </span>
        <div>
          <button
            className="icon-btn"
            aria-label="Уменьшить схему"
            disabled={zoom <= 0.7}
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
          >
            <Minus size={15} />
          </button>
          <button
            className="icon-btn"
            aria-label="Сбросить масштаб"
            onClick={() => setZoom(1)}
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="icon-btn"
            aria-label="Увеличить схему"
            disabled={zoom >= 1.6}
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
      <svg
        className="ultra-network"
        viewBox="0 0 620 430"
        role="img"
        aria-label="Схема устройств и учётных записей. Связи построены по сохранённым событиям."
      >
        <defs>
          <radialGradient id={`${id}halo`}>
            <stop stopColor="#43b7bf" stopOpacity=".12" />
            <stop offset="1" stopColor="#43b7bf" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}line`}>
            <stop stopColor="#43b7bf" stopOpacity=".65" />
            <stop offset="1" stopColor="#7189af" stopOpacity=".2" />
          </linearGradient>
        </defs>
        <circle cx="310" cy="215" r="205" fill={`url(#${id}halo)`} />
        <g
          className="ultra-orb-wire"
          fill="none"
          stroke="#21415a"
          strokeWidth=".7"
        >
          <ellipse cx="310" cy="215" rx="235" ry="163" />
          <ellipse cx="310" cy="215" rx="156" ry="163" />
          <ellipse cx="310" cy="215" rx="73" ry="163" />
          {[100, 145, 215, 285, 330].map((y) => (
            <ellipse
              key={y}
              cx="310"
              cy={y}
              rx={Math.sqrt(Math.max(0, 1 - ((y - 215) / 170) ** 2)) * 235}
              ry="22"
            />
          ))}
          <path d="M75 215H545M310 52V378" strokeDasharray="3 8" />
        </g>
        <g transform={`translate(310 215) scale(${zoom}) translate(-310 -215)`}>
          {(graph?.edges || []).slice(0, 120).map((edge, i) => {
            const a = nodes.find((n) => n.device && n.name === edge.device),
              b = nodes.find((n) => !n.device && n.name === edge.account);
            if (!a || !b) return null;
            return (
              <path
                className="ultra-network-edge"
                key={`${edge.device}:${edge.account}`}
                d={`M${a.x} ${a.y} Q310 ${150 + (i % 5) * 25} ${b.x} ${b.y}`}
                fill="none"
                stroke={`url(#${id}line)`}
                strokeWidth={selected === a.key || selected === b.key ? 2 : 1}
              />
            );
          })}
          {nodes.map((n) => (
            <g
              className="ultra-network-node"
              key={n.key}
              role="button"
              tabIndex={0}
              aria-label={`${n.name}, ${n.device ? `${n.events} событий, риск ${n.risk}` : "учётная запись"}`}
              aria-pressed={selected === n.key}
              onClick={() => setSelected(n.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(n.key);
                }
              }}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={selected === n.key ? 18 : 13}
                fill="#091321"
                stroke={
                  n.risk >= 85
                    ? "#df7082"
                    : n.risk >= 65
                      ? "#e6b86b"
                      : n.device
                        ? "#43b7bf"
                        : "#d0aa67"
                }
              />
              <circle
                cx={n.x}
                cy={n.y}
                r={n.device ? 4 : 3}
                fill={
                  n.risk >= 85 ? "#df7082" : n.device ? "#43b7bf" : "#d0aa67"
                }
              />
              <text
                x={n.x}
                y={n.y + 28}
                fill="#91a5bd"
                fontSize="9"
                textAnchor="middle"
              >
                {n.name.length > 22 ? n.name.slice(0, 20) + "…" : n.name}
              </text>
            </g>
          ))}
        </g>
        {!nodes.length && (
          <g>
            <text
              x="310"
              y="206"
              textAnchor="middle"
              fill="#f4f8ff"
              fontSize="16"
            >
              {pending
                ? "Получаем данные…"
                : error
                  ? "Схема недоступна"
                  : "Инфраструктура ещё не добавлена"}
            </text>
            <text
              x="310"
              y="232"
              textAnchor="middle"
              fill="#91a5bd"
              fontSize="11"
            >
              {error
                ? "Проверьте подключение и повторите запрос"
                : "Схема появится по данным устройств и событий"}
            </text>
          </g>
        )}
      </svg>
      <div className="ultra-scene-legend">
        <span>
          <i />
          Устройства
        </span>
        <span>
          <i />
          Учётные записи
        </span>
        <span>
          <i />
          Высокий риск
        </span>
        <small>Условное размещение · не географическая карта</small>
      </div>
      {current && (
        <div className="ultra-node-detail">
          <div>
            <b>{current.name}</b>
            <small>
              {current.kind} · {current.status}
            </small>
          </div>
          <button
            className="icon-btn"
            aria-label="Закрыть сведения об узле"
            onClick={() => setSelected(null)}
          >
            <X size={15} />
          </button>
          {current.device && (
            <>
              <span>
                {current.events} событий · риск {current.risk}/100
              </span>
              <Link to={`/app/events?q=${encodeURIComponent(current.name)}`}>
                Открыть события →
              </Link>
            </>
          )}
        </div>
      )}
      {!compact && (
        <p className="ultra-footnote">
          Связь означает присутствие устройства и учётной записи в одном
          событии, а не физическое соединение. Показано {nodes.length} узлов
          {(graph?.nodes.length || 0) > 36 ? " из выборки" : ""}; выборка — до{" "}
          {graph?.event_limit || 2000} событий.
        </p>
      )}
    </div>
  );
}

export function PresentationMode() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("ultra-presenting", active);
    const exit = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(false);
    };
    window.addEventListener("keydown", exit);
    return () => {
      document.body.classList.remove("ultra-presenting");
      window.removeEventListener("keydown", exit);
    };
  }, [active]);
  return (
    <button
      className="btn btn-outline ultra-presentation-toggle"
      aria-pressed={active}
      onClick={() => setActive(!active)}
    >
      <Maximize2 size={15} />
      {active ? "Обычный интерфейс · Esc" : "Режим презентации"}
    </button>
  );
}
