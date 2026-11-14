/* Назначение файла: Проверяет подсистему utils. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { describe, it, expect } from "vitest";
import { riskLabel, nextStatus, cn, publicationDate } from "./utils";
describe("Объяснение риска и жизненный цикл", () => {
  it("Показывает документированные границы", () => {
    expect(riskLabel(85)).toBe("Критический");
    expect(riskLabel(65)).toBe("Высокий");
    expect(riskLabel(40)).toBe("Средний");
    expect(riskLabel(0)).toBe("Низкий");
  });
  it("Не разрешает закрыть новый инцидент", () => {
    expect(nextStatus["Новый"]).not.toContain("Закрыт");
    expect(nextStatus["Устранён"]).toContain("Закрыт");
    expect(nextStatus["Закрыт"]).toEqual([]);
  });
  it("Объединяет классы компонента", () =>
    expect(cn("p-2", "p-4")).toBe("p-4"));
});

describe("Даты публикаций CERT-EU", () => {
  it.each([
    "Thu, 15 Oct 2026 11:38:20 CEST",
    "Thu, 15 Oct 2026 11:38:20 CET",
    "2026-10-15T11:38:20Z",
  ])("Отображает поддерживаемую дату %s", (value) => {
    expect(publicationDate(value)).toBe("15.10.2026");
  });
  it.each(["", "not a publication date"])("Не показывает Invalid Date для %s", (value) => {
    expect(publicationDate(value)).toBe("Дата публикации недоступна");
  });
});
