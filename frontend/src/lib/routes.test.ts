/* Назначение файла: Проверяет подсистему routes. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { describe, expect, it } from "vitest";
import { queryId } from "./routes";

describe("Workspace deep links", () => {
  it("reads document and incident identifiers independently", () => {
    expect(queryId("?document=42&incident=7", "document")).toBe(42);
    expect(queryId("?document=42&incident=7", "incident")).toBe(7);
  });

  it("rejects missing, malformed and unsafe identifiers", () => {
    for (const value of [
      "",
      "0",
      "-1",
      "1.5",
      "NaN",
      "Infinity",
      "1e3",
      "9007199254740992",
    ]) {
      expect(queryId(`?document=${value}`, "document")).toBeUndefined();
    }
    expect(queryId("?incident=7", "document")).toBeUndefined();
  });
});
