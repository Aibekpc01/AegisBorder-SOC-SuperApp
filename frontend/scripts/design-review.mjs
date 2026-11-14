/* global document, window, setTimeout, console, innerWidth, getComputedStyle */
import { chromium } from '@playwright/test';
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/v1/health', route=>route.fulfill({json:{status:'ok'}}));
await page.goto('http://127.0.0.1:5173');
await page.locator('.landing-hero').waitFor();
await page.waitForTimeout(1000);
for (const width of [1440,768,390]) {
 await page.setViewportSize({width,height:1000});
 await page.evaluate(async()=>{ for(let y=0;y<document.body.scrollHeight;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));} window.scrollTo(0,0); });
 await page.waitForTimeout(650);
 await page.screenshot({path:`../docs/design-${width}.png`,fullPage:width===1440});
 console.log(JSON.stringify({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),marks:await page.locator('.hero-identity-emblems .aegis-signature img').count()}));
}
await page.locator('.preview-console aside button').nth(1).click();
await page.locator('.preview-detail h3').filter({hasText:'Неизвестный USB'}).waitFor();
await page.emulateMedia({reducedMotion:'reduce'});
await page.waitForTimeout(100);
console.log(JSON.stringify({errors,pendingHidden:await page.locator('.reveal-pending').count(),animation:await page.locator('.preview-detail').evaluate(e=>getComputedStyle(e).animationName)}));
await browser.close();
