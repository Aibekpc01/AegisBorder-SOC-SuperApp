import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search, ShieldAlert } from "lucide-react";
import { api, type Row } from "../api";
import { date } from "../lib/utils";
import { Dialog } from "./ui/dialog";

export function AppTools({
  onIncident,
  onEvents,
}: {
  onIncident: (id: number) => void;
  onEvents: (term: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [notifications, setNotifications] = useState(false),
    [query, setQuery] = useState(""),
    [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const results = useQuery({
    queryKey: ["global-search", term],
    queryFn: async () => {
      const [events, incidents] = await Promise.all([
        api(`/events?q=${encodeURIComponent(term)}&limit=8`),
        api(`/incidents?q=${encodeURIComponent(term)}`),
      ]);
      return { events: events.items as Row[], incidents: incidents as Row[] };
    },
    enabled: open && term.length >= 2,
  });
  const feed = useQuery({
    queryKey: ["notification-incidents"],
    queryFn: () => api("/incidents"),
    refetchInterval: 30000,
  });
  const active = (feed.data || []).filter(
    (item: Row) => !["Закрыт", "Ложное срабатывание"].includes(item.status),
  );
  return (
    <>
      <button
        className="global-search-trigger"
        aria-label="Открыть глобальный поиск"
        onClick={() => setOpen(true)}
      >
        <Search size={15} /> Поиск <kbd>Ctrl K</kbd>
      </button>
      <button
        className="icon-btn notification-trigger"
        aria-label="Открыть уведомления об инцидентах"
        onClick={() => setNotifications(true)}
      >
        <Bell size={18} />
        {active.length > 0 && <span />}
      </button>
      <Dialog
        title="Поиск по событиям и инцидентам"
        open={open}
        onClose={() => setOpen(false)}
      >
        <p>
          Результаты берутся из API с учётом вашей роли и доступа к
          демонстрационным данным.
        </p>
        <input
          aria-label="Глобальный поиск"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Название, устройство или учётная запись…"
          maxLength={200}
        />
        {term.length < 2 ? (
          <p>Введите минимум два символа.</p>
        ) : results.isFetching ? (
          <p role="status">Поиск…</p>
        ) : results.error ? (
          <p role="alert">{results.error.message}</p>
        ) : (
          <div className="global-search-results">
            <h3>Инциденты</h3>
            {results.data?.incidents.length ? (
              results.data.incidents.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpen(false);
                    onIncident(item.id);
                  }}
                >
                  <ShieldAlert size={15} /> #{item.id} · {item.title}
                  <small>
                    {item.device} · {item.status} · риск {item.risk}/100
                  </small>
                </button>
              ))
            ) : (
              <p>Совпадений нет.</p>
            )}
            <h3>События</h3>
            {results.data?.events.length ? (
              results.data.events.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpen(false);
                    onEvents(term);
                  }}
                >
                  <b>{item.detail || item.type}</b>
                  <small>
                    {item.device} · {date(item.time)} · откроется мониторинг для
                    подробного поиска
                  </small>
                </button>
              ))
            ) : (
              <p>Совпадений нет.</p>
            )}
          </div>
        )}
      </Dialog>
      <Dialog
        title="Инциденты, требующие внимания"
        open={notifications}
        onClose={() => setNotifications(false)}
      >
        <p>
          Текущие незакрытые инциденты, доступные вам. Список обновляется каждые
          30 секунд; это не журнал прочтения уведомлений.
        </p>
        {feed.error ? (
          <p role="alert">{feed.error.message}</p>
        ) : feed.isPending ? (
          <p role="status">Загрузка…</p>
        ) : (
          <div className="global-search-results">
            {active.slice(0, 20).map((item: Row) => (
              <button
                key={item.id}
                onClick={() => {
                  setNotifications(false);
                  onIncident(item.id);
                }}
              >
                <b>
                  #{item.id} · {item.title}
                </b>
                <small>
                  {item.status} · {date(item.created)} · риск {item.risk}/100
                </small>
              </button>
            ))}
            {!active.length && <p>Незакрытых инцидентов нет.</p>}
          </div>
        )}
      </Dialog>
    </>
  );
}

export function DevelopmentModules() {
  return (
    <>
      <p>
        Следующие модули входят в план SuperApp. Они ещё не подключены к серверу
        и не выполняют действий.
      </p>
      <div className="module-roadmap">
        {[
          [
            "Почтовая безопасность",
            "Анализ синтетических сообщений и обучение распознаванию подозрительных писем.",
          ],
          [
            "Цифровой двойник инфраструктуры",
            "Наглядная модель учебных устройств и их связей.",
          ],
          [
            "Задачи и согласования",
            "Назначение работы, сроки и проверяемые переходы статусов.",
          ],
          [
            "Центр интеграций",
            "Настройка и проверка подключений в разрешённой тестовой среде.",
          ],
          [
            "Конструктор сценариев",
            "Создание безопасных учебных последовательностей событий.",
          ],
        ].map(([title, text]) => (
          <article key={title}>
            <ShieldAlert size={23} />
            <h2>{title}</h2>
            <p>{text}</p>
            <span className="badge">Запланировано · действий пока нет</span>
          </article>
        ))}
      </div>
    </>
  );
}
