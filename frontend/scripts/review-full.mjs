// Полностраничный снимок, нарезанный на кадры: node scripts/review-full.mjs <out> <url> <width> <label>
import { chromium } from "@playwright/test";
const [out, url, width = "1440", label = "full"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
await page.goto(url);
await page.waitForTimeout(1500);
// Прокручиваем страницу, чтобы сработали появления при прокрутке.
const height = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < height; y += 600) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(900);
const full = await page.evaluate(() => document.body.scrollHeight);
const slices = Math.ceil(full / 1800);
for (let i = 0; i < slices; i++) {
  await page.screenshot({ path: `${out}/${label}-${width}-${i}.png`, fullPage: true, clip: { x: 0, y: i * 1800, width: Number(width), height: Math.min(1800, full - i * 1800) } });
}
console.log(`height=${full} slices=${slices}`);
await browser.close();
