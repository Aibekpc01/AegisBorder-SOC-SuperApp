/* global process, console, document, innerWidth */
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const origin=process.env.AEGIS_CHECK_ORIGIN || 'https://aegisborder.130.61.214.154.sslip.io';
const output=origin.startsWith('https:')?'../release/design-r14/production':'../release/design-r14/stage';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[], checks=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 const response=await context.request.get(origin+'/api/v1/health');
 expect(response.status()).toBe(200); expect((await response.json()).status).toBe('ok');
 for (const width of [1440,768,390]) {
  await page.setViewportSize({width,height:1000});
  await page.goto(origin);
  await expect(page.locator('.landing-hero')).toBeVisible();
  await expect(page.locator('.hero-identity-emblems img')).toHaveCount(3);
  await expect.poll(()=>page.locator('.hero-identity-emblems img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)),{timeout:20000}).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:output+`/landing-${width}.png`});
 }
 checks.push('HTTPS/health; landing 1440/768/390; three loaded identity marks; no overflow');
 await page.getByRole('button',{name:'Открыть меню модулей'}).click();
 await page.getByRole('textbox',{name:'Найти модуль'}).fill('zzzz-no-results');
 await expect(page.getByText('Ничего не найдено',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Показать все модули'}).click();
 await expect(page.getByRole('textbox',{name:'Найти модуль'})).toHaveValue('');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 checks.push('Module dialog search/reset/Escape');
 await page.goto(origin+'/app');
 await expect(page.locator('.login-card')).toBeVisible();
 await page.screenshot({path:output+'/login-mobile.png'});
 const env=await readFile('../.env.server-admin','utf8');
 const password=env.match(/^PASSWORD=(.*)$/m)?.[1].trim();
 if(!password) throw Error('Admin credential not found');
 await page.getByLabel('Имя пользователя').fill('admin');
 await page.getByLabel('Пароль',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Войти в систему',exact:true}).click();
 await expect(page.locator('.shell, .dlp-required')).toBeVisible({timeout:30000});
 const me=await context.request.get(origin+'/api/v1/auth/me');
 expect(me.status()).toBe(200);
 expect((await me.json()).username).toBe('admin');
 checks.push('Existing administrator login');
 if(await page.locator('.dlp-required').isVisible()) {
  await page.screenshot({path:output+'/administrator-dlp-required.png'});
  checks.push('Existing administrator DLP requirement preserved; no policy changes');
  await context.request.post(origin+'/api/v1/auth/logout',{data:{}});
  await page.goto(origin+'/app');
  await page.getByRole('button',{name:'Открыть демонстрационный просмотр',exact:true}).click();
  await expect(page.locator('.shell')).toBeVisible();
  checks.push('Read-only demo viewer used for module checks');
 }
 const routes=(process.env.AEGIS_CHECK_ROUTES || ',events,incidents,team,workspace,users,assets').split(',');
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  for(const route of routes) {
   await page.goto(origin+'/app'+(route?'/'+route:''));
   await expect(page.locator('.shell')).toBeVisible();
   await page.waitForTimeout(600);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow at '+width).toBe(true);
   await page.screenshot({path:output+`/${route||'dashboard'}-${width}.png`});
  }
 }
 checks.push('Authenticated routes '+JSON.stringify(routes)+' at 1440/390; no page overflow');
 await context.request.post(origin+'/api/v1/auth/logout',{data:{}});
 expect(errors).toEqual([]);
 await writeFile(output+'/checks.json',JSON.stringify({origin,checks,errors},null,2));
 console.log(JSON.stringify({origin,checks,errors}));
} finally { await browser.close(); }
