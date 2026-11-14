// Снимки экранов для визуального ревью: node scripts/review-shots.mjs <outDir> [baseURL] [label]
import { chromium } from "@playwright/test";
const [out, base = "http://127.0.0.1:5173", label = "shot"] = process.argv.slice(2);
const pages = (process.env.PAGES || "/,/app,/app/incidents,/app/events,/app/scenarios,/app/workspace,/app/users,/app/help,/app/commission,/app/reports").split(",");
const sizes = (process.env.SIZES || "1440x900,390x844").split(",").map((s) => s.split("x").map(Number));
const browser = await chromium.launch({ channel: "msedge" });
const errors = [];
for (const [width, height] of sizes) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript(() => { try { localStorage.setItem("aegis-ultra-intro", "1"); if (location.search.includes("theme=light")) localStorage.setItem("aegis-theme", "light"); } catch { /* Хранилище может быть недоступно; снимок всё равно делаем. */ } });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`${width} ${page.url()} ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${width} ${page.url()} PAGEERROR ${e.message}`));
  await page.goto(base + "/app");
  await page.waitForTimeout(1500);
  if (process.env.LOGIN !== "0" && (await page.locator('input[type="password"]').count())) {
    await page.getByLabel("Имя пользователя").fill("admin");
    await page.getByLabel("Пароль", { exact: true }).fill(process.env.PW || "ReviewAdmin-2026!x");
    await page.getByRole("button", { name: /Войти/ }).click();
    await page.waitForTimeout(2500);
  }
  for (const p of pages) {
    await page.goto(base + p);
    await page.waitForTimeout(Number(process.env.WAIT || 2200));
    const name = `${out}/${label}-${width}${p.replace(/[/?=&]/g, "_") || "_root"}.png`;
    await page.screenshot({ path: name, fullPage: process.env.FULL === "1" });
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "no console errors");
