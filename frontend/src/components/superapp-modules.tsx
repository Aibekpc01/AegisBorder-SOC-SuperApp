/* Назначение файла: Содержит экраны дополнительных модулей суперприложения.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { appPage } from "../lib/routes";
import { explainers } from "../lib/explainers";
import { BlockGuide } from "./block-guide";
import { api } from "../api";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import {
  Archive,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { EventTable } from "./event-table";
import { FriendlyEventBuilder } from "./friendly-event-builder";
import { eventChoices } from "../lib/explainers";
import { date } from "../lib/utils";
import "../modules.css";
import { AcademyHub, TeamProject } from "./project-experience";
import { InfrastructureScene, DigitalCore } from "./ultra-visuals";
import { CorporateIntegrations } from "./corporate-integrations";
import { SecurityAnalytics } from "./supper-experience";

type User = { id: number; role: string };
type Incident = {
  id: number;
  title: string;
  risk: number;
  status: string;
  device: string;
  rule_id: string;
  created: string;
};
type Saved<T> = { id: number; created: string; payload: T };
type Task = {
  id: number;
  title: string;
  description: string;
  status: string;
  revision: number;
  owner_id: number;
  assignee_id: number | null;
  reviewer_id: number | null;
  incident_id: number | null;
  due: string | null;
};
type MailResult = {
  sender: string;
  subject: string;
  score: number;
  verdict: string;
  findings: { reason: string; weight: number }[];
  method: string;
};
type ImportResult = {
  created: number;
  duplicates: number;
  incidents: number[];
  sha256: string;
};
type EventInput = {
  external_id: string;
  time: string;
  device: string;
  account: string;
  source: string;
  type: string;
  detail: string;
  features: Record<string, unknown>;
};
type Template = { title: string; events: EventInput[] };
const base = "/superapp";

function Surface({
  children,
  error,
}: {
  children: ReactNode;
  error?: Error | null;
}) {
  const page = appPage(useLocation().pathname),
    guide = explainers[page];
  return (
    <section className="panel superapp-module">
      {error && (
        <p role="alert" className="error">
          {error.message}
        </p>
      )}
      {children}
      {guide && (
        <BlockGuide
          title="Как работать с этим разделом"
          text={guide.description}
          steps={guide.steps.join("\n")}
        />
      )}
    </section>
  );
}

function useAction() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await client.invalidateQueries();
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error("Не удалось выполнить действие"),
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

export function SuperappModules({ page, user }: { page: string; user: User }) {
  switch (page) {
    case "tasks":
      return <Tasks user={user} />;
    case "twin":
      return <Twin />;
    case "assistant":
      return <Assistant />;
    case "mail":
      return <Mail user={user} />;
    case "integrations":
      return <Imports user={user} />;
    case "m365":
      return <M365 />;
    case "rule-builder":
      return <RuleBuilder user={user} />;
    case "academy":
      return <AcademyHub />;
    case "team":
      return <TeamProject user={user} />;
    case "scenario-builder":
      return <ScenarioBuilder user={user} />;
    case "security-analytics":
      return <SecurityAnalytics />;
    default:
      return null;
  }
}

function M365() {
  type Monitor = {
    connected: boolean;
    events: (EventInput & { id: number; severity: string })[];
    accounts: number;
    devices: number;
    types: Record<string, number>;
  };
  const monitor = useQuery({
    queryKey: ["superapp-m365"],
    queryFn: () => api<Monitor>(base + "/m365"),
  });
  return (
    <Surface error={monitor.error}>
      <h2>Microsoft 365: учебный мониторинг</h2>
      <p>
        Онлайн-подключение не настроено. Показаны последние 500 доступных
        импортированных событий с источником Microsoft 365, M365 или
        Microsoft365. Происхождение записей не проверяется; это локальный
        учебный контур.
      </p>
      <Link className="btn btn-outline" to="/app/integrations">
        Импортировать учебные события
      </Link>
      {monitor.isPending && <p role="status">Загрузка событий…</p>}
      {monitor.data && (
        <>
          <p>
            Событий: {monitor.data.events.length} · учётных записей:{" "}
            {monitor.data.accounts} · устройств: {monitor.data.devices}
          </p>
          <div className="row wrap">
            {Object.entries(monitor.data.types).map(([type, count]) => (
              <span className="badge" key={type}>
                {type}: {count}
              </span>
            ))}
          </div>
          <EventTable items={monitor.data.events} technical />
        </>
      )}
    </Surface>
  );
}

function Tasks({ user }: { user: User }) {
  const action = useAction();
  const [state, setState] = useState("active"),
    [selection, setSelection] = useState<number[]>([]),
    [editing, setEditing] = useState<Task | null>(null),
    [pending, setPending] = useState<{ action: string; tasks: Task[] } | null>(
      null,
    );
  const [historyId, setHistoryId] = useState<number | null>(null);
  const history = useQuery({
    queryKey: ["task-history", historyId],
    queryFn: () =>
      api<{ id: number; actor_id: number; action: string; time: string }[]>(
        `${base}/tasks/${historyId}/history`,
      ),
    enabled: historyId !== null,
  });
  const tasks = useQuery({
    queryKey: ["superapp-tasks", state],
    queryFn: () => api<Task[]>(base + "/tasks?state=" + state),
  });
  const incidents = useQuery({
    queryKey: ["superapp-incidents"],
    queryFn: () => api<Incident[]>("/incidents"),
  });
  const operators = useQuery({
    queryKey: ["operators"],
    queryFn: () => api<{ id: number; username: string }[]>("/operators"),
  });
  const transitions: Record<string, string[]> = {
    Новая: ["В работе"],
    "В работе": ["На проверке", "Новая"],
    "На проверке": ["Завершена", "В работе"],
    Завершена: ["В работе"],
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    await action.run(async () => {
      await api(base + "/tasks", "POST", {
        title: data.get("title"),
        reviewer_id: data.get("reviewer") ? Number(data.get("reviewer")) : null,
        description: data.get("description"),
        incident_id: Number(data.get("incident")) || null,
        assignee_id: Number(data.get("assignee")) || null,
        due: data.get("due")
          ? new Date(String(data.get("due"))).toISOString()
          : null,
      });
      form.reset();
    });
  }
  return (
    <Surface
      error={action.error || tasks.error || incidents.error || operators.error}
    >
      <h2>Задачи и проверка выполнения</h2>
      <p>
        Постановщик или администратор подтверждает завершение после проверки.
        Личные учебные задачи изолированы.
      </p>
      {user.role === "admin" && (
        <div className="ultra-task-toolbar">
          <div className="ultra-segmented">
            {[
              ["active", "Активные"],
              ["archived", "Архив"],
              ["deleted", "Корзина"],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={state === key}
                onClick={() => {
                  setState(key);
                  setSelection([]);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <span>
            {selection.length
              ? `Выбрано: ${selection.length}`
              : "Выберите карточки для массового действия"}
          </span>
          {selection.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  setPending({
                    action: state === "active" ? "archive" : "restore",
                    tasks:
                      tasks.data?.filter((t) => selection.includes(t.id)) || [],
                  })
                }
              >
                {state === "active" ? (
                  <Archive size={14} />
                ) : (
                  <RotateCcw size={14} />
                )}{" "}
                {state === "active" ? "Архивировать" : "Восстановить"}
              </Button>
              {state !== "deleted" && (
                <Button
                  variant="destructive"
                  onClick={() =>
                    setPending({
                      action: "delete",
                      tasks:
                        tasks.data?.filter((t) => selection.includes(t.id)) ||
                        [],
                    })
                  }
                >
                  <Trash2 size={14} />В корзину
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {!["observer", "demo_viewer"].includes(user.role) && (
        <form className="module-form" onSubmit={submit}>
          <label>
            Задача
            <input name="title" required maxLength={200} />
          </label>
          <label>
            Описание
            <textarea name="description" maxLength={5000} />
          </label>
          <div className="module-form-grid">
            {user.role !== "demo" && (
              <label>
                Согласующий результата
                <select name="reviewer">
                  <option value="">Постановщик задачи</option>
                  {operators.data
                    ?.filter((o) => o.id !== user.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.username}
                      </option>
                    ))}
                </select>
                <small>
                  Выберите руководителя с ролью аналитика или администратора.
                </small>
              </label>
            )}
            <label>
              Инцидент
              <select name="incident">
                <option value="">Без связи</option>
                {incidents.data?.map((i) => (
                  <option key={i.id} value={i.id}>
                    #{i.id} · {i.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ответственный
              <select name="assignee">
                <option value="">Не назначен</option>
                {(user.role === "demo"
                  ? operators.data?.filter((o) => o.id === user.id)
                  : operators.data
                )?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.username}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Срок (местное время)
              <input type="datetime-local" name="due" />
            </label>
          </div>
          <Button disabled={action.busy}>Создать задачу</Button>
        </form>
      )}
      {tasks.isPending && <p role="status">Загрузка задач…</p>}
      <div className="module-card-grid">
        {tasks.data?.map((t) => (
          <article className="module-card" key={t.id}>
            {user.role === "admin" && (
              <div className="row between ultra-task-actions">
                <label>
                  <input
                    type="checkbox"
                    aria-label={`Выбрать задачу ${t.id}`}
                    checked={selection.includes(t.id)}
                    onChange={() =>
                      setSelection(
                        selection.includes(t.id)
                          ? selection.filter((id) => id !== t.id)
                          : [...selection, t.id],
                      )
                    }
                  />
                  Выбрать
                </label>
                <details className="ultra-card-menu">
                  <summary aria-label={`Действия с задачей ${t.id}`}>
                    <MoreHorizontal size={18} />
                  </summary>
                  <div>
                    {state === "active" && (
                      <>
                        <button onClick={() => setEditing(t)}>
                          <Pencil size={14} />
                          Редактировать
                        </button>
                        <button
                          onClick={() =>
                            setPending({ action: "archive", tasks: [t] })
                          }
                        >
                          <Archive size={14} />
                          Архивировать
                        </button>
                      </>
                    )}
                    {state !== "active" && (
                      <button
                        onClick={() =>
                          setPending({ action: "restore", tasks: [t] })
                        }
                      >
                        <RotateCcw size={14} />
                        Восстановить
                      </button>
                    )}
                    {state !== "deleted" && (
                      <button
                        disabled={!!t.incident_id}
                        title={
                          t.incident_id
                            ? "Связанные с инцидентом материалы можно только архивировать"
                            : undefined
                        }
                        onClick={() =>
                          setPending({ action: "delete", tasks: [t] })
                        }
                      >
                        <Trash2 size={14} />В корзину
                      </button>
                    )}
                  </div>
                </details>
              </div>
            )}
            <span className="badge">{t.status}</span>
            <h3>{t.title}</h3>
            <p>{t.description}</p>
            <p>
              Исполнитель:{" "}
              {operators.data?.find((o) => o.id === t.assignee_id)?.username ||
                (t.assignee_id ? `#${t.assignee_id}` : "Не назначен")}{" "}
              · Согласующий:{" "}
              {operators.data?.find(
                (o) => o.id === (t.reviewer_id || t.owner_id),
              )?.username || `#${t.reviewer_id || t.owner_id}`}
            </p>
            <Button variant="outline" onClick={() => setHistoryId(t.id)}>
              История задачи
            </Button>
            <small>
              Задача #{t.id} · версия {t.revision}
              {t.due ? ` · срок ${date(t.due)}` : ""}
            </small>
            {t.incident_id && <p>Инцидент #{t.incident_id}</p>}
            {state === "active" &&
              !["observer", "demo_viewer"].includes(user.role) &&
              (user.role === "admin" ||
                t.owner_id === user.id ||
                t.reviewer_id === user.id ||
                t.assignee_id === user.id) && (
                <div className="row wrap">
                  {transitions[t.status]
                    ?.filter(
                      (s) =>
                        s !== "Завершена" ||
                        user.role === "admin" ||
                        (t.reviewer_id || t.owner_id) === user.id,
                    )
                    .map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        disabled={action.busy}
                        onClick={() =>
                          action.run(async () => {
                            await api(`${base}/tasks/${t.id}`, "PATCH", {
                              revision: t.revision,
                              status: s,
                            });
                          })
                        }
                      >
                        {s}
                      </Button>
                    ))}
                </div>
              )}
          </article>
        ))}
      </div>
      {tasks.data?.length === 0 && <p>Задач пока нет.</p>}
      <Dialog
        title={`История задачи #${historyId}`}
        open={historyId !== null}
        onClose={() => setHistoryId(null)}
      >
        {history.isPending && <p role="status">Загрузка истории…</p>}
        {history.error && <p role="alert">{history.error.message}</p>}
        {history.data?.map((row) => (
          <article key={row.id}>
            <small>
              {date(row.time)} · сотрудник #{row.actor_id}
            </small>
            <p>{row.action}</p>
          </article>
        ))}
        {history.data?.length === 0 && <p>Записей пока нет.</p>}
      </Dialog>
      <Dialog
        title="Редактировать задачу"
        open={editing !== null}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action.run(async () => {
                await api(base + "/tasks/manage", "POST", {
                  action: "edit",
                  items: [{ id: editing.id, revision: editing.revision }],
                  title: f.get("title"),
                  description: f.get("description"),
                });
                setEditing(null);
              });
            }}
          >
            <label>
              Название
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={editing.title}
              />
            </label>
            <label>
              Описание
              <textarea
                name="description"
                maxLength={5000}
                defaultValue={editing.description}
              />
            </label>
            <Button disabled={action.busy}>Сохранить изменения</Button>
            {action.error && (
              <p role="alert" className="error">
                {action.error.message}
              </p>
            )}
          </form>
        )}
      </Dialog>
      <Dialog
        title={
          pending?.action === "delete"
            ? "Переместить задачи в корзину?"
            : pending?.action === "restore"
              ? "Восстановить задачи?"
              : "Архивировать задачи?"
        }
        open={pending !== null}
        onClose={() => setPending(null)}
      >
        {pending && (
          <>
            <p>
              Выбрано задач: {pending.tasks.length}. Действие запишется в аудит.
              Архив и корзина позволяют восстановить карточку; материалы
              расследований и журналы сохраняются.
            </p>
            <div className="row">
              <Button variant="outline" onClick={() => setPending(null)}>
                Отмена
              </Button>
              <Button
                variant={
                  pending.action === "delete" ? "destructive" : "default"
                }
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await api(base + "/tasks/manage", "POST", {
                      action: pending.action,
                      items: pending.tasks.map((t) => ({
                        id: t.id,
                        revision: t.revision,
                      })),
                    });
                    setPending(null);
                    setSelection([]);
                  })
                }
              >
                Подтвердить
              </Button>
            </div>
            {action.error && (
              <p role="alert" className="error">
                {action.error.message}
              </p>
            )}
          </>
        )}
      </Dialog>
    </Surface>
  );
}

function Twin() {
  type Graph = {
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
  const graph = useQuery({
    queryKey: ["superapp-twin"],
    queryFn: () => api<Graph>(base + "/twin"),
  });
  return (
    <Surface error={graph.error}>
      <h2>Цифровой двойник учебной инфраструктуры</h2>
      <p>
        Устройства из инвентаря и сохранённых событий. Связь с учётной записью
        означает совместное присутствие в событии. Топология сети и физические
        соединения не измерялись. Учитываются последние 2000 событий.
      </p>
      {graph.isPending && <p role="status">Построение схемы…</p>}
      <InfrastructureScene
        graph={graph.data}
        pending={graph.isPending}
        error={graph.error}
      />
      {graph.data?.nodes.length === 0 && (
        <p>Нет доступных устройств. Запустите учебный сценарий.</p>
      )}
    </Surface>
  );
}

function Assistant() {
  type Draft = {
    draft: string;
    method: string;
    evidence_ids: number[];
    recommendations: string[];
  };
  const incidents = useQuery({
    queryKey: ["superapp-incidents"],
    queryFn: () => api<Incident[]>("/incidents"),
  });
  const [selected, setSelected] = useState(0);
  const draft = useQuery({
    queryKey: ["superapp-assistant", selected],
    queryFn: () => api<Draft>(`${base}/assistant/${selected}`),
    enabled: selected > 0,
  });
  return (
    <Surface error={incidents.error || draft.error}>
      <div className="ultra-ai-layout">
        <DigitalCore
          state={
            draft.isFetching
              ? "working"
              : (incidents.data?.find((i) => i.id === selected)?.risk || 0) >=
                  85
                ? "critical"
                : draft.data
                  ? "complete"
                  : "idle"
          }
        />
        <div>
          <span className="eyebrow">ОБЪЯСНИМЫЙ АНАЛИЗ</span>
          <h2>Aegis AI: помощник расследования</h2>
          <p>
            Помощник соберёт описание из фактов выбранной ситуации и предложит
            следующие действия. Это черновик: сравните его с доказательствами
            перед тем, как делать вывод. Подключённой языковой модели пока нет.
          </p>
          <label>
            Выберите инцидент
            <select
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              <option value={0}>Выберите…</option>
              {incidents.data?.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.id} · {i.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {selected > 0 && draft.isPending && (
        <p role="status">Подготовка черновика…</p>
      )}
      {draft.data && (
        <article className="module-card">
          <p>{draft.data.draft}</p>
          <h3>Следующие действия</h3>
          <ul>
            {draft.data.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <p>
            Доказательства:{" "}
            {draft.data.evidence_ids.map((id) => `#${id}`).join(", ") ||
              "Нет связанных событий"}
          </p>
          <Link
            className="btn btn-outline"
            to={`/app/workspace?incident=${selected}`}
          >
            Материалы расследования
          </Link>
        </article>
      )}
      {incidents.data?.length === 0 && (
        <p>Сначала создайте инцидент учебным сценарием.</p>
      )}
    </Surface>
  );
}

function Mail({ user }: { user: User }) {
  const action = useAction();
  const [result, setResult] = useState<MailResult | null>(null);
  const history = useQuery({
    queryKey: ["superapp-mail"],
    queryFn: () => api<Saved<MailResult>[]>(base + "/history/mail"),
  });
  return (
    <Surface error={action.error || history.error}>
      <h2>Почтовая безопасность</h2>
      <p>
        Проверка текста учебного сообщения по локальным признакам. Ссылки и
        вложения не открываются; отсутствие признаков не гарантирует
        безопасность.
      </p>
      {!["observer", "demo_viewer"].includes(user.role) && (
        <form
          className="module-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void action.run(async () => {
              const saved = await api<Saved<MailResult>>(
                base + "/mail/analyze",
                "POST",
                {
                  sender: f.get("sender"),
                  subject: f.get("subject"),
                  body: f.get("body"),
                  attachments: String(f.get("attachments") || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              );
              setResult(saved.payload);
            });
          }}
        >
          <div className="row wrap">
            {[
              {
                label: "Взять подозрительное письмо",
                subject: "Срочно: подтвердите пароль",
                body: "Ваш доступ будет заблокирован. Введите пароль по ссылке https://127.0.0.1/login",
                attachments: "update.exe",
              },
              {
                label: "Взять обычное письмо",
                subject: "План учебных занятий",
                body: "Встреча состоится в среду. План занятий приложен к письму.",
                attachments: "schedule.pdf",
              },
            ].map((sample) => (
              <Button
                key={sample.label}
                type="button"
                variant="outline"
                disabled={action.busy}
                onClick={(e) => {
                  const form = e.currentTarget.form;
                  if (!form) return;
                  for (const [name, value] of Object.entries({
                    sender: "training@example.test",
                    subject: sample.subject,
                    body: sample.body,
                    attachments: sample.attachments,
                  })) {
                    const field = form.elements.namedItem(name);
                    if (
                      field instanceof HTMLInputElement ||
                      field instanceof HTMLTextAreaElement
                    )
                      field.value = value;
                  }
                  setResult(null);
                }}
              >
                {sample.label}
              </Button>
            ))}
          </div>
          <label>
            Отправитель
            <input
              name="sender"
              required
              maxLength={200}
              placeholder="security@example.test"
            />
          </label>
          <label>
            Тема
            <input name="subject" required maxLength={300} />
          </label>
          <label>
            Текст письма
            <textarea name="body" rows={7} maxLength={20000} />
          </label>
          <label>
            Имена вложений через запятую
            <input
              name="attachments"
              maxLength={4000}
              placeholder="report.pdf, update.exe"
            />
          </label>
          <Button disabled={action.busy}>Проверить сообщение</Button>
        </form>
      )}
      {result && (
        <article className="module-card" role="status">
          <h3>
            {result.verdict} · {result.score}/100
          </h3>
          <ul>
            {result.findings.map((f, i) => (
              <li key={i}>
                {f.reason}: +{f.weight}
              </li>
            ))}
          </ul>
          <small>{result.method}</small>
          <p>
            Баллы показывают сумму найденных признаков. Это не процент
            вероятности обмана.
          </p>
          <p>
            {result.findings.length
              ? "Что делать: не сообщайте пароль и не открывайте неизвестное вложение. Проверьте запрос другим способом, например уточните у отправителя по известному номеру."
              : "Что делать: проверьте отправителя и смысл письма самостоятельно. Отсутствие этих признаков не подтверждает безопасность сообщения."}
          </p>
        </article>
      )}
      <h3>Мои проверки</h3>
      {history.data?.map((r) => (
        <button
          className="module-history"
          key={r.id}
          onClick={() => setResult(r.payload)}
        >
          {r.payload.subject} · {r.payload.score}/100 · {date(r.created)}
        </button>
      ))}
      {history.data?.length === 0 && <p>Проверок пока нет.</p>}
    </Surface>
  );
}

function sampleEvents(): EventInput[] {
  return [
    {
      external_id: "training-" + crypto.randomUUID(),
      time: new Date().toISOString(),
      device: "TRAINING-PC",
      account: "training-user",
      source: "Synthetic import",
      type: "usb_connected",
      detail: "Учебное подключение неизвестного USB",
      features: { approved: false },
    },
  ];
}

function Imports({ user }: { user: User }) {
  const action = useAction();
  const [format, setFormat] = useState("json"),
    [content, setContent] = useState(""),
    [preview, setPreview] = useState<{
      count: number;
      types: Record<string, number>;
      events: EventInput[];
    } | null>(null),
    [result, setResult] = useState<ImportResult | null>(null);
  const history = useQuery({
    queryKey: ["superapp-imports"],
    queryFn: () => api<Saved<ImportResult>[]>(base + "/history/import"),
  });
  function change(value: string) {
    setContent(value);
    setPreview(null);
    setResult(null);
  }
  return (
    <Surface error={action.error || history.error}>
      <CorporateIntegrations role={user.role} />
      <h2>Разовая загрузка: JSON / CSV</h2>
      <p>
        Подготовьте учебные записи или возьмите готовый файл. Сначала система
        проверит данные, затем вы сможете загрузить их. Одни и те же записи
        повторно не добавляются. Для постоянного потока используйте приёмник
        выше.
      </p>
      {!["observer", "demo_viewer"].includes(user.role) && (
        <>
          <div className="friendly-step">
            <b>1</b> Подготовьте данные
          </div>
          <FriendlyEventBuilder
            disabled={action.busy}
            onEdited={() => change("")}
            onPrepared={(events) => {
              setFormat("json");
              change(JSON.stringify(events, null, 2));
            }}
          />
          <div className="row wrap">
            <Button
              variant="outline"
              disabled={action.busy}
              onClick={() => {
                setFormat("json");
                change(JSON.stringify(sampleEvents(), null, 2));
              }}
            >
              Заполнить учебный пример
            </Button>
            <label>
              Открыть файл
              <input
                type="file"
                accept=".json,.csv"
                disabled={action.busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void action.run(async () => {
                      if (file.size > 200000)
                        throw new Error("Размер файла превышает 200 КБ");
                      setFormat(
                        file.name.toLowerCase().endsWith(".csv")
                          ? "csv"
                          : "json",
                      );
                      change(await file.text());
                    });
                }}
              />
            </label>
          </div>
          {content && (
            <div className="friendly-event-preview">
              <p>
                Записи подготовлены. Следующий шаг — нажмите «Проверить файл».
              </p>
            </div>
          )}
          <details className="editor-advanced">
            <summary>Для специалиста: формат файла и исходные записи</summary>
            <label>
              Формат
              <select
                value={format}
                onChange={(e) => {
                  setFormat(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="json">JSON — список записей</option>
                <option value="csv">CSV — таблица записей</option>
              </select>
            </label>
            <p>
              До 200 событий и 200 КБ. Поля: external_id, time, device, account,
              source, type, detail, features. Время с часовым поясом; features —
              JSON-объект.
            </p>
            <label>
              События
              <textarea
                className="module-code"
                rows={12}
                value={content}
                maxLength={200000}
                disabled={action.busy}
                onChange={(e) => change(e.target.value)}
              />
            </label>
          </details>
          <div className="friendly-step">
            <b>2</b> Проверьте, затем загрузите
          </div>
          <div className="row wrap">
            <Button
              disabled={action.busy || !content}
              onClick={() =>
                action.run(async () => {
                  setPreview(
                    await api(base + "/imports/preview", "POST", {
                      format,
                      content,
                    }),
                  );
                })
              }
            >
              Проверить файл
            </Button>
            <Button
              variant="outline"
              disabled={action.busy || !preview || user.role === "demo"}
              onClick={() =>
                action.run(async () => {
                  const r = await api<Saved<ImportResult>>(
                    base + "/imports",
                    "POST",
                    { format, content },
                  );
                  setResult(r.payload);
                  setPreview(null);
                })
              }
            >
              Импортировать в базу
            </Button>
          </div>
          {user.role === "demo" && (
            <p>
              Demo-пользователь может проверить формат. Для выполнения
              используйте конструктор сценариев с личным сеансом.
            </p>
          )}
        </>
      )}
      {preview && (
        <article className="module-card">
          <h3>Проверено событий: {preview.count}</h3>
          <ul>
            {Object.entries(preview.types).map(([type, count]) => (
              <li key={type}>
                {eventChoices.find((e) => e.type === type)?.label || type}:{" "}
                {count}
              </li>
            ))}
          </ul>
          <p>Записи ещё не добавлены в базу.</p>
        </article>
      )}
      {result && (
        <p role="status">
          Добавлено: {result.created}; повторов: {result.duplicates};
          инцидентов: {result.incidents.length}.
        </p>
      )}
      <h3>Журнал моих импортов</h3>
      {history.data?.map((r) => (
        <article className="module-history" key={r.id}>
          {date(r.created)} · добавлено {r.payload.created} · повторов{" "}
          {r.payload.duplicates}
          <details className="editor-advanced">
            <summary>Контрольная сумма файла для специалиста</summary>
            <small>SHA-256: {r.payload.sha256}</small>
          </details>
        </article>
      ))}
    </Surface>
  );
}

function RuleBuilder({ user }: { user: User }) {
  const action = useAction();
  const [created, setCreated] = useState<string | null>(null),
    [eventType, setEventType] = useState("login_failed");
  return (
    <Surface error={action.error}>
      <h2>Конструктор правил</h2>
      <p>
        Объясните системе, на что обратить внимание. Например: «Если за минуту
        человек пять раз ошибся при входе — показать предупреждение». Условие
        проверяется для одного устройства, пользователя и источника в пределах
        одного сеанса.
      </p>
      {user.role === "admin" ? (
        <form
          className="module-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            void action.run(async () => {
              const r = await api<{ name: string }>(base + "/rules", "POST", {
                name: f.get("name"),
                event_type:
                  eventType === "custom" ? f.get("event_type") : eventType,
                threshold: Number(f.get("threshold")),
                window: Number(f.get("window")),
                risk: Number(f.get("risk")),
                description: f.get("description"),
              });
              setCreated(r.name);
              form.reset();
              setEventType("login_failed");
            });
          }}
        >
          <label>
            Название
            <input name="name" required maxLength={150} />
          </label>
          <label>
            Какое действие отслеживать
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              {eventChoices.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.label}
                </option>
              ))}
              <option value="custom">Другой тип — для специалиста</option>
            </select>
          </label>
          {eventType === "custom" && (
            <label>
              Тип события
              <input
                name="event_type"
                required
                pattern="[a-z][a-z0-9_]*"
                maxLength={60}
                placeholder="login_failed"
              />
            </label>
          )}
          <div className="module-form-grid">
            <label>
              Порог событий
              <input
                name="threshold"
                type="number"
                min={1}
                max={1000}
                defaultValue={3}
                required
              />
            </label>
            <label>
              Окно, секунды
              <input
                name="window"
                type="number"
                min={10}
                max={3600}
                defaultValue={60}
                required
              />
            </label>
            <label>
              Риск, 1–100
              <input
                name="risk"
                type="number"
                min={1}
                max={100}
                defaultValue={60}
                required
              />
            </label>
          </div>
          <p className="friendly-event-preview">
            Порог — число повторений. Окно — за сколько секунд они должны
            произойти. Риск — важность проверки от 1 до 100, а не вероятность
            атаки.
          </p>
          <label>
            Объяснение
            <input name="description" required maxLength={2000} />
          </label>
          <Button disabled={action.busy}>Создать правило</Button>
        </form>
      ) : (
        <p>Создание правил доступно администратору.</p>
      )}
      {created && (
        <p role="status">
          Правило «{created}» создано и применяется к новым событиям.
        </p>
      )}
      <Link className="btn btn-outline" to="/app/analysis">
        Открыть правила и повторный анализ
      </Link>
    </Surface>
  );
}

function ScenarioBuilder({ user }: { user: User }) {
  const action = useAction();
  const [title, setTitle] = useState("Мой учебный сценарий"),
    [content, setContent] = useState("");
  const [result, setResult] = useState<{
    demo_id: number;
    events: number;
    incidents: number[];
  } | null>(null);
  const history = useQuery({
    queryKey: ["superapp-scenarios"],
    queryFn: () => api<Saved<Template>[]>(base + "/history/scenario"),
  });
  return (
    <Surface error={action.error || history.error}>
      <h2>Конструктор учебных сценариев</h2>
      <p>
        Придумайте название тренировки и опишите вымышленное действие.
        Сохранённую тренировку можно повторять: каждый запуск создаёт отдельный
        учебный сеанс. Реальные компьютеры не затрагиваются.
      </p>
      {!["observer", "demo_viewer"].includes(user.role) && (
        <form
          className="module-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              let events: unknown;
              try {
                events = JSON.parse(content);
              } catch {
                throw new Error("Проверьте JSON событий");
              }
              await api(base + "/scenarios", "POST", { title, events });
            });
          }}
        >
          <label>
            Название
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              required
            />
          </label>
          <FriendlyEventBuilder
            disabled={action.busy}
            onEdited={() => setContent("")}
            onPrepared={(events) => setContent(JSON.stringify(events, null, 2))}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setContent(JSON.stringify(sampleEvents(), null, 2))}
          >
            Заполнить учебный пример
          </Button>
          {content && (
            <div className="friendly-event-preview">
              <p>
                Учебные записи подготовлены. Теперь сохраните шаблон, затем
                запустите его из списка ниже.
              </p>
            </div>
          )}
          <details className="editor-advanced">
            <summary>
              Для специалиста: редактировать последовательность в JSON
            </summary>
            <p>
              Можно задать до 100 событий в пределах 24 часов. При запуске
              интервалы между ними сохраняются.
            </p>
            <label>
              Последовательность событий (JSON)
              <textarea
                className="module-code"
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={200000}
              />
            </label>
          </details>
          <Button disabled={action.busy || !content}>Сохранить шаблон</Button>
        </form>
      )}
      <h3>Мои шаблоны</h3>
      {history.data?.map((t) => (
        <article className="module-card" key={t.id}>
          <h3>{t.payload.title}</h3>
          <p>{t.payload.events.length} событий</p>
          {!["observer", "demo_viewer"].includes(user.role) && (
            <Button
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  setResult(
                    await api(`${base}/scenarios/${t.id}/run`, "POST", {}),
                  );
                })
              }
            >
              Запустить в личном сеансе
            </Button>
          )}
        </article>
      ))}
      {result && (
        <p role="status">
          Сеанс #{result.demo_id}: сохранено {result.events} событий; инцидентов{" "}
          {result.incidents.length}.{" "}
          <Link to="/app/incidents">Перейти к расследованию</Link>
        </p>
      )}
    </Surface>
  );
}
