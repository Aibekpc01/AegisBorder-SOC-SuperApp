import { describe, expect, it } from "vitest";
import { defenseModules, defensePhases } from "./defense-story";
import { platformNavigation } from "./modules";

describe("История защиты", () => {
  it("Объясняет каждую доступную функцию и связывает её с этапом", () => {
    expect(defenseModules).toHaveLength(platformNavigation.length);
    for (const item of defenseModules) {
      expect(item.purpose.length).toBeGreaterThan(15);
      expect(item.action.length).toBeGreaterThan(20);
      expect(item.result.length).toBeGreaterThan(15);
      expect(item.phase).toBeGreaterThanOrEqual(0);
      expect(item.phase).toBeLessThan(defensePhases.length);
      expect(item.status).toMatch(/^Протестирован/);
    }
  });
});
