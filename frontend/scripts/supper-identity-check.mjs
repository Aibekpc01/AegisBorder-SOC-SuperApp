/* global console, process, document, innerWidth, getComputedStyle */
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const origin=process.env.SUPPER_ORIGIN||'http://127.0.0.1:5174';
const production=origin.startsWith('https:');
const out=`../release/supper-identity/${production?'production':'after'}`;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1050},reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(origin);
 await expect(page).toHaveTitle(/AegisBorder Supper/);
 await expect(page.locator('.landing-hero h1')).toHaveText(/AegisBorder\s*Supper/);
 await expect(page.locator('.hero-mission')).toContainText('Цифровое суперприложение для расследования киберинцидентов и защиты информации в Пограничной службе КНБ РК');
 await expect(page.locator('.hero-identity-emblems img')).toHaveCount(2);
 await expect.poll(()=>page.locator('.hero-identity-emblems img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)),{timeout:20000}).toBe(true);
 await page.screenshot({path:out+'/landing.png'});
 await page.goto(origin+'/app');
 await expect(page.getByText('AegisBorder Supper / ЗАЩИЩЁННЫЙ ДОСТУП',{exact:true})).toBeVisible();
 await page.screenshot({path:out+'/login.png'});
 if(production){await page.getByRole('button',{name:'Открыть демонстрационный просмотр',exact:true}).click();}
 else {
  const password=(await readFile('../.env.ultra-preview','utf8')).match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();
  await page.getByLabel('Имя пользователя').fill('admin');
  await page.getByLabel('Пароль',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Войти в систему',exact:true}).click();
 }
 await expect(page.locator('.ultra-dashboard')).toBeVisible();
 await expect(page.locator('.shell').getByRole('link',{name:'Чат',exact:true})).toBeVisible();
 await expect(page.locator('.shell').getByRole('link',{name:'Команда проекта',exact:true})).toHaveCount(0);
 await page.screenshot({path:out+'/dashboard.png',fullPage:true});
 await page.goto(origin+'/app/team');
 await expect(page.locator('.page-heading h1')).toHaveText('Чат');
 await expect(page.locator('.team-chat-log')).toBeVisible();
 await expect(page.getByRole('button',{name:'Общий чат',exact:true})).toBeVisible();
 await expect(page.locator('.corporate-chat-heading')).toContainText('Обсуждайте киберинциденты');
 await page.screenshot({path:out+'/chat.png',fullPage:true});
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(origin+'/');
  await expect(page.locator('.hero-identity-emblems')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(width===390)await page.screenshot({path:out+'/mobile.png',fullPage:false});
 }
 await context.request.post(origin+'/api/v1/auth/logout',{data:{}});
 const motion=await browser.newContext({reducedMotion:'no-preference'});
 const motionPage=await motion.newPage();
 await motionPage.goto(origin);
 const emblem=motionPage.locator('.hero-identity-emblems .institution-emblem').first();
 await expect(emblem).toBeVisible();
 expect(await emblem.evaluate(e=>getComputedStyle(e).animationIterationCount)).toBe('1');
 expect(await page.locator('.hero-identity-emblems .institution-emblem').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
 expect(errors).toEqual([]);
 await writeFile(out+'/checks.json',JSON.stringify({origin,brand:true,slogan:true,emblems:true,chat:true,responsive:true,reducedMotion:true,errors},null,2));
 console.log('PASS: Supper branding, slogan, both emblems, chat, responsive layout, restrained motion; no JavaScript errors');
} finally {await browser.close();}
