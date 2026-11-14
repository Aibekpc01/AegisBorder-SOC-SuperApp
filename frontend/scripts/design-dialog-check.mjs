/* global document, console, innerWidth */
import { chromium } from '@playwright/test';
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[]; page.on('pageerror', e=>errors.push(e.message));
await page.route('**/api/v1/**', route=> {
 const url=route.request().url();
 if(url.endsWith('/health')) return route.fulfill({json:{status:'ok'}});
 if(url.includes('auth/options')) return route.fulfill({json:{public_demo:false}});
 return route.fulfill({status:401,json:{detail:'Unauthorized'}});
});
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button',{name:'Открыть меню модулей'}).click();
await page.getByRole('dialog').waitFor();
await page.getByRole('textbox',{name:'Найти модуль'}).fill('zzzz-no-results');
await page.getByText('Ничего не найдено',{exact:true}).waitFor();
await page.screenshot({path:'../docs/design-module-empty.png'});
await page.getByRole('button',{name:'Показать все модули'}).click();
if(await page.getByRole('textbox',{name:'Найти модуль'}).inputValue()) throw Error('Search did not reset');
await page.keyboard.press('Escape');
await page.getByRole('dialog').waitFor({state:'hidden'});
console.log('Module search reset, Escape and modal close passed');
await page.goto('http://127.0.0.1:5173/app');
await page.locator('.login-card').waitFor();
for(const width of [1440,390]){
 await page.setViewportSize({width,height:1000});
 await page.screenshot({path:`../docs/design-login-${width}.png`,fullPage:true});
 console.log(JSON.stringify({screen:'login',width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
}
await page.route('**/api/v1/health',route=>route.fulfill({status:503,json:{status:'error'}}));
await page.reload();
await page.getByRole('alert').waitFor();
await page.screenshot({path:'../docs/design-entry-error.png',fullPage:true});
console.log(JSON.stringify({screen:'entry-error',errorIcon:await page.locator('.entry-error-icon').count(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
await page.route('**/api/v1/health',route=>route.fulfill({json:{status:'ok'}}));
await page.getByRole('button',{name:'Повторить проверку'}).click();
await page.locator('.login-card').waitFor();
console.log(JSON.stringify({retry:'passed',errors}));
await browser.close();
