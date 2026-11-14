/* Назначение файла: Вкладка «Доступ через DLP» в консоли пользователей.
 * По умолчанию DLP никому не нужен. Администратор включает требование конкретному сотруднику —
 * тогда тот сможет работать только после подключения агента Aegis DLP на своём ПК.
 * Права и иерархию проверяет сервер (PUT /api/v1/dlp/requirements/{id}); интерфейс лишь отражает их.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, ShieldCheck, ShieldOff } from "lucide-react";
import { api } from "../api";

type Requirement = {
  id: number;
  username: string;
  role: string;
  role_label: string;
  required: boolean;
  supported: boolean;
  editable: boolean;
};

export function DlpRequirements() {
  const client = useQueryClient();
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const list = useQuery({
    queryKey: ["dlp-requirements"],
    queryFn: () => api<Requirement[]>("/dlp/requirements"),
  });

  async function toggle(person: Requirement) {
    setBusy(person.id);
    setMessage("");
    try {
      await api(`/dlp/requirements/${person.id}`, "PUT", { required: !person.required });
      setMessage(
        person.required
          ? `${person.username}: требование DLP снято — доступ без агента.`
          : `${person.username}: теперь работа возможна только с подключённым Aegis DLP.`,
      );
      await client.invalidateQueries({ queryKey: ["dlp-requirements"] });
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const required = list.data?.filter((p) => p.required).length ?? 0;
  return (
    <section className="dlp-req" aria-labelledby="dlp-req-title">
      <div className="dlp-req-head">
        <div>
          <h3 id="dlp-req-title">Доступ через Aegis DLP</h3>
          <p>
            По умолчанию DLP не требуется: заходить и работать могут все. Включите требование сотруднику,
            чьи действия нужно ограничить, — без подключённого агента рабочие разделы для него закроются.
          </p>
        </div>
        <span className="badge">Требуется у {required}</span>
      </div>
      {message && (
        <p role="status" className="dlp-req-message">
          {message}
        </p>
      )}
      {list.error && (
        <p role="alert" className="error-box">
          {(list.error as Error).message}
        </p>
      )}
      {list.isPending && <p role="status">Загрузка списка…</p>}
      <ul className="dlp-req-list">
        {list.data?.map((person) => {
          const blocked = !person.editable || (!person.supported && !person.required);
          return (
            <li key={person.id} className={person.required ? "is-required" : ""}>
              <span className="dlp-req-icon" aria-hidden="true">
                {person.required ? <LockKeyhole size={16} /> : <ShieldOff size={16} />}
              </span>
              <div>
                <b>{person.username}</b>
                <small>
                  {person.role_label}
                  {!person.editable
                    ? " · изменить нельзя (вы сами или роль выше вашей)"
                    : !person.supported
                      ? " · агент DLP доступен ролям «Разработчик» и выше"
                      : ""}
                </small>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={person.required}
                aria-label={`Требовать Aegis DLP для ${person.username}`}
                className={"dlp-req-switch" + (person.required ? " is-on" : "")}
                disabled={blocked || busy === person.id}
                onClick={() => void toggle(person)}
              >
                <span />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="dlp-req-note">
        <ShieldCheck size={14} /> Решение применяет сервер: для отмеченных сотрудников рабочие API отвечают «нужен
        Aegis DLP», пока агент не подтвердит защиту ПК. Каждое изменение записывается в журнал действий.
      </p>
    </section>
  );
}
