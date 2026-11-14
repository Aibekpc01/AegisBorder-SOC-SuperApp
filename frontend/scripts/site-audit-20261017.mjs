import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const origin='https://aegisborder.130.61.214.154.sslip.io';
const dir='../release/site-audit-20261017';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const ctx=await browser.newContext({reducedMotion:'reduce'});const page=await ctx.newPage();
const result={date:new Date().toISOString(),origin,pages:[],api:[],errors:[],responses:[],failures:[]};
page.on('pageerror',e=>result.errors.push({url:page.url(),message:e.message}));
page.on('response',r=>{if(r.status()>=400)result.responses.push({url:r.url().replace(origin,''),status:r.status()});});
page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')result.failures.push({url:r.url(),error:r.failure()?.errorText});});
async function inspect(path,width,label){
 await page.setViewportSize({width,height:1000});
 const response=await page.goto(origin+path);await page.locator('.landing-hero, .login-card, .shell, .dlp-required').first().waitFor({state:'visible',timeout:30000});await page.waitForTimeout(350);
 const data=await page.evaluate(()=>({title:document.title,lang:document.documentElement.lang,description:document.querySelector('meta[name=description]')?.content,h1:[...document.querySelectorAll('h1')].map(e=>e.textContent),overflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),unnamedButtons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width&&!e.innerText.trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('title')).map(e=>e.outerHTML.slice(0,250)),unlabelledInputs:[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='hidden'&&e.getBoundingClientRect().width&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.labels?.length).map(e=>({tag:e.tagName,type:e.type,placeholder:e.placeholder})),landmarks:{main:document.querySelectorAll('main').length},navigation:performance.getEntriesByType('navigation').map(n=>({ttfb:n.responseStart-n.requestStart,dom:n.domContentLoadedEventEnd,duration:n.duration})),resources:performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').pop(),transfer:r.transferSize,decoded:r.decodedBodySize,duration:r.duration})).sort((a,b)=>b.decoded-a.decoded).slice(0,8),text:document.body.innerText.slice(0,600)}));
 result.pages.push({path,width,status:response.status(),headers:path==='/'?response.headers():undefined,...data});
 await page.screenshot({path:dir+'/'+label+'-'+width+'.png',fullPage:path==='/'});
}
try{
 for(const width of [1440,768,390,320]){await inspect('/',width,'landing');await inspect('/app',width,'login');}
 const menu=page.getByRole('button',{name:'Открыть меню модулей'});await page.goto(origin);await menu.click();await page.getByRole('textbox',{name:'Найти модуль'}).fill('zzzz-no-results');result.menu={emptyState:await page.getByText('Ничего не найдено',{exact:true}).isVisible()};await page.keyboard.press('Escape');result.menu.escapeClosed=await page.getByRole('dialog').count()===0;
 for(const path of ['/api/v1/health','/api/v1/auth/me','/api/v1/events','/api/v1/users','/api/v1/dlp/access','/openapi.json','/docs','/robots.txt','/sitemap.xml','/this-page-does-not-exist','/assets/does-not-exist.js']){const r=await ctx.request.get(origin+path);result.api.push({path,status:r.status(),type:r.headers()['content-type'],cache:r.headers()['cache-control'],body:(await r.text()).slice(0,130)});}
 const demo=await ctx.request.post(origin+'/api/v1/auth/demo-viewer');result.demoStatus=demo.status();result.cookieFlags=(await ctx.cookies()).map(({name,httpOnly,secure,sameSite})=>({name,httpOnly,secure,sameSite}));
 if(demo.ok()){
 const src=await readFile('src/lib/modules.ts','utf8');const routes=[...new Set(['',...Array.from(src.matchAll(/path: "([^"]*)"/g),m=>m[1]),'users','dlp'])];
 for(const width of [1440,390])for(const route of routes){await inspect('/app'+(route?'/'+route:''),width,route||'dashboard');}
 await ctx.request.post(origin+'/api/v1/auth/logout');
 }
} catch(e){result.fatal=e.stack;}finally{await writeFile(dir+'/checks.json',JSON.stringify(result,null,2));await browser.close();}
console.log(JSON.stringify({pages:result.pages.length,api:result.api,errors:result.errors,responses:result.responses,fatal:result.fatal,menu:result.menu,demo:result.demoStatus,cookies:result.cookieFlags,issues:result.pages.filter(p=>p.overflow||p.brokenImages.length||p.unnamedButtons.length||p.unlabelledInputs.length).map(p=>({path:p.path,width:p.width,overflow:p.overflow,broken:p.brokenImages,buttons:p.unnamedButtons.length,inputs:p.unlabelledInputs}))},null,2));
