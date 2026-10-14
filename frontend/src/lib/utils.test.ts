import { describe, it, expect } from "vitest";
import { riskLabel, nextStatus, cn } from "./utils";
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
