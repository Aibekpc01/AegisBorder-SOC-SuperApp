/* Назначение файла: Собирает защищённую оболочку, вход, навигацию и рабочие экраны. Учитывает состояние сеанса и требования DLP.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
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
  RefreshCw,
  LockKeyhole,
  Layers,
  Menu,
  X,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import { api, type Row } from "./api";
import { date, roles, statuses, nextStatus, riskLabel } from "./lib/utils";
import { BlockGuide } from "./components/block-guide";
import {
  ProfileEditor,
  UserAvatar,
  MyConnection,
} from "./components/user-profiles";
import { AccessPolicy } from "./components/access-policy";
import { EventTable } from "./components/event-table";
import { TrainingLab } from "./components/training-lab";
import {
  DemonstrationLanding,
  LearningCenter,
} from "./components/project-experience";
import { ThemeToggle } from "./components/theme-toggle";
import { AppTools } from "./components/app-tools";
import { appPath, appPage, queryId, extendedPages } from "./lib/routes";
import { Emblem, EmblemPair } from "./components/emblems";
import { ModuleMenu } from "./components/module-menu";
import { InvestigationGraph } from "./components/investigation-graph";
import { PagePrimer, PlainLanguageHelp } from "./components/beginner-help";
import { explainers } from "./lib/explainers";
import { UltraDashboard } from "./components/ultra-dashboard";
import { UltraIncidents } from "./components/ultra-incidents";
import { BRAND_NAME, BRAND_TAGLINE } from "./lib/brand";
import {
  UltraIntro,
  DigitalCore,
  PresentationMode,
} from "./components/ultra-visuals";
import {
  PresenceSignal,
  Participants,
  Devices,
  DemoWelcome,
} from "./components/presence-workspace";
import {
  CyberNews,
  DashboardWelcome,
  ExperienceSlides,
  PersonalExperience,
  ReportsCenter,
  ServiceWorkflow,
} from "./components/supper-experience";
import { DlpRequired } from "./components/dlp-required";
import { proveLocalDlp } from "./lib/dlp-proof";
import { DlpWorkspace } from "./components/dlp-workspace";
import { AccessConsole } from "./components/governance-console";
import { AutomaticLocation } from "./components/automatic-location";
const Workspace = React.lazy(() =>
  import("./components/workspace").then((module) => ({
    default: module.Workspace,
  })),
);
const SuperappModules = React.lazy(() =>
  import("./components/superapp-modules").then((module) => ({
    default: module.SuperappModules,
  })),
);

const pages = [
  ["dlp", "Aegis DLP", ShieldAlert],
  ["", "Главная панель", LayoutDashboard],
  ["events", "Мониторинг событий", Activity],
  ["incidents", "Центр инцидентов", ShieldAlert],
  ["analysis", "Умный анализ", BrainCircuit],
  ["anomalies", "Обнаружение аномалий", ScanLine],
  ["assets", "Устройства", Monitor],
  ["scenarios", "Учебные сценарии", FlaskConical],
  ["investigations", "Расследования", Search],
  ["reports", "Отчёты", FileText],
  ["workspace", "Документы и рабочее пространство", FileText],
  ["users", "Пользователи и роли", Users],
  ["audit", "История действий", History],
  ["settings", "Настройки", Settings],
  ["help", "Справка и обучение", BookOpen],
  ["commission", "Демонстрация проекта", Presentation],
  ["team", "Чат", Users],
  ["participants", "Сотрудники", Users],
  ["development", "Развитие SuperApp", Layers],
  ["assistant", "Aegis AI", BrainCircuit],
  ["mail", "Почтовая безопасность", ShieldAlert],
  ["m365", "Безопасность Office 365", Monitor],
  ["twin", "Цифровой двойник", Layers],
  ["tasks", "Задачи и согласования", FileText],
  ["integrations", "Центр интеграций", Layers],
  ["rule-builder", "Конструктор правил", Settings],
  ["academy", "Академия безопасности", BookOpen],
  ["scenario-builder", "Конструктор сценариев", FlaskConical],
  ["security-analytics", "Аналитика безопасности", Activity],
] as const;
const navigationGroups = [
  {
    title: "Начните здесь",
    paths: ["", "commission", "scenarios", "academy", "help"],
  },
  {
    title: "Ситуации и проверка",
    paths: ["incidents", "events", "investigations", "assistant", "mail"],
  },
  {
    title: "Работа и результаты",
    paths: [
      "workspace",
      "tasks",
      "team",
      "participants",
      "reports",
      "security-analytics",
    ],
  },
  {
    title: "Устройства и источники",
    paths: ["assets", "dlp", "twin", "m365", "integrations"],
  },
  {
    title: "Правила и управление",
    paths: [
      "analysis",
      "anomalies",
      "rule-builder",
      "scenario-builder",
      "users",
      "audit",
      "settings",
      "development",
    ],
  },
];
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
      className="risk-display"
      title="Оценка важности проверки по правилам. Не вероятность атаки."
    >
      <span
        className={
          "risk " + (value >= 85 ? "critical" : value >= 65 ? "high" : "medium")
        }
      >
        {value} <small>/100</small>
      </span>
      <span className="risk-meaning">{riskLabel(value)}</span>
    </span>
  );
}
export default function App() {
  const [navOpen, setNavOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [user, setUser] = useState<Row | null>(null),
    [ready, setReady] = useState(false),
    [technical, setTechnical] = useState(false),
    [navSearch, setNavSearch] = useState(""),
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
  useEffect(() => {
    const resize = () => {
      if (window.innerWidth <= 1000) setCollapsedGroups([]);
    };
    const shortcuts = (event: KeyboardEvent) => {
      if (
        !user ||
        event.repeat ||
        (event.target instanceof HTMLElement &&
          (event.target.matches("input,textarea,select") ||
            event.target.isContentEditable))
      )
        return;
      const destination = event.altKey
        ? (
            { "1": "", "2": "incidents", "3": "assistant" } as Record<
              string,
              string
            >
          )[event.key]
        : undefined;
      if (destination !== undefined) {
        event.preventDefault();
        routerNavigate(appPath(destination));
      }
    };
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", shortcuts);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", shortcuts);
    };
  }, [routerNavigate, user]);
  const editable =
      !!user &&
      !["observer", "demo_viewer"].includes(user.access_role || user.role),
    isAdmin = (user?.access_role || user?.role) === "admin";
  const dlpAccess = useQuery<Row>({
    queryKey: ["dlp-access", user?.id],
    queryFn: () => api("/dlp/access"),
    enabled: !!user,
    refetchInterval: 5000,
    retry: false,
  });
  // DLP по умолчанию не требуется: интерфейс открыт сразу, а для пользователей с назначенным
  // требованием сервер отвечает 428 — тогда проверка обновится и покажется экран подключения агента.
  const workAllowed = !!user && dlpAccess.data?.compliant !== false;
  useEffect(() => {
    const required = () => {
      void client.invalidateQueries({ queryKey: ["dlp-access"] });
    };
    window.addEventListener("aegis-dlp-required", required);
    return () => window.removeEventListener("aegis-dlp-required", required);
  }, [client]);
  useEffect(() => {
    if (!user || !dlpAccess.data?.required || !workAllowed) return;
    const refresh = () => {
      void proveLocalDlp().catch(() => {});
    };
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [user, workAllowed, dlpAccess.data?.required]);
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
    setNavOpen(false);
    setOffset(0);
    window.scrollTo(0, 0);
  }, [page, location.search]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!user || !workAllowed) return;
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
  }, [user, client, workAllowed]);
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
    enabled: workAllowed,
    refetchInterval: 15000,
  });
  const authOptions = useQuery({
    queryKey: ["auth-options"],
    queryFn: () => api<{ public_demo: boolean }>("/auth/options"),
  });
  const preferences = useQuery({
    queryKey: ["preferences"],
    queryFn: () => api("/settings"),
    enabled: workAllowed,
  });
  useEffect(() => {
    if (preferences.data) setTechnical(!preferences.data.simple_mode);
  }, [preferences.data]);
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api("/dashboard"),
    enabled: workAllowed && page === "",
  });
  const eventQuery = useQuery({
    queryKey: ["events", q, filter, offset],
    queryFn: () =>
      api(
        `/events?q=${encodeURIComponent(q)}&severity=${encodeURIComponent(filter)}&offset=${offset}`,
      ),
    enabled:
      workAllowed && (page === "events" || page === "" || page === "assets"),
  });
  const incidents = useQuery({
    queryKey: ["incidents", q, filter],
    queryFn: () =>
      api(
        `/incidents?q=${encodeURIComponent(q)}&status=${encodeURIComponent(filter)}`,
      ),
    enabled:
      workAllowed &&
      ["", "incidents", "investigations", "commission"].includes(page),
  });
  const details = useQuery({
    queryKey: ["incident", selected],
    queryFn: () => api("/incidents/" + selected),
    enabled: workAllowed && selected !== null,
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
    enabled: workAllowed && !!paths[page] && (page !== "users" || !!isAdmin),
  });
  const demos = useQuery({
    queryKey: ["demo-sessions"],
    queryFn: () => api("/demo-sessions"),
    enabled: workAllowed && ["commission", "scenarios"].includes(page),
  });
  const integrity = useQuery({
    queryKey: ["integrity"],
    queryFn: () => api("/audit/verify"),
    enabled: workAllowed && page === "audit",
  });
  useEffect(() => {
    if (demos.data?.length && !session) setSession(demos.data[0].id);
  }, [demos.data, session]);
  async function run(id: string, commission = false) {
    return await act(async () => {
      let demoId = session;
      if (
        (commission || ["demo", "demo_viewer"].includes(user?.role || "")) &&
        !demoId
      ) {
        const d = await api("/demo-sessions", "POST", {});
        demoId = d.id;
        setSession(d.id);
      }
      const r = await api("/scenarios/" + id, "POST", {
        demo_id:
          commission || ["demo", "demo_viewer"].includes(user?.role || "")
            ? demoId
            : null,
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
          <EmblemPair className="login-emblems" />
          <h1>
            AegisBorder <span>SuperApp</span>
          </h1>
          <p>{BRAND_TAGLINE}</p>
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
          <span className="eyebrow">
            AegisBorder SuperApp / ЗАЩИЩЁННЫЙ ДОСТУП
          </span>
          <h2>Добро пожаловать</h2>
          <p>Войдите, чтобы открыть центр управления.</p>
          <label>
            Имя пользователя
            <input
              name="username"
              defaultValue={authOptions.data?.public_demo ? "" : "admin"}
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
          {authOptions.data?.public_demo && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const r = await api("/auth/demo-viewer", "POST");
                  client.clear();
                  setSession(null);
                  setUser(r);
                }, "Демонстрационный просмотр открыт")
              }
            >
              Открыть демонстрационный просмотр
            </Button>
          )}
          {authOptions.data?.public_demo && (
            <>
              <hr />
              <p>
                Первый раз здесь? Откройте личную тренировку без регистрации.
                Ваши учебные события будут видны только вам.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const r = await api("/auth/demo", "POST");
                    client.clear();
                    setSession(null);
                    setUser(r);
                  }, "Личная тренировка открыта")
                }
              >
                Попробовать без регистрации
              </Button>
              <small>
                Демонстрационный сеанс действует два часа. Для нового посещения
                можно открыть новую тренировку.
              </small>
            </>
          )}
          <NavLink to="/" className="login-home">
            Вернуться на главную страницу
          </NavLink>
        </form>
      </div>
    );
  if (!workAllowed)
    return (
      <DlpRequired
        user={user}
        onLogout={() => {
          void api("/auth/logout", "POST", {}).then(() => {
            setUser(null);
            client.clear();
          });
        }}
      />
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
    <div
      className={`shell ${navOpen ? "ultra-nav-open" : ""}`}
      data-experience={technical ? "technical" : "simple"}
    >
      <UltraIntro />
      <button
        className="ultra-mobile-nav"
        aria-label={navOpen ? "Закрыть навигацию" : "Открыть навигацию"}
        aria-expanded={navOpen}
        onClick={() => setNavOpen(!navOpen)}
      >
        {navOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <aside>
        <NavLink className="brand" to="/app">
          <div className="brand-icon">
            <Emblem kind="border" />
          </div>
          <div>
            AegisBorder <strong>SuperApp</strong>
            <small className="brand-mission">{BRAND_TAGLINE}</small>
          </div>
        </NavLink>
        <label className="sidebar-search">
          <Search size={16} />
          <input
            aria-label="Найти раздел"
            placeholder="Найти раздел…"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
          />
        </label>
        <nav aria-label="Разделы приложения">
          {navigationGroups.map((group) => {
            const links = pages.filter(
              ([path, label]) =>
                group.paths.includes(path) &&
                (path !== "dlp" || user.permissions?.dlp) &&
                (isAdmin ||
                  !["users", "rule-builder"].includes(path) ||
                  (path === "users" && user.permissions?.manage_users)) &&
                (label + " " + (explainers[path]?.description || ""))
                  .toLocaleLowerCase("ru")
                  .includes(navSearch.toLocaleLowerCase("ru")),
            );
            return links.length ? (
              <section className="sidebar-nav-group" key={group.title}>
                <h2>
                  <button
                    className="ultra-nav-group-toggle"
                    aria-expanded={
                      !!navSearch || !collapsedGroups.includes(group.title)
                    }
                    onClick={() =>
                      setCollapsedGroups(
                        collapsedGroups.includes(group.title)
                          ? collapsedGroups.filter((g) => g !== group.title)
                          : [...collapsedGroups, group.title],
                      )
                    }
                  >
                    {group.title}
                    <ChevronRight size={11} />
                  </button>
                </h2>
                {(navSearch || !collapsedGroups.includes(group.title)) &&
                  links.map(([path, label, Icon]) => (
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
              </section>
            ) : null;
          })}
          {!pages.some(([path, label]) =>
            (label + " " + (explainers[path]?.description || ""))
              .toLocaleLowerCase("ru")
              .includes(navSearch.toLocaleLowerCase("ru")),
          ) && (
            <p className="sidebar-search-empty">
              Раздел не найден. Попробуйте другое слово.
            </p>
          )}
        </nav>
        <button
          className="ultra-intro-replay"
          onClick={() => window.dispatchEvent(new Event("aegis-replay-intro"))}
        >
          <Play size={12} /> Повторить вступление
        </button>
        <div className="sidebar-bottom">
          <Emblem kind="knb" className="sidebar-knb" />
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
            <PlainLanguageHelp />
            <ModuleMenu compact />
            <span
              className={
                health.isSuccess ? "system-status" : "system-status offline"
              }
            >
              <span className="online-dot" />{" "}
              {health.isSuccess ? "Система активна" : "Нет подключения"}
            </span>
            <button
              className="mode"
              aria-pressed={!technical}
              title="В простом режиме показаны пояснения и пошаговые подсказки"
              onClick={() => setTechnical(!technical)}
            >
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
                <small>
                  {user.role_label || roles[user.role] || user.role}
                </small>
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
          {user.role === "demo_viewer" && (
            <div className="ultra-viewer-banner">
              <Shield size={16} />
              <span>
                Демонстрационный просмотр. Постоянные данные защищены; учебные
                сценарии выполняются в вашем сеансе.
              </span>
              <NavLink to="/app/commission">Начать показ →</NavLink>
            </div>
          )}
          {user.role !== "demo_viewer" && (
            <AutomaticLocation userId={user.id} />
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                AegisBorder SuperApp / ЦЕНТР КИБЕРЗАЩИТЫ
              </span>
              <h1>{title}</h1>
              {page === "commission" && (
                <EmblemPair className="commission-emblems" />
              )}
              <p>
                {explainers[page]?.description ||
                  "Обнаружение, анализ и расследование на основе учебных событий."}
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
          <PresenceSignal userId={user.id} />
          {page === "" && ["demo", "demo_viewer"].includes(user.role) && (
            <DemoWelcome />
          )}
          {page === "" && dashboard.isPending && (
            <div
              className="ultra-skeleton-grid"
              role="status"
              aria-label="Загрузка оперативной сводки"
            >
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  <span />
                  <b />
                  <span />
                </div>
              ))}
            </div>
          )}
          {page !== "" &&
            ![
              "commission",
              "help",
              "academy",
              "team",
              "development",
              "scenarios",
              "workspace",
              "tasks",
              "security-analytics",
              "settings",
            ].includes(page) && (
              <PagePrimer page={page} technical={technical} />
            )}
          <PersonalExperience key={user.id} userId={user.id} page={page} />
          <ServiceWorkflow page={page} />
          {page === "development" && <ExperienceSlides mode="evolution" />}
          {page === "commission" && <ExperienceSlides mode="demo" />}
          {page === "scenarios" && <ExperienceSlides mode="training" />}
          {page === "" && <DashboardWelcome />}
          {extendedPages.includes(page) && (
            <React.Suspense fallback={<p role="status">Загрузка модуля…</p>}>
              <SuperappModules
                key={page}
                page={page}
                user={{ id: user.id, role: user.access_role || user.role }}
              />
            </React.Suspense>
          )}
          {page === "workspace" && (
            <React.Suspense
              fallback={<p role="status">Загрузка рабочего пространства…</p>}
            >
              <Workspace
                key={location.search}
                user={{ ...user, role: user.access_role || user.role }}
                initialDocument={queryId(location.search, "document")}
                initialIncident={queryId(location.search, "incident")}
              />
            </React.Suspense>
          )}
          {page === "" && dashboard.data && (
            <UltraDashboard
              dashboard={dashboard.data}
              incidents={incidents.data || []}
              events={eventQuery.data?.items || []}
              health={health.data}
              userId={user.id}
              onIncident={setSelected}
            />
          )}
          {page === "" && <CyberNews />}
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
                        {eventQuery.data?.total ? offset + 1 : 0}–
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
                  <UltraIncidents
                    items={incidents.data || []}
                    onOpen={setSelected}
                  />
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
              <DigitalCore
                state={
                  busy
                    ? "working"
                    : data.data?.[0]?.results?.some((r: Row) => r.anomaly)
                      ? "anomaly"
                      : data.data?.length
                        ? "complete"
                        : "idle"
                }
              />
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
          {page === "dlp" &&
            (user.permissions?.dlp ? (
              <DlpWorkspace />
            ) : (
              <Empty text="Aegis DLP: access restricted" />
            ))}
          {page === "" && user.permissions?.dlp && (
            <div className="info-box">
              <ShieldAlert size={24} />
              <div>
                <b>Aegis DLP · защита ПК</b>
                <p>
                  Подключите Windows-компьютер и следите за состоянием агента и
                  защиты.
                </p>
              </div>
              <Link className="btn btn-primary" to="/app/dlp">
                Открыть DLP
              </Link>
            </div>
          )}
          {page === "assets" && <Devices />}
          {page === "participants" && <Participants admin={isAdmin} />}
          {page === "scenarios" && (
            <TrainingLab
              scenarios={data.data || []}
              busy={busy}
              canRun={editable || user.role === "demo_viewer"}
              onRun={(id) => run(id, true)}
              onOpenIncident={setSelected}
              onNavigate={navigate}
            />
          )}
          {page === "commission" && <PresentationMode />}
          {page === "commission" && (
            <DemonstrationLanding
              scenarios={data.data || []}
              scenario={scenario}
              onSelect={(id) => {
                setScenario(id);
                setResult(null);
              }}
              onRun={() => run(scenario, true)}
              onNewSession={() =>
                act(async () => {
                  const demo = await api("/demo-sessions", "POST", {});
                  setSession(demo.id);
                  setResult(null);
                }, "Создан отдельный учебный сеанс")
              }
              onReset={() => setConfirmReset(true)}
              onIncident={setSelected}
              canRun={editable || user.role === "demo_viewer"}
              canReset={user.role !== "demo_viewer"}
              busy={busy}
              session={session}
              progress={
                demos.data?.find((demo: Row) => demo.id === session)
                  ?.progress || 0
              }
              result={
                result as {
                  events: number[];
                  incidents: number[];
                  steps: string[];
                  run_id: number;
                } | null
              }
            >
              <IncidentTable
                items={(session ? incidents.data || [] : []).filter(
                  (incident: Row) => incident.demo_id === session,
                )}
              />
            </DemonstrationLanding>
          )}
          {page === "reports" && (
            <ReportsCenter
              canCreate={editable || user.role === "demo_viewer"}
              onIncident={setSelected}
            />
          )}
          {page === "users" &&
            (user.permissions?.manage_users ? (
              <AccessConsole
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
                <p>
                  События обнаружения — учебные. Раздел «Устройства» показывает
                  реальные подключения браузеров к сайту.
                </p>
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
          {page === "help" && <LearningCenter onNavigate={navigate} />}
        </main>
        <footer>
          {BRAND_NAME} <span>{BRAND_TAGLINE}</span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {notice}
          <button
            className="icon-btn"
            aria-label="Закрыть уведомление"
            onClick={() => setNotice("")}
          >
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
  const canEdit = !["observer", "demo_viewer"].includes(
    user.access_role || user.role,
  );
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
      <InvestigationGraph key={item.id} incident={item} technical={technical} />
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
