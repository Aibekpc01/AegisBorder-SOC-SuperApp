/* Назначение файла: Показывает участников и устройства; отправляет сигналы присутствия текущего браузерного сеанса.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users,
  Monitor,
  Smartphone,
  Search,
  Wifi,
  Clock,
  Pencil,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Dialog } from "./ui/dialog";
import { api } from "../api";
import { roles } from "../lib/utils";
import "../presence.css";

type Member = {
  id: number;
  username: string;
  full_name: string;
  department: string;
  position: string;
  role: string;
  active: boolean;
  online: boolean;
  guest: boolean;
  last_seen: string | null;
  ip?: string;
};
type Device = {
  dlp_visit_id: string;
  dlp_required: boolean;
  dlp_assigned: boolean;
  dlp_can_assign: boolean;
  id: string;
  username: string;
  device: string;
  brand: string;
  browser: string;
  ip: string;
  first_seen: string;
  last_seen: string;
  online: boolean;
  city: string;
  city_source: string;
  accuracy: number | null;
  device_source: string;
  location_observed_at: string | null;
};
const stamp = (value: string | null) =>
  value
    ? new Date(
        value.match(/Z$|[+-]\d\d:\d\d$/) ? value : value + "Z",
      ).toLocaleString("ru-RU")
    : "Ещё не подключался";

export function PresenceSignal({ userId }: { userId: number }) {
  const client = useQueryClient();
  useEffect(() => {
    let alive = true;
    let initialized = false;
    const tab_id = crypto.randomUUID();
    let model = "";
    const hints = (
      navigator as Navigator & {
        userAgentData?: {
          getHighEntropyValues: (keys: string[]) => Promise<{ model?: string }>;
        };
      }
    ).userAgentData;
    const beat = () => {
      if (alive && navigator.onLine)
        void api("/presence/heartbeat", "POST", { tab_id, model })
          .then(() => {
            if (alive && !initialized) {
              initialized = true;
              void client.invalidateQueries({ queryKey: ["site-devices"] });
              void client.invalidateQueries({ queryKey: ["participants"] });
            }
          })
          .catch(() => {});
    };
    const leave = () => {
      void fetch("/api/v1/presence/disconnect", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab_id }),
      }).catch(() => {});
    };
    void hints
      ?.getHighEntropyValues(["model"])
      .then((value) => {
        model = (value.model || "").slice(0, 80);
        beat();
      })
      .catch(() => {});
    beat();
    const timer = window.setInterval(beat, 25000);
    window.addEventListener("online", beat);
    window.addEventListener("pageshow", beat);
    window.addEventListener("pagehide", leave);
    return () => {
      alive = false;
      leave();
      clearInterval(timer);
      window.removeEventListener("online", beat);
      window.removeEventListener("pageshow", beat);
      window.removeEventListener("pagehide", leave);
    };
  }, [userId, client]);
  return null;
}

export function PresenceBadge({ online }: { online: boolean }) {
  return (
    <span className={`presence-badge ${online ? "is-online" : "is-offline"}`}>
      <i />
      {online ? "Онлайн" : "Офлайн"}
    </span>
  );
}

export function Participants({ admin }: { admin: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["participants", "staff"],
    queryFn: () =>
      api<{ members: Member[] }>("/presence/participants?staff=true"),
    refetchInterval: 10000,
  });
  const rows = query.data?.members || [];
  const filtered = rows.filter(
    (m) =>
      (filter !== "online" || m.online) &&
      (filter !== "offline" || !m.online) &&
      `${m.username} ${m.full_name} ${m.department} ${m.position}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <section className="presence-workspace">
      <header className="presence-hero">
        <div>
          <span className="eyebrow">ЛЮДИ И ВЗАИМОДЕЙСТВИЕ</span>
          <h2>
            <Users /> Сотрудники
          </h2>
          <p>
            Действующие сотрудники, их подразделения и присутствие на сайте.
            IP-адреса доступны администратору.
          </p>
        </div>
        <Link className="btn btn-outline" to="/app/team">
          Открыть чат <ArrowRight size={16} />
        </Link>
      </header>
      <div className="presence-metrics">
        <article>
          <Wifi />
          <strong>{rows.filter((m) => m.online).length}</strong>
          <span>Сейчас онлайн</span>
        </article>
        <article>
          <ShieldCheck />
          <strong>{rows.filter((m) => !m.guest).length}</strong>
          <span>Сотрудников</span>
        </article>
        <article>
          <Users />
          <strong>{rows.filter((m) => !m.online).length}</strong>
          <span>Не в сети</span>
        </article>
      </div>
      <div className="presence-toolbar">
        <label>
          <Search size={18} />
          <input
            aria-label="Поиск участников"
            placeholder="Имя, должность, подразделение"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="presence-tabs">
          {[
            ["all", "Все"],
            ["online", "Онлайн"],
            ["offline", "Офлайн"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="presence-help">
        <Clock size={15} /> Обновление каждые 10 секунд. После закрытия сайта
        последней вкладки отправляется сигнал офлайн; при потере связи статус
        меняется в течение 75 секунд. Карточки сотрудников редактирует
        администратор.
      </p>
      {query.isPending && <p role="status">Загружаем участников…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      <div className="presence-grid">
        {filtered.map((member) => (
          <article className="presence-card" key={member.id}>
            <div className="row between">
              <span
                className={`presence-avatar ${member.guest ? "guest" : ""}`}
              >
                {(member.full_name || member.username)
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <PresenceBadge online={member.online} />
            </div>
            <h3>{member.full_name || member.username}</h3>
            <span className="badge">{roles[member.role] || member.role}</span>
            <p>
              {member.guest
                ? "Личная демонстрационная среда"
                : member.position || "Должность не указана"}
            </p>
            <p>
              {admin && `Последний IP: ${member.ip || "Ещё не подключался"}`}
            </p>
            <small>
              {member.department ||
                (member.guest
                  ? "Учебные данные изолированы от других гостей"
                  : "Подразделение не указано")}
            </small>
            <footer>
              <span>
                {!member.active
                  ? "Аккаунт отключён"
                  : member.online
                    ? "Подключён к сайту"
                    : `Последняя связь: ${stamp(member.last_seen)}`}
              </span>
              {admin && !member.guest && (
                <button
                  className="btn btn-outline"
                  aria-label={`Редактировать ${member.username}`}
                  onClick={() => {
                    setEdit(member);
                    setError("");
                  }}
                >
                  <Pencil size={14} /> Изменить
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
      {!query.isPending && !filtered.length && (
        <div className="presence-empty">
          Участники не найдены. Попробуйте другой запрос или фильтр.
        </div>
      )}
      {admin && (
        <Link className="btn btn-outline" to="/app/users">
          Создать сотрудника или настроить права <ArrowRight size={15} />
        </Link>
      )}
      {edit && (
        <Dialog
          open={true}
          title="Карточка сотрудника"
          onClose={() => {
            if (!busy) setEdit(null);
          }}
        >
          <section className="presence-dialog">
            <p>
              {edit.username} · {roles[edit.role]}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api(`/presence/employees/${edit.id}`, "PATCH", {
                    full_name: edit.full_name,
                    department: edit.department,
                    position: edit.position,
                  });
                  await client.invalidateQueries({
                    queryKey: ["participants"],
                  });
                  setEdit(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {(
                [
                  ["full_name", "ФИО", 160],
                  ["position", "Должность", 120],
                  ["department", "Подразделение", 120],
                ] as const
              ).map(([key, label, max]) => (
                <label key={key}>
                  {label}
                  <input
                    autoFocus={key === "full_name"}
                    maxLength={max}
                    value={edit[key]}
                    onChange={(e) =>
                      setEdit({ ...edit, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              {error && <p role="alert">{error}</p>}
              <div className="row">
                <button className="btn" disabled={busy}>
                  Сохранить
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => setEdit(null)}
                >
                  Отмена
                </button>
              </div>
            </form>
          </section>
        </Dialog>
      )}
    </section>
  );
}

export function Devices() {
  const client = useQueryClient();
  const [dlpMessage, setDlpMessage] = useState("");
  const [assigning, setAssigning] = useState("");
  const [search, setSearch] = useState("");
  const [online, setOnline] = useState(false);
  const query = useQuery({
    queryKey: ["site-devices"],
    queryFn: () =>
      api<{ devices: Device[]; scope: string }>("/presence/devices"),
    refetchInterval: 10000,
  });
  const rows = query.data?.devices || [];
  const filtered = rows.filter(
    (d) =>
      (!online || d.online) &&
      `${d.device} ${d.browser} ${d.ip} ${d.username} ${d.city}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function assignDlp(device: Device) {
    setAssigning(device.id);
    try {
      await api("/dlp/assign", "POST", { visit_id: device.dlp_visit_id });
      setDlpMessage(
        `Сотруднику ${device.username} назначен Aegis DLP. Уведомление появится на сайте; рабочие функции будут закрыты до подключения агента.`,
      );
      await client.invalidateQueries({ queryKey: ["site-devices"] });
      await client.invalidateQueries({ queryKey: ["dlp-access"] });
    } catch (error) {
      setDlpMessage(
        error instanceof Error ? error.message : "Ошибка назначения",
      );
    } finally {
      setAssigning("");
    }
  }
  return (
    <section className="presence-workspace">
      {dlpMessage && (
        <p role="status" className="info-box">
          {dlpMessage}
        </p>
      )}
      <header className="presence-hero">
        <div>
          <span className="eyebrow">ИСТОРИЯ ПОДКЛЮЧЕНИЙ</span>
          <h2>
            <Monitor /> Устройства
          </h2>
          <p>
            Реальные подключения к сайту: телефоны, планшеты и компьютеры.
            История сеансов сохраняется после выхода.
          </p>
        </div>
        <span className="presence-badge is-online">
          <Wifi size={14} />
          {rows.filter((d) => d.online).length} онлайн
        </span>
      </header>
      <div className="presence-toolbar">
        <label>
          <Search size={18} />
          <input
            aria-label="Поиск устройств"
            placeholder="Устройство, город, IP, браузер или сотрудник"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          className="btn btn-outline"
          aria-pressed={online}
          onClick={() => setOnline(!online)}
        >
          {online ? "Показать всю историю" : "Только онлайн"}
        </button>
      </div>
      <p className="presence-help">
        {query.data?.scope === "all"
          ? "Администратору доступны подключения всех участников."
          : "Здесь показаны ваши подключения. Полная история с IP-адресами доступна администратору."}{" "}
        Название определяется браузером; точная модель и имя компьютера могут
        быть недоступны. IP — адрес подключения, а не физическое местоположение.
      </p>
      {query.isPending && <p role="status">Загрузка устройств…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      <div className="presence-grid">
        {filtered.map((d) => (
          <article key={d.id} className="presence-card device-card">
            <div className="row between">
              <span className="presence-avatar">
                {/iPhone|iPad|Android|SM-|Pixel|Redmi|POCO|Xiaomi|HUAWEI|Samsung/i.test(
                  d.device,
                ) ? (
                  <Smartphone />
                ) : (
                  <Monitor />
                )}
              </span>
              <PresenceBadge online={d.online} />
            </div>
            <h3>
              {d.brand &&
              !d.device.toLowerCase().includes(d.brand.toLowerCase())
                ? `${d.brand} · ${d.device}`
                : d.device}
            </h3>
            <p>
              {d.browser} · {d.username}
            </p>
            <dl>
              <dt>Последний IP</dt>
              <dd>{d.ip}</dd>
              <dt>Город</dt>
              <dd>
                {d.city || "Не определён"}
                <small>{d.city_source}</small>
                {d.accuracy != null && (
                  <small>Точность координат: ±{Math.round(d.accuracy)} м</small>
                )}
                {d.location_observed_at && (
                  <small>Измерено: {stamp(d.location_observed_at)}</small>
                )}
              </dd>
              <dt>Сведения об устройстве</dt>
              <dd>{d.device_source}</dd>
              <dt>Начало сеанса</dt>
              <dd>{stamp(d.first_seen)}</dd>
              <dt>Последняя связь</dt>
              <dd>{stamp(d.last_seen)}</dd>
            </dl>
            <div className="dlp-device-action">
              {d.dlp_required && (
                <span className="badge">Aegis DLP обязателен</span>
              )}
              {d.dlp_can_assign && (
                <button
                  className="btn btn-primary"
                  disabled={assigning === d.id}
                  onClick={() => assignDlp(d)}
                >
                  <ShieldCheck size={16} />
                  {d.dlp_assigned
                    ? "Напомнить об установке Aegis DLP"
                    : "Подключить пользователю Aegis DLP"}
                </button>
              )}
            </div>

            <footer>
              <Clock size={14} />{" "}
              {d.online
                ? "Сайт открыт на устройстве"
                : "Сеанс сохранён в истории"}
            </footer>
          </article>
        ))}
      </div>
      {!query.isPending && !filtered.length && (
        <div className="presence-empty">
          Подключения появятся автоматически после первого сигнала от сайта.
          Обновление каждые 10 секунд.
        </div>
      )}
      <p className="presence-help">
        Один вход — одна запись истории. Несколько вкладок одного сеанса
        учитываются вместе. Закрытие последней вкладки отправляет сигнал
        отключения. При потере сети или принудительном закрытии браузера офлайн
        определяется в течение 75 секунд. Выход из аккаунта завершает статус
        сразу.
      </p>
    </section>
  );
}

export function DemoWelcome() {
  return (
    <section className="demo-welcome">
      <div>
        <Sparkles />
        <span className="eyebrow">ВАША ЛИЧНАЯ ДЕМОНСТРАЦИЯ</span>
      </div>
      <h2>От первого сигнала — к расследованию</h2>
      <p>
        Для нового гостя уже подготовлены три учебных примера: подбор пароля,
        доступ к закрытому ресурсу и неизвестное USB-устройство. Откройте
        инцидент, изучите события и проверьте, почему система рассчитала такой
        риск.
      </p>
      <div className="demo-steps">
        <Link to="/app/incidents">
          <b>01</b>
          <span>
            Изучите инциденты<small>События, причины и оценка риска</small>
          </span>
          <ArrowRight />
        </Link>
        <Link to="/app/scenarios">
          <b>02</b>
          <span>
            Запустите сценарий<small>Посмотрите, как появляются сигналы</small>
          </span>
          <ArrowRight />
        </Link>
        <Link to="/app/participants">
          <b>03</b>
          <span>
            Познакомьтесь с участниками<small>Кто сейчас на связи</small>
          </span>
          <ArrowRight />
        </Link>
      </div>
      <small>
        Это синтетические примеры, а не реальные атаки. Ваши учебные инциденты
        видны только в вашей среде. Действия с постоянными данными ограничены
        вашей ролью.
      </small>
    </section>
  );
}
