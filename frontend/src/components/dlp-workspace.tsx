/* Назначение файла: Показывает панель Aegis DLP: устройства, установку агента, состояние, назначения и доступные управляющие действия.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Download,
  Monitor,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { api, type Row } from "../api";
import "../dlp.css";

const stamp = (v?: number) =>
  v ? new Date(v * 1000).toLocaleString("ru-RU") : "Ещё не подключался";
const stateLabel: Record<string, string> = {
  online: "На связи",
  offline: "Нет связи",
  pending: "Ожидает установки",
  revoked: "Ключ отозван",
};
const protection = (v: unknown) =>
  v === true ? "Включена" : v === false ? "Выключена" : "Нет данных";

export function DlpWorkspace() {
  const cache = useQueryClient();
  const [selected, select] = useState("");
  const [candidate, setCandidate] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [usbMode, setUsbMode] = useState("audit");
  const [message, setMessage] = useState("");
  const devices = useQuery<Row[]>({
    queryKey: ["dlp-devices"],
    queryFn: () => api("/dlp/devices"),
    refetchInterval: 5000,
    retry: false,
  });
  const candidates = useQuery<Row[]>({
    queryKey: ["dlp-candidates"],
    queryFn: () => api("/dlp/candidates"),
    refetchInterval: 10000,
    retry: false,
  });
  const events = useQuery<Row[]>({
    queryKey: ["dlp-events", selected],
    queryFn: () => api(`/dlp/devices/${selected}/events`),
    enabled: !!selected,
    refetchInterval: 5000,
    retry: false,
  });
  const list = devices.data || [];
  const current = list.find((d) => d.id === selected);
  const snapshot = current?.snapshot;
  const status = snapshot?.status || {};

  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/dlp/enroll", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, visit_id: candidate, format: "native" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Не удалось создать пакет");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "aegis-dlp-windows.zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage(
        "Пакет скачан. Распакуйте на выбранном ПК и запустите AegisDLP.exe. Python не нужен. Ключ активации действует 24 часа; архив не передавайте другим людям.",
      );
      await cache.invalidateQueries({ queryKey: ["dlp-devices"] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (
      !current ||
      !window.confirm(
        "Отозвать подключение? Локальные ограничения на ПК продолжат действовать. Для восстановления связи потребуется новый пакет.",
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/dlp/devices/${current.id}/revoke`, "POST", {});
      await cache.invalidateQueries({ queryKey: ["dlp-devices"] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка отзыва");
    } finally {
      setBusy(false);
    }
  }

  async function control(action: "policy" | "quick-scan") {
    if (!current) return;
    if (
      action === "policy" &&
      usbMode === "block" &&
      !window.confirm(
        "Запретить чтение и запись съёмных дисков на этом ПК? Служба применит политику при следующей связи и сохранит её без интернета.",
      )
    )
      return;
    setBusy(true);
    try {
      await api(
        `/dlp/devices/${current.id}/${action}`,
        "POST",
        action === "policy" ? { usb_mode: usbMode } : {},
      );
      setMessage(
        "Запрос сохранён. Фактический результат появится после подтверждения агента.",
      );
      await cache.invalidateQueries({ queryKey: ["dlp-devices"] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка управления");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dlp-workspace">
      <section className="dlp-hero">
        <ShieldCheck size={40} />
        <div>
          <span className="badge">
            AEGIS DLP · WINDOWS SERVICE · БЕЗ PYTHON
          </span>
          <h1>Защита остаётся на месте. События возвращаются на связь.</h1>
          <p>
            Реальная телеметрия установленного агента. Обновление панели каждые
            5 секунд, агент отправляет состояние каждые 30 секунд. Отсутствие
            связи не означает отключение локальной защиты.
          </p>
        </div>
      </section>
      {devices.error && (
        <p role="alert" className="error">
          {devices.error.message}
        </p>
      )}
      {message && (
        <p role="status" className="info-box">
          {message}
        </p>
      )}
      <div className="dlp-metrics">
        {[
          ["ПК зарегистрировано", list.length],
          ["На связи", list.filter((d) => d.state === "online").length],
          ["Нет связи", list.filter((d) => d.state === "offline").length],
          [
            "Ожидают установки",
            list.filter((d) => d.state === "pending").length,
          ],
        ].map(([label, value]) => (
          <article key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>
      <section className="dlp-card">
        <h2>
          <Download size={20} /> Подключить Windows-ПК с сайта
        </h2>
        <p>
          Выберите свой ПК из устройств, входивших на сайт. Пакет привязывается
          к первому запущенному экземпляру агента. Скачивание архива ещё не
          означает установку.
        </p>
        <div className="dlp-enroll">
          <label>
            Подключённый ПК
            <select
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
            >
              <option value="">Выберите ПК Windows</option>
              {candidates.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.ip}
                </option>
              ))}
            </select>
          </label>
          <label>
            Название в панели
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Пост-07"
            />
          </label>
          <button
            className="btn btn-primary"
            disabled={
              busy || !candidate || name.trim().length < 2 || !!devices.error
            }
            onClick={download}
          >
            Скачать Aegis DLP для Windows
          </button>
        </div>
        {!candidates.data?.length && (
          <p>
            Подходящих ПК пока нет. Откройте сайт на Windows-компьютере под
            своей учётной записью. Телефоны и планшеты не поддерживаются.
          </p>
        )}
        <ol>
          <li>Распакуйте архив на выбранном Windows-ПК.</li>
          <li>
            Запустите AegisDLP.exe и подтвердите установку администратором
            Windows. Python и скачивание зависимостей не требуются.
          </li>
          <li>
            Задайте локальный пароль. После установки подтвердите локальную
            службу кнопкой на сайте; разрешите браузеру соединение с ней, если
            он спросит.
          </li>
        </ol>
        <p>
          Служба запускается вместе с Windows, значок — при входе пользователя.
          USB-политики задаются ниже. Обычный сотрудник не может удалить службу;
          администратор Windows сохраняет управление и штатное удаление.
        </p>
      </section>
      <div className="dlp-columns">
        <section className="dlp-card">
          <h2>
            <Monitor size={20} /> Компьютеры
          </h2>
          {devices.isPending ? (
            <p>Загрузка…</p>
          ) : !list.length ? (
            <p>
              Агенты ещё не подключены. Здесь будут реальные устройства, без
              демонстрационных показателей.
            </p>
          ) : (
            list.map((d) => (
              <button
                key={d.id}
                className={`dlp-device ${selected === d.id ? "selected" : ""}`}
                onClick={() => select(d.id)}
              >
                <b>{d.name}</b>
                <span className={`dlp-state ${d.state}`}>
                  {stateLabel[d.state]}
                </span>
                <small>
                  {d.hostname || "Ожидаем первый запуск"} ·{" "}
                  {d.ip || "IP появится после подключения"}
                </small>
                <small>{stamp(d.last_seen)}</small>
              </button>
            ))
          )}
        </section>
        <section className="dlp-card">
          <h2>
            <Activity size={20} /> Состояние устройства
          </h2>
          {!current ? (
            <p>Выберите компьютер слева.</p>
          ) : (
            <>
              <h3>{current.name}</h3>
              <p>{snapshot?.os || "Версия Windows появится после установки"}</p>
              {snapshot?.collection_error && (
                <p role="alert" className="error">
                  Агент на связи, но сбор состояния защиты завершился ошибкой.
                  Защита не подтверждена.
                </p>
              )}
              {current.state === "offline" && (
                <p>
                  <WifiOff size={16} /> Показаны последние полученные данные:{" "}
                  {stamp(current.last_seen)}.
                </p>
              )}
              <div className="dlp-policy-control">
                <h3>Политики и управление службой</h3>
                <p>
                  Назначена версия: {current.policy?.version || 1}; применена:{" "}
                  {snapshot?.policy_version ?? 0}. Режим:{" "}
                  {current.policy?.usb_mode || "audit"}.
                </p>
                {snapshot?.policy_error && (
                  <p role="alert" className="error">
                    Ошибка применения: {snapshot.policy_error}
                  </p>
                )}
                {current.can_policy && !current.revoked && (
                  <div className="row wrap">
                    <select
                      aria-label="Политика USB"
                      value={usbMode}
                      onChange={(e) => setUsbMode(e.target.value)}
                    >
                      <option value="audit">
                        Наблюдать / снять ограничения Aegis
                      </option>
                      <option value="block">Запретить съёмные диски</option>
                      <option value="restore">
                        Восстановить прежнюю USB-политику
                      </option>
                    </select>
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => control("policy")}
                    >
                      Назначить политику
                    </button>
                    <button
                      className="btn btn-outline"
                      disabled={busy}
                      onClick={() => control("quick-scan")}
                    >
                      Запросить быструю проверку
                    </button>
                  </div>
                )}
                {(current.commands || []).map((command: Row) => (
                  <p key={command.id}>
                    Быстрая проверка:{" "}
                    {{
                      pending: "ожидает связи",
                      started: "выполняется",
                      completed: "команда завершена",
                      failed: "ошибка",
                    }[command.status as string] || command.status}
                  </p>
                ))}
              </div>
              <dl className="dlp-details">
                <dt>Версия агента / служба</dt>
                <dd>
                  {snapshot?.agent_version || "Нет данных"} /{" "}
                  {snapshot?.service_mode ? "Да" : "Нет"}
                </dd>
                <dt>Антивирус</dt>
                <dd>{protection(status.antivirus)}</dd>
                <dt>Защита в реальном времени</dt>
                <dd>{protection(status.realtime)}</dd>
                <dt>Возраст антивирусных баз</dt>
                <dd>
                  {status.signatures_age == null
                    ? "Нет данных"
                    : `${status.signatures_age} дн.`}
                </dd>
                <dt>Чтение съёмных дисков запрещено</dt>
                <dd>{protection(status.usb_read_denied)}</dd>
                <dt>Запись на съёмные диски запрещена</dt>
                <dd>{protection(status.usb_write_denied)}</dd>
                <dt>CPU / RAM</dt>
                <dd>
                  {status.cpu_percent ?? "—"}% / {status.memory_percent ?? "—"}%
                </dd>
                <dt>Событий в локальной очереди</dt>
                <dd>{snapshot?.pending ?? "Нет данных"}</dd>
              </dl>
              <p>
                USB-значения отражают локальную политику, фактическое
                ограничение нужно проверить на ПК. Город по IP не определяется с
                гарантированной точностью.
              </p>
              {current.can_manage && !current.revoked && (
                <button
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={revoke}
                >
                  Отозвать подключение
                </button>
              )}
              <h3>Последние состояния</h3>
              <div className="dlp-timeline">
                {(current.history || [])
                  .slice(-8)
                  .reverse()
                  .map((h: Row) => (
                    <p key={h.time}>
                      <time>{stamp(h.time)}</time>
                      <span>
                        {h.collection_error
                          ? "Ошибка сбора"
                          : `Антивирус: ${protection(h.status?.antivirus)}`}
                      </span>
                    </p>
                  ))}
              </div>
              <h3>События агента</h3>
              {events.error && <p role="alert">{events.error.message}</p>}
              {!events.data?.length ? (
                <p>Событий пока нет.</p>
              ) : (
                events.data.map((e) => (
                  <article className="dlp-event" key={e.id}>
                    <b>{e.type}</b>
                    <small>{new Date(e.time).toLocaleString("ru-RU")}</small>
                    <p>{e.detail}</p>
                  </article>
                ))
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
