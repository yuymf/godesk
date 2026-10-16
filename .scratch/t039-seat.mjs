import { chromium } from "../node_modules/@playwright/test/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const ROOT="/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t039";
for (const suite of ["H03","H04","H05"]) {
  const log=readFileSync(`${ROOT}/${suite}/log.jsonl`,"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l));
  const room=log.find(o=>o.step==="room-probe");
  const browser=await chromium.launch();
  const page=await (await browser.newContext({viewport:{width:1440,height:1100}})).newPage();
  await page.goto(room.url,{waitUntil:"networkidle",timeout:60000});
  await page.waitForTimeout(2000);
  // Try multiple seat claim patterns used in prior evidence scripts
  const select=page.locator('select').first();
  if (await select.count()) {
    try { await select.selectOption({index:1}); await page.waitForTimeout(500); } catch {}
  }
  for (const label of ["入座","占据","坐下","Claim","座位 0"]) {
    const b=page.getByRole("button",{name:new RegExp(label)}).first();
    if (await b.count() && await b.isEnabled().catch(()=>false)) {
      try { await b.click({timeout:2000}); await page.waitForTimeout(800); break; } catch {}
    }
  }
  // Click seat chip
  const chip=page.locator('.seat-chip, [data-seat="0"], button').filter({hasText:/座位\s*0|Seat\s*0/i}).first();
  if (await chip.count()) { try { await chip.click({timeout:2000}); } catch {} }
  await page.waitForTimeout(1500);
  const metrics=await page.evaluate(()=>{
    const main=document.querySelector("main.room-view");
    const stage=document.querySelector(".tabletop-stage, .g3d-stage");
    const drawer=document.querySelector(".desk-action-drawer");
    const invitation=document.querySelector(".room-invitation");
    return {
      seated: main?.classList.contains("room-view-seated") ?? false,
      immersive: main?.classList.contains("room-view-tabletop-immersive") ?? false,
      stageH: stage ? Math.round(stage.getBoundingClientRect().height) : 0,
      drawerH: drawer ? Math.round(drawer.getBoundingClientRect().height) : 0,
      drawerOpen: drawer?.hasAttribute("open") ?? null,
      inviteCollapsed: invitation?.classList.contains("is-collapsed") ?? false,
      classes: main?.className ?? "",
    };
  });
  console.log(suite, metrics);
  writeFileSync(`${ROOT}/${suite}/t039-metrics.json`,JSON.stringify(metrics,null,2));
  await page.screenshot({path:`${ROOT}/${suite}/15-room-stage-seated.png`});
  // Also overwrite 15-room-stage if seated for evidence
  if (metrics.seated) {
    await page.locator("canvas").first().screenshot({path:`${ROOT}/${suite}/15-room-stage.png`}).catch(()=>{});
    await page.screenshot({path:`${ROOT}/${suite}/15-room-stage-full.png`});
  }
  await browser.close();
}
