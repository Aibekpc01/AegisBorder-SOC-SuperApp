const { chromium } = require("../frontend/node_modules/playwright");
const assert = require("node:assert/strict");

(async () => {
  const base = process.env.AEGIS_PUBLIC_URL || "http://127.0.0.1:8001";
  const browser = await chromium.launch({channel:"msedge",headless:true});
  const contexts = [];
  try {
    for (let i=0;i<2;i++) {
      const context=await browser.newContext();contexts.push(context);
      const page=await context.newPage();
      await page.goto(base+"/app");
      await page.getByRole("button",{name:"Попробовать без регистрации"}).click();
      await page.getByRole("heading",{name:"Главная панель",exact:true}).waitFor();
      const user=await (await context.request.get(base+"/api/v1/auth/me")).json();
      assert.equal(user.role,"demo");
      const connectors=await (await context.request.get(base+"/api/v1/integrations/connectors")).json();
      assert.deepEqual(connectors,[]);
      if(i===0) {
        await page.goto(base+"/app/commission");
        await page.getByRole("button",{name:"Запустить проверку",exact:true}).click();
        await page.locator(".demo-result").waitFor();
      }
      if(i===1) {
        const events=await (await context.request.get(base+"/api/v1/events")).json();
        assert.equal(events.total,0,"Second visitor must not see first visitor's events");
      }
      await page.screenshot({path:`frontend/test-results/public-visitor-${i+1}.png`,fullPage:true});
    }
    const a=await (await contexts[0].request.get(base+"/api/v1/auth/me")).json();
    const b=await (await contexts[1].request.get(base+"/api/v1/auth/me")).json();
    assert.notEqual(a.id,b.id);
    console.log("Public demo: two visitors, personal roles, isolated events and real scenario passed");
  } finally {
    await Promise.all(contexts.map(c=>c.close()));
    await browser.close();
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
