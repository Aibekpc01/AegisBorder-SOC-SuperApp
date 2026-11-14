/* Назначение файла: Переключает светлую и тёмную темы и сохраняет пользовательский выбор.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    let value = "dark";
    try {
      value = localStorage.getItem("aegis-theme") || "dark";
    } catch {
      /* Частный режим браузера. */
    }
    document.documentElement.dataset.theme =
      value === "light" ? "light" : "dark";
    return document.documentElement.dataset.theme;
  });
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("aegis-theme", next);
    } catch {
      /* Тема работает и без хранилища. */
    }
  }
  return (
    <button
      className="icon-btn theme-toggle"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"
      }
      title="Переключить тему"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
