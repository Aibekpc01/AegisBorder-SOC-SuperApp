/* Назначение файла: Единая точка HTTP-запросов к /api/v1. Передаёт cookie сеанса, разбирает JSON и сообщает интерфейсу об истечении сеанса и требовании DLP.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

export type Row = Record<string, any>;
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(result: unknown, status: number): string {
  if (result && typeof result === "object" && "detail" in result) {
    const detail = result.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  if (status === 422)
    return "Проверьте обязательные поля и допустимые значения";
  if (status === 401) return "Сеанс завершён. Войдите снова";
  if (status === 403) return "Недостаточно прав для этого действия";
  if (status === 429) return "Слишком много запросов. Повторите позже";
  if (status >= 500) return "Сервер временно недоступен. Повторите позже";
  return "Не удалось выполнить запрос";
}

export async function api<T = any>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  // Все экраны используют один префикс и одну обработку ошибок, чтобы одинаково реагировать на потерю доступа.
  const response = await fetch("/api/v1" + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  // Detect expiry even when a proxy replaces the JSON error with an HTML page.
  if (response.status === 401 && !path.startsWith("/auth/"))
    window.dispatchEvent(new Event("aegis-expired"));
  // HTTP 428 означает, что сервер требует подтверждения DLP; оболочка переключит рабочий экран.
  if (response.status === 428) window.dispatchEvent(new Event("aegis-dlp-required"));
  if (response.status === 204) return undefined as T;
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      response.ok
        ? "Сервер вернул некорректный ответ. Повторите запрос"
        : errorMessage(undefined, response.status),
      response.status,
    );
  }
  if (!response.ok) {
    throw new ApiError(errorMessage(result, response.status), response.status);
  }
  return result as T;
}
