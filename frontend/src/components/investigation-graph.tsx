import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileText, ZoomIn, ZoomOut } from "lucide-react";
import { api, type Row } from "../api";
import { EventTable } from "./event-table";
import { Button } from "./ui/button";
import { BlockGuide } from "./block-guide";

export function InvestigationGraph({
  incident,
  technical,
}: {
  incident: Row;
  technical: boolean;
}) {
  const [filter, setFilter] = useState<{ kind: string; value: string } | null>(
      null,
    ),
    [zoom, setZoom] = useState(1);
  const events = (incident.events || []) as Row[];
  const documents = useQuery({
    queryKey: ["incident-documents", incident.id],
    queryFn: () => api(`/workspace/documents?incident_id=${incident.id}`),
  });
  const devices = [
      ...new Set(
        events
          .map((e) => e.device)
          .filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0,
          ),
      ),
    ],
    accounts = [
      ...new Set(
        events
          .map((e) => e.account)
          .filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0,
          ),
      ),
    ];
  const filtered = filter
    ? events.filter((e) =>
        filter.kind === "device"
          ? e.device === filter.value
          : e.account === filter.value,
      )
    : events;
  const height = Math.max(
    230,
    Math.max(devices.length, accounts.length) * 82 + 65,
  );
  return (
    <section className="investigation-visual">
      <div className="row between wrap">
        <h3>Граф доказательств</h3>
        <div className="row">
          <Button
            variant="ghost"
            disabled={zoom <= 0.75}
            aria-label="Уменьшить граф"
            onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
          >
            <ZoomOut size={16} />
          </Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            disabled={zoom >= 2}
            aria-label="Увеличить граф"
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
          >
            <ZoomIn size={16} />
          </Button>
        </div>
      </div>
      <div className="evidence-graph-scroll">
        <svg
          className="evidence-graph"
          viewBox={`0 0 760 ${height}`}
          style={{ width: 760 * zoom, height: height * zoom }}
          role="group"
          aria-label="Связи инцидента с устройствами и учётными записями"
        >
          <defs>
            <linearGradient id={`graph-${incident.id}`}>
              <stop stopColor="#00a6bc" />
              <stop offset="1" stopColor="#f5b335" />
            </linearGradient>
          </defs>
          {devices.map((device, i) => (
            <path
              className="graph-edge"
              key={device}
              d={`M 260 ${55 + i * 82} C 300 ${55 + i * 82} 300 ${height / 2} 330 ${height / 2}`}
            />
          ))}
          {accounts.map((account, i) => (
            <path
              className="graph-edge"
              key={account}
              d={`M 430 ${height / 2} C 470 ${height / 2} 460 ${55 + i * 82} 500 ${55 + i * 82}`}
            />
          ))}
          <g className="graph-center">
            <circle cx="380" cy={height / 2} r="50" />
            <text x="380" y={height / 2 - 8} textAnchor="middle">
              Инцидент
            </text>
            <text x="380" y={height / 2 + 15} textAnchor="middle">
              #{incident.id}
            </text>
          </g>
          {[
            { values: devices, kind: "device", x: 20 },
            { values: accounts, kind: "account", x: 500 },
          ].flatMap((group) =>
            group.values.map((value, i) => (
              <g
                key={group.kind + value}
                role="button"
                tabIndex={0}
                aria-label={
                  (group.kind === "device"
                    ? "Показать события устройства "
                    : "Показать события учётной записи ") + value
                }
                className={
                  "graph-node " +
                  (filter?.kind === group.kind && filter.value === value
                    ? "selected"
                    : "")
                }
                onClick={() => setFilter({ kind: group.kind, value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFilter({ kind: group.kind, value });
                  }
                }}
              >
                <rect
                  x={group.x}
                  y={25 + i * 82}
                  width="240"
                  height="60"
                  rx="10"
                />
                <text
                  x={group.x + 15}
                  y={46 + i * 82}
                  className="graph-node-caption"
                >
                  {group.kind === "device" ? "УСТРОЙСТВО" : "УЧЁТНАЯ ЗАПИСЬ"}
                </text>
                <text x={group.x + 15} y={68 + i * 82}>
                  {value.length > 25 ? value.slice(0, 24) + "…" : value}
                </text>
              </g>
            )),
          )}
        </svg>
      </div>
      <BlockGuide
        title="Граф доказательств"
        text="Связи построены по сохранённым событиям этого инцидента. Учётные записи — значения из синтетических событий, а не профили сотрудников."
        steps="Нажмите устройство или учётную запись, чтобы отфильтровать хронологию ниже. Увеличьте граф для чтения; горизонтальная прокрутка доступна на узком экране. Линии означают участие в инциденте, а не доказанную причинность."
      />
      <div className="row between wrap">
        <h3>
          {filter
            ? `Хронология: ${filter.value}`
            : "Хронология связанных событий"}
        </h3>
        {filter && (
          <Button variant="outline" onClick={() => setFilter(null)}>
            Показать все события
          </Button>
        )}
      </div>
      <EventTable items={filtered} technical={technical} />
      <h3>
        <FileText size={17} /> Связанные материалы Workspace
      </h3>
      {documents.isPending ? (
        <p role="status">Загрузка материалов…</p>
      ) : documents.error ? (
        <p role="alert">{documents.error.message}</p>
      ) : (
        <div className="linked-materials">
          {documents.data?.map((doc: Row) => (
            <Link key={doc.id} to={`/app/workspace?document=${doc.id}`}>
              {doc.title}
              <small>
                {doc.status} · версия {doc.revision}
              </small>
            </Link>
          ))}
          {documents.data?.length === 0 && (
            <p>Документов с этой связью пока нет.</p>
          )}
          <Link
            className="btn btn-outline"
            to={`/app/workspace?incident=${incident.id}`}
          >
            Открыть Workspace для инцидента
          </Link>
        </div>
      )}
    </section>
  );
}
