import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const roles: Record<string, string> = {
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
