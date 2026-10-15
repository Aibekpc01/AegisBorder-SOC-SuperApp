/* global console, document, innerWidth */
import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const origin = "http://127.0.0.1:5174";
const out = "../release/aegis-ultra/final";
await mkdir(out, { recursive: true });
const password = (await readFile("../.env.ultra-preview", "utf8"))
  .match(/^ADMIN_PASSWORD=(.*)$/m)[1]
  .trim();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1050 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name) => {
  checks.push(name);
  console.log("OK:", name);
};
try {
  await page.goto(origin + "/app");
  await page.getByLabel("Имя пользователя").fill("admin");
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Войти в систему", exact: true })
    .click();
  await expect(page.locator(".ultra-dashboard")).toBeVisible();
  check("HTTPS-independent local session and dashboard");
  const request = context.request;
  const session = await (
    await request.post(origin + "/api/v1/demo-sessions", { data: {} })
  ).json();
  for (const scenario of ["bruteforce", "usb", "copy"]) {
    const r = await request.post(origin + "/api/v1/scenarios/" + scenario, {
      data: { demo_id: session.id },
    });
    expect(r.status()).toBe(200);
  }
  await page.reload();
  await expect(page.locator(".ultra-network-node").first()).toBeVisible();
  await page.locator(".ultra-network-node").first().click();
  await expect(page.locator(".ultra-node-detail")).toBeVisible();
  await page.getByLabel("Закрыть сведения об узле").click();
  await page.getByLabel("Увеличить схему").click();
  await page.getByLabel("Сбросить масштаб").click();
  check("Actual infrastructure nodes, details and zoom");
  await page
    .getByRole("button", {
      name: "Настроить виджет: Инфраструктура",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Скрыть с панели" }).click();
  await expect(page.locator(".ultra-widget-infrastructure")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Восстановить виджеты панели" })
    .click();
  await expect(page.locator(".ultra-widget-infrastructure")).toBeVisible();
  check("Widget hide and restore");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  check("Global search keyboard shortcut");
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + "/dashboard.png", fullPage: true });
  const routes = [
    "events",
    "incidents",
    "analysis",
    "anomalies",
    "assets",
    "scenarios",
    "investigations",
    "reports",
    "workspace",
    "users",
    "audit",
    "settings",
    "help",
    "commission",
    "team",
    "development",
    "assistant",
    "mail",
    "m365",
    "twin",
    "tasks",
    "integrations",
    "rule-builder",
    "academy",
    "scenario-builder",
    "security-analytics",
  ];
  for (const route of routes) {
    await page.goto(origin + "/app/" + route);
    await expect(page.locator(".shell")).toBeVisible();
    await page.waitForTimeout(180);
    if (
      [
        "incidents",
        "assistant",
        "twin",
        "commission",
        "tasks",
        "users",
      ].includes(route)
    )
      await page.screenshot({ path: `${out}/${route}.png`, fullPage: true });
  }
  check("All 27 existing application routes render");
  await page.goto(origin + "/app/incidents");
  await page.locator(".ultra-incident-card").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".investigation-visual")).toBeVisible();
  await page.screenshot({ path: out + "/investigation.png", fullPage: false });
  await page.keyboard.press("Escape");
  check("Incident cards open evidence and relationship graph");
  await page.goto(origin + "/app/assistant");
  const select = page.getByLabel("Выберите инцидент");
  const selected = await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(selected);
  await expect(
    page
      .locator(".ultra-ai-layout + article, .ultra-ai-layout ~ article")
      .first(),
  ).toBeVisible();
  await page.screenshot({ path: out + "/assistant.png", fullPage: true });
  check("Analysis core reflects a completed API request");
  await page.goto(origin + "/app/tasks");
  const taskTitle = "Проверка ULTRA — восстановление " + Date.now();
  await page
    .getByLabel("Задача", { exact: true })
    .fill(taskTitle);
  await page
    .getByLabel("Описание", { exact: true })
    .fill("Синтетическая проверка в изолированной базе.");
  await page
    .getByRole("button", { name: "Создать задачу", exact: true })
    .click();
  const task = page
    .locator("article.module-card")
    .filter({ hasText: taskTitle })
    .first();
  await expect(task).toBeVisible();
  await task.locator("summary").click();
  await task.getByRole("button", { name: "Архивировать", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Архив", exact: true }).click();
  await expect(task).toBeVisible();
  await task.locator("summary").click();
  await task.getByRole("button", { name: "Восстановить", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Активные", exact: true }).click();
  await expect(task).toBeVisible();
  check("Task create, archive, confirm and restore through UI");
  await page.screenshot({ path: out + "/tasks.png", fullPage: true });
  await page.goto(origin + "/app/commission");
  await page
    .getByRole("button", { name: "Режим презентации", exact: true })
    .click();
  await expect(page.locator("body")).toHaveClass(/ultra-presenting/);
  await page.screenshot({ path: out + "/presentation.png", fullPage: false });
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/ultra-presenting/);
  check("Presentation mode and Escape exit");
  for (const width of [390, 768, 1440, 2560, 3840]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1050 });
    await page.goto(origin + "/app");
    await expect(page.locator(".ultra-kpis")).toBeVisible();
    await page.waitForTimeout(120);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if (width <= 768)
      await page.screenshot({
        path: `${out}/dashboard-${width}.png`,
        fullPage: true,
      });
  }
  check("No page overflow at 390, 768, 1440, 2560 and 3840 pixels");
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.goto(origin + "/");
  await page.waitForTimeout(350);
  await page.screenshot({ path: out + "/landing.png", fullPage: false });
  const viewerContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const viewer = await viewerContext.newPage();
  await viewer.goto(origin + "/app");
  await viewer
    .getByRole("button", {
      name: "Открыть демонстрационный просмотр",
      exact: true,
    })
    .click();
  await expect(viewer.locator(".ultra-dashboard")).toBeVisible();
  expect(
    await (await viewerContext.request.get(origin + "/api/v1/auth/me")).json(),
  ).toHaveProperty("role", "demo_viewer");
  expect(
    (
      await viewerContext.request.put(origin + "/api/v1/settings", {
        data: { organization: "forbidden" },
      })
    ).status(),
  ).toBe(403);
  await expect(
    viewer.getByRole("link", { name: "Пользователи и роли", exact: true }),
  ).toHaveCount(0);
  await viewer.goto(origin + "/app/commission");
  const runResponse = viewer.waitForResponse(
    (r) =>
      r.url().includes("/api/v1/scenarios/") && r.request().method() === "POST",
  );
  await viewer
    .getByRole("button", { name: "Запустить проверку", exact: true })
    .click();
  expect((await runResponse).status()).toBe(200);
  await expect(
    viewer.getByRole("heading", { name: "Результат проверки", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    viewer.getByRole("button", { name: "Сбросить мои данные", exact: true }),
  ).toHaveCount(0);
  await viewer.screenshot({ path: out + "/demo-viewer.png", fullPage: true });
  check(
    "Demo viewer UI login, server write denial and personal synthetic scenario",
  );
  await viewerContext.close();
  expect(errors).toEqual([]);
  await writeFile(
    out + "/checks.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log("PASS:", checks.length, "checks; no JavaScript errors");
} finally {
  await browser.close();
}
