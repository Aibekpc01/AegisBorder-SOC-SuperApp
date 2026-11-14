/* Назначение файла: Настройка инструментов разработки, сборки или проверки проекта.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": { target: process.env.AEGIS_API_TARGET || "http://127.0.0.1:8000", ws: true } } },
  build: { chunkSizeWarningLimit: 1100 },
});
