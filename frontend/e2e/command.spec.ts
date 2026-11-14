/* Назначение файла: Проверяет подсистему command.spec. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
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

test("Экран входа показывает отказ сервера без выдуманной успешной проверки", async ({page})=>{
  await page.route("**/api/v1/health",route=>route.fulfill({status:503,contentType:"application/json",body:'{"status":"unavailable"}'}));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Сервер пока не отвечает");
  await expect(page.locator(".entry-check")).toContainText("Нет ответа");
  await page.getByRole("button",{name:"Открыть описание проекта"}).click();
  await expect(page.getByRole("heading",{name:"AegisBorder Supper"})).toBeVisible();
});

test("История защиты, честная загрузка, автоматический город и корпоративный приёмник", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({latitude:43.2389,longitude:76.8897,accuracy:100});
  await page.goto("/");
  await expect(page.getByRole("heading", {name:/Попытка атаки/})).toBeVisible();
  await expect(page.locator(".defense-module-grid button")).toHaveCount(21);
  await page.locator(".defense-module-grid").getByRole("button",{name:/Почтовая безопасность/}).click();
  await expect(page.locator(".defense-explanation")).toContainText("Проверьте текст");
  await page.locator(".defense-module-grid").getByRole("button",{name:/Чат/}).click();
  await expect(page.locator(".defense-explanation")).toContainText("Обсудите проверку");
  await expect(page.locator(".landing-catalog")).not.toContainText("В разработке");
  await expect(page.locator(".landing-integrations")).not.toContainText("Запланировано");
  await page.locator(".defense-story").screenshot({path:"test-results/defense-story.png"});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  await page.locator(".defense-story").screenshot({path:"test-results/defense-story-mobile.png"});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("/app");
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Войти в систему"}).click();
  await expect(page.locator(".entry-location")).toContainText("Алматы");
  await page.goto("/app/integrations");
  await page.locator(".connector-providers").getByRole("button",{name:/Любая система/}).click();
  await page.getByLabel("Название корпоративного подключения").fill("QA корпоративный приёмник");
  await page.getByRole("button",{name:"Создать защищённый приёмник"}).click();
  await expect(page.locator(".connector-success")).toContainText("Приёмник создан");
  await page.getByRole("button",{name:"Проверить ключ и API"}).click();
  await expect(page.locator(".connector-success")).toContainText("Ключ и API работают");
  await page.getByText("Проверить передачу учебного события",{exact:true}).click();
  await page.getByRole("button",{name:"Подготовить пример для этого продукта"}).click();
  await page.getByRole("button",{name:"Отправить учебное событие"}).click();
  await expect(page.locator(".connector-success")).toContainText("Добавлено: 1");
  await expect(page.locator(".connector-metrics")).toContainText("События поступают");
  await page.getByRole("button",{name:"Отправить учебное событие"}).click();
  await expect(page.locator(".connector-success")).toContainText("повторов: 1");
  const pendingDownload=page.waitForEvent("download");
  await page.getByRole("button",{name:"Скачать инструкцию подключения"}).click();
  const download=await pendingDownload;
  await download.saveAs("test-results/connector-guide.md");
  expect(await readFile("test-results/connector-guide.md","utf8")).toContain("AEGIS_CONNECTOR_TOKEN");
  await page.locator(".corporate-integrations").screenshot({path:"test-results/corporate-integrations.png"});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  await page.getByRole("button",{name:"Отключить приём",exact:true}).click();
  await expect(page.locator(".connector-metrics")).toContainText("Отключён");
});

test("Дизайн показа: интерактивные этапы, учебники и слайды всех разделов", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app");
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("link", { name: "Показать систему по шагам" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Показать этап: Решение человека" })
    .click();
  await expect(page.locator(".experience-caption")).toContainText(
    "Ответственный проверяет контекст",
  );
  await page.goto("/app/commission");
  await expect(
    page.getByRole("heading", {
      name: "Демонстрация проекта",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.locator(".demo-chapter-grid button")).toHaveCount(6);
  await page
    .locator(".demo-chapter-grid")
    .getByRole("button", { name: /Провести расследование/ })
    .click();
  await expect(page.locator(".experience-slide")).toContainText(
    "Назначьте ответственного",
  );
  await page.screenshot({
    path: "test-results/presentation-landing.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/app/academy");
  await expect(page.locator(".academy-catalog > button")).toHaveCount(12);
  await page.getByLabel("Поиск учебника").fill("Пароли");
  await page
    .locator(".academy-catalog")
    .getByRole("button", { name: /Пароли и коды доступа/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Пароли и коды доступа", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Следующая глава", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Код — тоже секрет", exact: true }),
  ).toBeVisible();
  const lessonDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Скачать учебник", exact: true })
    .click();
  const lesson = await lessonDownload;
  await lesson.saveAs("test-results/passwords-book.md");
  expect(await readFile("test-results/passwords-book.md", "utf8")).toContain(
    "Код — тоже секрет",
  );
  await page.screenshot({
    path: "test-results/academy-library.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/app/help");
  await page.getByLabel("Поиск раздела для обучения").fill("Задачи");
  await page
    .getByRole("navigation", { name: "Разделы учебника" })
    .getByRole("button", { name: "Задачи и согласования", exact: true })
    .click();
  await page.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(page.locator(".learning-slide-stage")).toContainText(
    "Напишите задачу",
  );
  const guideDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать учебник по сайту" }).click();
  await (await guideDownload).saveAs("test-results/platform-guide.md");
  expect(await readFile("test-results/platform-guide.md", "utf8")).toContain(
    "Чат",
  );
  await page.screenshot({
    path: "test-results/learning-center.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/app/commission");
  await expect(page.locator(".demo-chapter-grid button")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app");
  await expect(page.locator(".experience-core")).toBeVisible();
  expect(
    await page
      .locator(".experience-core")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  expect(errors).toEqual([]);
});

test("Чат: сообщения между участниками, сохранение и мобильный экран", async ({
  browser,
  page,
}) => {
  await page.goto("/app");
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("heading", { name: "Главная панель", exact: true }),
  ).toBeVisible();
  const colleagueName = "qa_team_" + randomUUID().slice(0, 8),
    colleaguePassword = randomUUID() + "Aa1!";
  const colleagueResponse = await page.request.post("/api/v1/users", {
    data: {
      username: colleagueName,
      password: colleaguePassword,
      role: "analyst",
      full_name: "Учебный участник проверки чата",
      department: "Тестовый проект",
    },
  });
  expect(colleagueResponse.status()).toBe(200);
  const colleague = await colleagueResponse.json(),
    context = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
  try {
    const reader = await context.newPage();
    await reader.goto("/app");
    await reader.getByLabel("Имя пользователя").fill(colleagueName);
    await reader.getByLabel("Пароль", { exact: true }).fill(colleaguePassword);
    await reader.getByRole("button", { name: "Войти в систему" }).click();
    await expect(
      reader.getByRole("heading", { name: "Главная панель", exact: true }),
    ).toBeVisible();
    await page.goto("/app/team");
    await reader.goto("/app/team");
    await expect(
      page.getByRole("heading", {
        name: "Учебный участник проверки чата",
        exact: true,
      }),
    ).toBeVisible();
    const text = "Учебное сообщение проверки " + randomUUID().slice(0, 8);
    await page.getByLabel("Сообщение команде").fill(text);
    await page
      .getByRole("button", { name: "Отправить сообщение", exact: true })
      .click();
    await expect(
      page.getByRole("log", { name: "Сообщения команды" }),
    ).toContainText(text);
    await expect(
      reader.getByRole("log", { name: "Сообщения команды" }),
    ).toContainText(text, { timeout: 10000 });
    await reader
      .getByRole("button", { name: "Вопросы и помощь", exact: true })
      .click();
    await expect(
      reader.getByRole("log", { name: "Сообщения команды" }),
    ).not.toContainText(text);
    await page.reload();
    await expect(
      page.getByRole("log", { name: "Сообщения команды" }),
    ).toContainText(text);
    await page.screenshot({
      path: "test-results/project-team.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
    await page.request.patch(`/api/v1/users/${colleague.id}/active`);
  }
});

test("Помощник не уводит со страницы с несохранённым документом", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("heading", { name: "Главная панель", exact: true }),
  ).toBeVisible();
  const response = await page.request.post("/api/v1/workspace/documents", {
    data: { title: "Проверка защиты экскурсии " + randomUUID().slice(0, 8) },
  });
  expect(response.status()).toBe(201);
  const document = await response.json();
  await page.goto(`/app/workspace?document=${document.id}`);
  await expect(page.locator(".document-save-state")).toContainText("Сохранено");
  await page.route(
    `**/api/v1/workspace/documents/${document.id}`,
    async (route) => {
      if (route.request().method() === "PUT")
        await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    },
  );
  const editor = page.getByRole("textbox", { name: "Текст документа" });
  await editor.fill("Изменения должны сохраниться перед экскурсией");
  await expect(page.locator(".document-save-state")).toContainText(
    /ожидают|Сохранение/,
  );
  await page
    .getByRole("button", { name: "Помощник по сайту", exact: true })
    .click();
  const guide = page.getByRole("complementary", {
    name: "Локальный помощник по сайту",
  });
  await guide.getByRole("button", { name: "Весь сайт", exact: true }).click();
  await expect(guide).toContainText("Дождитесь сохранения документа");
  await expect(page).toHaveURL(new RegExp(`document=${document.id}$`));
  await expect(page.locator(".document-save-state")).toContainText(
    "Сохранено",
    { timeout: 10000 },
  );
  await guide.getByRole("button", { name: "Закрыть помощника" }).click();
  await page.reload();
  await expect(editor).toContainText(
    "Изменения должны сохраниться перед экскурсией",
  );
});

test("Бесплатный помощник: локальные ответы, подсветка блоков и экскурсия без изменений данных", async ({
  page,
}) => {
  const externalCalls: string[] = [],
    writes: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:8000") &&
      /^https?:/.test(request.url())
    )
      externalCalls.push(request.url());
    if (
      request.method() !== "GET" &&
      request.url().includes("/api/v1/") &&
      !request.url().includes("/auth/")
    )
      writes.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Помощник по сайту", exact: true })
    .click();
  let guide = page.getByRole("complementary", {
    name: "Локальный помощник по сайту",
  });
  await guide
    .getByRole("button", { name: "Объясни страницу", exact: true })
    .click();
  await expect(guide).toContainText("учебной платформой AegisBorder");
  await guide
    .getByLabel("Вопрос помощнику по сайту")
    .fill("Кто взломал компьютер вчера?");
  await guide.getByRole("button", { name: "Задать вопрос" }).click();
  await expect(guide).toContainText("нет отдельного подготовленного ответа");
  await guide.getByRole("button", { name: "Весь сайт", exact: true }).click();
  await expect(guide).toContainText("Шаг 1 из 7");
  await guide
    .getByRole("button", { name: "Следующий шаг", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("heading", { name: "Главная панель", exact: true }),
  ).toBeVisible();
  await guide
    .getByRole("button", { name: "Покажи блоки", exact: true })
    .click();
  await expect(
    guide.getByRole("heading", { name: "Назначение страницы" }),
  ).toBeVisible();
  await expect(page.locator(".page-heading")).toHaveClass(
    /aegis-guide-highlight/,
  );
  await guide
    .getByRole("button", { name: "Следующий шаг", exact: true })
    .click();
  await expect(page.locator(".first-visit")).toHaveClass(
    /aegis-guide-highlight/,
  );
  await guide.getByRole("button", { name: "Закрыть помощника" }).click();
  await expect(page.locator(".aegis-guide-highlight")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Помощник: объяснить этот блок", exact: true })
    .first()
    .click();
  guide = page.getByRole("complementary", {
    name: "Локальный помощник по сайту",
  });
  await expect(guide).toContainText("Поток событий");
  await page.screenshot({
    path: "test-results/free-site-guide.png",
    fullPage: true,
    animations: "disabled",
  });
  await guide.getByRole("button", { name: "Закрыть помощника" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Помощник по сайту", exact: true })
    .click();
  await guide.getByRole("button", { name: "Объяснения", exact: true }).click();
  await guide
    .getByRole("button", { name: "Что такое риск?", exact: true })
    .click();
  await expect(guide).toContainText("не процент вероятности атаки");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/free-site-guide-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(writes).toEqual([]);
  expect(externalCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test("Понятный интерфейс: объяснения, словарь, формы без JSON и мобильное меню", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app");
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("link", { name: "Показать систему по шагам" }),
  ).toBeVisible();
  await page.locator(".mode").click();
  await expect(
    page.getByRole("link", { name: "Показать систему по шагам" }),
  ).toHaveCount(0);
  await page.locator(".mode").click();
  await page.getByRole("button", { name: "Словарь простыми словами" }).click();
  const glossary = page.getByRole("dialog");
  await glossary.getByLabel("Найти слово в словаре").fill("риск");
  await expect(glossary.locator("dt", { hasText: /^Риск$/ })).toBeVisible();
  await expect(glossary).toContainText("не процент вероятности атаки");
  await glossary.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByLabel("Найти раздел").fill("поручения");
  await expect(
    page.getByRole("link", { name: "Задачи и согласования", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Найти раздел").fill("");
  await page.screenshot({
    path: "test-results/beginner-home-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Включить светлую тему" }).click();
  await page.screenshot({
    path: "test-results/beginner-home-light.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/app/mail");
  await page.getByRole("button", { name: "Взять обычное письмо" }).click();
  await page.getByRole("button", { name: "Проверить сообщение" }).click();
  await expect(page.getByRole("status")).toContainText("0/100");
  await page
    .getByRole("button", { name: "Взять подозрительное письмо" })
    .click();
  await page.getByRole("button", { name: "Проверить сообщение" }).click();
  await expect(page.getByRole("status")).toContainText("100/100");
  await expect(page.getByRole("status")).toContainText("Что делать:");

  await page.goto("/app/scenario-builder");
  await expect(
    page.getByRole("region", { name: "Объяснение раздела простыми словами" }),
  ).toBeVisible();
  await page
    .getByText("Как пользоваться — 3 простых шага", { exact: false })
    .click();
  await expect(page.locator(".page-primer ol")).toBeVisible();
  await expect(page.locator(".module-code")).not.toBeVisible();
  const title = "Тренировка без кода " + randomUUID().slice(0, 8);
  await page.getByLabel("Название", { exact: true }).fill(title);
  await page.getByLabel("Что произошло?").selectOption("failed-login");
  await page
    .getByLabel("Учебный компьютер")
    .fill("Учебный компьютер для комиссии");
  await page.getByLabel("Учебный пользователь").fill("Учебный сотрудник");
  await page
    .getByRole("button", { name: "Подготовить учебные записи" })
    .click();
  await page.getByRole("button", { name: "Сохранить шаблон" }).click();
  const template = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await template
    .getByRole("button", { name: "Запустить в личном сеансе" })
    .click();
  await expect(page.getByRole("status")).toContainText("сохранено 5 событий");
  await page.screenshot({
    path: "test-results/beginner-scenario-form.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await expect(
    page.getByRole("link", { name: "Показать систему по шагам" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Открыть меню модулей" }).click();
  await page.getByRole("dialog").getByLabel("Найти модуль").fill("Задачи");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Задачи и согласования" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Задачи и согласования",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Задачи и проверка выполнения",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/beginner-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("SuperApp: tasks, mail, academy, imports, twin and scenario builder", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app");
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("heading", { name: "Главная панель", exact: true }),
  ).toBeVisible();

  await page.goto("/app/tasks");
  const taskTitle = "UI task " + randomUUID().slice(0, 8);
  await page.getByLabel("Задача", { exact: true }).fill(taskTitle);
  await page
    .getByRole("button", { name: "Создать задачу", exact: true })
    .click();
  const task = page.locator("article").filter({
    has: page.getByRole("heading", { name: taskTitle, exact: true }),
  });
  await expect(task).toBeVisible();
  await task.getByRole("button", { name: "В работе", exact: true }).click();
  await expect(task.locator(".badge")).toHaveText("В работе");
  await page.reload();
  await expect(task.locator(".badge")).toHaveText("В работе");

  await page.goto("/app/mail");
  await page.getByLabel("Отправитель").fill("training@example.test");
  await page.getByLabel("Тема", { exact: true }).fill("Срочно: пароль");
  await page
    .getByLabel("Текст письма")
    .fill("Введите пароль https://127.0.0.1/login");
  await page.getByLabel("Имена вложений через запятую").fill("update.exe");
  await page.getByRole("button", { name: "Проверить сообщение" }).click();
  await expect(page.getByRole("status")).toContainText("100/100");

  await page.goto("/app/academy");
  const course = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Подозрительные письма",
      exact: true,
    }),
  });
  await course.getByLabel("Проверить запрос независимым каналом").check();
  await course.getByLabel("Нужна собственная проверка").check();
  await course.getByRole("button", { name: "Проверить ответы" }).click();
  await expect(page.getByRole("status")).toContainText("Курс пройден");

  await page.goto("/app/integrations");
  await page.getByRole("button", { name: "Заполнить учебный пример" }).click();
  await page.getByRole("button", { name: "Проверить файл" }).click();
  await expect(
    page.getByRole("heading", { name: "Проверено событий: 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Импортировать в базу" }).click();
  await expect(page.getByRole("status")).toContainText("Добавлено: 1");
  const m365Import = await page.request.post("/api/v1/superapp/imports", {
    data: {
      content: JSON.stringify([
        {
          external_id: "m365-ui-" + randomUUID(),
          time: new Date().toISOString(),
          device: "M365-TRAINING",
          account: "training-user",
          source: "Microsoft 365",
          type: "usb_connected",
          detail: "Учебное событие Microsoft 365",
          features: { approved: false },
        },
      ]),
    },
  });
  expect(m365Import.status()).toBe(201);
  await page.goto("/app/m365");
  await expect(page.locator("main table")).toContainText(
    "Учебное событие Microsoft 365",
  );

  await page.goto("/app/twin");
  await page.getByRole("button", { name: /TRAINING-PC/ }).click();
  await expect(
    page.getByRole("heading", { name: "TRAINING-PC: связи" }),
  ).toBeVisible();
  await page.goto("/app/scenario-builder");
  const scenarioTitle = "UI scenario " + randomUUID().slice(0, 8);
  await page.getByLabel("Название", { exact: true }).fill(scenarioTitle);
  await page.getByRole("button", { name: "Заполнить учебный пример" }).click();
  await page.getByRole("button", { name: "Сохранить шаблон" }).click();
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: scenarioTitle, exact: true }),
    })
    .getByRole("button", { name: "Запустить в личном сеансе" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "сохранено 1 событий; инцидентов 1",
  );
  const incidentId = (
    await (await page.request.get("/api/v1/incidents")).json()
  )[0].id;
  await page.goto("/app/assistant");
  await page.getByLabel("Выберите инцидент").selectOption(String(incidentId));
  await expect(page.locator("main article")).toContainText(
    `Инцидент #${incidentId}`,
  );
  const docTitle = "Graph document " + randomUUID().slice(0, 8);
  const documentResponse = await page.request.post(
    "/api/v1/workspace/documents",
    { data: { title: docTitle, incident_id: incidentId } },
  );
  expect(documentResponse.status()).toBe(201);
  await page.goto("/app/incidents");
  await page
    .getByRole("button", {
      name: `Открыть инцидент ${incidentId}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Граф доказательств", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Показать события устройства TRAINING-PC",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Хронология: TRAINING-PC" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Увеличить граф" }).click();
  await page.getByRole("link", { name: new RegExp(docTitle) }).click();
  await expect(
    page.getByLabel("Название документа", { exact: true }),
  ).toHaveValue(docTitle);
  await page.reload();
  await expect(
    page.getByLabel("Название документа", { exact: true }),
  ).toHaveValue(docTitle);
  await page.goto(`/app/workspace?incident=${incidentId}`);
  await expect(
    page.getByRole("button", { name: new RegExp(docTitle) }),
  ).toBeVisible();
  await page.goto("/app/rule-builder");
  const ruleTitle = "UI rule " + randomUUID().slice(0, 8);
  await page.getByLabel("Название", { exact: true }).fill(ruleTitle);
  await page.getByLabel("Какое действие отслеживать").selectOption("custom");
  await page
    .getByLabel("Тип события", { exact: true })
    .fill("custom_ui_training");
  await page
    .getByLabel("Объяснение", { exact: true })
    .fill("Проверка конструктора правил");
  await page
    .getByRole("button", { name: "Создать правило", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(ruleTitle);
  await page.goto("/app/security-analytics");
  await expect(
    page.getByRole("heading", { name: "По статусам" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/superapp-analytics.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/tasks");
  await expect(
    page.getByRole("heading", { name: "Задачи и проверка выполнения" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("SuperApp: публичный лендинг, темы и сохранение Workspace после обновления", async ({
  page,
}) => {
  const errors: string[] = [],
    privateCalls: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/") && !request.url().endsWith("/api/v1/health")) privateCalls.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "AegisBorder Supper" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Неизвестный USB/ }).click();
  await expect(page.locator(".preview-detail h3")).toHaveText(
    "Неизвестный USB",
  );
  await page.getByRole("button", { name: "Включить светлую тему" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({
    path: "test-results/superapp-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Включить тёмную тему" }).click();
  await page.screenshot({
    path: "test-results/superapp-landing.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(privateCalls).toEqual([]);
  await page
    .getByRole("link", { name: "Открыть SuperApp", exact: true })
    .click();
  await page.getByLabel("Имя пользователя").fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти в систему" }).click();
  await expect(
    page.getByRole("heading", { name: "Главная панель", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Документы и рабочее пространство" })
    .click();
  const title = "Учебный материал UI " + randomUUID().slice(0, 8);
  await page
    .getByRole("button", { name: "Создать документ", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Название документа").fill(title);
  await dialog.getByRole("button", { name: "Создать и открыть" }).click();
  await expect(page.locator(".document-save-state")).toContainText("Сохранено");
  const editor = page.getByRole("textbox", { name: "Текст документа" });
  await editor.click();
  await editor.press("Control+End");
  await editor.press("Enter");
  await editor.pressSequentially("Доказательства сохранены в PostgreSQL");
  await expect(page.locator(".document-save-state")).toContainText(
    "Сохранено",
    { timeout: 15000 },
  );
  await page
    .getByRole("button", { name: "Вставить таблицу", exact: true })
    .click();
  await expect(editor.locator("table")).toBeVisible();
  await expect(page.locator(".document-save-state")).toContainText(
    "Сохранено",
    { timeout: 15000 },
  );
  await page
    .getByLabel("Комментарий к документу")
    .fill("Учебная заметка комиссии");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(
    page.getByText("Учебная заметка комиссии", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Отправить на проверку" }).click();
  await expect(page.locator(".document-status")).toContainText("На проверке");
  await page.getByRole("button", { name: "Утвердить документ" }).click();
  await expect(page.locator(".document-status")).toContainText("Утверждён");
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await page.getByRole("button", { name: "История версий" }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: /Версия 1 · Черновик/ }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /Версия 1 · Черновик/ }).click();
  await expect(
    page.getByRole("dialog").last().getByRole("heading", { name: title }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/workspace-editor.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    page.getByRole("textbox", { name: "Текст документа" }),
  ).toContainText("Доказательства сохранены в PostgreSQL");
  await expect(page.locator(".document-paper table")).toBeVisible();
  await expect(
    page.getByText("Учебная заметка комиссии", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "К документам" }).click();
  await page.getByLabel("Поиск документов").fill(title);
  await expect(page.locator(".document-card")).toHaveCount(1);
  // Старые прямые ссылки продолжают открывать прежние страницы.
  await page.goto("/events");
  await expect(
    page.getByRole("heading", { name: "Мониторинг событий", exact: true }),
  ).toBeVisible();
  await page.goto("/assets");
  await expect(
    page.getByRole("heading", { name: "Контроль компьютеров", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Открыть глобальный поиск", exact: true })
    .click();
  await page.getByLabel("Глобальный поиск", { exact: true }).fill("учеб");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Инциденты", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Открыть уведомления об инцидентах" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Текущие незакрытые инциденты",
  );
  expect(errors).toEqual([]);
});

test("Личный профиль, фото, история IP, геолокация и проверка политики VPN", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app");
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
  await dialog.getByLabel("Фото пользователя", { exact: true }).setInputFiles({
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
  await page.goto("/app");
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
    await page.getByRole("button", { name: "Открыть меню модулей" }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Киберполигон", exact: true })
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
  await page.goto("/app");
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
  await page.getByRole("link", { name: "Демонстрация проекта" }).click();
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
  await page.getByRole("link", { name: "Демонстрация проекта" }).click();
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
      await page.goto("/app");
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
  await page.goto("/app");
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
