/* Назначение файла: Показывает события в табличном виде и помогает просматривать их поля.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Monitor, ArrowUpRight } from "lucide-react";
import { api, type Row } from "../api";
import { date } from "../lib/utils";
import { Dialog } from "./ui/dialog";
import { BlockGuide } from "./block-guide";

export function EventTable({
  items,
  technical,
}: {
  items: Row[];
  technical: boolean;
}) {
  const [opened, setOpened] = useState<number | null>(null);
  const event = useQuery({
    queryKey: ["event-detail", opened],
    queryFn: () => api("/events/" + opened),
    enabled: opened !== null,
  });
  if (!items.length)
    return (
      <div className="empty">
        <Monitor size={30} />
        <p>Событий пока нет. Запустите учебный сценарий.</p>
      </div>
    );
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Время</th>
              <th>Устройство</th>
              <th>Событие</th>
              <th>Уровень</th>
              {technical && <th>Источник / тип</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr
                className="event-row"
                tabIndex={0}
                key={e.id}
                onClick={() => setOpened(e.id)}
                onKeyDown={(key) => {
                  if (key.key === "Enter") {
                    setOpened(e.id);
                  }
                }}
                aria-label={"Открыть событие " + e.id}
              >
                <td className="nowrap">{date(e.time)}</td>
                <td>
                  <Monitor size={14} /> {e.device}
                  <small>{e.account}</small>
                </td>
                <td>{e.detail}</td>
                <td>
                  <span
                    className={
                      "badge " + (e.severity === "Критическая" ? "red" : "")
                    }
                  >
                    {e.severity}
                  </span>
                </td>
                {technical && (
                  <td>
                    <code>{e.type}</code>
                    <small>{e.source}</small>
                  </td>
                )}
                <td>
                  <ArrowUpRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        title={"Событие #" + opened}
        open={opened !== null}
        onClose={() => setOpened(null)}
      >
        {event.isLoading ? (
          <p>Загрузка события…</p>
        ) : event.error ? (
          <p className="error">{event.error.message}</p>
        ) : (
          event.data && (
            <div className="event-details">
              <h3>{event.data.detail}</h3>
              <div className="event-summary">
                {[
                  ["Время", date(event.data.time)],
                  ["Устройство", event.data.device],
                  ["Учётная запись", event.data.account],
                  ["Уровень", event.data.severity],
                  ["Источник", event.data.source],
                  ["Тип события", event.data.type],
                ].map(([name, value]) => (
                  <div key={name}>
                    <small>{name}</small>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <h3>Что учитывает система</h3>
              <div className="readable-evidence">
                {Object.entries({
                  approved: "Действие разрешено",
                  restricted: "Обращение к закрытым данным",
                  critical: "Затронуты важные файлы",
                  local_hour: "Час учебного события",
                  files: "Число файлов",
                  gap_seconds: "Нет сигнала от устройства, секунд",
                  unusual: "Поведение отличается от обычного",
                  protection_enabled: "Защита включена",
                })
                  .filter(([key]) => key in event.data.features)
                  .map(([key, label]) => (
                    <p key={key}>
                      <b>{label}:</b>{" "}
                      {typeof event.data.features[key] === "boolean"
                        ? event.data.features[key]
                          ? "Да"
                          : "Нет"
                        : String(event.data.features[key])}
                    </p>
                  ))}
              </div>
              <details className="editor-advanced" open={technical}>
                <summary>Для специалиста: исходные признаки события</summary>
                <pre>{JSON.stringify(event.data.features, null, 2)}</pre>
              </details>
              <BlockGuide
                title="Карточка события"
                text="Это фактическая запись из учебной базы, которую использовали правила обнаружения."
                steps="Проверьте время, устройство и признаки. Закройте окно для возврата к списку или продолжите расследование в карточке инцидента."
              />
            </div>
          )
        )}
      </Dialog>
    </>
  );
}
