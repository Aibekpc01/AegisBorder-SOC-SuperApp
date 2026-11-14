// Проверка продакшен-сборки: метрики загрузки главной, ошибки консоли и CSP, WebSocket после входа.
// Запуск: node scripts/review-perf.mjs [baseURL] [password]
import { chromium } from "@playwright/test";

const [base = "http://127.0.0.1:8000", password = process.env.ADMIN_PASSWORD] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge" });
const problems = [];

async function measure(width, height, throttle) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && !m.text().includes("401") && problems.push(`${width}: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`${width}: ${e.message}`));
  if (throttle) {
    // Примерно «быстрый 4G» и замедление процессора в 4 раза, как в мобильном профиле Lighthouse.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8 * 1024 / 1000 * 1000, uploadThroughput: 750e3 / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  await page.addInitScript(() => {
    window.__lcp = 0;
    window.__cls = 0;
    new PerformanceObserver((list) => list.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => list.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator(".fr-hero h1").waitFor();
  await page.waitForTimeout(1500);
  const metrics = await page.evaluate(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0;
    const resources = performance.getEntriesByType("resource");
    const nav = performance.getEntriesByType("navigation")[0];
    const bytes = resources.reduce((sum, r) => sum + (r.transferSize || 0), nav?.transferSize || 0);
    return { fcp: Math.round(fcp), lcp: Math.round(window.__lcp), cls: Number(window.__cls.toFixed(4)), requests: resources.length + 1, kb: Math.round(bytes / 1024) };
  });
  await context.close();
  return { width, throttle, ...metrics };
}

const results = [await measure(1440, 900, false), await measure(1920, 1080, false), await measure(390, 844, true)];
console.table(results);

// Вход, переход по разделам и проверка WebSocket под строгой CSP.
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => localStorage.setItem("aegis-ultra-intro", "1"));
const page = await context.newPage();
page.on("console", (m) => m.type() === "error" && !m.text().includes("401") && problems.push(`app: ${m.text()}`));
page.on("pageerror", (e) => problems.push(`app: ${e.message}`));
let socketOpened = false;
page.on("websocket", () => (socketOpened = true));
await page.goto(base + "/app");
await page.getByLabel("Имя пользователя").fill("admin");
await page.getByLabel("Пароль", { exact: true }).fill(password);
await page.getByRole("button", { name: /Войти/ }).click();
await page.locator(".shell").waitFor({ timeout: 20000 });
for (const path of ["", "events", "incidents", "investigations", "scenarios", "workspace", "reports", "users", "audit", "settings", "help", "commission", "academy", "team", "assets", "integrations"]) {
  await page.goto(base + "/app/" + path);
  await page.locator(".shell").waitFor();
  await page.waitForTimeout(700);
}
console.log("websocket opened:", socketOpened);
await browser.close();
console.log(problems.length ? "PROBLEMS:\n" + [...new Set(problems)].join("\n") : "no console or CSP errors");
