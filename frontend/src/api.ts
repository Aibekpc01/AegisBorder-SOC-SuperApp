export type Row = Record<string, any>;
export async function api<T = any>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch("/api/v1" + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/"))
      window.dispatchEvent(new Event("aegis-expired"));
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : response.status === 422
          ? "Проверьте обязательные поля и допустимые значения"
          : "Не удалось выполнить запрос",
    );
  }
  return result;
}
