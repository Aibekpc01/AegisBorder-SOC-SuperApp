/* Назначение файла: Содержит общие вспомогательные функции интерфейса, включая сборку CSS-классов.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const roles: Record<string, string> = {
  creator: "Создатель",
  cto: "Chief Technical Director",
  deputy_cto: "Заместитель CTO",
  team_lead: "Руководитель команды",
  developer: "Разработчик",
  auditor: "Аудитор",
  demo_viewer: "Демонстрационный просмотр",
  admin: "Администратор",
  analyst: "Аналитик",
  observer: "Наблюдатель",
  demo: "Демонстрационный пользователь",
};
export const statuses = [
  "Новый",
  "На проверке",
  "Подтверждён",
  "Устранён",
  "Закрыт",
  "Ложное срабатывание",
];
export const nextStatus: Record<string, string[]> = {
  Новый: ["На проверке", "Ложное срабатывание"],
  "На проверке": ["Подтверждён", "Ложное срабатывание"],
  Подтверждён: ["Устранён"],
  Устранён: ["Закрыт"],
  Закрыт: [],
  "Ложное срабатывание": [],
};
export function riskLabel(risk: number) {
  return risk >= 85
    ? "Критический"
    : risk >= 65
      ? "Высокий"
      : risk >= 40
        ? "Средний"
        : "Низкий";
}
export function date(value: string) {
  return new Date(
    value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : value + "Z",
  ).toLocaleString("ru-RU");
}

/** CERT-EU uses European timezone abbreviations that Date.parse does not accept. */
export function publicationDate(value: string) {
  const normalized = value.trim().replace(/\sCEST$/i, " +0200").replace(/\sCET$/i, " +0100");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime())
    ? "Дата публикации недоступна"
    : parsed.toLocaleDateString("ru-RU");
}
