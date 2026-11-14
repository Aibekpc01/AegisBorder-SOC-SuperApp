/* Назначение файла: Показывает профиль пользователя и формы изменения разрешённых персональных данных.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Plus,
  Search,
  MapPin,
  Globe,
  Clock,
  Shield,
  UserRound,
  Save,
  LocateFixed,
  CheckCircle2,
  MoreHorizontal,
} from "lucide-react";
import { api, type Row } from "../api";
import { date, roles } from "../lib/utils";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { BlockGuide } from "./block-guide";
import { useRoleCatalog } from "../lib/access";

export function UserAvatar({
  user,
  large = false,
}: {
  user: Row;
  large?: boolean;
}) {
  const profile = user.profile || {};
  return (
    <div className={"person-avatar " + (large ? "large" : "")}>
      {profile.has_avatar ? (
        <img
          src={`/api/v1/users/${user.id}/avatar?v=${encodeURIComponent(profile.avatar_version || "")}`}
          alt={`Фото ${profile.full_name || user.username}`}
        />
      ) : (
        <img
          src={`/api/v1/users/${user.id}/avatar/presets/0`}
          alt={`Аватар ${profile.full_name || user.username}`}
        />
      )}
    </div>
  );
}
async function imageData(file: File) {
  if (file.size > 2 * 1024 * 1024)
    throw new Error("Фото должно быть не больше 2 МБ");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Выберите PNG, JPEG или WebP");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать фото"));
    reader.readAsDataURL(file);
  });
}
export function ProfileEditor({
  userId,
  admin,
  onChanged,
}: {
  userId: number;
  admin: boolean;
  onChanged: () => void;
}) {
  const catalog = useRoleCatalog();
  const [avatarPage, setAvatarPage] = useState(0);
  const client = useQueryClient(),
    [tab, setTab] = useState("profile"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const profile = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => api(`/users/${userId}/profile`),
  });
  const history = useQuery({
    queryKey: ["user-logins", userId],
    queryFn: () => api(`/users/${userId}/logins`),
    enabled: tab === "logins",
  });
  async function save(
    work: () => Promise<unknown>,
    notice = "Изменения сохранены",
  ) {
    if (profile.data?.can_edit_profile === false) {
      setMessage("Вышестоящая учётная запись доступна только для просмотра");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await work();
      await client.invalidateQueries();
      onChanged();
      setMessage(notice);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка операции");
    } finally {
      setBusy(false);
    }
  }
  if (profile.isLoading) return <p>Загрузка профиля…</p>;
  if (profile.error) return <p className="error">{profile.error.message}</p>;
  const person = profile.data as Row,
    p = person.profile || {};
  return (
    <div className="profile-editor">
      <div className="profile-cover">
        <UserAvatar user={person} large />
        <div>
          <span className="eyebrow">ЛИЧНАЯ КАРТОЧКА</span>
          <h2>{p.full_name || person.username}</h2>
          <p>
            {p.position ||
              person.role_label ||
              roles[person.role] ||
              person.role}{" "}
            · {p.department || "Подразделение не указано"}
          </p>
          <span className="badge">
            {person.active ? "Учётная запись активна" : "Доступ отключён"}
          </span>
        </div>
      </div>
      <div className="profile-tabs" role="tablist" aria-label="Разделы профиля">
        {[
          ["profile", "Личные данные"],
          ["security", "Доступ и роль"],
          ["logins", "История входов"],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {message && (
        <div className="profile-message" role="status">
          <CheckCircle2 size={17} />
          {message}
        </div>
      )}
      {tab === "profile" && (
        <>
          <div className="photo-controls">
            <label className="photo-upload">
              <Camera size={17} /> Загрузить фото
              <input
                aria-label="Фото пользователя"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    save(
                      async () =>
                        api(`/users/${userId}/avatar`, "PUT", {
                          image_data_url: await imageData(file),
                        }),
                      "Фото сохранено",
                    );
                  e.target.value = "";
                }}
              />
            </label>
            <small>PNG, JPEG, WebP · до 2 МБ · метаданные удаляются</small>
            {p.has_avatar && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  save(
                    () => api(`/users/${userId}/avatar`, "DELETE"),
                    "Фото удалено",
                  )
                }
              >
                Убрать фото
              </Button>
            )}
          </div>
          <details className="avatar-picker">
            <summary>Выбрать автоматически созданный аватар</summary>
            <p>
              Аватары создаются внутри приложения. Фотографии и личные данные не
              отправляются внешним сервисам.
            </p>
            <div className="avatar-options">
              {Array.from({ length: 8 }, (_, i) => avatarPage * 8 + i).map(
                (variant) => (
                  <button
                    key={variant}
                    aria-label={`Выбрать аватар ${variant + 1}`}
                    disabled={busy}
                    onClick={() =>
                      save(
                        () =>
                          api(`/users/${userId}/avatar/generate`, "POST", {
                            variant,
                          }),
                        "Аватар сохранён",
                      )
                    }
                  >
                    <img
                      src={`/api/v1/users/${userId}/avatar/presets/${variant}`}
                      alt=""
                    />
                  </button>
                ),
              )}
            </div>
            <button
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setAvatarPage((avatarPage + 1) % 100)}
            >
              Другие варианты
            </button>
          </details>
          <form
            className="personal-form"
            onSubmit={(e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              save(() => api(`/users/${userId}/profile`, "PUT", values));
            }}
          >
            {[
              ["full_name", "ФИО", "text", 160],
              ["department", "Подразделение", "text", 120],
              ["position", "Должность", "text", 120],
              ["email", "Электронная почта", "email", 160],
              ["phone", "Телефон", "tel", 40],
            ].map(([name, label, type, max]) => (
              <label key={name}>
                {" "}
                {label}
                <input
                  name={name as string}
                  type={type as string}
                  defaultValue={p[name] || ""}
                  maxLength={Number(max)}
                />
              </label>
            ))}
            <label className="wide">
              О пользователе
              <textarea
                name="bio"
                rows={3}
                maxLength={2000}
                defaultValue={p.bio || ""}
              />
            </label>
            <Button disabled={busy}>
              <Save size={16} /> Сохранить личные данные
            </Button>
          </form>
          <BlockGuide
            title="Личные данные"
            text="Фото и сведения хранятся в базе. Полную карточку видят сам пользователь и администратор."
            steps="Выберите фото, заполните поля и сохраните данные. Для демонстрации используйте вымышленные сведения; фото проверяется сервером и приводится к безопасному PNG."
          />
        </>
      )}
      {tab === "security" && (
        <>
          <div className="identity-summary">
            <div>
              <small>Логин</small>
              <strong>{person.username}</strong>
            </div>
            <div>
              <small>Текущая роль</small>
              <strong>
                {person.role_label || roles[person.role] || person.role}
              </strong>
            </div>
          </div>
          {admin && person.can_edit_profile !== false ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save(
                  () =>
                    api(`/users/${userId}`, "PATCH", {
                      role: f.get("role"),
                      password: f.get("password") || undefined,
                    }),
                  "Права обновлены. При смене пароля прежние сеансы отзываются.",
                );
              }}
            >
              <label>
                Роль
                <select name="role" defaultValue={person.role}>
                  <option value={person.role}>{person.role_label || roles[person.role] || person.role}</option>
                  {(catalog.data || []).filter(item=>item.name!==person.role).map((item) => (
                    <option
                      value={item.name}
                      key={item.name}
                      disabled={!item.can_assign && item.name !== person.role}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Новый пароль (пустое поле — сохранить текущий)
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                />
              </label>
              <Button disabled={busy}>
                <Shield size={16} /> Сохранить права доступа
              </Button>
            </form>
          ) : (
            <p>
              Изменить роль и пароль через эту карточку может администратор.
            </p>
          )}
          <BlockGuide
            title="Доступ и роль"
            text="Роль определяет доступные действия на сервере, а не только видимость кнопок."
            steps="Администратор управляет системой, аналитик расследует, наблюдатель читает, demo работает в собственном учебном сеансе. Смена пароля отзывает прежние сеансы."
          />
        </>
      )}
      {tab === "logins" && (
        <>
          <LastConnection person={person} />
          {history.isLoading && <p>Загрузка истории…</p>}
          {history.error && <p className="error">{history.error.message}</p>}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>IP и источник</th>
                  <th>Расположение сети</th>
                  <th>Результат</th>
                </tr>
              </thead>
              <tbody>
                {history.data?.map((item: Row) => (
                  <tr key={item.id}>
                    <td>{date(item.time)}</td>
                    <td>
                      <code>{item.ip}</code>
                      <small>{item.ip_source}</small>
                    </td>
                    <td>
                      {[item.network.country, item.network.city]
                        .filter(Boolean)
                        .join(", ") || "Не определено"}
                      <small>{item.network.network_label}</small>
                    </td>
                    <td>
                      <span className={"badge " + (item.success ? "" : "red")}>
                        {item.success ? "Вход выполнен" : "Отказ"}
                      </span>
                      <small>{item.reason}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BlockGuide
            title="История входов"
            text="IP записывается при попытке входа. Это адрес, видимый серверу: за NAT или прокси он может отличаться от адреса устройства."
            steps="Смотрите время, источник адреса и причину отказа. География из справочника относится к сети; браузерные координаты обозначены отдельным источником и точностью."
          />
        </>
      )}
    </div>
  );
}
export function LastConnection({ person }: { person: Row }) {
  const last = person.last_login,
    location = person.last_location;
  return (
    <div className="connection-cards">
      <div>
        <Globe size={21} />
        <small>Последний успешный вход</small>
        <strong>{last?.ip || "Нет записей входов"}</strong>
        <p>{last ? date(last.time) : "История начнётся со следующего входа"}</p>
      </div>
      <div>
        <MapPin size={21} />
        <small>Расположение сети</small>
        <strong>
          {[last?.network?.country, last?.network?.city]
            .filter(Boolean)
            .join(", ") || "Не определено"}
        </strong>
        <p>
          {last?.network?.location_source ||
            "Для локального адреса город не устанавливается"}
        </p>
      </div>
      {location && (
        <div>
          <LocateFixed size={21} />
          <small>Последние переданные координаты</small>
          {location.city && (
            <p>
              {location.country} · {location.city} (приблизительно)
            </p>
          )}
          <strong>
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </strong>
          <p>
            ±{Math.round(location.accuracy)} м · {date(location.observed_at)}
            <br />
            Сообщено браузером; независимо не проверено
          </p>
        </div>
      )}
    </div>
  );
}
export function UsersWorkspace({
  currentUser,
  onChanged,
}: {
  currentUser: Row;
  onChanged: () => void;
}) {
  const [confirmAccess, setConfirmAccess] = useState<Row | null>(null);
  const [listState, setListState] = useState("active");
  const [pending, setPending] = useState<{ user: Row; action: string } | null>(
    null,
  );
  const catalog = useRoleCatalog();
  const client = useQueryClient(),
    [q, setQ] = useState(""),
    [role, setRole] = useState(""),
    [showInactive, setShowInactive] = useState(false),
    [editing, setEditing] = useState<number | null>(null),
    [creating, setCreating] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const users = useQuery({
    queryKey: ["users-workspace", listState],
    queryFn: () => api("/users?state=" + listState),
  });
  const items = (users.data || []).filter(
    (u: Row) =>
      (listState === "deleted" || showInactive || u.active) &&
      (!role || u.role === role) &&
      `${u.username} ${u.profile.full_name} ${u.profile.department} ${u.profile.position}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  async function toggle(u: Row) {
    setBusy(true);
    try {
      await api(`/users/${u.id}/active`, "PATCH", {});
      await client.invalidateQueries();
      setMessage("Доступ пользователя обновлён");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="users-workspace">
      <div className="people-hero">
        <div>
          <span className="eyebrow">КОМАНДА И ПРАВА ДОСТУПА</span>
          <h2>Личные карточки пользователей</h2>
          <p>Фото, сведения, роль и история входов — в одном месте.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={17} /> Добавить пользователя
        </Button>
      </div>
      <div className="row wrap">
        <Button
          variant="outline"
          aria-pressed={listState === "active"}
          onClick={() => setListState("active")}
        >
          Пользователи
        </Button>
        <Button
          variant="outline"
          aria-pressed={listState === "deleted"}
          onClick={() => setListState("deleted")}
        >
          Корзина пользователей
        </Button>
        <p>
          Удаление отзывает входы и сохраняет историю. После восстановления
          доступ включается отдельно.
        </p>
      </div>
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Поиск пользователей"
            placeholder="Имя, логин, отдел…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          aria-label="Роль пользователя"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">Все роли</option>
          {catalog.data?.map((item) => (
            <option key={item.name} value={item.name}>
              {item.label}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />{" "}
          Отключённые
        </label>
      </div>
      {message && (
        <p role="status" className="profile-message">
          {message}
        </p>
      )}
      {users.isLoading && <p>Загрузка пользователей…</p>}
      {users.error && <p className="error">{users.error.message}</p>}
      <div className="people-grid">
        {items.map((u: Row) => (
          <article className="person-card" key={u.id}>
            <button
              className="person-card-main"
              onClick={() => setEditing(u.id)}
              aria-label={`Открыть профиль ${u.username}`}
            >
              <div className="row between">
                <UserAvatar user={u} large />
                <span className={"badge " + (u.active ? "" : "red")}>
                  {u.role_label || roles[u.role] || u.role}
                </span>
              </div>
              <h3>{u.profile.full_name || u.username}</h3>
              <p>
                {u.profile.position || "Должность не указана"}
                <small>
                  {u.profile.department || "Подразделение не указано"}
                </small>
              </p>
              <div className="person-login">
                <Globe size={14} />
                <span>{u.last_login?.ip || "Нет записей входов"}</span>
                <Clock size={14} />
                <span>{u.last_login ? date(u.last_login.time) : "—"}</span>
              </div>
              <div className="person-location">
                <MapPin size={14} />
                {[u.last_login?.network?.country, u.last_login?.network?.city]
                  .filter(Boolean)
                  .join(", ") || "Расположение не определено"}
              </div>
            </button>
            <div className="person-card-actions">
              <Button variant="outline" onClick={() => setEditing(u.id)}>
                Настроить карточку
              </Button>
              {listState === "active" &&
                u.id !== currentUser.id &&
                (u.role_rank ?? 0) <= (currentUser.role_rank ?? 0) && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmAccess(u)}
                  >
                    {u.active ? "Отключить" : "Включить"}
                  </Button>
                )}
              <details className="ultra-card-menu">
                <summary aria-label={`Действия с пользователем ${u.username}`}>
                  <MoreHorizontal size={18} />
                </summary>
                <div>
                  <button onClick={() => setEditing(u.id)}>
                    Редактировать профиль и роль
                  </button>
                  {u.id !== currentUser.id &&
                    (u.role_rank ?? 0) <= (currentUser.role_rank ?? 0) && (
                      <>
                        {listState === "active" ? (
                          <>
                            <button
                              disabled={busy}
                              onClick={() =>
                                setPending({ user: u, action: "delete" })
                              }
                            >
                              Удалить пользователя
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                setPending({
                                  user: u,
                                  action: "revoke-sessions",
                                })
                              }
                            >
                              Завершить все сеансы
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() =>
                              setPending({ user: u, action: "restore" })
                            }
                          >
                            Восстановить из корзины
                          </button>
                        )}
                      </>
                    )}
                  {listState === "active" &&
                    u.id !== currentUser.id &&
                    (u.role_rank ?? 0) <= (currentUser.role_rank ?? 0) && (
                      <button
                        disabled={busy}
                        onClick={() => setConfirmAccess(u)}
                      >
                        {u.active ? "Отключить доступ" : "Восстановить доступ"}
                      </button>
                    )}
                </div>
              </details>
            </div>
          </article>
        ))}
      </div>
      {!items.length && !users.isLoading && (
        <div className="empty">
          <UserRound size={32} />
          <p>Пользователей по выбранным фильтрам нет.</p>
        </div>
      )}
      <BlockGuide title="Учётные записи" />
      <Dialog
        title={
          confirmAccess?.active
            ? "Отключить доступ пользователя?"
            : "Восстановить доступ пользователя?"
        }
        open={confirmAccess !== null}
        onClose={() => setConfirmAccess(null)}
      >
        {confirmAccess && (
          <>
            <p>
              Пользователь: {confirmAccess.username}. История действий и
              материалы расследований сохранятся. Операция будет записана в
              аудит.
            </p>
            <div className="row">
              <Button variant="outline" onClick={() => setConfirmAccess(null)}>
                Отмена
              </Button>
              <Button
                disabled={busy}
                variant={confirmAccess.active ? "destructive" : "default"}
                onClick={async () => {
                  await toggle(confirmAccess);
                  setConfirmAccess(null);
                }}
              >
                Подтвердить
              </Button>
            </div>
          </>
        )}
      </Dialog>
      <Dialog
        open={pending !== null}
        title={
          pending?.action === "delete"
            ? "Удалить пользователя"
            : pending?.action === "restore"
              ? "Восстановить пользователя"
              : "Завершить сеансы пользователя"
        }
        onClose={() => !busy && setPending(null)}
      >
        {pending && (
          <>
            <h3>{pending.user.username}</h3>
            <p>
              {pending.action === "delete"
                ? "Пользователь уйдёт в корзину и потеряет доступ. Его документы, сообщения и аудит останутся."
                : pending.action === "restore"
                  ? "Карточка вернётся из корзины с отключённым доступом. После проверки включите доступ отдельно."
                  : "Все действующие входы будут отозваны. Для продолжения работы потребуется повторный вход."}
            </p>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage("");
                try {
                  await api(
                    `/users/${pending.user.id}${pending.action === "delete" ? "" : "/" + pending.action}`,
                    pending.action === "delete" ? "DELETE" : "POST",
                  );
                  await client.invalidateQueries();
                  setPending(null);
                  setMessage("Действие выполнено и записано в аудит");
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Подтвердить
            </Button>
            {message && <p role="status">{message}</p>}
          </>
        )}
      </Dialog>
      <Dialog
        title="Личная карточка пользователя"
        open={editing !== null}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <ProfileEditor
            key={editing}
            userId={editing}
            admin
            onChanged={onChanged}
          />
        )}
      </Dialog>
      <Dialog
        title="Добавить пользователя"
        open={creating}
        onClose={() => setCreating(false)}
      >
        <form
          className="personal-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setMessage("");
            try {
              const created = await api(
                "/users",
                "POST",
                Object.fromEntries(f),
              );
              await client.invalidateQueries();
              setCreating(false);
              setEditing(created.id);
            } catch (err) {
              setMessage((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Логин
            <input
              name="username"
              required
              minLength={3}
              maxLength={80}
              pattern="[a-zA-Z0-9_.-]+"
            />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </label>
          <label>
            ФИО
            <input name="full_name" maxLength={160} />
          </label>
          <label>
            Подразделение
            <input name="department" maxLength={120} />
          </label>
          <label>
            Должность
            <input name="position" maxLength={120} />
          </label>
          <label>
            Роль
            <select name="role" defaultValue="observer">
              <option value="observer">Наблюдатель</option>
              {catalog.data
                ?.filter((item) => item.can_assign && item.name!=="observer")
                .map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.label}
                  </option>
                ))}
            </select>
          </label>
          <Button disabled={busy}>
            <Plus size={16} /> Создать карточку
          </Button>
          {message && (
            <p role="alert" className="error">
              {message}
            </p>
          )}
        </form>
        <BlockGuide
          title="Создать пользователя"
          text="Сначала создаётся учётная запись; затем откроется карточка для фото и контактов."
          steps="Выберите минимально необходимые права. Пароль — от 12 символов. Данные учебных пользователей могут быть вымышленными."
        />
      </Dialog>
    </div>
  );
}
export function MyConnection({
  person,
  onChanged,
}: {
  person: Row;
  onChanged: () => void;
}) {
  const client = useQueryClient(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const connection = useQuery({
    queryKey: ["my-connection"],
    queryFn: () => api("/auth/connection"),
  });
  async function locate() {
    setMessage("");
    setBusy(true);
    try {
      if (!navigator.geolocation)
        throw new Error("Браузер не поддерживает геолокацию");
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 0,
          }),
      );
      await api("/auth/location", "POST", {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        observed_at: new Date(position.timestamp).toISOString(),
      });
      await client.invalidateQueries();
      onChanged();
      setMessage("Местоположение сохранено с указанной браузером точностью");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Браузер не предоставил местоположение. Разрешите доступ или оставьте его выключенным.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="connection-panel">
      <div className="row between">
        <div>
          <h2>Моё соединение и местоположение</h2>
          <p>
            Текущий IP: <code>{connection.data?.ip || "Проверка…"}</code>
          </p>
        </div>
        <span className="badge">
          <Shield size={14} />{" "}
          {connection.data?.network?.allowed
            ? "Доступ разрешён"
            : "Проверка политики"}
        </span>
      </div>
      <LastConnection person={person} />
      <p className="connection-note">
        {connection.data?.network?.anonymizer_status}.{" "}
        {connection.data?.ip_source}. Координаты доступны вам и администратору;
        они сохраняются только по вашему запросу.
      </p>
      <Button variant="outline" disabled={busy} onClick={locate}>
        <LocateFixed size={16} />
        {busy ? "Запрос браузера…" : "Передать моё местоположение"}
      </Button>
      {message && <p role="status">{message}</p>}
      <BlockGuide
        title="Моё соединение"
        text="IP определяется сервером. Геолокация браузера требует вашего разрешения и может быть неточной."
        steps="Нажмите кнопку только если хотите передать координаты. При отказе права доступа не меняются. В Docker или за NAT сервер может видеть адрес шлюза, а не вашего устройства."
      />
    </section>
  );
}
