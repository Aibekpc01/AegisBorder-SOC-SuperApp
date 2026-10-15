import { ArrowUpRight, Clock3, Monitor, ShieldAlert } from "lucide-react";
import { type Row } from "../api";
import { date, riskLabel } from "../lib/utils";

export function UltraIncidents({
  items,
  onOpen,
}: {
  items: Row[];
  onOpen: (id: number) => void;
}) {
  if (!items.length)
    return (
      <div className="ultra-empty">
        <ShieldAlert size={28} />
        <h3>Инциденты не найдены</h3>
        <p>Измените фильтр или запустите синтетический сценарий.</p>
      </div>
    );
  return (
    <div className="ultra-incident-grid">
      {[...items]
        .sort((a, b) => b.risk - a.risk)
        .map((item) => (
          <button
            className="ultra-incident-card"
            key={item.id}
            onClick={() => onOpen(item.id)}
          >
            <div className="row between">
              <span className="ultra-incident-ref">
                ИНЦИДЕНТ / {String(item.id).padStart(4, "0")}
              </span>
              <span className="badge">{item.status}</span>
            </div>
            <div className="ultra-incident-card-body">
              <div
                className={`ultra-risk-ring ${item.risk >= 85 ? "critical" : item.risk >= 65 ? "warning" : ""}`}
                style={{ "--risk": `${item.risk}%` } as React.CSSProperties}
              >
                <strong>{item.risk}</strong>
                <small>из 100</small>
              </div>
              <div>
                <small>{riskLabel(item.risk)} приоритет</small>
                <h3>{item.title}</h3>
              </div>
            </div>
            <p>
              Система нашла признаки по правилу. Откройте доказательства и
              проверьте причину перед решением.
            </p>
            <div className="ultra-incident-meta">
              <span>
                <Monitor size={13} />
                {item.device}
              </span>
              <span>
                <Clock3 size={13} />
                {date(item.created)}
              </span>
            </div>
            <div className="ultra-incident-footer">
              <span>Изучить ситуацию</span>
              <ArrowUpRight size={16} />
            </div>
          </button>
        ))}
    </div>
  );
}
