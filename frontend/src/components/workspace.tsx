/* Назначение файла: Собирает рабочее пространство расследования: документы, записи, совместную работу и редактирование.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import {
  ArrowLeft,
  Bold,
  CheckCircle2,
  FileText,
  Heading2,
  History,
  Italic,
  List,
  Plus,
  Save,
  Search,
  Table2,
} from "lucide-react";
import { api, type Row } from "../api";
import { date } from "../lib/utils";
import { BlockGuide } from "./block-guide";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

const base = "/workspace/documents";
const extensions = [
  StarterKit.configure({ link: false, heading: { levels: [1, 2, 3] } }),
  TableKit.configure({ table: { resizable: false } }),
];
export function Workspace({
  user,
  initialIncident,
  initialDocument,
}: {
  user: Row;
  initialIncident?: number;
  initialDocument?: number;
}) {
  const client = useQueryClient(),
    [selected, setSelected] = useState<number | null>(initialDocument || null),
    [search, setSearch] = useState(""),
    [creation, setCreation] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [state, setState] = useState("active");
  const [pending, setPending] = useState<{ doc: Row; action: string } | null>(
    null,
  );
  const docs = useQuery({
    queryKey: ["documents", search, initialIncident, state],
    queryFn: () =>
      api(
        `${base}?state=${state}&q=${encodeURIComponent(search)}${initialIncident ? `&incident_id=${initialIncident}` : ""}`,
      ),
  });
  const templates = useQuery({
    queryKey: ["document-templates"],
    queryFn: () => api("/workspace/templates"),
  });
  const document = useQuery({
    queryKey: ["document", selected],
    queryFn: () => api(`${base}/${selected}`),
    enabled: selected !== null,
  });
  const incidents = useQuery({
    queryKey: ["workspace-incidents"],
    queryFn: () => api("/incidents"),
  });
  const operators = useQuery({
    queryKey: ["operators"],
    queryFn: () => api("/operators"),
  });
  return (
    <section className="workspace-module">
      {selected === null ? (
        <>
          <div className="row between wrap">
            {initialIncident && <p>Материалы инцидента #{initialIncident}</p>}
            <div className="workspace-search">
              <Search size={17} />
              <input
                aria-label="Поиск документов"
                placeholder="Поиск по названию и тексту…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={200}
              />
            </div>
            {!["observer", "demo_viewer"].includes(user.role) && (
              <Button onClick={() => setCreation(true)}>
                <Plus size={16} /> Создать документ
              </Button>
            )}
          </div>
          <BlockGuide
            title="Документы Workspace"
            text="Материалы расследования сохраняются в базе. Учебные документы доступны только владельцу, общие — согласно роли."
            steps="Создайте документ из шаблона. Откройте карточку, заполните текст, свяжите с инцидентом и отправьте на проверку. Автосохранение создаёт версии; зелёная отметка подтверждает сохранение."
          />
          <div className="row wrap">
            {[
              ["active", "В работе"],
              ["archived", "Архив"],
              ["deleted", "Корзина"],
            ].map(([key, label]) => (
              <Button
                key={key}
                variant="outline"
                aria-pressed={state === key}
                onClick={() => setState(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          {docs.isPending ? (
            <p role="status">Загрузка документов…</p>
          ) : docs.error ? (
            <p role="alert">{docs.error.message}</p>
          ) : (
            <div className="document-grid">
              {docs.data?.map((doc: Row) => (
                <article key={doc.id} className="supper-document-item">
                  <button
                    className="document-card"
                    key={doc.id}
                    onClick={() => setSelected(doc.id)}
                  >
                    <div className="row between">
                      <FileText size={24} />
                      <span className="badge">{doc.status}</span>
                    </div>
                    <h2>{doc.title}</h2>
                    <p>
                      {doc.incident_id
                        ? `Инцидент #${doc.incident_id}`
                        : "Без связи с инцидентом"}
                    </p>
                    <small>
                      Версия {doc.revision} · {date(doc.updated)}
                    </small>
                    <span className="document-access">
                      {doc.demo_only
                        ? "Личный учебный документ"
                        : "Рабочий материал"}
                    </span>
                  </button>
                  <div className="row wrap">
                    <a
                      className="btn btn-outline"
                      href={`${"/api/v1" + base}/${doc.id}/export`}
                    >
                      Скачать текст
                    </a>
                    {doc.can_manage && (
                      <>
                        {state === "active" ? (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setPending({ doc, action: "archive" })
                            }
                          >
                            В архив
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setPending({ doc, action: "restore" })
                            }
                          >
                            Восстановить
                          </Button>
                        )}
                        {state !== "deleted" &&
                          !doc.incident_id &&
                          doc.status !== "Утверждён" && (
                            <Button
                              variant="outline"
                              onClick={() =>
                                setPending({ doc, action: "delete" })
                              }
                            >
                              В корзину
                            </Button>
                          )}
                      </>
                    )}
                  </div>
                </article>
              ))}
              {docs.data?.length === 0 && (
                <div className="empty">
                  <FileText size={32} />
                  <p>
                    {search
                      ? "Документы не найдены."
                      : "Создайте первый материал расследования."}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      ) : document.isPending ? (
        <p role="status">Открытие документа…</p>
      ) : document.error ? (
        <>
          <p role="alert">{document.error.message}</p>
          <Button onClick={() => setSelected(null)}>Вернуться к списку</Button>
        </>
      ) : (
        <DocumentEditor
          key={selected}
          doc={document.data}
          user={user}
          incidents={incidents.data || []}
          operators={operators.data || []}
          onBack={() => {
            setSelected(null);
            client.invalidateQueries({ queryKey: ["documents"] });
          }}
        />
      )}
      <Dialog
        title="Создать документ из шаблона"
        open={creation}
        onClose={() => !busy && setCreation(false)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            setError("");
            try {
              const doc = await api(base, "POST", {
                ...data,
                incident_id: data.incident_id ? Number(data.incident_id) : null,
              });
              client.setQueryData(["document", doc.id], doc);
              client.invalidateQueries({ queryKey: ["documents"] });
              setSelected(doc.id);
              setCreation(false);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Название документа
            <input
              name="title"
              required
              maxLength={200}
              defaultValue="Материалы учебного расследования"
            />
          </label>
          <label>
            Шаблон
            <select name="template">
              {templates.data?.map((t: Row) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Связанный инцидент
            <select name="incident_id" defaultValue={initialIncident || ""}>
              <option value="">Без связи</option>
              {incidents.data?.map((inc: Row) => (
                <option key={inc.id} value={inc.id}>
                  #{inc.id} · {inc.title}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={busy || !templates.data}>
            {busy ? "Создание…" : "Создать и открыть"}
          </Button>
          {error && <p role="alert">{error}</p>}
        </form>
      </Dialog>
      <Dialog
        title="Управление документом"
        open={pending !== null}
        onClose={() => !busy && setPending(null)}
      >
        {pending && (
          <>
            <h3>{pending.doc.title}</h3>
            <p>
              {pending.action === "delete"
                ? "Документ переместится в корзину. Его можно восстановить; версии сохранятся."
                : pending.action === "archive"
                  ? "Документ останется доступен в архиве. Для редактирования его нужно восстановить."
                  : "Документ вернётся в рабочий список."}
            </p>
            {error && <p role="alert">{error}</p>}
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api(`${base}/${pending.doc.id}/lifecycle`, "POST", {
                    action: pending.action,
                    revision: pending.doc.revision,
                  });
                  await client.invalidateQueries({ queryKey: ["documents"] });
                  await client.invalidateQueries({
                    queryKey: ["document", pending.doc.id],
                  });
                  setPending(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Подтвердить
            </Button>
          </>
        )}
      </Dialog>
    </section>
  );
}

function DocumentEditor({
  doc,
  user,
  incidents,
  operators,
  onBack,
}: {
  doc: Row;
  user: Row;
  incidents: Row[];
  operators: Row[];
  onBack: () => void;
}) {
  const client = useQueryClient(),
    [title, setTitle] = useState(doc.title),
    [content, setContent] = useState<JSONContent>(doc.content),
    [incident, setIncident] = useState(doc.incident_id),
    [assignee, setAssignee] = useState(doc.assignee_id),
    [status, setStatus] = useState(doc.status),
    [revision, setRevision] = useState(doc.revision),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0),
    [history, setHistory] = useState(false),
    [preview, setPreview] = useState<Row | null>(null),
    [comments, setComments] = useState<Row[]>(doc.comments),
    [note, setNote] = useState(""),
    [noteBusy, setNoteBusy] = useState(false);
  const version = useRef(doc.revision),
    lock = useRef(false),
    dirtyRef = useRef(false),
    current = useRef<Row>({}),
    mounted = useRef(true);
  current.current = {
    title,
    content,
    incident_id: incident,
    assignee_id: assignee,
    status,
  };
  dirtyRef.current = dirty;
  const editable = doc.can_edit && status !== "Утверждён";
  function touch() {
    setDirty(true);
    setError("");
    setTick((t) => t + 1);
  }
  const editor = useEditor({
    extensions,
    content: doc.content,
    editable,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        "aria-label": "Текст документа",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      setContent(editor.getJSON());
      touch();
    },
  });
  const versions = useQuery({
    queryKey: ["document-versions", doc.id, revision],
    queryFn: () => api(`${base}/${doc.id}/versions`),
    enabled: history,
  });
  useEffect(() => {
    editor?.setEditable(editable && !saving, false);
  }, [editor, editable, saving]);
  useEffect(() => {
    mounted.current = true;
    const unload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || lock.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const followLink = (e: MouseEvent) => {
      if (
        (dirtyRef.current || lock.current) &&
        (e.target as Element).closest("a[href]")
      ) {
        e.preventDefault();
        e.stopPropagation();
        setError(
          "Дождитесь сохранения документа перед переходом в другой раздел.",
        );
      }
    };
    window.addEventListener("beforeunload", unload);
    const beforeNavigation = (event: Event) => {
      if (dirtyRef.current || lock.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("aegis-before-navigation", beforeNavigation);
    document.addEventListener("click", followLink, true);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("aegis-before-navigation", beforeNavigation);
      document.removeEventListener("click", followLink, true);
    };
  }, []);
  const saveRef = useRef<(nextStatus?: string) => Promise<boolean>>(
    async () => false,
  );
  saveRef.current = async (nextStatus?: string) => {
    if (lock.current || !doc.can_edit) return false;
    if (!dirtyRef.current && !nextStatus) return true;
    lock.current = true;
    setSaving(true);
    setError("");
    const sent = {
      ...current.current,
      status: nextStatus || current.current.status,
    };
    const before = JSON.stringify(current.current);
    try {
      const value = await api(`${base}/${doc.id}`, "PUT", {
        ...sent,
        revision: version.current,
      });
      version.current = value.revision;
      if (mounted.current) {
        setRevision(value.revision);
        if (nextStatus) {
          setStatus(value.status);
          current.current.status = value.status;
        }
        if (JSON.stringify(current.current) === before || nextStatus) {
          setDirty(false);
          dirtyRef.current = false;
        } else setTick((t) => t + 1);
        client.invalidateQueries({ queryKey: ["documents"] });
      }
      return true;
    } catch (err) {
      if (mounted.current) setError((err as Error).message);
      return false;
    } finally {
      lock.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  useEffect(() => {
    if (!dirty || error) return;
    const timer = setTimeout(() => {
      void saveRef.current();
    }, 1000);
    return () => clearTimeout(timer);
  }, [tick, dirty, error]);
  async function refresh() {
    if (
      dirty &&
      !window.confirm(
        "Загрузить последнюю версию? Несохранённый текст можно предварительно скачать кнопкой «Сохранить копию»; он будет заменён.",
      )
    )
      return;
    try {
      const value = await api(`${base}/${doc.id}`);
      editor?.commands.setContent(value.content, { emitUpdate: false });
      setContent(value.content);
      setTitle(value.title);
      setIncident(value.incident_id);
      setAssignee(value.assignee_id);
      setStatus(value.status);
      setRevision(value.revision);
      version.current = value.revision;
      setComments(value.comments);
      setDirty(false);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  function downloadCopy() {
    const blob = new Blob([JSON.stringify(current.current, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aegis-document-${doc.id}-local-copy.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="document-editor">
      <div className="row between wrap">
        <Button
          variant="ghost"
          disabled={saving}
          onClick={async () => {
            if (
              (!dirtyRef.current && !lock.current) ||
              (await saveRef.current())
            )
              onBack();
          }}
        >
          <ArrowLeft size={16} /> К документам
        </Button>
        <span className="document-save-state" role="status">
          {saving ? (
            "Сохранение…"
          ) : error ? (
            "Есть несохранённые изменения или ошибка"
          ) : dirty ? (
            "Изменения ожидают сохранения…"
          ) : (
            <>
              <CheckCircle2 size={15} /> Сохранено · версия {revision}
            </>
          )}
        </span>
        <Button variant="outline" onClick={() => setHistory(true)}>
          <History size={16} /> История версий
        </Button>
      </div>
      {error && (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <div className="row wrap">
            <Button variant="outline" onClick={downloadCopy}>
              Сохранить копию
            </Button>
            <Button variant="outline" onClick={refresh}>
              Загрузить актуальную версию
            </Button>
          </div>
        </div>
      )}
      <label>
        Название документа
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            touch();
          }}
          maxLength={200}
          required
          disabled={!editable || saving}
        />
      </label>
      <div className="document-meta">
        <label>
          Связанный инцидент
          <select
            value={incident || ""}
            disabled={!editable || saving}
            onChange={(e) => {
              setIncident(e.target.value ? Number(e.target.value) : null);
              touch();
            }}
          >
            <option value="">Без связи</option>
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                #{inc.id} · {inc.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ответственный
          <select
            value={assignee || ""}
            disabled={!editable || saving}
            onChange={(e) => {
              setAssignee(e.target.value ? Number(e.target.value) : null);
              touch();
            }}
          >
            <option value="">Не назначен</option>
            {operators
              .filter((op) =>
                doc.demo_only ? op.id === doc.owner_id : op.role !== "demo",
              )
              .map((op) => (
                <option key={op.id} value={op.id}>
                  {op.username}
                </option>
              ))}
          </select>
        </label>
        <div className="document-status">
          <small>СТАТУС ДОКУМЕНТА</small>
          <span className="badge">{status}</span>
        </div>
      </div>
      <div className="editor-toolbar" aria-label="Форматирование документа">
        {[
          [
            "Полужирный",
            Bold,
            () => editor?.chain().focus().toggleBold().run(),
            editor?.isActive("bold"),
          ],
          [
            "Курсив",
            Italic,
            () => editor?.chain().focus().toggleItalic().run(),
            editor?.isActive("italic"),
          ],
          [
            "Заголовок",
            Heading2,
            () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
            editor?.isActive("heading"),
          ],
          [
            "Маркированный список",
            List,
            () => editor?.chain().focus().toggleBulletList().run(),
            editor?.isActive("bulletList"),
          ],
          [
            "Вставить таблицу",
            Table2,
            () =>
              editor
                ?.chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run(),
            false,
          ],
        ].map(([name, Icon, action, active]) => {
          const I = Icon as typeof Bold;
          return (
            <button
              key={String(name)}
              aria-label={String(name)}
              title={String(name)}
              aria-pressed={!!active}
              disabled={!editable || saving}
              onClick={action as () => void}
            >
              <I size={17} />
            </button>
          );
        })}
        <Button
          variant="ghost"
          disabled={!editable || saving || !editor?.isActive("table")}
          onClick={() => editor?.chain().focus().addRowAfter().run()}
        >
          Добавить строку
        </Button>
        <Button
          variant="ghost"
          disabled={!editable || saving || !editor?.isActive("table")}
          onClick={() => editor?.chain().focus().deleteTable().run()}
        >
          Удалить таблицу
        </Button>
      </div>
      <EditorContent editor={editor} className="document-paper" />
      <div className="row wrap document-actions">
        <Button
          disabled={!doc.can_edit || saving || !dirty}
          onClick={() => saveRef.current()}
        >
          <Save size={16} /> Сохранить сейчас
        </Button>
        {doc.can_edit && status === "Черновик" && (
          <Button
            variant="outline"
            disabled={saving || !!error}
            onClick={async () => {
              if (await saveRef.current()) await saveRef.current("На проверке");
            }}
          >
            Отправить на проверку
          </Button>
        )}
        {doc.can_approve && status === "На проверке" && (
          <Button
            variant="outline"
            disabled={saving || !!error}
            onClick={async () => {
              if (await saveRef.current()) await saveRef.current("Утверждён");
            }}
          >
            Утвердить документ
          </Button>
        )}
        {doc.can_edit && status !== "Черновик" && (
          <Button
            variant="outline"
            disabled={saving || !!error}
            onClick={async () => {
              if (await saveRef.current()) await saveRef.current("Черновик");
            }}
          >
            Вернуть в черновик
          </Button>
        )}
      </div>
      <BlockGuide
        title="Редактор материалов"
        text="Автосохранение выполняется через секунду после изменения. Заголовки, списки и таблицы хранятся как проверенное дерево документа."
        steps="Сначала заполните материал и дождитесь «Сохранено». Передайте документ на проверку; утверждение доступно аналитику и администратору. Утверждённый текст защищён от редактирования. Если другое окно сохранило новую версию, скачайте свою копию и загрузите актуальную."
      />
      <div className="document-comments">
        <h2>Комментарии и заметки</h2>
        {comments.map((c) => (
          <article key={c.id}>
            <small>
              Пользователь #{c.author_id} · {date(c.created)}
            </small>
            <p>{c.text}</p>
          </article>
        ))}
        {!comments.length && <p>Комментариев пока нет.</p>}
        {!["observer", "demo_viewer"].includes(user.role) && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setNoteBusy(true);
              try {
                const item = await api(`${base}/${doc.id}/comments`, "POST", {
                  text: note,
                });
                setComments((prev) => [...prev, item]);
                setNote("");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setNoteBusy(false);
              }
            }}
          >
            <label>
              Комментарий к документу
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                maxLength={5000}
              />
            </label>
            <Button disabled={noteBusy}>Добавить заметку</Button>
          </form>
        )}
      </div>
      <Dialog
        title="История версий документа"
        open={history}
        onClose={() => setHistory(false)}
      >
        <p>
          Каждое сохранённое изменение создаёт отдельную подписанную версию.
          Просмотр версии не заменяет текущий текст.
        </p>
        {versions.error ? (
          <p role="alert">{versions.error.message}</p>
        ) : versions.isPending ? (
          <p role="status">Загрузка…</p>
        ) : (
          <div className="global-search-results">
            {versions.data?.map((v: Row) => (
              <button key={v.id} onClick={() => setPreview(v)}>
                <b>
                  Версия {v.revision} · {v.snapshot.status}
                </b>
                <small>
                  {date(v.created)} · автор #{v.author_id}
                </small>
              </button>
            ))}
          </div>
        )}
      </Dialog>
      <Dialog
        title={"Просмотр версии " + (preview?.revision || "")}
        open={preview !== null}
        onClose={() => setPreview(null)}
      >
        {preview && <VersionPreview value={preview.snapshot} />}
      </Dialog>
    </div>
  );
}
function VersionPreview({ value }: { value: Row }) {
  const editor = useEditor(
    { extensions, content: value.content, editable: false },
    [value],
  );
  return (
    <>
      <h2>{value.title}</h2>
      <EditorContent editor={editor} className="document-paper" />
    </>
  );
}
