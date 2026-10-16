import { chromium } from "../node_modules/@playwright/test/index.mjs";
import { readFileSync } from "node:fs";
const log = readFileSync("/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t036/H04/log.jsonl","utf8")
  .split("\n").filter(Boolean).map(l=>JSON.parse(l));
const room = log.find(o=>o.step==="room-probe");
const url = room.url;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
await page.goto(url,{waitUntil:"networkidle",timeout:60000});
await page.waitForTimeout(3500);
await page.locator("canvas").first().screenshot({path:"/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t036/H04/15-room-stage-close.png"});
const hud = await page.evaluate(() => document.body.innerText);
const factories = [...hud.matchAll(/工厂\s*(\d+)\s+([^\n]+)/g)].map(m=>({id:m[1],tiles:m[2].trim().slice(0,50)}));
console.log("factories from HUD", factories.slice(0,6));
await browser.close();
console.log("done");
