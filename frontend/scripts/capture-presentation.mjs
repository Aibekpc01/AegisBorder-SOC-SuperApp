// Снимает реальные экраны приложения (1920×1080) для презентационного ролика: node scripts/capture-presentation.mjs <outDir>
// Требует запущенный тестовый сервер с учебными данными (см. presentation/VIDEO_PLAN.md).
import { chromium } from "@playwright/test";
const out = process.argv[2], B = "http://127.0.0.1:8100";
const b = await chromium.launch({ channel: "msedge" });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  localStorage.setItem("aegis-ultra-intro", "1");
  const css = ".entry-location,.site-assistant-launcher,.ultra-intro-replay{display:none!important}";
  document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.append(s); });
});
const p = await ctx.newPage();
const shot = async (name, wait = 1800) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${out}/${name}.png` }); };
await p.goto(B + "/"); await p.locator(".fr-hero h1").waitFor(); await shot("landing-hero", 2500);
await p.goto(B + "/#structure"); await p.waitForTimeout(1500);
await p.evaluate(() => document.querySelector("#structure").scrollIntoView({ block: "start" })); await p.evaluate(() => window.scrollBy(0, -90));
await p.getByRole("button", { name: /Посмотреть, как работает/ }).click(); await shot("org", 2400);
await p.goto(B + "/app");
await p.getByLabel("Имя пользователя").fill("admin");
await p.getByLabel("Пароль", { exact: true }).fill("ReviewAdmin-2026!x");
await p.getByRole("button", { name: /Войти/ }).click();
await p.locator(".shell").waitFor();
await p.goto(B + "/app"); await shot("dashboard", 2500);
await p.evaluate(() => window.scrollTo(0, 560)); await shot("dashboard-2", 800);
await p.goto(B + "/app/incidents"); await shot("incidents");
await p.evaluate(() => window.scrollTo(0, 420)); await shot("incidents-2", 700);
await p.locator(".ultra-incident-card").first().click(); await shot("incident-detail", 1500);
await p.keyboard.press("Escape");
await p.goto(B + "/app/events"); await p.evaluate(() => window.scrollTo(0, 380)); await shot("events");
await p.goto(B + "/app/m365"); await shot("o365", 2200);
await p.evaluate(() => window.scrollTo(0, 620)); await shot("o365-2", 800);
await p.goto(B + "/app/workspace?document=3"); await shot("workspace", 2500);
await p.goto(B + "/app/reports"); await shot("reports");
await p.goto(B + "/app/scenarios"); await shot("scenarios");
await p.goto(B + "/app/audit"); await shot("audit");
await p.goto(B + "/app/users"); await p.getByRole("button", { name: /Доступ через DLP/ }).click(); await shot("dlp", 1200);
await b.close();
console.log("done");
