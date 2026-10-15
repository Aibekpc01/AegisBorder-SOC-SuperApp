/* global process, console, document, innerWidth */
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const origin=process.env.PRESENCE_ORIGIN || 'http://127.0.0.1:5176';
const prod=origin.startsWith('https:');
const out=`../release/presence/${prod?'production':'preview'}`;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 if(!prod){
  await page.goto(origin+'/app');
  const password=(await readFile('../.env.ultra-preview','utf8')).match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();
  await page.getByLabel('Имя пользователя').fill('admin');
  await page.getByLabel('Пароль',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Войти в систему',exact:true}).click();
  await expect(page.locator('.ultra-dashboard')).toBeVisible();
  await page.goto(origin+'/app/participants');
  await expect(page.locator('.page-heading h1')).toHaveText('Участники');
  await expect(page.locator('.presence-card').first()).toBeVisible();
  await page.screenshot({path:out+'/participants.png',fullPage:true});
  await page.getByRole('button',{name:'Редактировать admin',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(origin+'/app/assets');
  await expect(page.locator('.device-card').first()).toBeVisible();
  await page.screenshot({path:out+'/devices.png',fullPage:true});
  await context.request.post(origin+'/api/v1/auth/logout',{data:{}});
 }
 await page.goto(origin+'/app');
 await page.getByRole('button',{name:'Открыть демонстрационный просмотр',exact:true}).click();
 await expect(page.locator('.demo-welcome')).toBeVisible();
 await expect(page.locator('.ultra-dashboard')).toBeVisible();
 const incidents=await context.request.get(origin+'/api/v1/incidents');
 expect(incidents.ok()).toBe(true);
 const body=await incidents.json();
 expect(Array.isArray(body)?body.length:(body.items||body.incidents||[]).length).toBeGreaterThanOrEqual(3);
 await page.screenshot({path:out+'/demo.png',fullPage:true});
 await page.goto(origin+'/app/participants');
 await expect(page.locator('.presence-card').first()).toBeVisible();
 await expect(page.getByRole('button',{name:/Редактировать/})).toHaveCount(0);
 await page.getByRole('button',{name:'Демогости',exact:true}).click();
 await expect(page.locator('.presence-card').first()).toContainText('Гость');
 await page.screenshot({path:out+'/guests.png',fullPage:true});
 await page.goto(origin+'/app/team');
 await expect(page.locator('.team-member .presence-badge').first()).toBeVisible();
 await page.goto(origin+'/app/assets');
 await expect(page.locator('.device-card').first()).toBeVisible();
 for(const width of [390,768,1440]) {
  await page.setViewportSize({width,height:900});
  for(const route of ['participants','assets']) {
   await page.goto(origin+'/app/'+route);
   await expect(page.locator('.presence-card').first()).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
   if(width===390)await page.screenshot({path:out+'/'+route+'-mobile.png',fullPage:true});
  }
 }
 await context.request.post(origin+'/api/v1/auth/logout',{data:{}});
 expect(errors).toEqual([]);
 console.log('PASS: participants, devices, guest visibility, seeded incidents, admin edit dialog, mobile layout, no JS errors');
} finally { await browser.close(); }
