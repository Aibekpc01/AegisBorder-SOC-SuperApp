import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plug, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { Button } from "./ui/button";
import { date } from "../lib/utils";
import "../corporate-integrations.css";

type Provider = {
  id: string;
  name: string;
  purpose: string;
  method: string;
  fields: string;
};
type Connector = {
  id: number;
  name: string;
  provider: string;
  enabled: boolean;
  received: number;
  received_at: string | null;
  state: string;
  endpoint: string;
};
function example(provider: string) {
  const id = "training-" + crypto.randomUUID(),
    time = new Date().toISOString();
  if (provider === "kaspersky")
    return [
      {
        id,
        timestamp: time,
        host: "TRAINING-PC",
        user: "training-user",
        event: "malware_detected",
        detail: "Учебный сигнал антивируса",
      },
    ];
  if (provider === "dlp")
    return [
      {
        event_id: id,
        timestamp: time,
        workstation: "TRAINING-PC",
        user: "training-user",
        action: "file_copy",
        detail: "Учебная проверка копирования",
        features: { files: 1000 },
      },
    ];
  if (provider === "m365")
    return [
      {
        id,
        activityDateTime: time,
        initiatedBy: { user: { userPrincipalName: "training@example.test" } },
        activityDisplayName: "Учебное офисное действие",
      },
    ];
  return [
    {
      external_id: id,
      time,
      device: "TRAINING-PC",
      account: "training-user",
      source: "Corporate training",
      type: "usb_connected",
      detail: "Учебное событие интеграции",
      features: { approved: false },
    },
  ];
}
export function CorporateIntegrations({ role }: { role: string }) {
  const client = useQueryClient(),
    providers = useQuery({
      queryKey: ["connector-providers"],
      queryFn: () => api<Provider[]>("/integrations/providers"),
    }),
    connectors = useQuery({
      queryKey: ["corporate-connectors"],
      queryFn: () => api<Connector[]>("/integrations/connectors"),
      refetchInterval: 15000,
    });
  const [provider, setProvider] = useState("kaspersky"),
    [name, setName] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [token, setToken] = useState(""),
    [payload, setPayload] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const active = connectors.data?.find((c) => c.id === selected),
    admin = role === "admin";
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      await client.invalidateQueries({ queryKey: ["corporate-connectors"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка подключения");
    } finally {
      setBusy(false);
    }
  }
  async function receiver(suffix: string, content?: unknown) {
    if (!active || !token)
      throw new Error("Выберите приёмник и укажите его ключ");
    const response = await fetch(
      `/api/v1/integrations/receivers/${active.id}/${suffix}`,
      {
        method: "POST",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: content === undefined ? undefined : JSON.stringify(content),
      },
    );
    const r = await response.json();
    if (!response.ok) throw new Error(r.detail || "Приёмник вернул ошибку");
    return r;
  }
  function download() {
    if (!active) return;
    const p = providers.data?.find((p) => p.id === active.provider);
    const guide = `# Подключение ${active.name}\n\n${p?.method}\n\n1. Настройте разрешённый экспорт на стороне продукта.\n2. Преобразуйте записи в формат: ${p?.fields}.\n3. POST JSON на ${window.location.origin + active.endpoint}\n4. Заголовок Authorization: Bearer <AEGIS_CONNECTOR_TOKEN>. Храните ключ в окружении или хранилище секретов.\n5. Проверка ключа: POST ${window.location.origin}/api/v1/integrations/receivers/${active.id}/check\n6. Убедитесь, что время поступления обновилось и события видны в мониторинге.\n\nМаксимум 200 событий и 200 КБ. Уникальный ID; время с часовым поясом. Повторы не создают новые записи. Для корпоративного подключения нужен HTTPS.\n\nПример:\n${JSON.stringify(example(active.provider), null, 2)}\n\nПриёмник не устанавливает агент на сторонний сервер, не опрашивает Microsoft Graph и не блокирует устройства. Экспорт и права настраивает администратор продукта. Универсальная совместимость зависит от возможностей экспортирующего агента.\n`;
    const url = URL.createObjectURL(
      new Blob([guide], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegis-connector-${active.id}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className="corporate-integrations"
      aria-label="Подключение корпоративных приложений"
    >
      <header>
        <span className="experience-kicker">
          <Plug size={17} /> ИНТЕГРАЦИИ / ОТ ПРОДУКТА К РЕЗУЛЬТАТУ
        </span>
        <h2>
          Ваши системы.
          <br />
          <em>Единый центр безопасности.</em>
        </h2>
        <p>
          Подключите поток событий от антивируса, DLP или офисных сервисов.
          Aegis принимает записи, проверяет их по правилам и помогает
          расследовать ситуацию.
        </p>
      </header>
      <div className="connector-pipeline">
        <span>Ваш продукт</span>
        <b>→</b>
        <span>Агент экспорта</span>
        <b>→</b>
        <span>
          <ShieldCheck size={20} /> API Aegis
        </span>
        <b>→</b>
        <span>События и инциденты</span>
      </div>
      <p className="connector-note">
        Приёмник — защищённый адрес для записей о действиях. После его создания
        администратор настраивает отправку на стороне продукта. Статус ниже
        подтверждается фактическим поступлением данных.
      </p>
      {(providers.error || connectors.error) && (
        <p role="alert">{(providers.error || connectors.error)?.message}</p>
      )}
      <div className="connector-providers">
        {providers.data?.map((p) => (
          <button
            key={p.id}
            aria-pressed={provider === p.id}
            disabled={busy}
            onClick={() => setProvider(p.id)}
          >
            <Plug size={23} />
            <b>{p.name}</b>
            <span>{p.purpose}</span>
            <small>{p.method}</small>
          </button>
        ))}
      </div>
      {admin ? (
        <form
          className="connector-create"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const c = await api<Connector & { token: string }>(
                "/integrations/connectors",
                "POST",
                { name, provider },
              );
              setSelected(c.id);
              setToken(c.token);
              setName("");
              setPayload("");
              setMessage(
                "Приёмник создан. Ключ показан один раз — сохраните его в защищённом месте.",
              );
            });
          }}
        >
          <label>
            Название подключения
            <input
              aria-label="Название корпоративного подключения"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kaspersky — учебный офис"
            />
          </label>
          <Button disabled={busy}>Создать защищённый приёмник</Button>
        </form>
      ) : (
        <p className="connector-note">
          {role === "demo"
            ? "В публичной тренировке корпоративные подключения выключены. Изучите схему или запустите личный сценарий."
            : "Подключения создаёт администратор. Вы можете просматривать состояние и работать с поступившими событиями."}
        </p>
      )}
      <div className="connector-workspace">
        <nav aria-label="Созданные подключения">
          <h3>Подключения</h3>
          {connectors.isPending && <p>Загрузка…</p>}
          {connectors.data?.map((c) => (
            <button
              key={c.id}
              aria-pressed={selected === c.id}
              disabled={busy}
              onClick={() => {
                setSelected(c.id);
                setToken("");
                setPayload("");
                setError("");
                setMessage("");
              }}
            >
              <b>{c.name}</b>
              <span>{c.state}</span>
              <small>Новых событий: {c.received}</small>
            </button>
          ))}
          {!connectors.isPending && !connectors.data?.length && (
            <p>Пока нет подключений. Выберите продукт и создайте приёмник.</p>
          )}
        </nav>
        <article>
          {active ? (
            <>
              <h3>{active.name}</h3>
              <div className="connector-metrics">
                <span>
                  <small>Состояние</small>
                  <b>{active.state}</b>
                </span>
                <span>
                  <small>Последнее поступление</small>
                  <b>
                    {active.received_at
                      ? date(active.received_at)
                      : "События ещё не поступали"}
                  </b>
                </span>
              </div>
              <ol className="connector-steps">
                <li>
                  <b>Настройте экспорт в продукте</b>
                  <p>
                    {
                      providers.data?.find((p) => p.id === active.provider)
                        ?.method
                    }
                    . Права и формат экспорта зависят от версии продукта.
                  </p>
                  {active.provider === "m365" && <details><summary>Автоматический сбор Microsoft Entra</summary><p>Администратор регистрирует приложение с разрешением AuditLog.Read.All и согласием организации. Агент scripts/pull_m365_audit.py читает журнал и передаёт его в этот приёмник. Tenant, Client ID, секрет Microsoft и ключ Aegis задаются в окружении агента. Первый запуск читает последний час, следующие используют контрольную точку; повторные записи пропускаются.</p><p>Периодический запуск настраивается планировщиком вашей организации. Это журнал Microsoft Entra, а не полный аудит всех приложений Office.</p></details>}
                </li>
                <li>
                  <b>Укажите адрес и ключ</b>
                  <code>{window.location.origin + active.endpoint}</code>
                  <p>
                    POST, JSON, Authorization: Bearer &lt;ключ&gt;. Для
                    корпоративного подключения используйте HTTPS.
                  </p>
                </li>
                <li>
                  <b>Проверьте поступление</b>
                  <p>
                    Проверка ключа подтверждает API. Передача событий
                    подтверждается временем выше и записями в мониторинге.
                  </p>
                </li>
              </ol>
              <Button variant="outline" onClick={download}>
                <Download size={16} /> Скачать инструкцию подключения
              </Button>
              {admin && (
                <>
                  <label className="connector-key">
                    Ключ приёмника
                    <input
                      aria-label="Ключ приёмника"
                      type="password"
                      value={token}
                      autoComplete="off"
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Укажите сохранённый ключ"
                    />
                  </label>
                  <p className="connector-note">
                    Ключ не сохраняется в браузере и не возвращается в списке.
                    Для повторного доступа к утраченному ключу выпустите новый.
                  </p>
                  <div className="row wrap">
                    <Button
                      variant="outline"
                      disabled={busy || !token || !active.enabled}
                      onClick={() =>
                        void run(async () => {
                          const r = await receiver("check");
                          setMessage(r.message);
                        })
                      }
                    >
                      Проверить ключ и API
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const r = await api<Connector & { token: string }>(
                            `/integrations/connectors/${active.id}/rotate`,
                            "POST",
                          );
                          setToken(r.token);
                          setMessage(
                            "Новый ключ выпущен. Старый больше не действует; обновите отправитель.",
                          );
                        })
                      }
                    >
                      Заменить ключ
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await api(
                            `/integrations/connectors/${active.id}`,
                            "PATCH",
                            { enabled: !active.enabled },
                          );
                          setMessage(
                            active.enabled
                              ? "Приёмник отключён"
                              : "Приёмник включён",
                          );
                        })
                      }
                    >
                      {active.enabled ? "Отключить приём" : "Включить приём"}
                    </Button>
                  </div>
                  <details className="connector-test">
                    <summary>Проверить передачу учебного события</summary>
                    <p>
                      Это явная отправка в базу проекта. Используйте вымышленные
                      данные; применяются обычные правила обнаружения.
                    </p>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        setPayload(
                          JSON.stringify(example(active.provider), null, 2),
                        )
                      }
                    >
                      Подготовить пример для этого продукта
                    </Button>
                    <label>
                      Пакет событий
                      <textarea
                        aria-label="Пакет событий подключения"
                        rows={9}
                        maxLength={200000}
                        value={payload}
                        onChange={(e) => setPayload(e.target.value)}
                      />
                    </label>
                    <Button
                      disabled={busy || !token || !payload || !active.enabled}
                      onClick={() =>
                        void run(async () => {
                          const r = await receiver(
                            "events",
                            JSON.parse(payload),
                          );
                          setMessage(
                            `Добавлено: ${r.created}; повторов: ${r.duplicates}; инцидентов: ${r.incidents.length}. Проверьте мониторинг событий.`,
                          );
                        })
                      }
                    >
                      Отправить учебное событие
                    </Button>
                  </details>
                </>
              )}
            </>
          ) : (
            <>
              <h3>Подключение по шагам</h3>
              <p>
                Выберите продукт, назовите подключение, передайте адрес и ключ
                администратору внешней системы.
              </p>
              <p>
                События проходят проверку формата, защиту от повторов и анализ
                по правилам.
              </p>
              <p>
                Office без журналов Microsoft 365 подключается через
                универсальный корпоративный агент.
              </p>
            </>
          )}
        </article>
      </div>
      {message && (
        <p role="status" className="connector-success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
