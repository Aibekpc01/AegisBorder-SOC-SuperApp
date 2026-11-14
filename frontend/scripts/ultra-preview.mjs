/* Назначение файла: Проверяет подсистему ultra preview. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

/* global process, console, document, innerWidth, fetch */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const stage = process.argv[2] || "after";
const out = `../release/aegis-ultra/${stage}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1050 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173/");
await page.waitForTimeout(1800);
await page.screenshot({ path: `${out}/landing.png`, fullPage: false });
await page.goto("http://127.0.0.1:5173/app");
await page.waitForTimeout(1800);
const username = "ultra_preview_" + randomUUID().replaceAll("-", "");
const password = randomUUID() + "Aa1!";
const setup = spawnSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "app",
    "python",
    "-c",
    `import sys,json
from app.command.db import SessionLocal
from app.command.models import User
from app.command.security import hasher
d=json.load(sys.stdin)
with SessionLocal() as db:
 db.add(User(username=d['username'],password_hash=hasher.hash(d['password']),role='admin'));db.commit()
`,
  ],
  {
    cwd: "..",
    input: JSON.stringify({ username, password }),
    encoding: "utf8",
  },
);
if (setup.status !== 0) throw new Error(setup.stderr);
await page.getByLabel("Имя пользователя").fill(username);
await page.getByLabel("Пароль", { exact: true }).fill(password);
await page
  .getByRole("button", { name: "Войти в систему", exact: true })
  .click();
await page.locator(".shell").waitFor();
await page.waitForTimeout(1800);
await page.screenshot({ path: `${out}/dashboard.png`, fullPage: true });
for (const path of ["assistant", "twin", "incidents", "commission"]) {
  await page.goto(`http://127.0.0.1:5173/app/${path}`);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/${path}.png`, fullPage: true });
}
await page.setViewportSize({ width: 768, height: 1024 });
await page.goto("http://127.0.0.1:5173/app");
await page.waitForTimeout(1400);
await page.screenshot({ path: `${out}/tablet.png`, fullPage: true });
console.log(
  JSON.stringify({
    stage,
    errors,
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  }),
);
await page.evaluate(() =>
  fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }),
);
spawnSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "app",
    "python",
    "-c",
    `import sys
from sqlalchemy import select
from app.command.db import SessionLocal
from app.command.models import User
with SessionLocal() as db:
 u=db.scalar(select(User).where(User.username==sys.stdin.read().strip()));u.active=False;db.commit()
`,
  ],
  { cwd: "..", input: username, encoding: "utf8" },
);
await browser.close();
