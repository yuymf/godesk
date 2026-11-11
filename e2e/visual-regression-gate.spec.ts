import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_PIXELGATE_PORT,
  DEFAULT_SEED,
  WARMUP_FRAMES,
  assertPortExclusive,
  captureFrozenCanvas,
  captureFrozenTwice,
  canvasClip,
  freezeDeterministic,
  waitHarnessStable,
  waitSceneSettled,
  type HarnessApi,
} from "./helpers/visual-capture";
import { comparePng, diffBounds, formatDiff, type VisualDiffResult } from "./helpers/visual-diff";
import {
  BASELINE_DIR,
  describeBaselineEnv,
  displayPath,
  missingBaselineMessage,
  resolveBaseline,
  updateBaselineEnabled,
  writeBaseline,
} from "./helpers/visual-baseline";

/**
 * G3D-PIXELGATE — shader / 视觉回归的像素门。
 *
 * 为什么需要这张卡：父卡 `t_9077dba6` 的 `digest()` 只有**状态**、没有像素。
 * 改 shader、改光照、贴图 404、透明排序错乱都不会让 digest 动一个字节，
 * 但玩家一眼就能看出坏。这个 spec 就是那道只有像素能过的门。
 *
 * 前置（缺一不许截图，见 e2e/helpers/visual-capture.ts 文件头）：
 *   ① 端口独占自证（不用共享的 8799）
 *   ② harness 稳定存在（存在 → 等 3 个 rAF → 复查仍在 + dataset 标记仍在）
 *   ③ freeze() 后 isFrozen() === true
 *   ④ 连续两次 digest 字节级相同
 *   ⑤ 丢弃 WARMUP_FRAMES 帧 warmup
 *
 * 本地回归能力，无部署、无 wrangler.jsonc 改动、无真凭据。
 */

/**
 * Playwright 1.63 期望 chromium r1243；本机（开发机）只缓存 r1208/r1248 + 系统 Chrome。
 * spec-local fallback：只在 r1243 缺失时启用，不动共享 playwright.config.ts。
 * （与父卡 harness-determinism.spec.ts 同一模式）
 *
 * CI/固定镜像里**不启用**：那里 Playwright 自带的 chromium 就是基线所属的那个浏览器，
 * 用系统 Chrome 顶替会悄悄换掉渲染栈（实测两者同帧差 0.47%，见 e2e/helpers/visual-baseline.ts）。
 */
const PW_CACHE = `${process.env.HOME ?? ""}/.cache/ms-playwright`;
const expectedRevision = `${PW_CACHE}/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`;
const fallbackBinaries = [
  "/usr/bin/google-chrome",
  `${PW_CACHE}/chromium-1248/chrome-linux64/chrome`,
  `${PW_CACHE}/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`,
];
const localBinary = process.env.CI || existsSync(expectedRevision) ? null : (fallbackBinaries.find(existsSync) ?? null);
if (localBinary) {
  test.use({ launchOptions: { executablePath: localBinary, args: ["--enable-unsafe-swiftshader"] } });
}
/**
 * 实际启动的是哪个浏览器 —— 基线按它分目录（`ubuntu22-google-chrome-152` vs
 * `ubuntu24-chromium-153`）。系统 Chrome 与 Playwright 自带 chromium 是两条渲染栈，
 * 混用会让像素门拿错基线。fallback 被用上时必须如实标注，不许都叫 "chromium"。
 */
const BROWSER_LABEL = localBinary ? "google-chrome" : "chromium";


const HEX_ISLAND_PROMPT = "做一款可以与电脑对战的汐屿六角岛资源建造游戏";
/** 证据落盘根目录。
 *
 * 刻意不用 `test-results/`：Playwright 每次运行都会清空它，于是"上一次的 diff 图"
 * 会在下一次跑之前消失，报告里的路径就变成死链（实测踩过）。
 * `pixelgate-evidence/` 命中的是 `.gitignore` 里的 `*-evidence/`，不入 git 但能留存。
 */
const EVIDENCE_DIR = resolve(process.cwd(), "pixelgate-evidence");

/** 本 spec 独占的端口。刻意不等于 playwright.config.ts 的 8799。 */
const PIXELGATE_PORT = Number(process.env.GODESK_PIXELGATE_PORT ?? DEFAULT_PIXELGATE_PORT);
/** 像素门独占的 origin（webServer 由 playwright.pixelgate.config.ts 起在这个端口）。 */
const PIXELGATE_ORIGIN = `http://127.0.0.1:${PIXELGATE_PORT}`;

type HarnessWindow = Window & { __godeskHarness?: HarnessApi };

/** 收集报告用的一行行证据，最后整块打出来。 */
const evidence: string[] = [];
function record(line: string): void {
  evidence.push(line);
  console.log(line);
}

async function buildHexPreview(page: Page): Promise<string> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(HEX_ISLAND_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  const { builds } = (await (await page.request.get(`/api/projects/${projectId}?view=builds`)).json()) as {
    builds: { id: string }[];
  };
  expect(builds.length).toBeGreaterThan(0);
  return `/chatgpt-plugin/play/${encodeURIComponent(builds.at(-1)!.id)}`;
}

/**
 * 一个「可注入视觉故障」的初始化脚本。
 *
 * 为什么不改源码重建：三种失败模式（shader 常量改错 / 无关逻辑改动 / 贴图 404）
 * 如果都靠"改 src 再 pnpm build"，一次用例要 40s+ 的构建，且无法在同一进程里
 * 做 A/B。这里用的是**同一份构建产物**上的确定性注入：
 *   - shader：hook `WebGLRenderingContext.prototype.shaderSource`，对真实 GLSL 做字面量替换
 *     （GLSL 就在产物里，改它等于改 shader 源码；`THREE.WebGLProgram` 会真的编译失败或
 *      产出不同的像素）。
 *   - 无关逻辑：只改一个不影响渲染的 tuning 常量（`motion.placeMs`），
 *     它会让 `digest()` 变（父卡已实测），但冻结帧的像素必须**完全不变**。
 *   - 贴图 404：`page.route` 让某个真实贴图请求返回 404。
 */
type FaultMode = "none" | "shader-pattern-strength" | "shader-compile-error" | "unrelated-logic" | "texture-404";

const SHADER_HOOK = (mode: FaultMode) => `
(() => {
  const MODE = ${JSON.stringify(mode)};
  const stats = { shaderSourceCalls: 0, rewritten: 0 };
  // 真实 GLSL 字面量：materials.ts 里 pattern 的 albedo 混合式
  //   diffuseColor.rgb *= mix(1.0, 0.52 + 0.96 * gdP, uGdPattern);
  // 把它压成几乎常数 → 地块失去程序化纹理起伏，像素必然变。
  const REWRITES = {
    "shader-pattern-strength": ["0.52 + 0.96 * gdP", "0.05 + 0.10 * gdP"],
    // shader 编译失败：注入未定义符号，THREE 会报 Shader Error 并放弃该 program。
    "shader-compile-error": ["void main() {", "void main() { gdPixelGateUndefinedSymbol = 1.0;"],
  };
  const rewrite = (src) => {
    if (typeof src !== "string") return src;
    stats.shaderSourceCalls += 1;
    const rule = REWRITES[MODE];
    if (!rule || !src.includes(rule[0])) return src;
    stats.rewritten += 1;
    return src.split(rule[0]).join(rule[1]);
  };
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    const original = C.prototype.shaderSource;
    C.prototype.shaderSource = function (shader, source) { return original.call(this, shader, rewrite(source)); };
  }
  window.__gdPixelGateHook = stats;
})();
`;

type CaptureOptions = {
  /** 注入哪种视觉故障。 */
  fault?: FaultMode;
  /** 让哪个 URL 返回 404（贴图缺失用例）。 */
  block404?: string;
  /** 冻结时注入的 tuning（无关逻辑用例）。 */
  tuning?: Record<string, number>;
  /** 证据子目录名。 */
  tag: string;
};

type CaptureResult = {
  png: Buffer;
  clip: { x: number; y: number; width: number; height: number };
  freeze: Awaited<ReturnType<typeof freezeDeterministic>>;
  hook: { shaderSourceCalls: number; rewritten: number } | null;
  consoleErrors: string[];
  pageErrors: string[];
  textureFailures: { url: string; status: number }[];
  path: string;
};

/**
 * 完整走一遍"端口自证 → 冻结自证链 → warmup → 截图"。
 *
 * 端口自证用模块级 {@link PIXELGATE_ORIGIN}，不用 `page.url()`：那是带
 * `?harness=1&seed=...` 的预览页 URL，端口虽然一样但语义不对，
 * 而且一旦有人把预览改到别的 host 就会静默失效。
 */
async function captureFrozen(page: Page, previewPath: string, options: CaptureOptions): Promise<CaptureResult> {
  const fault = options.fault ?? "none";
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const textureFailures: { url: string; status: number }[] = [];

  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 400)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 400));
  });
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && /\.(ktx2|webp|png|jpg|glb|gltf|bin)(\?|$)/.test(url)) {
      textureFailures.push({ url: new URL(url).pathname, status: response.status() });
    }
  });

  if (fault !== "none" && fault !== "unrelated-logic") {
    await page.addInitScript(SHADER_HOOK(fault));
  }
  if (options.block404) {
    await page.route(options.block404, (route) => route.fulfill({ status: 404, contentType: "text/plain", body: "pixel-gate: intentional 404" }));
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${previewPath}?harness=1&seed=${DEFAULT_SEED}`);

  // ① + ② 顺序是硬的：先证明端口独占，再证明 harness 稳定。
  const ownership = await assertPortExclusive(PIXELGATE_ORIGIN, PIXELGATE_PORT);
  if (!ownership.exclusive) {
    throw new Error(
      `pixel-gate: port ownership not proven on :${ownership.port} — ${ownership.note}. ` +
        `A shared port silently re-builds and swaps asset hashes, which detaches the harness mid-run ` +
        `and produces a non-zero diff that has nothing to do with your change.`,
    );
  }

  const { samples } = await waitHarnessStable(page);
  await waitSceneSettled(page);
  // ③ ④ ⑤ 都在 freezeDeterministic 内部，任一不过直接抛。
  const freeze = await freezeDeterministic(page, { seed: DEFAULT_SEED, warmupFrames: WARMUP_FRAMES, tuning: options.tuning });

  const hook = await page.evaluate(() => (window as unknown as { __gdPixelGateHook?: { shaderSourceCalls: number; rewritten: number } }).__gdPixelGateHook ?? null);
  const clip = await canvasClip(page);
  const outDir = resolve(EVIDENCE_DIR, options.tag);
  mkdirSync(outDir, { recursive: true });
  const png = await captureFrozenCanvas(page, resolve(outDir, "frame.png"));

  // 截完再确认一次冻结态没被打破（异步任务可能在截图期间摘掉 harness）。
  const after = await page.evaluate(() => {
    const h = (window as HarnessWindow).__godeskHarness;
    return { alive: Boolean(h), frozen: h?.isFrozen() ?? null, flag: document.documentElement.dataset.godeskHarness ?? null };
  });
  if (!after.alive || after.frozen !== true || after.flag !== "1") {
    throw new Error(
      `pixel-gate: harness detached/unfroze around the screenshot (alive=${after.alive}, frozen=${after.frozen}, flag=${after.flag}). ` +
        `This is the shared-port failure mode, not a pixel regression.`,
    );
  }

  record(
    `[capture:${options.tag}] port=:${ownership.port} ${ownership.note} | ` +
      `stabilityRaf=${samples} | frozen=${freeze.stillFrozen} | ` +
      `gameTimeMs=${freeze.gameTimeMs} frames=${freeze.frames} ticks=${freeze.physicsTicks} | ` +
      `digest=${freeze.digestSha256[0].slice(0, 16)} (twice-equal) | ` +
      `clip=${clip.width}x${clip.height} | shaderCalls=${hook?.shaderSourceCalls ?? 0} rewritten=${hook?.rewritten ?? 0} | ` +
      `textureFailures=${textureFailures.length} consoleErrors=${consoleErrors.length} pageErrors=${pageErrors.length}`,
  );

  return { png, clip, freeze, hook, consoleErrors, pageErrors, textureFailures, path: resolve(outDir, "frame.png") };
}

/** 跑一次 diff 并把四态结论记进证据。 */
function diffAndRecord(
  baseline: Buffer | string,
  actual: Buffer,
  label: string,
  tag: string,
  options: { maxDiffRatio?: number; pixelThreshold?: number } = {},
): VisualDiffResult {
  const outDir = resolve(EVIDENCE_DIR, tag);
  mkdirSync(outDir, { recursive: true });
  const result = comparePng(baseline, actual, {
    label,
    diffImagePath: resolve(outDir, "diff.png"),
    sideBySideDir: outDir,
    ...options,
  });
  const bounds = diffBounds(baseline, actual, options.pixelThreshold);
  record(formatDiff(result));
  record(`[bounds:${label}] ${bounds ? `x=${bounds.x} y=${bounds.y} w=${bounds.width} h=${bounds.height}` : "none (0 px differ)"}`);
  if (result.diffImagePath) record(`[diff-image] ${displayPath(result.diffImagePath)}`);
  return result;
}

test.describe("G3D-PIXELGATE deterministic pixel gate", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(600_000);

  let previewPath = "";

  /**
   * 每个用例都能独立运行（`-g "基线门"` 必须能跑）。
   * 预览构建很便宜（本地 NL 生成，实测 ~2s），同一 worker 里只建一次并缓存。
   */
  async function ensurePreview(page: Page): Promise<string> {
    if (!previewPath) previewPath = await buildHexPreview(page);
    return previewPath;
  }

  test("① 基建自证：同冻结状态连拍两次 diff 必须为 0（端口独占 + 冻结自证链）", async ({ page, baseURL }) => {
    // 端口独占自证放在最前面：不成立的话后面所有像素结论都不可信。
    const ownership = await assertPortExclusive(baseURL, PIXELGATE_PORT);
    record(`[port-ownership] ${ownership.note} | verifiable=${ownership.verifiable} listeners=${JSON.stringify(ownership.listeners.map((l) => l.pid))}`);
    expect(ownership.portMatches, `pixel gate must not share port with other e2e suites (got :${ownership.port}, want :${PIXELGATE_PORT})`).toBe(true);
    expect(ownership.verifiable, "port ownership must be verifiable on this host (ss + /proc)").toBe(true);
    expect(ownership.exclusive, `port :${ownership.port} must have exactly one listener that is our wrangler — ${ownership.note}`).toBe(true);

    previewPath = await buildHexPreview(page);
    record(`[preview] ${previewPath}`);

    const captured = await captureFrozen(page, previewPath, { tag: "self-proof" });

    // 冻结自证链的三条硬断言（顺序已在 captureFrozen 里保证）。
    expect(captured.freeze.stillFrozen).toBe(true);
    expect(captured.freeze.digestStable).toBe(true);
    expect(captured.freeze.digestSha256[0]).toBe(captured.freeze.digestSha256[1]);
    // warmup 必须真的被丢弃（否则基线毫无意义：实测 frame 0 vs 180 差 49.8%）。
    expect(captured.freeze.warmupFrames).toBe(WARMUP_FRAMES);
    expect(captured.freeze.frames).toBe(WARMUP_FRAMES);

    // 连拍两次：不是"小于阈值"，是 0。
    const twice = await captureFrozenTwice(page, resolve(EVIDENCE_DIR, "self-proof-twice"));
    const selfProof = diffAndRecord(twice.first, twice.second, "consecutive-shots", "self-proof-twice");
    expect(
      selfProof.diffPixels,
      `two consecutive shots of the SAME frozen frame must be byte-identical — got ${selfProof.diffPixels} px. ` +
        `Non-zero here means the harness is not frozen cleanly (or the port is shared). Do NOT raise the threshold.`,
    ).toBe(0);

    // 跨 context 重跑同一 seed：同样必须 0（证明"可复现"而不是"同一进程凑巧"）。
    const otherContext = await page.context().browser()!.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });
    try {
      const otherPage = await otherContext.newPage();
      const replay = await captureFrozen(otherPage, previewPath, { tag: "self-proof-crossrun" });
      expect(replay.freeze.digestSha256[0], "same seed in a fresh context must yield the same digest").toBe(
        captured.freeze.digestSha256[0],
      );
      const crossRun = diffAndRecord(captured.png, replay.png, "cross-context-same-seed", "self-proof-crossrun");
      expect(
        crossRun.diffPixels,
        `same seed in an independent browser context must render identical pixels — got ${crossRun.diffPixels} px`,
      ).toBe(0);
    } finally {
      await otherContext.close();
    }
  });

  test("② 基线门：冻结帧 vs 已提交基线必须 0 像素差异", async ({ page }) => {
    await ensurePreview(page);
    const captured = await captureFrozen(page, previewPath, { tag: "baseline" });

    // 基线按**实际渲染栈**分目录（见 e2e/helpers/visual-baseline.ts 文件头）。
    // 版本号取自真正在跑的浏览器，不是 package.json —— fallback 用系统 Chrome 时
    // 那个数字会变，基线目录也跟着变，绝不会拿 chromium 基线去比 chrome 的帧。
    const browserVersion = page.context().browser()?.version() ?? "unknown";
    const envKey = describeBaselineEnv({ browserLabel: BROWSER_LABEL, browserVersion });
    record(`[baseline-env] key=${envKey} browser=${BROWSER_LABEL}/${browserVersion} platform=${process.platform}`);

    const decision = resolveBaseline("hex-island/frozen-frame", { envKey });
    if (decision.action === "missing") {
      throw new Error(missingBaselineMessage(decision, "hex-island/frozen-frame"));
    }
    if (decision.action === "write") {
      writeBaseline(decision.path, captured.png);
      record(`[baseline] WROTE ${displayPath(decision.path)} (env=${envKey}) because ${process.env.GODESK_UPDATE_BASELINE === "1" ? "GODESK_UPDATE_BASELINE=1" : "?"}`);
      return;
    }

    const result = diffAndRecord(decision.baseline, captured.png, "baseline-vs-frozen-frame", "baseline");
    expect(
      result.diffPixels,
      `frozen frame must match the committed baseline at ${BASELINE_DIR}/${envKey}/hex-island/frozen-frame.png`,
    ).toBe(0);
  });

  test("③ shader 类：改一个真实 GLSL 常量 → 像素必须变（证明能抓到）", async ({ page }) => {
    await ensurePreview(page);
    const baseline = await captureFrozen(page, previewPath, { tag: "shader-control" });
    const mutated = await captureFrozen(page, previewPath, { tag: "shader-pattern-strength", fault: "shader-pattern-strength" });

    // 注入确实打到了真实 GLSL 上（不是空转）。
    expect(mutated.hook?.rewritten ?? 0, "the GLSL rewrite must actually hit fragment shaders").toBeGreaterThan(0);

    const result = diffAndRecord(baseline.png, mutated.png, "shader-pattern-strength", "shader-pattern-strength");
    record(`[case-③] rewrittenShaders=${mutated.hook?.rewritten} diffPixels=${result.diffPixels} diffRatio=${result.diffRatio.toFixed(8)}`);
    expect(result.diffRatio, "changing a real GLSL constant MUST move pixels").toBeGreaterThan(0);
    expect(result.passed).toBe(false);
  });

  test("④ shader 编译失败 → 静默 fallback 必须被抓到", async ({ page }) => {
    await ensurePreview(page);
    const baseline = await captureFrozen(page, previewPath, { tag: "shader-compile-control" });
    const broken = await captureFrozen(page, previewPath, { tag: "shader-compile-error", fault: "shader-compile-error" });

    const shaderErrors = broken.consoleErrors.filter((line) => /Shader Error|VALIDATE_STATUS|program not valid/i.test(line));
    record(`[case-④] shaderErrorLogs=${shaderErrors.length} firstError=${shaderErrors[0]?.slice(0, 160) ?? "none"}`);
    expect(shaderErrors.length, "a broken shader must surface THREE.WebGLProgram errors").toBeGreaterThan(0);

    const result = diffAndRecord(baseline.png, broken.png, "shader-compile-error", "shader-compile-error");
    expect(result.diffRatio, "a failed shader compile (silent material fallback) MUST move pixels").toBeGreaterThan(0);
  });

  test("⑤ 不该变类：改一处无关逻辑（tuning）→ 像素必须为 0（证明没有误报）", async ({ page }) => {
    await ensurePreview(page);
    const baseline = await captureFrozen(page, previewPath, { tag: "unrelated-control" });
    // `motion.placeMs` 是真实 gameplay 常量（MOTION_MS.place = 280），父卡用它证明 digest 会变。
    // 冻结帧不播放任何 tween，所以像素必须纹丝不动 —— 这正是"没有误报"的证据。
    const tuned = await captureFrozen(page, previewPath, { tag: "unrelated-tuning", tuning: { "motion.placeMs": 560 } });

    expect(tuned.freeze.tuning["motion.placeMs"], "the tuning override must be installed").toBe(560);

    // 同一页面上证明 digest 真的变了（否则这个反例没意义：改的东西根本没生效）。
    const digestMoved = await page.evaluate(() => {
      const h = (window as HarnessWindow).__godeskHarness!;
      h.freeze();
      h.reset(20261111);
      const before = h.digestJson();
      h.setTuning({ "motion.placeMs": 560 });
      const after = h.digestJson();
      return { same: before === after, beforeLen: before.length, afterLen: after.length };
    });
    record(`[case-⑤] digestSame=${digestMoved.same} beforeLen=${digestMoved.beforeLen} afterLen=${digestMoved.afterLen}`);
    expect(digestMoved.same, "the tuning change MUST move the state digest — otherwise this negative control proves nothing").toBe(false);

    const result = diffAndRecord(baseline.png, tuned.png, "unrelated-logic-unchanged", "unrelated-tuning");
    expect(
      result.diffPixels,
      `an unrelated logic change (digest moved, no render input changed) must leave pixels EXACTLY unchanged — got ${result.diffPixels} px`,
    ).toBe(0);
  });

  test("⑥ 贴图缺失类：让真实贴图 404 → 必须被抓到", async ({ page }) => {
    await ensurePreview(page);
    const baseline = await captureFrozen(page, previewPath, { tag: "texture-control" });
    // sea-normal.ktx2 是真实存在的水面法线贴图（实测该帧会请求它）。
    const missing = await captureFrozen(page, previewPath, {
      tag: "texture-404",
      fault: "none",
      block404: "**/sea-normal*.ktx2",
    });

    record(`[case-⑥] textureFailures=${JSON.stringify(missing.textureFailures)}`);
    expect(
      missing.textureFailures.some((entry) => /sea-normal/.test(entry.url) && entry.status === 404),
      "the 404 must actually have been served to the page",
    ).toBe(true);

    const result = diffAndRecord(baseline.png, missing.png, "texture-404-sea-normal", "texture-404");
    expect(result.diffRatio, "a missing texture MUST move pixels").toBeGreaterThan(0);
  });

  test.afterAll(() => {
    // 把整份证据落到磁盘，方便 chief 直接打开看，也方便贴进报告。
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(resolve(EVIDENCE_DIR, "evidence.log"), `${evidence.join("\n")}\n`, "utf8");
    console.log(`\n=== PIXEL GATE EVIDENCE (${displayPath(EVIDENCE_DIR)}) ===\n${evidence.join("\n")}\n`);
  });
});

/** 显式更新基线的用法提示（写进 spec 里，别只放文档）。 */
test("⑦ 基线更新必须显式（默认拒绝写盘）", async () => {
  expect(updateBaselineEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  expect(updateBaselineEnabled({ GODESK_UPDATE_BASELINE: "1" } as NodeJS.ProcessEnv)).toBe(true);
  record(`[baseline-policy] update requires GODESK_UPDATE_BASELINE=1 (currently ${updateBaselineEnabled() ? "ON" : "OFF"})`);
});
