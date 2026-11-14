/* Назначение файла: Показывает административные формы управления ролями, правами и настройками.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Crown,
  ShieldCheck,
  Users,
  Layers,
  Trash2,
  Activity,
} from "lucide-react";
import { api, type Row } from "../api";
import { date } from "../lib/utils";
import { UsersWorkspace } from "./user-profiles";
import { Dialog } from "./ui/dialog";
import "../governance.css";

import { useRoleCatalog, type RoleInfo } from "../lib/access";

export function AccessConsole({
  currentUser,
  onChanged,
}: {
  currentUser: Row;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState("users");
  return (
    <section className="access-console">
      <header className="access-hero">
        <div>
          <span className="eyebrow">ЛЮДИ · ПРАВА · УПРАВЛЕНИЕ</span>
          <h2>
            <Crown /> Командный центр CTO
          </h2>
          <p>
            Назначения, история доступа и состав команды. Высшие роли защищены
            серверной проверкой иерархии.
          </p>
        </div>
        <span className="badge">
          {currentUser.role_label || currentUser.role}
        </span>
      </header>
      <nav className="access-tabs" aria-label="Управление командой">
        {[
          ["users", "Пользователи", Users],
          ["roles", "Роли и полномочия", Layers],
          ["cto", "Кабинет CTO", Activity],
        ].map(([key, label, Icon]) => (
          <button
            key={String(key)}
            aria-pressed={tab === key}
            onClick={() => setTab(String(key))}
          >
            {typeof Icon !== "string" && <Icon size={17} />} {String(label)}
          </button>
        ))}
      </nav>
      {tab === "users" && (
        <UsersWorkspace currentUser={currentUser} onChanged={onChanged} />
      )}{" "}
      {tab === "roles" && (
        <RoleManager
          canManage={!!currentUser.permissions?.manage_roles}
          creator={currentUser.role === "creator"}
        />
      )}{" "}
      {tab === "cto" && <CTODashboard />}
    </section>
  );
}

function RoleManager({
  canManage,
  creator,
}: {
  canManage: boolean;
  creator: boolean;
}) {
  const roles = useRoleCatalog(),
    client = useQueryClient();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<RoleInfo | null>(null);
  return (
    <section className="panel">
      <h2>Кому какие полномочия доступны</h2>
      <p>
        Новые роли наследуют проверенный профиль доступа. Системные роли
        защищены; пользовательскую роль можно удалить после переназначения всех
        её пользователей.
      </p>
      {canManage && (
        <form
          className="module-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            setError("");
            try {
              await api(
                "/roles",
                "POST",
                Object.fromEntries(new FormData(form)),
              );
              form.reset();
              await client.invalidateQueries({ queryKey: ["role-catalog"] });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="module-form-grid">
            <label>
              Код роли
              <input
                name="name"
                required
                minLength={3}
                maxLength={30}
                pattern="[a-z][a-z0-9_]*"
                placeholder="security_engineer"
              />
            </label>
            <label>
              Название
              <input
                name="label"
                required
                minLength={3}
                maxLength={150}
                placeholder="Инженер безопасности"
              />
            </label>
            <label>
              Профиль полномочий
              <select name="base">
                <option value="observer">Просмотр и личный профиль</option>
                <option value="analyst">
                  Аналитика, расследования и согласование
                </option>
                {creator && (
                  <option value="admin">Администрирование платформы</option>
                )}
              </select>
            </label>
          </div>
          <button className="btn" disabled={busy}>
            Создать роль
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {roles.error && <p role="alert">{roles.error.message}</p>}
      <div className="role-grid">
        {roles.data?.map((role) => (
          <article key={role.name}>
            <div className="row between">
              <ShieldCheck size={23} />
              <span className="badge">
                {role.builtin ? "Системная" : "Пользовательская"}
              </span>
            </div>
            <h3>{role.label}</h3>
            <code>{role.name}</code>
            <p>
              {role.base === "admin"
                ? "Параметры, интеграции и управление. Назначения ограничены иерархией."
                : role.base === "analyst"
                  ? "Работа с инцидентами, задачами и документами; без общих настроек безопасности."
                  : role.base.startsWith("demo")
                    ? "Личная учебная среда с ограничениями роли."
                    : "Просмотр данных и собственный профиль. Изменения рабочих данных запрещены."}
            </p>
            {role.name === "deputy_cto" && (
              <p>Дополнительно: управление нижестоящими сотрудниками.</p>
            )}
            {role.name === "creator" && (
              <p>Полный доступ и назначение CTO и других создателей.</p>
            )}
            <small>Назначено пользователей: {role.assigned}</small>
            {canManage && !role.builtin && (
              <button
                className="btn btn-outline"
                disabled={
                  busy ||
                  role.assigned > 0 ||
                  (!creator && role.base === "admin")
                }
                onClick={() => setPending(role)}
              >
                <Trash2 size={15} />
                Удалить роль
              </button>
            )}
          </article>
        ))}
      </div>
      <Dialog
        open={pending !== null}
        title="Удалить неиспользуемую роль"
        onClose={() => !busy && setPending(null)}
      >
        {pending && (
          <>
            <p>
              {pending.label} ({pending.name}). История назначений останется в
              аудите.
            </p>
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api(`/roles/${pending.name}`, "DELETE");
                  await client.invalidateQueries({
                    queryKey: ["role-catalog"],
                  });
                  setPending(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Подтвердить удаление
            </button>
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </Dialog>
    </section>
  );
}

function CTODashboard() {
  const query = useQuery({
    queryKey: ["governance-overview"],
    queryFn: () =>
      api<{
        active_staff: number;
        blocked_staff: number;
        deleted_users: number;
        active_sessions: number;
        roles: number;
        history: {
          id: number;
          time: string;
          action: string;
          actor_id: number;
        }[];
      }>("/governance/overview"),
    refetchInterval: 30000,
  });
  const d = query.data;
  return (
    <section className="panel">
      <span className="eyebrow">ОБЗОР ТЕХНИЧЕСКОГО РУКОВОДИТЕЛЯ</span>
      <h2>Команда и контроль доступа</h2>
      <p>
        Фактические показатели базы. Сеанс означает действующий вход;
        онлайн-присутствие смотрите в «Сотрудниках».
      </p>
      {query.error && <p role="alert">{query.error.message}</p>}
      {d && (
        <div className="supper-kpis">
          {[
            [d.active_staff, "Активных сотрудников"],
            [d.blocked_staff, "Доступ отключён"],
            [d.active_sessions, "Действующих сеансов"],
            [d.deleted_users, "В корзине"],
          ].map(([n, title]) => (
            <article key={title}>
              <strong>{n}</strong>
              <h3>{title}</h3>
            </article>
          ))}
        </div>
      )}
      <div className="access-shortcuts">
        {[
          [
            "participants",
            "Состав команды",
            "Кто сейчас онлайн и кто отвечает за работу",
          ],
          [
            "tasks",
            "Поручения и согласования",
            "Назначить исполнителя и проверить результат",
          ],
          [
            "integrations",
            "Интеграции и агенты",
            "Приёмники событий, ключи и состояние обмена",
          ],
          [
            "audit",
            "Контроль изменений",
            "История и проверка целостности журнала",
          ],
        ].map(([path, title, text]) => (
          <Link key={path} to={`/app/${path}`}>
            <h3>{title}</h3>
            <p>{text}</p>
          </Link>
        ))}
      </div>
      <section className="agent-plan">
        <span className="badge">WINDOWS 10/11 · СЛУЖБА И ТРЕЙ · БЕЗ PYTHON</span>
        <h3>Aegis DLP — защита и связь без постоянного Интернета</h3>
        <p>
          Aegis DLP для Windows 10/11: автономный режим без сервера, локальная
          консоль по паролю, очередь событий и обратимый запрет доступа к
          съёмным дискам. EXE устанавливает службу Windows и значок в трее;
          политики и проверки назначаются из панели Aegis DLP.
        </p>
        <div className="row wrap">
          <Link className="btn btn-primary" to="/app/dlp">
            Подключить Aegis DLP к компьютеру
          </Link>
          <Link className="btn btn-outline" to="/app/integrations">
            Настроить индивидуальный приёмник
          </Link>
        </div>
        <p>
          Отправляются метаданные обнаружений, без документов, паролей и
          клавиатурного ввода. Сотрудник подтверждает установку администратором Windows.
          DLP требуется только после назначения создателем или руководителем. Без назначения рабочие функции доступны без агента.
        </p>
      </section>
      <h3>Последние изменения доступа</h3>
      <div className="access-history">
        {d?.history.map((r) => (
          <article key={r.id}>
            <small>
              {date(r.time)} · сотрудник #{r.actor_id}
            </small>
            <p>{r.action}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
