/* Назначение файла: Проверяет подсистему ultra intro. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

/* global console */
import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const origin='http://127.0.0.1:5174';
const password=(await readFile('../.env.ultra-preview','utf8')).match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 await context.request.post(origin+'/api/v1/auth/login',{data:{username:'admin',password}});
 const page=await context.newPage();
 await page.goto(origin+'/app');
 await expect(page.getByRole('dialog',{name:'Знакомство с AegisBorder'})).toBeVisible();
 await page.screenshot({path:'../release/aegis-ultra/final/intro.png'});
 const skip=page.getByRole('button',{name:'Пропустить вступление'});
 await expect(skip).toBeFocused();
 await page.keyboard.press('Tab');
 await expect(skip).toBeFocused();
 await skip.click();
 await expect(page.locator('.ultra-intro')).toHaveCount(0);
 await page.reload();
 await expect(page.locator('.ultra-dashboard')).toBeVisible();
 await expect(page.locator('.ultra-intro')).toHaveCount(0);
 await page.getByRole('button',{name:'Повторить вступление'}).click();
 await expect(page.locator('.ultra-intro')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('.ultra-intro')).toHaveCount(0);
 const reduced=await browser.newContext({reducedMotion:'reduce'});
 await reduced.request.post(origin+'/api/v1/auth/login',{data:{username:'admin',password}});
 const reducedPage=await reduced.newPage();
 await reducedPage.goto(origin+'/app');
 await expect(reducedPage.locator('.ultra-dashboard')).toBeVisible();
 await expect(reducedPage.locator('.ultra-intro')).toHaveCount(0);
 console.log('PASS: first intro, focus, skip, one-time display, replay, Escape and reduced motion');
} finally {await browser.close();}
