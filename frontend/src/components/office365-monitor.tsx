/* Назначение файла: Мониторинг безопасности Office 365 — почта Exchange/Outlook, SharePoint, OneDrive, Teams,
 * Entra ID и Purview DLP. Данные: GET /api/v1/superapp/m365; обновление каждые 15 секунд.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Cloud,
  KeyRound,
  Mail,
  MessagesSquare,
  Radio,
  ShieldCheck,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api";
import { date } from "../lib/utils";
import { EventTable } from "./event-table";
import "../styles/office365.css";

type MonitorEvent = {
  id: number;
  external_id: string;
  time: string;
  device: string;
  account: string;
  source: string;
  type: string;
  detail: string;
  severity: string;
  features: Record<string, unknown>;
};
type Monitor = {
  connected: boolean;
  mode: "live" | "imported-synthetic";
  last_received: string | null;
  receivers: number;
  events: MonitorEvent[];
  accounts: number;
  workloads: { id: string; label: string; events: number }[];
  rules: { id: string; name: string; description: string; risk: number; enabled: boolean }[];
};

const icons: Record<string, LucideIcon> = {
  Exchange: Mail,
  SharePoint: Share2,
  OneDrive: Cloud,
  MicrosoftTeams: MessagesSquare,
  AzureActiveDirectory: KeyRound,
  SecurityComplianceCenter: ShieldCheck,
};

/** Что именно отслеживается в каждом сервисе — показывается под счётчиком. */
const watched: Record<string, string> = {
  Exchange: "Пересылка, отправка архивов наружу, экспорт ящиков, массовое чтение и удаление писем",
  SharePoint: "Скачивание и выгрузка архивов, внешние и анонимные ссылки",
  OneDrive: "Скачивание и выгрузка архивов, внешние и анонимные ссылки",
  MicrosoftTeams: "Внешние гости в командах",
  AzureActiveDirectory: "Неудачные входы и изменения каталога",
  SecurityComplianceCenter: "Срабатывания DLP и экспорт eDiscovery",
};

export function Office365Monitor() {
  const monitor = useQuery({
    queryKey: ["superapp-m365"],
    queryFn: () => api<Monitor>("/superapp/m365"),
    refetchInterval: 15_000,
  });
  const data = monitor.data;
  return (
    <div className="o365">
      <div className="o365-head">
        <div>
          <span className="eyebrow">Microsoft 365 · Office 365</span>
          <h2>Безопасность почты, файлов и совместной работы</h2>
          <p>
            Единый журнал аудита Office 365: письма Outlook, архивы в SharePoint и OneDrive, команды Teams,
            входы Entra ID и DLP. Правила ниже превращают подозрительные действия в инциденты с объяснением.
          </p>
        </div>
        <div className={"o365-status" + (data?.connected ? " is-live" : "")} role="status">
          <Radio size={16} />
          <div>
            <b>{data?.connected ? "Поток событий активен" : "Поток не подключён"}</b>
            <small>
              {data?.last_received
                ? "Последние данные: " + date(data.last_received)
                : data
                  ? "Показаны импортированные учебные записи"
                  : "Проверка…"}
            </small>
          </div>
        </div>
      </div>

      {monitor.error && (
        <p role="alert" className="error-box">
          {(monitor.error as Error).message}
        </p>
      )}

      <div className="o365-services">
        {(data?.workloads ?? Object.keys(icons).map((id) => ({ id, label: id, events: 0 }))).map((w) => {
          const Icon = icons[w.id] ?? ShieldCheck;
          return (
            <article key={w.id} className="o365-service">
              <div className="o365-service-top">
                <span className="o365-service-icon">
                  <Icon size={18} />
                </span>
                <strong>{data ? w.events : "—"}</strong>
              </div>
              <h3>{w.label}</h3>
              <p>{watched[w.id]}</p>
            </article>
          );
        })}
      </div>

      <section className="o365-rules" aria-labelledby="o365-rules-title">
        <div className="row between">
          <h3 id="o365-rules-title">Правила защиты Office 365</h3>
          <Link className="btn btn-ghost" to="/app/analysis">
            Настроить пороги
          </Link>
        </div>
        <ul>
          {data?.rules.map((r) => (
            <li key={r.id} className={r.enabled ? "" : "is-off"}>
              <span className={"o365-risk " + (r.risk >= 80 ? "critical" : r.risk >= 65 ? "high" : "medium")}>
                {r.risk}
              </span>
              <div>
                <b>{r.name}</b>
                <small>{r.description}</small>
              </div>
              <span className="badge">{r.enabled ? "Включено" : "Выключено"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="o365-feed-title">
        <div className="row between">
          <h3 id="o365-feed-title">
            Лента событий {data && <small>· {data.events.length} записей, {data.accounts} учётных записей</small>}
          </h3>
          <Link className="btn btn-outline" to="/app/integrations">
            Подключить Office 365
          </Link>
        </div>
        {monitor.isPending && <p role="status">Загрузка событий…</p>}
        {data && <EventTable items={data.events} technical />}
      </section>

      <details className="o365-howto">
        <summary>Как подключить реальный Office 365</summary>
        <ol>
          <li>В «Центре интеграций» создайте приёмник типа «Microsoft 365 / Office 365» и сохраните ключ.</li>
          <li>
            В Entra ID зарегистрируйте приложение с разрешением Office 365 Management APIs → ActivityFeed.Read
            (и ActivityFeed.ReadDlp для DLP), включите аудит в Microsoft Purview.
          </li>
          <li>
            На сервере интеграции запустите агент <code>scripts/pull_office365_audit.py --watch 60</code>. Он опрашивает
            журнал каждую минуту; задержку появления записей задаёт Microsoft.
          </li>
        </ol>
        <p>Темы и тексты писем не передаются: анализируются только операции, домены адресатов и типы вложений.</p>
      </details>
    </div>
  );
}
