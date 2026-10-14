// Generic hardness-real probe: paste RULEBOOK → studio → floors → Room 3D (share-gate path).
// T031: cold-run default lands in shareable Room (hasStage/host+canvas); 03-play is Room, not docs page.
import { chromium } from "../node_modules/@playwright/test/index.mjs";
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:8799";
const OUT = process.env.OUT || "/tmp/hardness-real-probe";
const RULEBOOK = process.env.RULEBOOK;
const SUITE = process.env.SUITE || "Hx";
if (!RULEBOOK) { console.error("RULEBOOK required"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const logPath = `${OUT}/log.jsonl`;
writeFileSync(logPath, "");
const L = (o) => {
  const line = JSON.stringify({ t: new Date().toISOString(), suite: SUITE, ...o });
  appendFileSync(logPath, line + "\n");
  console.log(line);
};
const book = readFileSync(RULEBOOK, "utf8").trim() + "\n";
L({ step: "start", bookChars: book.length, probePath: "scripts/hardness-real-probe.mjs", roomFirst: true });

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
const shot = async (n) => {
  await page.screenshot({ path: `${OUT}/${n}.png` });
  L({ shot: n });
};

function normalizeRoomUrl(sessionUrl) {
  let url = sessionUrl;
  if (!url) return null;
  if (!url.startsWith("http")) url = BASE + (url.startsWith("/") ? url : `/${url}`);
  if (url.includes("/room/") && !url.includes("/chatgpt-plugin/")) {
    url = url.replace("/room/", "/chatgpt-plugin/room/");
  }
  return url;
}

try {
  await page.goto(BASE + "/chatgpt-plugin/new", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(book);
  await shot("00-new-filled");
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  const navigated = await page.waitForURL(/studio\//, { timeout: 180000 }).then(() => true).catch(() => false);
  L({ step: "after-generate", navigated, url: page.url() });
  await shot("01-after-generate");
  if (!navigated) {
    const err = (await page.locator('[role="alert"], .form-error, .notice, .workflow-notice').allInnerTexts().catch(() => [])).join(" | ");
    L({ step: "stay-on-new", ui: err.slice(0, 800) });
    writeFileSync(`${OUT}/RESULT.md`, `# ${SUITE} probe\n\n- navigated: false\n- note: stayed on /new\n`);
    L({ step: "done" });
    process.exit(0);
  }
  const pid = new URL(page.url()).pathname.split("/").at(-1);
  const api = async (v) => (await page.request.get(`${BASE}/api/projects/${pid}?view=${v}`)).json().catch(() => null);
  const api2 = async (v) => (await page.request.get(`${BASE}/chatgpt-plugin/api/projects/${pid}?view=${v}`)).json().catch(() => null);
  let plan = await api("generation-plan");
  if (!plan?.generationPlan) plan = await api2("generation-plan");
  writeFileSync(`${OUT}/generation-plan.json`, JSON.stringify(plan, null, 2));
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click().catch(() => {});
  await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120000 }).catch(() => {});
  let rs = await api("rule-system");
  if (!rs?.ruleSystem && !rs?.runtimeSupport) rs = await api2("rule-system");
  writeFileSync(`${OUT}/rule-system.json`, JSON.stringify(rs, null, 2));
  const root = rs?.ruleSystem || rs || {};
  const rt = root.runtimeSupport || rs?.runtimeSupport || {};
  const kernel = rt.kernel || {};
  const mechanics = root.generation?.requestedMechanics || [];
  const unsupported = rt.unsupported || kernel.unsupported || [];
  L({
    step: "studio",
    projectId: pid,
    requestedMechanics: mechanics,
    kernelType: kernel.type || null,
    status: rt.status || null,
    executable: rt.status === "executable",
    harbor: kernel.harbor,
    freight: kernel.freight,
    unsupported: (Array.isArray(unsupported) ? unsupported : []).slice(0, 6),
  });
  await shot("02-studio");

  let playHud = null;
  let roomProbe = null;
  try {
    let builds = await api("builds");
    if (!builds?.builds) builds = await api2("builds");
    const build = (builds?.builds || [])[0];
    const playUrl = build?.playableUrl;
    L({
      step: "build",
      buildId: build?.id || null,
      playability: build?.playabilityFloor?.status,
      presentation: build?.presentationFloor?.status,
      hasPlayableUrl: Boolean(playUrl),
    });

    // T031 · share-gate path: POST sessions → Room 3D is the default 03-play capture.
    if (build?.id) {
      const body = { seed: 42, idempotencyKey: `hardness-${SUITE}-${Date.now()}` };
      const res = await page.request.post(`${BASE}/api/builds/${build.id}/sessions`, { data: body });
      const text = await res.text();
      writeFileSync(`${OUT}/session-create.json`, text);
      L({ step: "session-create", status: res.status(), ok: res.ok() });
      if (res.ok()) {
        const j = JSON.parse(text);
        const url = normalizeRoomUrl(j.sessionUrl || j.url || (j.id ? `/chatgpt-plugin/room/${j.id}` : null));
        if (url) {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
          await page.waitForTimeout(3500);
          const claim = page.getByRole("button", { name: /座位\s*0|入座|坐这里|Claim/ });
          if (await claim.count()) {
            await claim.first().click();
            await page.waitForTimeout(2500);
          }
          await page.waitForSelector(
            '[data-testid="tabletop-stage"], [data-testid="g3d-scene-host"], canvas',
            { timeout: 25000 },
          ).catch(() => {});
          await page.waitForTimeout(2500);
          await shot("03-play");
          await shot("15-room-stage");
          const kernelType = kernel.type || null;
          roomProbe = {
            path: "POST /api/builds/:id/sessions → Room",
            url: page.url(),
            hasStage: await page.locator('[data-testid="tabletop-stage"]').count(),
            hasSceneHost: await page.locator('[data-testid="g3d-scene-host"]').count(),
            canvas: await page.locator("canvas").count(),
            kernelAttr: kernelType
              ? await page.locator(`[data-kernel="${kernelType}"]`).count()
              : 0,
          };
          writeFileSync(`${OUT}/room-evidence.json`, JSON.stringify(roomProbe, null, 2));
          L({ step: "room-probe", ...roomProbe });
          const textBody = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 900);
          playHud = {
            hasAutoBattler: /潮阵|礁蟹|备战席|和电脑对战/.test(textBody),
            isRoom: /共享会话|可重连|邀请/.test(textBody) || roomProbe.hasStage > 0 || roomProbe.hasSceneHost > 0,
            isDocsPage: /这个版本长什么样/.test(textBody) && roomProbe.canvas === 0,
            snippet: textBody.slice(0, 500),
          };
          L({ step: "play-hud", ...playHud });
        }
      } else {
        L({ step: "session-create-fail", body: text.slice(0, 400) });
      }
    }

    // Fallback: docs/playable preview only if Room path failed (still capture as 03-play-docs).
    if (!roomProbe && playUrl) {
      let final = playUrl;
      if (playUrl.includes("/play/") && !playUrl.includes("/chatgpt-plugin/")) {
        final = playUrl.replace("/play/", "/chatgpt-plugin/play/");
      }
      await page.goto(final, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(async () => {
        await page.goto(playUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      });
      await page.waitForTimeout(2000);
      await shot("03-play");
      await shot("03-play-docs");
      const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 900);
      playHud = {
        hasAutoBattler: /潮阵|礁蟹|备战席|和电脑对战/.test(text),
        isRoom: false,
        isDocsPage: /这个版本长什么样/.test(text),
        snippet: text.slice(0, 500),
        fallback: "playableUrl",
      };
      L({ step: "play-hud", ...playHud });
    }
  } catch (e) {
    L({ step: "play-err", err: String(e).slice(0, 300) });
  }

  const falseAb =
    rt.status === "executable" &&
    (kernel.type === "auto-battler-v1" || (mechanics.includes("auto-battler") && !/hex|route|auction|settlement|network/i.test(String(kernel.type))));
  L({
    step: "verdict",
    falsePositiveAutoBattler: Boolean(falseAb),
    kernelType: kernel.type || null,
    status: rt.status || null,
    mechanics,
    roomProbe: roomProbe
      ? {
          hasStage: roomProbe.hasStage,
          hasSceneHost: roomProbe.hasSceneHost,
          canvas: roomProbe.canvas,
          kernelAttr: roomProbe.kernelAttr,
        }
      : null,
    probePath: "scripts/hardness-real-probe.mjs → Room sessions",
  });
  writeFileSync(`${OUT}/RESULT.md`, `# ${SUITE} probe (T031 Room path)

| 项 | 值 |
| --- | --- |
| probe | \`scripts/hardness-real-probe.mjs\` → POST sessions → Room |
| kernel | ${kernel.type || "?"} |
| Room | hasStage=${roomProbe?.hasStage ?? 0} · host=${roomProbe?.hasSceneHost ?? 0} · canvas=${roomProbe?.canvas ?? 0} |
| 03-play | ${playHud?.isDocsPage ? "docs (fallback)" : playHud?.isRoom ? "Room 3D" : "unknown"} |

`);
  L({ step: "done" });
} catch (e) {
  L({ step: "fatal", err: String(e).slice(0, 500) });
  await shot("99-fatal").catch(() => {});
  process.exitCode = 1;
} finally {
  await b.close();
}
