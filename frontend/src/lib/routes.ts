/* Назначение файла: Хранит правила и вспомогательные функции маршрутизации между разделами.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

/** Прежние прямые ссылки сохраняются; новые переходы ведут в /app. */
export function appPath(path = "") {
  if (path === "/app" || path.startsWith("/app/")) return path;
  return "/app" + (path && path !== "/" ? "/" + path.replace(/^\//, "") : "");
}
export function appPage(path: string) {
  return path.replace(/^\/app(?:\/|$)/, "").replace(/^\//, "");
}

export function queryId(search: string, name: string): number | undefined {
  const value = new URLSearchParams(search).get(name);
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

export const extendedPages = [
  "assistant",
  "mail",
  "m365",
  "twin",
  "tasks",
  "integrations",
  "rule-builder",
  "academy",
  "scenario-builder",
  "security-analytics",
  "team",
];
