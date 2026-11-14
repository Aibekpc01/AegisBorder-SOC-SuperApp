/* Назначение файла: Проверяет подсистему api. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

afterEach(() => vi.unstubAllGlobals());

function respond(body: string | null, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(body, { status })),
  );
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", { dispatchEvent });
  return dispatchEvent;
}

describe("API transport", () => {
  it("sends JSON and session credentials, preserving the typed response", async () => {
    respond('{"id":7}', 201);
    expect(
      await api<{ id: number }>("/tasks", "POST", { title: "Test" }),
    ).toEqual({ id: 7 });
    expect(fetch).toHaveBeenCalledWith("/api/v1/tasks", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: '{"title":"Test"}',
    });
  });

  it("accepts an explicit empty response", async () => {
    respond(null, 204);
    expect(await api<void>("/tasks/7", "DELETE")).toBeUndefined();
  });

  it("rejects malformed successful responses instead of returning empty data", async () => {
    respond("<html>Proxy</html>");
    await expect(api("/incidents")).rejects.toMatchObject({
      name: "ApiError",
      status: 200,
      message: "Сервер вернул некорректный ответ. Повторите запрос",
    });
  });

  it("preserves a server error and its status", async () => {
    respond('{"detail":"Документ уже изменён"}', 409);
    const error = await api("/documents/1", "PATCH", {}).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "Документ уже изменён",
    });
  });

  it.each([null, [], { detail: null }, { detail: [{ msg: "invalid" }] }])(
    "handles validation bodies without exposing raw structures: %j",
    async (body) => {
      respond(JSON.stringify(body), 422);
      await expect(api("/tasks", "POST", {})).rejects.toMatchObject({
        status: 422,
        message: "Проверьте обязательные поля и допустимые значения",
      });
    },
  );

  it("reports expiry even for a non-JSON 401", async () => {
    const dispatch = respond("Unauthorized", 401);
    await expect(api("/incidents")).rejects.toMatchObject({ status: 401 });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][0].type).toBe("aegis-expired");
  });

  it("does not report expiry for a failed login", async () => {
    const dispatch = respond('{"detail":"Неверный пароль"}', 401);
    await expect(api("/auth/login", "POST", {})).rejects.toThrow(
      "Неверный пароль",
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each([403, 429, 502])(
    "keeps the status of non-JSON HTTP %i errors",
    async (status) => {
      respond("<html>Error</html>", status);
      await expect(api("/tasks")).rejects.toMatchObject({
        name: "ApiError",
        status,
      });
    },
  );

  it("propagates network failures", async () => {
    const failure = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
    await expect(api("/health")).rejects.toBe(failure);
  });
});
