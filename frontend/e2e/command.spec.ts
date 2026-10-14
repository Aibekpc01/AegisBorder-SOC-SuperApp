import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
const username = "qa_ui_" + randomUUID().replaceAll("-", "");
const password = randomUUID() + "Aa1!";
function testAccount(cleanup = false) {
  const script = cleanup
    ? `import sys,json
from sqlalchemy import select
from app.command.db import SessionLocal
from app.command.models import User
from app.command.security import audit
data=json.load(sys.stdin)
with SessionLocal() as db:
 row=db.scalar(select(User).where(User.username==data['username']))
 if row:
  row.active=False
  audit(db,row.id,'Тестовая учётная запись отключена после проверки UI')
  db.commit()
`
    : `import sys,json
from app.command.db import SessionLocal
from app.command.models import User
from app.command.security import hasher,audit
data=json.load(sys.stdin)
with SessionLocal() as db:
 row=User(username=data['username'],password_hash=hasher.hash(data['password']),role='admin')
 db.add(row);db.flush()
 audit(db,row.id,'Создана отдельная тестовая учётная запись для проверки UI')
 db.commit()
`;
  const result = spawnSync(
    "docker",
    ["compose", "exec", "-T", "app", "python", "-c", script],
    {
      cwd: "..",
      input: JSON.stringify({ username, password }),
      encoding: "utf8",
    },
  );
  if (result.status !== 0)
    throw new Error(
      "Не удалось подготовить тестовую учётную запись: " + result.stderr,
    );
}
test.beforeAll(() => testAccount());
test.afterAll(() => testAccount(true));

test("Личный профиль, фото, история IP, геолокация и проверка политики VPN", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("heading", { name: "Главная панель", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Открыть раздел: События безопасности" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Мониторинг событий", exact: true }),
  ).toBeVisible();
  await page.locator(".block-guide summary").first().click();
  await expect(page.locator(".block-guide details").first()).toHaveAttribute(
    "open",
    "",
  );
  await page.getByRole("button", { name: "Открыть мой профиль" }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("ФИО", { exact: true })
    .fill("Учебный оператор интерфейса");
  await dialog
    .getByLabel("Подразделение", { exact: true })
    .fill("Синтетический отдел");
  await dialog
    .getByLabel("Должность", { exact: true })
    .fill("Учебный аналитик");
  await dialog
    .getByLabel("Электронная почта", { exact: true })
    .fill("qa@example.invalid");
  await dialog.getByRole("button", { name: "Сохранить личные данные" }).click();
  await expect(dialog.getByRole("status")).toContainText("Изменения сохранены");
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAALElEQVR4nGO02PuDgRqAiSqmMIwaRAwYDWzCYDSMCIPRMCIMRsOIMBh8YQQA1TkCHcjanMUAAAAASUVORK5CYII=",
    "base64",
  );
  await dialog
    .getByLabel("Фото пользователя", { exact: true })
    .setInputFiles({
      name: "synthetic-avatar.png",
      mimeType: "image/png",
      buffer: image,
    });
  await expect(dialog.getByRole("status")).toContainText("Фото сохранено");
  await expect(
    dialog.getByRole("img", { name: "Фото Учебный оператор интерфейса" }),
  ).toBeVisible();
  await dialog.getByRole("tab", { name: "История входов" }).click();
  await expect(
    dialog.getByRole("columnheader", { name: "IP и источник" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Вход выполнен", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/user-profile.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page
    .getByRole("link", { name: "Пользователи и роли", exact: true })
    .click();
  await page.getByLabel("Поиск пользователей").fill(username);
  await expect(page.locator(".person-card")).toHaveCount(1);
  await expect(page.locator(".person-card")).toContainText(
    "Учебный оператор интерфейса",
  );
  await page.screenshot({
    path: "test-results/users-profiles.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Настройки", exact: true }).click();
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 51.1,
    longitude: 71.4,
    accuracy: 125,
  });
  await page
    .getByRole("button", { name: "Передать моё местоположение" })
    .click();
  await expect(
    page.getByText("Местоположение сохранено с указанной браузером точностью"),
  ).toBeVisible();
  await expect(
    page.getByText("51.1000, 71.4000", { exact: true }),
  ).toBeVisible();
  const original = await (
    await page.request.get("/api/v1/access-policy")
  ).json();
  const base = {
    block_anonymizers: original.block_anonymizers,
    restrict_to_trusted: original.restrict_to_trusted,
    trusted_cidrs: original.trusted_cidrs,
    blocked_cidrs: original.blocked_cidrs,
    networks: original.networks,
  };
  try {
    await page
      .getByRole("button", { name: "Добавить сеть", exact: true })
      .click();
    const index = base.networks.length + 1;
    await page
      .getByLabel("IP или CIDR " + index, { exact: true })
      .fill("203.0.113.0/24");
    await page
      .getByLabel("Название / источник " + index, { exact: true })
      .fill("Синтетическая проверка VPN");
    await page
      .getByRole("button", { name: "Сохранить политику доступа" })
      .click();
    await expect(
      page.getByText(
        "Политика сохранена. Она действует для входов и текущих сеансов.",
      ),
    ).toBeVisible();
    await page
      .getByLabel("IP для проверки политики", { exact: true })
      .fill("203.0.113.15");
    await page
      .getByRole("button", { name: "Проверить IP", exact: true })
      .click();
    await expect(page.locator(".policy-result")).toContainText(
      base.block_anonymizers ? "Доступ запрещён" : "Доступ разрешён",
    );
    await page.screenshot({
      path: "test-results/access-policy.png",
      fullPage: true,
    });
  } finally {
    expect(
      (await page.request.put("/api/v1/access-policy", { data: base })).ok(),
    ).toBeTruthy();
  }
  await page.getByRole("button", { name: "Открыть мой профиль" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Убрать фото" }).click();
  await expect(dialog.getByRole("status")).toContainText("Фото удалено");
  expect(errors).toEqual([]);
});

test("Интерактивный полигон: категории, картинка-инструкция, реальные доказательства", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("heading", { name: "Главная панель", exact: true }),
  ).toBeVisible();
  const demo = await (await page.request.post("/api/v1/demo-sessions")).json();
  try {
    await page
      .getByRole("link", { name: "Учебные сценарии", exact: true })
      .click();
    await expect(
      page.getByText(
        "Интеллектуальная система защиты Пограничной службы КНБ РК",
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Устройства", exact: true }).click();
    await page.getByLabel("Поиск учебной ситуации").fill("USB");
    await expect(page.locator(".lab-scenario")).toHaveCount(1);
    await page
      .getByRole("button", { name: /Неизвестное USB-устройство/ })
      .click();
    await page.screenshot({
      path: "test-results/training-lab.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Как это работает" }).click();
    await page.getByRole("button", { name: "Шаг 6: Сохраните PDF" }).click();
    await expect(
      page.getByRole("heading", { name: "Сохраните PDF", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Скрыть схему" }).click();
    const resultPromise = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/scenarios/usb") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Запустить сценарий", exact: true })
      .click();
    const result = await (await resultPromise).json();
    expect(result.events).toHaveLength(1);
    await expect(
      page.getByRole("heading", {
        name: "Проверка завершена — исследуйте доказательства",
      }),
    ).toBeVisible();
    await expect(page.locator(".timeline-toggle")).toHaveCount(1);
    await page.locator(".timeline-toggle").click();
    await expect(page.getByText("DEMO-USB-001", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Начать расследование" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Неизвестное USB-устройство",
    );
    await page.getByRole("button", { name: "Закрыть", exact: true }).click();
    await page.getByRole("link", { name: "Справка и обучение" }).click();
    await expect(
      page.getByRole("group", {
        name: "Интерактивная схема: шесть шагов расследования",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Шаг 5: Проведите расследование" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Проведите расследование",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/visual-guide.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page
      .getByRole("link", { name: "Учебные сценарии", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Запустить сценарий", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  } finally {
    await page.request.post(`/api/v1/demo-sessions/${demo.id}/reset`);
  }
});

test("Комиссия: сценарий → расследование → PDF → сброс своего сеанса", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Имя пользователя").fill("admin");
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("heading", { name: "Главная панель", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/command-center.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Режим комиссии" }).click();
  await page.getByRole("button", { name: "Новый сеанс", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Создан отдельный");
  await page
    .getByRole("button", { name: "Запустить проверку", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Результат проверки" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Открыть инцидент #/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Почему система создала предупреждение"),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "На проверке", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Подтверждён", exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Вывод оператора")
    .fill("Учебное расследование: события проверены, риск объяснён.");
  await dialog.getByRole("button", { name: "Сохранить расследование" }).click();
  await dialog
    .getByLabel("Комментарий", { exact: true })
    .fill("Комиссия проверила хронологию");
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(dialog.getByText("Комиссия проверила хронологию")).toBeVisible();
  await dialog.getByRole("button", { name: "Сформировать PDF" }).click();
  await expect(page.getByRole("status")).toContainText("PDF-отчёт сохранён");
  await page.screenshot({
    path: "test-results/investigation.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("link", { name: "Отчёты", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Скачать PDF" }).first().click();
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toMatch(/aegis-report/);
  await file.saveAs("test-results/commission-report.pdf");
  await page.getByRole("link", { name: "Режим комиссии" }).click();
  await page.getByRole("button", { name: "Сбросить мои данные" }).click();
  await page.getByRole("button", { name: "Подтвердить сброс" }).click();
  await expect(page.getByRole("status")).toContainText("сеанс очищен");
  expect(errors).toEqual([]);
});

test("Роли в браузере и изоляция двух демонстрационных пользователей", async ({
  browser,
  request,
}) => {
  await request.post("/api/v1/auth/login", {
    data: { username, password },
  });
  const testPassword = randomUUID() + "Aa1";
  const accounts: { id: number; username: string; role: string }[] = [];
  const contexts = [];
  try {
    for (const role of ["observer", "analyst", "demo", "demo"]) {
      const username = "qa_" + role + "_" + randomUUID().slice(0, 8);
      const response = await request.post("/api/v1/users", {
        data: { username, password: testPassword, role },
      });
      expect(response.ok()).toBeTruthy();
      accounts.push(await response.json());
    }
    for (const account of accounts) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await page.goto("/");
      await page.getByLabel("Имя пользователя").fill(account.username);
      await page.getByLabel("Пароль", { exact: true }).fill(testPassword);
      await page.getByRole("button", { name: "Войти в систему" }).click();
      await expect(
        page.getByRole("heading", { name: "Главная панель", exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Учебные сценарии" }).click();
      const run = page
        .getByRole("button", { name: "Запустить сценарий" })
        .first();
      if (account.role === "observer") await expect(run).toBeDisabled();
      else await expect(run).toBeEnabled();
      await page.getByRole("link", { name: "Пользователи и роли" }).click();
      await expect(
        page.getByText("Управление пользователями доступно администратору."),
      ).toBeVisible();
      expect((await context.request.get("/api/v1/users")).status()).toBe(403);
    }
    const a = contexts[2],
      b = contexts[3];
    const demo = await (await a.request.post("/api/v1/demo-sessions")).json();
    const run = await (
      await a.request.post("/api/v1/scenarios/bruteforce", {
        data: { demo_id: demo.id },
      })
    ).json();
    expect(run.incidents.length).toBeGreaterThan(0);
    expect(
      (await b.request.get("/api/v1/incidents/" + run.incidents[0])).status(),
    ).toBe(404);
    expect(
      (await b.request.post(`/api/v1/demo-sessions/${demo.id}/reset`)).status(),
    ).toBe(404);
    expect((await (await b.request.get("/api/v1/events")).json()).total).toBe(
      0,
    );
    expect(
      (await a.request.post(`/api/v1/demo-sessions/${demo.id}/reset`)).ok(),
    ).toBeTruthy();
  } finally {
    for (const context of contexts) await context.close();
    for (const account of accounts)
      await request.patch(`/api/v1/users/${account.id}/active`);
  }
});

test("Все разделы, поиск, фильтры и настройки правил", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("heading", { name: "Главная панель", exact: true }),
  ).toBeVisible();
  for (const title of [
    "Мониторинг событий",
    "Центр инцидентов",
    "Умный анализ",
    "Обнаружение аномалий",
    "Контроль компьютеров",
    "Учебные сценарии",
    "Расследования",
    "Отчёты",
    "Пользователи и роли",
    "История действий",
    "Настройки",
    "Справка и обучение",
  ]) {
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".error-box")).toHaveCount(0);
  }
  await page.getByRole("link", { name: "Мониторинг событий" }).click();
  await page.getByLabel("Поиск", { exact: true }).fill("нет_такого_устройства");
  await expect(
    page.getByRole("heading", { name: "События (0)" }),
  ).toBeVisible();
  await page.getByLabel("Фильтр", { exact: true }).selectOption("Критическая");
  await page.getByRole("link", { name: "Умный анализ" }).click();
  await page.getByRole("button", { name: "Настроить правило" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Сохранить правило" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
