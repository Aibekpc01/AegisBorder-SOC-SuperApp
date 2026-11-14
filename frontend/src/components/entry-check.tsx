/* Назначение файла: Выполняет вступительную проверку и показывает состояние подготовки приложения.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, LoaderCircle, CircleAlert } from "lucide-react";
import "../entry-check.css";
import aegisMark from "../assets/aegis-mark.svg";

export function EntryCheck({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false),
    [attempt, setAttempt] = useState(0),
    [resources, setResources] = useState(false),
    [server, setServer] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setError("");
    setServer(false);
    setResources(false);
    const timeout = setTimeout(() => controller.abort(), 8000);
    const ready = Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]).then(() => {
      if (active) setResources(true);
    });
    const health = fetch("/api/v1/health", {
      signal: controller.signal,
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.status !== "ok") throw new Error();
      if (active) setServer(true);
    });
    void Promise.all([
      ready,
      health,
      new Promise((resolve) => setTimeout(resolve, 750)),
    ])
      .then(() => {
        if (active) setDone(true);
      })
      .catch(() => {
        if (active)
          setError(
            "Сервер пока не отвечает. Повторите проверку или откройте описание проекта.",
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [attempt]);
  if (done) return <>{children}</>;
  return (
    <div className="entry-check">
      <div className="entry-check-card" data-state={error ? "error" : "loading"}>
        <div className="entry-shield">
          <img src={aegisMark} alt="Aegis" width={64} height={64} />
          <span />
        </div>
        <span className="experience-kicker">AegisBorder Supperapp</span>
        <h1>
          Проверяем готовность
          <br />к работе
        </h1>
        <p>
          Подготавливаем интерфейс и проверяем доступность приложения и базы
          данных.
        </p>
        <ul>
          <li>
            {resources ? (
              <CheckCircle2 />
            ) : (
              <LoaderCircle className="entry-spin" />
            )}
            <span>Интерфейс браузера</span>
            <b>{resources ? "Готов" : "Подготовка…"}</b>
          </li>
          <li>
            {server ? (
              <CheckCircle2 />
            ) : error ? (
              <CircleAlert className="entry-error-icon" />
            ) : (
              <LoaderCircle className="entry-spin" />
            )}
            <span>Сервер и база данных</span>
            <b>{server ? "Доступны" : error ? "Нет ответа" : "Проверка…"}</b>
          </li>
        </ul>
        <div className="entry-check-progress" role="progressbar" aria-label="Подготовка приложения" aria-valuemin={0} aria-valuemax={2} aria-valuenow={Number(resources) + Number(server)}>
          <span style={{ width: `${(Number(resources) + Number(server)) * 50}%` }} />
        </div>
        <small>
          Права доступа проверяются при входе. Этот экран проверяет готовность
          приложения.
        </small>
        {error && (
          <>
            <p role="alert">{error}</p>
            <div className="row wrap">
              <button
                className="btn btn-primary"
                onClick={() => setAttempt((v) => v + 1)}
              >
                Повторить проверку
              </button>
              <button className="btn btn-outline" onClick={() => setDone(true)}>
                Открыть описание проекта
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
