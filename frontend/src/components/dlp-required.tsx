/* Назначение файла: Показывает экран обязательного подключения DLP и кнопку подтверждения локальной службы перед открытием рабочих функций.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { DlpWorkspace } from "./dlp-workspace";
import { Devices, PresenceSignal } from "./presence-workspace";
import { proveLocalDlp } from "../lib/dlp-proof";
import type { Row } from "../api";

export function DlpRequired({
  user,
  onLogout,
}: {
  user: Row;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState("dlp"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  async function verify() {
    setBusy(true);
    setMessage("");
    try {
      await proveLocalDlp();
      setMessage(
        "Локальная служба подтверждена. Ожидаем актуальное состояние и применение политики.",
      );
      await cache.invalidateQueries({ queryKey: ["dlp-access"] });
    } catch {
      setMessage(
        "Не удалось связаться с Aegis DLP на этом ПК. Установите агент, проверьте службу и разрешите сайту доступ к локальной сети в браузере.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="dlp-required">
      <PresenceSignal userId={user.id} />
      <section className="dlp-required-notice" role="alert">
        <ShieldAlert size={32} />
        <div>
          <span className="badge">ОБЯЗАТЕЛЬНАЯ ЗАЩИТА УСТРОЙСТВА</span>
          <h1>Для работы необходим Aegis DLP</h1>
          <p>
            {user.role_label || user.role} · {user.username}. Создатель или
            руководитель назначил установку Aegis DLP для мониторинга
            устройства. Без назначения установка не требуется.
          </p>
          <p>
            Рабочие функции закрыты, пока этот сеанс не подтвердит локальную
            службу Aegis DLP. Доступ к установке и управлению DLP сохранён.
          </p>
          <div className="row wrap">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={verify}
            >
              {busy
                ? "Проверяем локальную службу…"
                : "Агент установлен — подтвердить этот ПК"}
            </button>
            <button className="btn btn-outline" onClick={onLogout}>
              Выйти
            </button>
          </div>
          {message && <p role="status">{message}</p>}
        </div>
      </section>
      <div className="row wrap">
        <button
          className={"btn " + (tab === "dlp" ? "btn-primary" : "btn-outline")}
          onClick={() => setTab("dlp")}
        >
          Aegis DLP · установка и управление
        </button>
        <button
          className={
            "btn " + (tab === "devices" ? "btn-primary" : "btn-outline")
          }
          onClick={() => setTab("devices")}
        >
          Устройства · назначить установку
        </button>
      </div>
      {tab === "dlp" ? <DlpWorkspace /> : <Devices />}
    </main>
  );
}
