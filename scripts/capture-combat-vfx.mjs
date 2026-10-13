import { chromium } from "@playwright/test";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

const BASE = "http://127.0.0.1:8799";
const OUT = "/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/trajectory/asset-vfx";
const PROMPT0 = "做一款两人自走棋，商店买棋上阵自动打架";

const browser = await chromium.launch({ headless: true });
const host = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const guestCtx = await browser.newContext();
const guest = await guestCtx.newPage({ viewport: { width: 1440, height: 900 } });
await mkdir(OUT, { recursive: true });

await host.goto(`${BASE}/chatgpt-plugin/new`);
await host.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT0);
await host.getByRole("button", { name: "生成可玩版本" }).click();
await host.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 120_000 });
const projectId = new URL(host.url()).pathname.split("/").at(-1);
await host.getByRole("button", { name: "确认玩法并开始试玩" }).click();
await host.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });

// apply all three skill prompts in one iterate if possible - do sequential
for (const prompt of ["螃蟹攻击带范围溅射", "巫师有治疗", "给新羁绊加护盾"]) {
  await host.goto(`${BASE}/chatgpt-plugin/studio/${projectId}`);
  await host.locator("#iteration-prompt").fill(prompt);
  await host.getByRole("button", { name: /改下一版并试玩/ }).click();
  for (let i = 0; i < 90; i++) {
    const body = await host.locator("body").innerText();
    if (/规则校验通过|已保存/.test(body) && !/正在改下一版|正在处理/.test(body)) break;
    await host.waitForTimeout(1000);
  }
}

const sessions = await (await host.request.get(`${BASE}/api/projects/${projectId}?view=sessions`)).json();
const u = new URL(sessions.sessions.at(-1).sessionUrl, BASE);
u.searchParams.set("tier", "high");
await host.goto(u.toString());
await guest.goto(u.toString());
try { await host.getByLabel("你的席位").selectOption("1"); } catch {}
try { await guest.getByLabel("你的席位").selectOption("0"); } catch {}
const gBoard = guest.getByRole("region", { name: "潮阵对局" });
const hBoard = host.getByRole("region", { name: "潮阵对局" });
await gBoard.waitFor({ timeout: 60_000 });

async function fillSide(p, board, startCell) {
  // buy until we have 3 on board
  for (let n = 0; n < 4; n++) {
    const card = board.locator(".tide-arena-card:enabled").first();
    if (!(await card.count())) {
      const refresh = board.getByRole("button", { name: "刷新" });
      if (await refresh.count()) await refresh.click();
      await p.waitForTimeout(400);
    }
    if (!(await card.count())) continue;
    await card.click();
    await p.waitForTimeout(250);
    const from = await p.evaluate(() => window.__tideArena?.screenOf({ kind: "bench", benchIndex: 0 }));
    const to = await p.evaluate((c) => window.__tideArena?.screenOf({ kind: "cell", boardIndex: c }), startCell + n);
    if (from && to) {
      await p.mouse.move(from.x, from.y); await p.mouse.down();
      await p.mouse.move(to.x, to.y, { steps: 5 }); await p.mouse.up();
    }
  }
}
await fillSide(guest, gBoard, 1);
await fillSide(host, hBoard, 1);

// before shot with crab on board
await gBoard.screenshot({ path: join(OUT, "before-after-crab-onboard.png") });

await gBoard.getByRole("button", { name: "准备完毕" }).click();
await hBoard.getByRole("button", { name: "准备完毕" }).click();

// Poll for combat/replay phase
let got = false;
for (let i = 0; i < 80; i++) {
  const txt = await gBoard.innerText().catch(() => "");
  const phase = await gBoard.locator("text=/战斗|回放|结算/").count();
  if (/战斗|回放|结算/.test(txt) || phase) {
    await guest.waitForTimeout(600);
    await gBoard.screenshot({ path: join(OUT, "combat-mid-vfx.png") });
    // also try a bit later for heal/shield moments
    await guest.waitForTimeout(1200);
    await gBoard.screenshot({ path: join(OUT, "combat-mid-vfx-2.png") });
    got = true;
    break;
  }
  await guest.waitForTimeout(400);
}
console.log(JSON.stringify({ projectId, got }));
await guestCtx.close();
await browser.close();
