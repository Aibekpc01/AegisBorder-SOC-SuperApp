import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  LayoutDashboard,
  Activity,
  ShieldAlert,
  BrainCircuit,
  ScanLine,
  Monitor,
  FlaskConical,
  Search,
  FileText,
  Users,
  History,
  Settings,
  BookOpen,
  Presentation,
  LogOut,
  ArrowUpRight,
  ChevronRight,
  Play,
  CheckCircle2,
  Radio,
  Download,
  RefreshCw,
  LockKeyhole,
  Layers,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import { api, type Row } from "./api";
import { date, roles, statuses, nextStatus, riskLabel } from "./lib/utils";
import "./style.css";
import "./redesign.css";
import "./profiles.css";
import { BlockGuide } from "./components/block-guide";
import {
  UsersWorkspace,
  ProfileEditor,
  UserAvatar,
  MyConnection,
} from "./components/user-profiles";
import { AccessPolicy } from "./components/access-policy";
import { EventTable } from "./components/event-table";
import { TrainingLab } from "./components/training-lab";
import { VisualGuide } from "./components/visual-guide";
import { ThemeToggle } from "./components/theme-toggle";
import { AppTools, DevelopmentModules } from "./components/app-tools";
import { appPath, appPage } from "./lib/routes";
import "./superapp.css";
const Workspace = React.lazy(() =>
  import("./components/workspace").then((module) => ({
    default: module.Workspace,
  })),
);

const pages = [
  ["", "Главная панель", LayoutDashboard],
  ["events", "Мониторинг событий", Activity],
  ["incidents", "Центр инцидентов", ShieldAlert],
  ["analysis", "Умный анализ", BrainCircuit],
  ["anomalies", "Обнаружение аномалий", ScanLine],
  ["assets", "Контроль компьютеров", Monitor],
  ["scenarios", "Учебные сценарии", FlaskConical],
  ["investigations", "Расследования", Search],
  ["reports", "Отчёты", FileText],
  ["workspace", "Документы и рабочее пространство", FileText],
  ["users", "Пользователи и роли", Users],
  ["audit", "История действий", History],
  ["settings", "Настройки", Settings],
  ["help", "Справка и обучение", BookOpen],
  ["commission", "Режим комиссии", Presentation],
  ["development", "Развитие SuperApp", Layers],
] as const;
function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
      <BlockGuide title={title} />
    </section>
  );
}
function Empty({
  text = "Записей пока нет. Начните с учебного сценария.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Shield size={32} />
      <p>{text}</p>
    </div>
  );
}
function Risk({ value }: { value: number }) {
  return (
    <span
      className={
        "risk " + (value >= 85 ? "critical" : value >= 65 ? "high" : "medium")
      }
    >
      {value} <small>/100</small>
    </span>
  );
}
export default function App() {
  const [user, setUser] = useState<Row | null>(null),
    [ready, setReady] = useState(false),
    [technical, setTechnical] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState(""),
    [offset, setOffset] = useState(0),
    [session, setSession] = useState<number | null>(null),
    [scenario, setScenario] = useState("bruteforce"),
    [result, setResult] = useState<Row | null>(null),
    [editRule, setEditRule] = useState<Row | null>(null),
    [confirmReset, setConfirmReset] = useState(false),
    [editUser, setEditUser] = useState<Row | null>(null);
  const location = useLocation(),
    routerNavigate = useNavigate(),
    client = useQueryClient();
  const navigate = (path: string) => routerNavigate(appPath(path));
  const page = appPage(location.pathname);
  const editable = !!user && user.role !== "observer",
    isAdmin = user?.role === "admin";
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
    const expired = () => {
      setUser(null);
      client.clear();
    };
    window.addEventListener("aegis-expired", expired);
    return () => window.removeEventListener("aegis-expired", expired);
  }, [client]);
  useEffect(() => {
    setQ(new URLSearchParams(location.search).get("q") || "");
    setFilter("");
    setOffset(0);
    window.scrollTo(0, 0);
  }, [page, location.search]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!user) return;
    let socket: WebSocket | undefined,
      timer: ReturnType<typeof setTimeout>,
      stopped = false,
      revision = "";
    function connect() {
      socket = new WebSocket(
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/v1/ws`,
      );
      socket.onmessage = (e) => {
        if (revision && revision !== e.data) client.invalidateQueries();
        revision = e.data;
      };
      socket.onclose = () => {
        if (!stopped) timer = setTimeout(connect, 5000);
      };
    }
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [user, client]);
  async function act(
    work: () => Promise<any>,
    message = "Изменения сохранены",
  ) {
    setBusy(true);
    try {
      const value = await work();
      await client.invalidateQueries();
      setNotice(message);
      return value;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Ошибка операции");
      return null;
    } finally {
      setBusy(false);
    }
  }
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api("/health"),
    enabled: !!user,
    refetchInterval: 15000,
  });
  const preferences = useQuery({
    queryKey: ["preferences"],
    queryFn: () => api("/settings"),
    enabled: !!user,
  });
  useEffect(() => {
    if (preferences.data) setTechnical(!preferences.data.simple_mode);
  }, [preferences.data]);
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api("/dashboard"),
    enabled: !!user && page === "",
  });
  const eventQuery = useQuery({
    queryKey: ["events", q, filter, offset],
    queryFn: () =>
      api(
        `/events?q=${encodeURIComponent(q)}&severity=${encodeURIComponent(filter)}&offset=${offset}`,
      ),
    enabled: !!user && (page === "events" || page === "" || page === "assets"),
  });
  const incidents = useQuery({
    queryKey: ["incidents", q, filter],
    queryFn: () =>
      api(
        `/incidents?q=${encodeURIComponent(q)}&status=${encodeURIComponent(filter)}`,
      ),
    enabled:
      !!user &&
      ["", "incidents", "investigations", "commission"].includes(page),
  });
  const details = useQuery({
    queryKey: ["incident", selected],
    queryFn: () => api("/incidents/" + selected),
    enabled: !!user && selected !== null,
  });
  const paths: Record<string, string> = {
    analysis: "/detection-rules",
    anomalies: "/analytics/anomalies",
    assets: "/assets",
    scenarios: "/scenarios",
    commission: "/scenarios",
    reports: "/reports",
    users: "/users",
    audit: "/audit",
    settings: "/settings",
  };
  const data = useQuery({
    queryKey: ["page", page],
    queryFn: () => api(paths[page]),
    enabled: !!user && !!paths[page] && (page !== "users" || !!isAdmin),
  });
  const demos = useQuery({
    queryKey: ["demo-sessions"],
    queryFn: () => api("/demo-sessions"),
    enabled: !!user && ["commission", "scenarios"].includes(page),
  });
  const integrity = useQuery({
    queryKey: ["integrity"],
    queryFn: () => api("/audit/verify"),
    enabled: !!user && page === "audit",
  });
  useEffect(() => {
    if (demos.data?.length && !session) setSession(demos.data[0].id);
  }, [demos.data, session]);
  async function run(id: string, commission = false) {
    return await act(async () => {
      let demoId = session;
      if ((commission || user?.role === "demo") && !demoId) {
        const d = await api("/demo-sessions", "POST", {});
        demoId = d.id;
        setSession(d.id);
      }
      const r = await api("/scenarios/" + id, "POST", {
        demo_id: commission || user?.role === "demo" ? demoId : null,
      });
      setResult(r);
      if (!commission && r.incidents.length) setSelected(r.incidents[0]);
      return r;
    }, "Учебные события обработаны. Результат сохранён.");
  }
  function IncidentTable({ items }: { items: Row[] }) {
    return items.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Инцидент</th>
              <th>Устройство</th>
              <th>Риск</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <b>
                    #{i.id} · {i.title}
                  </b>
                  <small>{date(i.created)}</small>
                </td>
                <td>{i.device}</td>
                <td>
                  <Risk value={i.risk} />
                </td>
                <td>
                  <span className="badge">{i.status}</span>
                </td>
                <td>
                  <Button
                    variant="ghost"
                    onClick={() => setSelected(i.id)}
                    aria-label={"Открыть инцидент " + i.id}
                  >
                    <ArrowUpRight size={18} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty />
    );
  }
  if (!ready)
    return (
      <div className="login">
        <p>Проверка сеанса…</p>
      </div>
    );
  if (!user)
    return (
      <div className="login">
        <div className="login-art">
          <Shield size={70} />
          <h1>
            AegisBorder <span>SOC</span>
          </h1>
          <p>
            Интеллектуальная система защиты
            <br />
            Пограничной службы КНБ РК
          </p>
          <div className="badge">
            <LockKeyhole size={14} /> Локальная учебная среда
          </div>
        </div>
        <form
          className="login-card"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const r = await act(
              () => api("/auth/login", "POST", Object.fromEntries(f)),
              "Вход выполнен",
            );
            if (r) {
              client.clear();
              setSession(null);
              setUser(r);
            }
          }}
        >
          <span className="eyebrow">COMMAND CENTER / 0.3</span>
          <h2>Добро пожаловать</h2>
          <p>Войдите, чтобы открыть центр управления.</p>
          <label>
            Имя пользователя
            <input
              name="username"
              defaultValue="admin"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <Button disabled={busy}>
            Войти в систему <ChevronRight size={16} />
          </Button>
          {notice && (
            <p role="alert" className="error">
              {notice}
            </p>
          )}
          <small>Используйте пароль своей учебной учётной записи.</small>
          <NavLink to="/" className="login-home">
            Вернуться на главную страницу
          </NavLink>
        </form>
      </div>
    );
  const title = pages.find((p) => p[0] === page)?.[1] || "Главная панель";
  const loading =
    dashboard.isLoading ||
    eventQuery.isLoading ||
    incidents.isLoading ||
    data.isLoading;
  const failure = [
    dashboard.error,
    eventQuery.error,
    incidents.error,
    data.error,
  ].find(Boolean);
  return (
    <div className="shell">
      <aside>
        <NavLink className="brand" to="/app">
          <div className="brand-icon">
            <Shield size={24} />
          </div>
          <div>
            AegisBorder <strong>SuperApp</strong>
            <small className="brand-mission">
              Интеллектуальная система защиты Пограничной службы КНБ РК
            </small>
          </div>
        </NavLink>
        <div className="nav-label">ЦЕНТР УПРАВЛЕНИЯ</div>
        <nav>
          {pages.map(([path, label, Icon]) => (
            <NavLink
              end
              key={path}
              to={appPath(path)}
              aria-label={label}
              title={label}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={18} />
              <span>{label}</span>
              {path === "commission" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Radio size={16} />
          <div>
            Учебный контур<small>Только синтетические данные</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="breadcrumbs">
            AegisBorder SuperApp <ChevronRight size={14} /> <b>{title}</b>
          </div>
          <div className="row">
            <AppTools
              onIncident={setSelected}
              onEvents={(term) =>
                navigate("/events?q=" + encodeURIComponent(term))
              }
            />
            <ThemeToggle />
            <span
              className={
                health.isSuccess ? "system-status" : "system-status offline"
              }
            >
              <span className="online-dot" />{" "}
              {health.isSuccess ? "Система активна" : "Нет подключения"}
            </span>
            <button className="mode" onClick={() => setTechnical(!technical)}>
              {technical ? "Технический режим" : "Простой режим"}
            </button>
            <button
              className="profile profile-trigger"
              aria-label="Открыть мой профиль"
              onClick={() => setEditUser(user)}
            >
              <UserAvatar user={user} />
              <div>
                {user.profile?.full_name || user.username}
                <small>{roles[user.role]}</small>
              </div>
            </button>
            <button
              className="icon-btn"
              aria-label="Выйти"
              onClick={() =>
                act(async () => {
                  await api("/auth/logout", "POST", {});
                  setUser(null);
                  client.clear();
                  setSession(null);
                }, "Вы вышли из системы")
              }
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                ОПЕРАТИВНАЯ ОБСТАНОВКА / УЧЕБНЫЙ КОНТУР
              </span>
              <h1>{title}</h1>
              <p>
                {page === "commission"
                  ? "Проверьте возможности системы самостоятельно — шаг за шагом."
                  : "Обнаружение, анализ и расследование на основе синтетических событий."}
              </p>
            </div>
            <div className="row">
              <Button
                variant="outline"
                onClick={() => client.invalidateQueries()}
              >
                <RefreshCw size={15} /> Обновить
              </Button>
              {page === "" && editable && (
                <Button onClick={() => navigate("/commission")}>
                  <Play size={15} /> Проверить систему
                </Button>
              )}
            </div>
          </div>
          {failure && (
            <div role="alert" className="error-box">
              {(failure as Error).message}
            </div>
          )}
          {loading && <div className="loading-line" />}
          {page === "development" && <DevelopmentModules />}
          {page === "workspace" && (
            <React.Suspense
              fallback={<p role="status">Загрузка рабочего пространства…</p>}
            >
              <Workspace user={user} />
            </React.Suspense>
          )}
          {page === "" && dashboard.data && (
            <>
              <div className="metric-grid">
                {[
                  [
                    "События безопасности",
                    dashboard.data.events,
                    Activity,
                    "Сохранены в базе данных",
                  ],
                  [
                    "Открытые инциденты",
                    dashboard.data.open_incidents,
                    ShieldAlert,
                    "Требуют проверки оператора",
                  ],
                  [
                    "Максимальный риск",
                    dashboard.data.risk,
                    ScanLine,
                    riskLabel(dashboard.data.risk),
                  ],
                  [
                    "Учебные устройства",
                    dashboard.data.assets,
                    Monitor,
                    "Синтетическая инфраструктура",
                  ],
                ].map(([label, value, Icon, caption]) => {
                  const I = Icon as typeof Activity;
                  return (
                    <button
                      className="metric"
                      key={String(label)}
                      onClick={() =>
                        navigate(
                          label === "События безопасности"
                            ? "/events"
                            : label === "Учебные устройства"
                              ? "/assets"
                              : "/incidents",
                        )
                      }
                      aria-label={"Открыть раздел: " + label}
                    >
                      <div className="row between">
                        <span>{String(label)}</span>
                        <I size={21} />
                      </div>
                      <strong>
                        {String(value)}
                        {label === "Максимальный риск" && <small>/100</small>}
                      </strong>
                      <p>
                        <span className="online-dot" />
                        {String(caption)}
                      </p>
                      <span className="metric-instruction">
                        {
                          {
                            "События безопасности":
                              "Все сохранённые события: нажмите для поиска.",
                            "Открытые инциденты":
                              "Незакрытые предупреждения: нажмите для проверки.",
                            "Максимальный риск":
                              "Максимум среди открытых инцидентов: изучите причины.",
                            "Учебные устройства":
                              "Карточки устройств и их события: нажмите для просмотра.",
                          }[String(label)]
                        }{" "}
                        <ArrowUpRight size={14} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="chart-grid">
                <Panel
                  title="Поток событий"
                  subtitle="Последние 1 000 событий · время UTC"
                  action={<span className="badge">Живые данные</span>}
                >
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dashboard.data.timeline}>
                        <defs>
                          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor="#38BDF8"
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="100%"
                              stopColor="#38BDF8"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#23364f" vertical={false} />
                        <XAxis dataKey="time" stroke="#8095b2" />
                        <YAxis stroke="#8095b2" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            background: "#15243A",
                            border: "1px solid #28405d",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="events"
                          name="События"
                          stroke="#38BDF8"
                          fill="url(#area)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel
                  title="Состояние инцидентов"
                  subtitle="Распределение по этапам расследования"
                >
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dashboard.data.distribution}
                        layout="vertical"
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={125}
                          stroke="#92a8c5"
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#15243A",
                            border: "1px solid #28405d",
                          }}
                        />
                        <Bar
                          dataKey="value"
                          name="Инциденты"
                          fill="#38BDF8"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>
              <Panel
                title="Инциденты, требующие внимания"
                subtitle="Откройте карточку, чтобы увидеть причины и хронологию"
                action={
                  <Button
                    variant="ghost"
                    onClick={() => navigate("/incidents")}
                  >
                    Все инциденты <ArrowUpRight size={16} />
                  </Button>
                }
              >
                <IncidentTable items={(incidents.data || []).slice(0, 5)} />
              </Panel>
              <div className="education-banner">
                <div>
                  <span className="eyebrow">ПОНЯТНО ДЛЯ КАЖДОГО</span>
                  <h2>От учебной ситуации до отчёта</h2>
                  <p>
                    Запустите проверку, изучите доказательства и сформируйте
                    PDF.
                  </p>
                </div>
                <Button onClick={() => navigate("/commission")}>
                  Открыть режим комиссии <ChevronRight size={16} />
                </Button>
              </div>
            </>
          )}
          {["events", "incidents", "investigations"].includes(page) && (
            <>
              <div className="toolbar">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Поиск"
                    placeholder="Поиск по устройству, событию или описанию…"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setOffset(0);
                    }}
                  />
                </div>
                <select
                  aria-label="Фильтр"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="">
                    Все {page === "events" ? "уровни" : "статусы"}
                  </option>
                  {(page === "events"
                    ? ["Информация", "Средняя", "Высокая", "Критическая"]
                    : statuses
                  ).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <Panel
                title={
                  page === "events"
                    ? `События (${eventQuery.data?.total ?? 0})`
                    : "Рабочий список инцидентов"
                }
              >
                {page === "events" ? (
                  <>
                    <EventTable
                      items={eventQuery.data?.items || []}
                      technical={technical}
                    />
                    <div className="pagination">
                      <Button
                        variant="outline"
                        disabled={!offset}
                        onClick={() => setOffset(offset - 100)}
                      >
                        Назад
                      </Button>
                      <span>
                        {offset + 1}–
                        {Math.min(offset + 100, eventQuery.data?.total || 0)}
                      </span>
                      <Button
                        variant="outline"
                        disabled={offset + 100 >= (eventQuery.data?.total || 0)}
                        onClick={() => setOffset(offset + 100)}
                      >
                        Далее
                      </Button>
                    </div>
                  </>
                ) : (
                  <IncidentTable items={incidents.data || []} />
                )}
              </Panel>
            </>
          )}
          {page === "analysis" && (
            <>
              <div className="info-box">
                <BrainCircuit size={24} />
                <div>
                  <b>Детерминированные правила корреляции</b>
                  <p>
                    Правила проверяют реальные записи событий. Это
                    алгоритмический анализ; результаты машинного обучения
                    находятся в отдельном разделе.
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => api("/analytics/reanalyze", "POST", {}),
                        "Повторный анализ завершён",
                      )
                    }
                  >
                    Повторный анализ
                  </Button>
                )}
              </div>
              <div className="scenario-grid">
                {data.data?.map((r: Row) => (
                  <Panel
                    key={r.id}
                    title={r.name}
                    subtitle={r.description}
                    action={
                      <span className={"badge " + (!r.enabled ? "red" : "")}>
                        {r.enabled ? "Включено" : "Отключено"}
                      </span>
                    }
                  >
                    <div className="rule-metrics">
                      <span>
                        Порог <b>{r.threshold}</b>
                      </span>
                      <span>
                        Окно <b>{r.window} с</b>
                      </span>
                      <span>
                        Риск <b>{r.risk}/100</b>
                      </span>
                    </div>
                    {technical && (
                      <p>
                        <code>{r.event_type}</code>
                      </p>
                    )}
                    {isAdmin && (
                      <Button variant="outline" onClick={() => setEditRule(r)}>
                        Настроить правило
                      </Button>
                    )}
                  </Panel>
                ))}
              </div>
            </>
          )}
          {page === "anomalies" && (
            <>
              <div className="info-box">
                <ScanLine size={24} />
                <div>
                  <b>Isolation Forest · синтетический профиль</b>
                  <p>
                    Модель обучается на 512 воспроизводимых нормальных примерах.
                    Оценка ниже нуля означает аномалию относительно этого
                    профиля. Точность на реальной инфраструктуре не измерялась.
                  </p>
                </div>
                {editable && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => api("/analytics/anomalies", "POST", {}),
                        "Анализ аномалий завершён",
                      )
                    }
                  >
                    Запустить анализ
                  </Button>
                )}
              </div>
              {data.data?.length ? (
                <Panel
                  title="Результаты последнего анализа"
                  subtitle={`${data.data[0].version} · ${date(data.data[0].created)}`}
                >
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Событие</th>
                          <th>Результат</th>
                          <th>Оценка модели</th>
                          <th>Признаки</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.data[0].results.map((r: Row) => (
                          <tr key={r.event_id}>
                            <td>#{r.event_id}</td>
                            <td>
                              <span
                                className={"badge " + (r.anomaly ? "red" : "")}
                              >
                                {r.anomaly ? "Аномалия" : "В пределах профиля"}
                              </span>
                            </td>
                            <td>{r.score}</td>
                            <td>{r.reasons.join("; ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {technical && (
                    <pre>
                      {JSON.stringify(data.data[0].parameters, null, 2)}
                    </pre>
                  )}
                </Panel>
              ) : (
                <Empty text="Запустите анализ после создания учебных событий." />
              )}
            </>
          )}
          {page === "assets" && (
            <>
              <div className="info-box">
                <Monitor size={24} />
                <p>
                  Список учебных устройств. Система не подключается к реальным
                  компьютерам и не выполняет удалённые команды.
                </p>
              </div>
              <div className="scenario-grid">
                {data.data?.map((a: Row) => (
                  <Panel key={a.id} title={a.name} subtitle={a.kind}>
                    <Monitor size={35} className="accent" />
                    <p>{a.description}</p>
                    <div className="row between">
                      <span className="badge">{a.status}</span>
                      <span>Критичность: {a.criticality}/100</span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigate("/events?q=" + encodeURIComponent(a.name));
                      }}
                    >
                      Посмотреть события <ChevronRight size={16} />
                    </Button>
                  </Panel>
                ))}
              </div>
            </>
          )}
          {page === "scenarios" && (
            <TrainingLab
              scenarios={data.data || []}
              busy={busy}
              canRun={editable}
              onRun={(id) => run(id, true)}
              onOpenIncident={setSelected}
              onNavigate={navigate}
            />
          )}
          {page === "commission" && (
            <>
              <div className="commission-hero">
                <div>
                  <span className="eyebrow">ДЕМОНСТРАЦИЯ ДЛЯ КОМИССИИ</span>
                  <h2>Проверить возможности системы</h2>
                  <p>
                    Выберите ситуацию. Система сохранит события, объяснит
                    предупреждение
                    <br />и поможет пройти расследование до PDF-отчёта.
                  </p>
                </div>
                <Presentation size={62} />
              </div>
              <div className="steps">
                {[
                  "Выбрать ситуацию",
                  "Запустить проверку",
                  "Изучить результат",
                  "Открыть инцидент",
                  "Провести расследование",
                  "Сформировать PDF",
                ].map((s, i) => {
                  const progress =
                    demos.data?.find((d: Row) => d.id === session)?.progress ||
                    0;
                  return (
                    <div key={s} className={progress > i ? "done" : ""}>
                      <span>
                        {progress > i ? <CheckCircle2 size={18} /> : i + 1}
                      </span>
                      <small>{s}</small>
                    </div>
                  );
                })}
              </div>
              <Panel
                title="Учебная ситуация"
                subtitle={
                  data.data?.find((s: Row) => s.id === scenario)?.description
                }
              >
                <div className="row wrap">
                  <select
                    aria-label="Учебная ситуация"
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                  >
                    {data.data?.map((s: Row) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={busy || !editable}
                    onClick={() => run(scenario, true)}
                  >
                    <Play size={16} />
                    {result ? "Повторить проверку" : "Запустить проверку"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !editable}
                    onClick={() =>
                      act(async () => {
                        const d = await api("/demo-sessions", "POST", {});
                        setSession(d.id);
                        setResult(null);
                      }, "Создан отдельный учебный сеанс")
                    }
                  >
                    Новый сеанс
                  </Button>
                  {session && (
                    <Button
                      variant="destructive"
                      disabled={!editable}
                      onClick={() => setConfirmReset(true)}
                    >
                      Сбросить мои данные
                    </Button>
                  )}
                </div>
                {session && (
                  <p>
                    Ваш учебный сеанс: #{session}. Данные других участников
                    сохраняются.
                  </p>
                )}
              </Panel>
              {result && (
                <Panel
                  title="Результат проверки"
                  subtitle={`Сохранено событий: ${result.events.length}. Связанных инцидентов: ${result.incidents.length}.`}
                >
                  <div className="check-list">
                    {result.steps.map((s: string) => (
                      <p key={s}>
                        <CheckCircle2 size={18} />
                        {s}
                      </p>
                    ))}
                  </div>
                  {result.incidents.map((id: number) => (
                    <Button key={id} onClick={() => setSelected(id)}>
                      Открыть инцидент #{id} <ArrowUpRight size={16} />
                    </Button>
                  ))}
                </Panel>
              )}
              <Panel
                title="Ваши результаты"
                subtitle="Можно вернуться к расследованию после перезагрузки страницы"
              >
                <IncidentTable
                  items={(incidents.data || []).filter(
                    (i: Row) => i.demo_id === session,
                  )}
                />
              </Panel>
            </>
          )}
          {page === "reports" && (
            <Panel
              title="Сохранённые отчёты"
              subtitle="Снимок инцидента на момент формирования; PDF поддерживает русский текст"
            >
              {data.data?.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Отчёт</th>
                        <th>Инцидент</th>
                        <th>Создан</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((r: Row) => (
                        <tr key={r.id}>
                          <td>Отчёт #{r.id}</td>
                          <td>{r.snapshot.title}</td>
                          <td>{date(r.created)}</td>
                          <td>
                            <Button asChild variant="outline">
                              <a href={`/api/v1/reports/${r.id}/pdf`}>
                                <Download size={16} /> Скачать PDF
                              </a>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty text="Откройте инцидент и нажмите «Сформировать PDF»." />
              )}
            </Panel>
          )}
          {page === "users" &&
            (isAdmin ? (
              <UsersWorkspace
                currentUser={user}
                onChanged={() =>
                  api("/auth/me")
                    .then(setUser)
                    .catch(() => setUser(null))
                }
              />
            ) : (
              <Empty text="Управление пользователями доступно администратору." />
            ))}
          {page === "audit" && (
            <Panel
              title="История действий"
              action={
                <span
                  className={"badge " + (integrity.data?.valid ? "" : "red")}
                >
                  {integrity.data?.valid
                    ? "Целостность подтверждена"
                    : "Проверка целостности"}
                </span>
              }
            >
              <table>
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Пользователь</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data?.map((a: Row) => (
                    <tr key={a.id}>
                      <td>{date(a.time)}</td>
                      <td>#{a.actor_id}</td>
                      <td>{a.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
          {page === "settings" && data.data && (
            <Panel title="Настройки учебного центра">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  act(() =>
                    api("/settings", "PUT", {
                      organization: f.get("organization"),
                      simple_mode: f.get("simple_mode") === "on",
                    }),
                  );
                }}
              >
                <label>
                  Название центра
                  <input
                    name="organization"
                    defaultValue={data.data.organization}
                    required
                    maxLength={150}
                    disabled={!isAdmin}
                  />
                </label>
                <label className="checkbox">
                  <input
                    name="simple_mode"
                    type="checkbox"
                    defaultChecked={data.data.simple_mode}
                    disabled={!isAdmin}
                  />{" "}
                  Простой режим по умолчанию
                </label>
                <p>Контур: синтетический. Реальные устройства не подключены.</p>
                <Button disabled={!isAdmin || busy}>Сохранить настройки</Button>
              </form>
            </Panel>
          )}
          {page === "settings" && (
            <>
              <MyConnection
                person={user}
                onChanged={() =>
                  api("/auth/me")
                    .then(setUser)
                    .catch(() => setUser(null))
                }
              />
              {isAdmin && <AccessPolicy />}
            </>
          )}
          {page === "help" && (
            <>
              <VisualGuide onNavigate={navigate} />
              <div className="chart-grid">
                <Panel title="Первые шаги сотрудника">
                  <p>
                    Нажмите на любой блок схемы выше: появится подсказка и
                    кнопка перехода к нужному разделу. В учебном полигоне можно
                    раскрыть каждое событие и сразу открыть расследование.
                  </p>
                  <Button onClick={() => navigate("/commission")}>
                    Начать пошаговую проверку
                  </Button>
                </Panel>
                <Panel title="Как понимать результаты">
                  <p>
                    <b>Событие</b> — зарегистрированное действие учебного
                    устройства.
                  </p>
                  <p>
                    <b>Инцидент</b> — группа событий, удовлетворяющих правилу
                    обнаружения.
                  </p>
                  <p>
                    <b>Риск</b> — объяснимая оценка 0–100; это не вероятность
                    реальной атаки.
                  </p>
                  <p>
                    <b>Аномалия</b> — отличие от синтетического профиля
                    машинного обучения.
                  </p>
                  <p>
                    Технический режим в верхней панели показывает типы событий и
                    параметры модели.
                  </p>
                </Panel>
              </div>
            </>
          )}
        </main>
        <footer>
          AegisBorder SOC · Command Center 0.3{" "}
          <span>
            Локальная демонстрационная система · Только синтетические данные
          </span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {notice}
          <button className="icon-btn" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      <Dialog
        title={"Инцидент #" + selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      >
        {notice && <p role="status">{notice}</p>}
        {details.error ? (
          <p className="error">{details.error.message}</p>
        ) : details.data ? (
          <IncidentDetail
            item={details.data}
            user={user}
            technical={technical}
            busy={busy}
            act={act}
          />
        ) : (
          <p>Загрузка карточки…</p>
        )}
      </Dialog>
      <Dialog
        title="Настройка правила"
        open={!!editRule}
        onClose={() => setEditRule(null)}
      >
        {editRule && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              act(async () => {
                await api("/detection-rules/" + editRule.id, "PATCH", {
                  threshold: Number(f.get("threshold")),
                  window: Number(f.get("window")),
                  risk: Number(f.get("risk")),
                  enabled: f.get("enabled") === "on",
                });
                setEditRule(null);
              });
            }}
          >
            <p>{editRule.name}</p>
            {[
              ["threshold", "Порог", 1, 1000],
              ["window", "Окно, секунд", 10, 3600],
              ["risk", "Базовый риск", 1, 100],
            ].map(([key, label, min, max]) => (
              <label key={key}>
                {label}
                <input
                  name={key as string}
                  type="number"
                  defaultValue={editRule[key]}
                  min={Number(min)}
                  max={Number(max)}
                  required
                />
              </label>
            ))}
            <label className="checkbox">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={editRule.enabled}
              />{" "}
              Включено
            </label>
            <Button disabled={busy}>Сохранить правило</Button>
          </form>
        )}
      </Dialog>
      <Dialog
        title="Личная карточка"
        open={!!editUser}
        onClose={() => setEditUser(null)}
      >
        {editUser && (
          <ProfileEditor
            key={editUser.id}
            userId={editUser.id}
            admin={!!isAdmin}
            onChanged={() =>
              api("/auth/me")
                .then(setUser)
                .catch(() => setUser(null))
            }
          />
        )}
      </Dialog>
      <Dialog
        title="Сброс собственных учебных данных"
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
      >
        <p>
          Будут удалены события, инциденты и отчёты только выбранного сеанса #
          {session}. История действий сохранится.
        </p>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() =>
            act(async () => {
              await api(`/demo-sessions/${session}/reset`, "POST", {});
              setConfirmReset(false);
              setResult(null);
            }, "Ваш учебный сеанс очищен")
          }
        >
          Подтвердить сброс
        </Button>
      </Dialog>
    </div>
  );
}

function IncidentDetail({
  item,
  user,
  technical,
  busy,
  act,
}: {
  item: Row;
  user: Row;
  technical: boolean;
  busy: boolean;
  act: (work: () => Promise<any>, message?: string) => Promise<any>;
}) {
  const [comment, setComment] = useState(""),
    [conclusion, setConclusion] = useState(item.conclusion || ""),
    [checks, setChecks] = useState<string[]>(
      item.investigation?.checklist || [],
    );
  useEffect(() => {
    setConclusion(item.conclusion || "");
    setChecks(item.investigation?.checklist || []);
  }, [item.id, item.conclusion, item.investigation?.checklist]);
  const canEdit = user.role !== "observer";
  const operators = useQuery({
    queryKey: ["operators"],
    queryFn: () => api("/operators"),
  });
  const [eventId, setEventId] = useState("");
  return (
    <div className="incident-detail">
      <div className="row between">
        <div>
          <h2>{item.title}</h2>
          <p>
            {item.device} · {item.account}
          </p>
        </div>
        <Risk value={item.risk} />
      </div>
      <div className="explanation">
        <ShieldAlert size={22} />
        <div>
          <b>Почему система создала предупреждение</b>
          <p>{item.explanation}</p>
        </div>
      </div>
      <div className="row wrap">
        <span className="badge">{item.status}</span>
        {canEdit &&
          (nextStatus[item.status] || []).map((s) => (
            <Button
              key={s}
              variant="outline"
              disabled={busy}
              onClick={() =>
                act(() => api("/incidents/" + item.id, "PATCH", { status: s }))
              }
            >
              {s}
            </Button>
          ))}
        {canEdit && (
          <Button
            variant="outline"
            onClick={() =>
              act(() =>
                api("/incidents/" + item.id, "PATCH", { assignee_id: user.id }),
              )
            }
          >
            Назначить себя
          </Button>
        )}
      </div>
      {canEdit && (
        <div className="row">
          <label>
            Ответственный
            <select
              aria-label="Ответственный"
              value={item.assignee_id || ""}
              onChange={(e) =>
                act(() =>
                  api("/incidents/" + item.id, "PATCH", {
                    assignee_id: e.target.value ? Number(e.target.value) : null,
                  }),
                )
              }
            >
              <option value="">Не назначен</option>
              {operators.data?.map((u: Row) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <h3>Хронология событий</h3>
      <EventTable items={item.events} technical={technical} />
      {canEdit && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await api(`/incidents/${item.id}/events/${eventId}`, "POST", {});
              setEventId("");
            });
          }}
        >
          <input
            aria-label="ID связанного события"
            type="number"
            min={1}
            placeholder="ID дополнительного события"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            required
          />
          <Button disabled={busy}>Связать событие</Button>
        </form>
      )}
      <h3>Расследование</h3>
      {item.recommendations.map((r: string) => (
        <label className="checkbox" key={r}>
          <input
            type="checkbox"
            checked={checks.includes(r)}
            disabled={!canEdit}
            onChange={(e) =>
              setChecks(
                e.target.checked
                  ? [...checks, r]
                  : checks.filter((x) => x !== r),
              )
            }
          />
          {r}
        </label>
      ))}
      <label>
        Вывод оператора
        <textarea
          aria-label="Вывод оператора"
          rows={3}
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          disabled={!canEdit}
        />
      </label>
      {canEdit && (
        <Button
          disabled={busy}
          onClick={() =>
            act(() =>
              api(`/incidents/${item.id}/investigation`, "PUT", {
                conclusion,
                checklist: checks,
              }),
            )
          }
        >
          Сохранить расследование
        </Button>
      )}
      <h3>Комментарии</h3>
      {item.comments.map((c: Row) => (
        <div className="comment" key={c.id}>
          <small>
            Пользователь #{c.author_id} · {date(c.created)}
          </small>
          <p>{c.text}</p>
        </div>
      ))}
      {canEdit && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await api(`/incidents/${item.id}/comments`, "POST", {
                text: comment,
              });
              setComment("");
            });
          }}
        >
          <input
            aria-label="Комментарий"
            placeholder="Добавить комментарий…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            maxLength={5000}
          />
          <Button disabled={busy}>Добавить</Button>
        </form>
      )}
      <h3>История изменений</h3>
      {item.history.length ? (
        item.history.map((h: Row) => (
          <p key={h.id}>
            {date(h.created)} · {h.action}
          </p>
        ))
      ) : (
        <p>Статус ещё не изменялся.</p>
      )}
      {canEdit && (
        <Button
          disabled={busy}
          onClick={() =>
            act(async () => {
              const r = await api("/reports/" + item.id, "POST", {});
              window.open(`/api/v1/reports/${r.id}/pdf`, "_blank", "noopener");
              return r;
            }, "PDF-отчёт сохранён. Он доступен в разделе «Отчёты».")
          }
        >
          <FileText size={17} /> Сформировать PDF
        </Button>
      )}
    </div>
  );
}
