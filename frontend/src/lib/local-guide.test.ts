/* Назначение файла: Проверяет подсистему local guide. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { describe, expect, it } from "vitest";
import { localGuideAnswer, siteTour } from "./local-guide";

describe("free local site guide", () => {
  it("explains the selected page and the public landing page", () => {
    expect(localGuideAnswer("Как пользоваться?", "tasks")).toContain(
      "постановщик",
    );
    expect(localGuideAnswer("Объясни страницу", "landing")).toContain(
      "выданной учётной записью",
    );
  });
  it("does not interpret Russian word endings as an AI question", () => {
    expect(
      localGuideAnswer("Что такое учётная запись в этой ситуации?", "events"),
    ).toContain("Имя пользователя");
    expect(localGuideAnswer("Это ИИ?", "events")).toContain(
      "Языковая модель не подключена",
    );
  });
  it("states uncertainty instead of inventing incident findings", () => {
    expect(
      localGuideAnswer("Кто взломал компьютер вчера?", "incidents"),
    ).toContain("нет отдельного подготовленного ответа");
    expect(localGuideAnswer("Что такое риск?", "incidents")).toContain(
      "не процент вероятности атаки",
    );
    expect(siteTour.every((step) => !step.path.startsWith("http"))).toBe(true);
  });
});
