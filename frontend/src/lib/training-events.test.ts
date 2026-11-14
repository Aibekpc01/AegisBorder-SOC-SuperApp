/* Назначение файла: Проверяет подсистему training events. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { describe, expect, it } from "vitest";
import { buildTrainingEvents } from "./training-events";

describe("учебные записи из понятной формы", () => {
  it("preserves permission differences between safe and suspicious USB examples", () => {
    expect(
      buildTrainingEvents("unknown-usb", "ПК", "Сотрудник", 1)[0].features
        .approved,
    ).toBe(false);
    expect(
      buildTrainingEvents("allowed-usb", "ПК", "Сотрудник", 1)[0].features
        .approved,
    ).toBe(true);
  });
  it("creates distinct IDs and maintains one-second intervals for repeated logins", () => {
    const events = buildTrainingEvents(
      "failed-login",
      " ПК ",
      " Сотрудник ",
      5,
      new Date("2026-10-15T12:00:00Z"),
    );
    expect(new Set(events.map((e) => e.external_id)).size).toBe(5);
    expect(events[0].device).toBe("ПК");
    expect(
      new Date(events[4].time).getTime() - new Date(events[0].time).getTime(),
    ).toBe(4000);
    expect(events.every((e) => e.type === "login_failed")).toBe(true);
  });
  it("rejects empty participants, unknown presets and invalid repetition counts", () => {
    for (const count of [0, 21, 1.5, NaN])
      expect(() =>
        buildTrainingEvents("failed-login", "ПК", "Сотрудник", count),
      ).toThrow();
    expect(() =>
      buildTrainingEvents("unknown-usb", " ", "Сотрудник", 1),
    ).toThrow();
    expect(() =>
      buildTrainingEvents("missing", "ПК", "Сотрудник", 1),
    ).toThrow();
  });
});
