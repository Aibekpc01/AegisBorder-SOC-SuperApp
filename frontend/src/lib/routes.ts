/** Прежние прямые ссылки сохраняются; новые переходы ведут в /app. */
export function appPath(path = "") {
  if (path === "/app" || path.startsWith("/app/")) return path;
  return "/app" + (path && path !== "/" ? "/" + path.replace(/^\//, "") : "");
}
export function appPage(path: string) {
  return path.replace(/^\/app(?:\/|$)/, "").replace(/^\//, "");
}
