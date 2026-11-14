import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('../release/emblems-r15',{recursive:true});
try {
for(const width of [1440,390]) {
await page.setViewportSize({width,height:1000});
await page.goto('https://aegisborder.130.61.214.154.sslip.io/');
await expect(page.locator('.hero-identity-emblems img')).toHaveCount(2);
await expect(page.locator('.emblem-pair .aegis-signature')).toHaveCount(0);
await expect.poll(()=>page.locator('.hero-identity-emblems img').evaluateAll(items=>items.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
await page.screenshot({path:`../release/emblems-r15/landing-${width}.png`});
}
await page.goto('https://aegisborder.130.61.214.154.sslip.io/app');
await expect(page.locator('.login-emblems img')).toHaveCount(2);
await expect(page.locator('.emblem-pair .aegis-signature')).toHaveCount(0);
expect(errors).toEqual([]);
console.log('PASS: desktop/mobile and login show two official emblems without adjacent Aegis; no page errors');
} finally {await browser.close();}
