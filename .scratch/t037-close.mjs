import { chromium } from "../node_modules/@playwright/test/index.mjs";
import { readFileSync } from "node:fs";
const log = readFileSync("/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t037/H03/log.jsonl","utf8")
  .split("\n").filter(Boolean).map(l=>JSON.parse(l));
const room = log.find(o=>o.step==="room-probe");
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
await page.goto(room.url,{waitUntil:"networkidle",timeout:60000});
await page.waitForTimeout(4000);
const canvas = page.locator("canvas").first();
const box = await canvas.boundingBox();
// crop center card zone
await page.screenshot({
  path: "/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t037/H03/15-room-stage-cards-close.png",
  clip: { x: box.x + box.width*0.15, y: box.y + box.height*0.05, width: box.width*0.7, height: box.height*0.7 },
});
// Check DOM text does not include floating T1+ debug (HUD buttons may still say 买白+0 which is OK)
const body = await page.evaluate(() => document.body.innerText);
const hasDebugFace = /T\d\+\d+\|[a-z]+/.test(body);
console.log({ hasDebugFaceInDom: hasDebugFace, canvas: !!box });
await browser.close();
