/* Назначение файла: Настройка инструментов разработки, сборки или проверки проекта.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default ts.config(
  {
    ignores: ["dist/**", "node_modules/**", ".npm-cache/**", "test-results/**"],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  { files: ["*.js"], languageOptions: { globals: globals.node } },
  {
    // Playwright scripts run in Node and evaluate callbacks in the browser.
    files: ["scripts/emblems-r15-check.mjs", "scripts/site-audit-*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["scripts/site-audit-accessibility.mjs", "scripts/site-audit-extra.mjs"],
    languageOptions: { globals: { axe: "readonly" } },
  },
);
