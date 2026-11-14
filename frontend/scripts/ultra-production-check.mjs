/* Назначение файла: Проверяет подсистему ultra production. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
 * Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.
 */

/* global console */
import { chromium, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const origin='https://aegisborder.130.61.214.154.sslip.io';
const output='../release/aegis-ultra/production';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1050},reducedMotion:'reduce'});
const errors=[];
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(origin);
 await expect(page.getByRole('heading',{name:/Всё под контролем/})).toBeVisible();
 await page.screenshot({path:output+'/landing.png',fullPage:false});
 await page.goto(origin+'/app');
 await expect(page.getByText('AEGIS ULTRA / ЗАЩИЩЁННЫЙ ДОСТУП',{exact:true})).toBeVisible();
 await page.screenshot({path:output+'/login.png',fullPage:false});
 await page.getByRole('button',{name:'Открыть демонстрационный просмотр',exact:true}).click();
 await expect(page.locator('.ultra-dashboard')).toBeVisible();
 expect((await (await context.request.get(origin+'/api/v1/auth/me')).json()).role).toBe('demo_viewer');
 expect((await context.request.put(origin+'/api/v1/settings',{data:{organization:'not permitted'}})).status()).toBe(403);
 await expect(page.locator('.ultra-viewer-banner')).toBeVisible();
 await page.screenshot({path:output+'/dashboard.png',fullPage:true});
 await page.goto(origin+'/app/twin');
 await expect(page.locator('.ultra-infrastructure')).toBeVisible();
 await page.goto(origin+'/app/assistant');
 await expect(page.locator('.ultra-core')).toBeVisible();
 await context.request.post(origin+'/api/v1/auth/logout',{data:{}});
 expect(errors).toEqual([]);
 await writeFile(output+'/checks.json',JSON.stringify({url:origin,landing:200,loginScreen:true,demoViewer:true,serverWriteDenied:403,modules:['dashboard','twin','assistant'],errors},null,2));
 console.log('PASS: production UI, HTTPS, demo viewer, server permissions, modules; no JavaScript errors');
} finally {await browser.close();}
