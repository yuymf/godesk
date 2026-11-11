import { expect, test, type Browser, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

/**
 * Playwright 1.63 expects chromium r1243; this host caches r1208/r1248 plus a
 * system Chrome. Pick a local binary ONLY when the expected revision is
 * missing, so the spec works either way and never needs a browser download.
 * Spec-local: no other e2e spec is affected.
 */
const PW_CACHE = "/home/halyu/.cache/ms-playwright";
const expected = `${PW_CACHE}/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`;
const fallbacks = [
  "/usr/bin/google-chrome",
  `${PW_CACHE}/chromium-1248/chrome-linux64/chrome`,
  `${PW_CACHE}/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`,
];
const localBinary = existsSync(expected) ? null : (fallbacks.find(existsSync) ?? null);
if (localBinary) test.use({ launchOptions: { executablePath: localBinary, args: ["--enable-unsafe-swiftshader"] } });

/**
 * G3D-HARNESS — browser-side deterministic regression four-piece.
 *
 *   freeze / fixed-dt clock / seeded RNG / digest / step / stepUntil
 *
 * This spec proves the core claim: "change one constant -> automatically prove
 * the behaviour actually changed by the predicted amount", without eyeballing
 * a screenshot. `digest()` is structured state (no pixels), so a shader /
 * visual change is NOT covered here — that gap belongs to the pixel gate
 * (seika's card). See docs/harness/deterministic-harness.md.
 *
 * Local regression capability only. No deploy, no wrangler.jsonc, no secrets.
 */
const HEX_ISLAND_PROMPT = "做一款可以与电脑对战的汐屿六角岛资源建造游戏";
const SEED = 20261111;

/**
 * How long BOTH harness signals must stay continuously true, on the same API
 * instance, before we call the page ready. See `waitHarnessReady`.
 */
const HARNESS_STABLE_MS = 250;

type HarnessApi = {
  freeze(): boolean;
  resume(): boolean;
  isFrozen(): boolean;
  setDt(ms: number): number;
  getDt(): number;
  reset(seed?: number): string;
  now(): number;
  setSeed(seed: number): { seeded: boolean; seed: number | null; draws: number };
  rngState(): { seeded: boolean; seed: number | null; draws: number };
  randomSequence(count?: number): number[];
  seededSequence(seed: number, count?: number): number[];
  setTuning(partial: Record<string, number>): Record<string, number>;
  getTuning(): Record<string, number>;
  digest(): Record<string, unknown>;
  digestJson(): string;
  digestSha256(): Promise<string>;
  status(): Record<string, unknown>;
  playMotion(id: string): number;
  step(options: { frames?: number; durationMs?: number }): {
    elapsedMs: number; frames: number; physicsTicks: number; report: Record<string, unknown>;
  };
  stepUntil(predicate: string, options?: { timeoutMs?: number; maxFrames?: number }): {
    predicateMet: boolean; elapsedMs: number; frames: number; physicsTicks: number;
    predicate: string; error?: string; report: Record<string, unknown>;
  };
};

type HarnessWindow = Window & {
  __godeskHarness?: HarnessApi;
  __godeskHarnessStability?: { ref: HarnessApi | null; since: number };
};

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** Local, deterministic NL generation (no external LLM) -> immutable build id. */
async function buildHexPreviewPath(page: Page): Promise<string> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(HEX_ISLAND_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  expect(projectId).toBeTruthy();
  const { builds } = (await (await page.request.get(`/api/projects/${projectId}?view=builds`)).json()) as {
    builds: { id: string }[];
  };
  expect(builds.length).toBeGreaterThan(0);
  return `/chatgpt-plugin/play/${encodeURIComponent(builds.at(-1)!.id)}`;
}

/**
 * Wait until the harness runtime is not merely present, but STABLE.
 *
 * "Present right now" is too weak a predicate to hand to the next `evaluate`:
 * a document can be torn down and re-created between the poll and the following
 * CDP round-trip, and the caller then reads `undefined`. That is how this spec
 * produced a ~1-in-10 false red on `__godeskHarness.freeze()`.
 *
 * So we require BOTH signals — the `window.__godeskHarness` global and the
 * `documentElement.dataset.godeskHarness === "1"` marker — to hold on the SAME
 * API instance for a continuous `HARNESS_STABLE_MS` window. Any delete, any
 * re-attach (new instance) or any marker flap resets the clock inside the page,
 * so this only resolves during a genuinely quiescent period.
 *
 * Then we cross two animation frames plus a delay — the gap the old
 * "exists once" check left open — and re-assert both signals still hold.
 */
async function waitHarnessReady(page: Page): Promise<void> {
  await page.waitForFunction(
    (stableMs: number) => {
      const w = window as HarnessWindow;
      const api = w.__godeskHarness;
      const flag = document.documentElement.dataset.godeskHarness === "1";
      const st = (w.__godeskHarnessStability ??= { ref: null, since: 0 });
      if (!api || !flag) {
        st.ref = null;
        st.since = 0;
        return false;
      }
      // A different instance means detach+re-attach happened: restart the clock.
      if (st.ref !== api) {
        st.ref = api;
        st.since = performance.now();
        return false;
      }
      return performance.now() - st.since >= stableMs;
    },
    HARNESS_STABLE_MS,
    { timeout: 60_000, polling: 50 },
  );

  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
  // Wait for the async hex dressing + water chunks so the digest's subsystem
  // state is settled (otherwise two runs could sample different load stages).
  await expect.poll(
    () => page.getByTestId("g3d-scene-host").evaluate((el) => ({
      water: el.dataset.water ?? null,
      props: el.dataset.terrainProps ?? null,
      island: el.dataset.island ?? null,
      boot: el.dataset.boot ?? null,
    })),
    { timeout: 90_000 },
  ).toMatchObject({ water: "on", props: expect.any(String), island: expect.any(String), boot: "ready" });

  // Settle across two frames + a delay, then prove BOTH signals are still there
  // and still the same instance. This is the exact window the old check missed.
  await page.evaluate(
    () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }),
  );
  await page.waitForTimeout(HARNESS_STABLE_MS);
  const settled = await page.evaluate(() => {
    const w = window as HarnessWindow;
    return {
      global: typeof w.__godeskHarness,
      flag: document.documentElement.dataset.godeskHarness ?? null,
      sameInstance: w.__godeskHarnessStability?.ref === w.__godeskHarness,
    };
  });
  expect(settled.global, "harness global must survive the settle window").toBe("object");
  expect(settled.flag, "harness marker must survive the settle window").toBe("1");
  expect(settled.sameInstance, "harness instance must not be swapped under us").toBe(true);
}

async function digestJson(page: Page): Promise<string> {
  return page.evaluate(() => (window as HarnessWindow).__godeskHarness!.digestJson());
}

test.describe("G3D-HARNESS browser-side deterministic regression", () => {
  /**
   * The preview build is created lazily on first use, through the test's own
   * `page` fixture (which carries `use.baseURL`).
   *
   * This used to be a module-level `let previewPath = ""` assigned only by the
   * first test, so the second test depended on the first having run. Any
   * `-g` / `--grep` / `--only` / IDE single-test run then hit
   * "serial dependency: previous test must run first" — a false failure that
   * looks exactly like a real bug. Building on demand keeps the cost paid once
   * per worker while making each test independently runnable.
   */
  let previewPath = "";

  async function ensurePreviewPath(page: Page): Promise<string> {
    if (!previewPath) previewPath = await buildHexPreviewPath(page);
    expect(previewPath, "fixture: preview build must exist").toBeTruthy();
    return previewPath;
  }

  test("four-piece: conditional global, idempotent digest, seeded RNG, step / stepUntil", async ({ browser, page }) => {
    test.setTimeout(300_000);
    const built = await ensurePreviewPath(page);
    const harnessUrl = `${built}?harness=1&seed=${SEED}`;

    // ---- ① conditional global: `?harness=1` only -------------------------
    await page.goto(built);
    await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
    const normal = await page.evaluate(() => ({
      global: typeof (window as HarnessWindow).__godeskHarness,
      flag: document.documentElement.dataset.godeskHarness ?? null,
      busy: typeof (window as unknown as { __g3dMotionBusy?: unknown }).__g3dMotionBusy,
    }));
    expect(normal.global, "normal players must NOT get __godeskHarness").toBe("undefined");
    expect(normal.flag).toBeNull();
    expect(normal.busy, "normal render path still works").toBe("function");

    await page.goto(harnessUrl);
    await waitHarnessReady(page);
    expect(await page.evaluate(() => document.documentElement.dataset.godeskHarness)).toBe("1");

    // ---- ② Byte-identical frozen digest + sha256 across two fresh runs ----
    // Two independent browser contexts = "run it twice with the same seed".
    const run = async (b: Browser): Promise<string> => {
      const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });
      try {
        const p = await ctx.newPage();
        await p.goto(harnessUrl);
        await waitHarnessReady(p);
        return await digestJson(p);
      } finally {
        await ctx.close();
      }
    };
    const first = await run(browser);
    const second = await run(browser);
    expect(sha256(first)).toBe(sha256(second));
    // And two consecutive calls while frozen (the hard godot-mcp criterion).
    const frozenPair = await page.evaluate(async () => {
      const h = (window as HarnessWindow).__godeskHarness!;
      h.freeze();
      const a = JSON.stringify(h.digest());
      const b = JSON.stringify(h.digest());
      const hashA = await h.digestSha256();
      const hashB = await h.digestSha256();
      return { a, b, frozen: h.isFrozen(), same: a === b, hashA, hashB };
    });
    expect(frozenPair.frozen).toBe(true);
    expect(frozenPair.same, "two frozen digests must be byte-identical").toBe(true);
    expect(sha256(frozenPair.a)).toBe(sha256(frozenPair.b));
    expect(frozenPair.hashA).toBe(frozenPair.hashB);
    expect(frozenPair.hashA, "in-page digestSha256 must match Node sha256").toBe(sha256(frozenPair.a));
    console.log(`[harness-idempotency] run1=${sha256(first)} run2=${sha256(second)} frozen=${sha256(frozenPair.a)} inPage=${frozenPair.hashA}`);

    // ---- ③ seeded RNG is byte-identical per seed ------------------------
    const rng = await page.evaluate(() => {
      const h = (window as HarnessWindow).__godeskHarness!;
      h.setSeed(4242);
      const a = h.randomSequence(32);
      h.setSeed(4242);
      const b = h.randomSequence(32);
      h.setSeed(4243);
      const c = h.randomSequence(32);
      const pure = h.seededSequence(4242, 32);
      h.setSeed(4242);
      return { a, b, c, pure, state: h.rngState() };
    });
    expect(rng.a).toEqual(rng.b);
    expect(rng.a).toEqual(rng.pure);
    expect(JSON.stringify(rng.a)).not.toEqual(JSON.stringify(rng.c));
    expect(rng.state.seeded).toBe(true);

    // ---- ④ fixed-dt clock + step / stepUntil ---------------------------
    const clock = await page.evaluate(() => {
      const h = (window as HarnessWindow).__godeskHarness!;
      h.freeze();

      // A) default dt = 1000/60: one physics tick per frame, frames == N*dt.
      h.reset(4242);
      const defaultDt = h.getDt();
      const frames8 = h.step({ frames: 8 });
      const duration100 = h.step({ durationMs: 100 });
      const frames3 = h.step({ frames: 3 });
      const until = h.stepUntil("d.clock.gameTimeMs >= 400", { timeoutMs: 2000 });
      const badPredicate = h.stepUntil("d.animations.tweens.length > 0", { timeoutMs: 100 });

      // B) setDt(25): the physics accumulator is a REAL fixed-step counter,
      //    independent of frame count (200 ms / 16.667 ms = 12 ticks).
      h.reset(4242);
      const setDt = h.setDt(25);
      const wide8 = h.step({ frames: 8 });
      const after = h.status();
      h.setDt(1000 / 60);
      return { defaultDt, setDt, frames8, duration100, frames3, until, badPredicate, wide8, after, dt: h.getDt() };
    });
    expect(clock.defaultDt).toBeCloseTo(1000 / 60, 9);
    expect(clock.setDt).toBe(25);
    // frames IS N x dt — no "real frames, unknown duration" trap.
    expect(clock.frames8).toMatchObject({ frames: 8, physicsTicks: 8 });
    expect(clock.frames8.elapsedMs).toBeCloseTo(8 * (1000 / 60), 5);
    expect(clock.duration100).toMatchObject({ elapsedMs: 100, frames: 6, physicsTicks: 6 });
    expect(clock.frames3).toMatchObject({ frames: 3, physicsTicks: 3 });
    expect(clock.frames3.elapsedMs).toBeCloseTo(50, 5);
    expect(clock.until.predicateMet).toBe(true);
    // elapsedMs is relative to THIS stepUntil call; the absolute game time is
    // in the returned digest (report.clock.gameTimeMs).
    expect(clock.until.elapsedMs).toBeGreaterThan(0);
    expect((clock.until.report as { clock: { gameTimeMs: number } }).clock.gameTimeMs).toBeGreaterThanOrEqual(400);
    expect(clock.until.error).toBeUndefined();
    expect(clock.badPredicate.predicateMet).toBe(false);
    expect(clock.badPredicate.error).toBe("timeout");
    // 8 frames at 25 ms = 200 ms of game time = 12 fixed 60 Hz physics ticks.
    expect(clock.wide8).toMatchObject({ elapsedMs: 200, frames: 8, physicsTicks: 12 });
    expect(clock.dt).toBeCloseTo(1000 / 60, 9);
    expect(clock.frames8.report).toHaveProperty("clock.gameTimeMs");
    expect((clock.frames8.report as { clock: { mode: string } }).clock.mode).toBe("fixed-dt");
  });

  test("regression closed loop: change a gameplay constant -> digest numbers move by the predicted ratio", async ({ page }) => {
    test.setTimeout(300_000);
    const built = await ensurePreviewPath(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${built}?harness=1&seed=${SEED}`);
    // Independent readiness: never rely on a previous test's page state.
    await waitHarnessReady(page);

    // `motion.placeMs` is a REAL gameplay constant (MOTION_MS.place = 280).
    // We change it via the harness tuning seam instead of editing source and
    // rebuilding; motionDurationMs() reads exactly the same value, so this is
    // behaviourally identical to changing the constant in code.
    const result = await page.evaluate(() => {
      const h = (window as HarnessWindow).__godeskHarness!;
      h.freeze();
      h.reset(20261111);
      const objects = (h.digest().scene as { objects: { id: string; kind: string; position: number[]; scale: number[] }[] }).objects;
      const target = objects.find((o) => o.kind === "tile") ?? objects[0]!;
      const id = target.id;

      const sample = (placeMs: number) => {
        h.reset(20261111); // canonical clock + tweens + tuning
        h.setTuning({ "motion.placeMs": placeMs });
        const durationMs = h.playMotion(id);
        const until = h.stepUntil("d.clock.gameTimeMs >= 140", { timeoutMs: 1000 });
        const d = h.digest();
        const scene = d.scene as { objects: { id: string; position: number[]; scale: number[] }[] };
        const animations = d.animations as { tweens: { id: string; durationMs: number; linearProgress: number; easedProgress: number }[] };
        return {
          durationMs,
          gameTimeMs: (d.clock as { gameTimeMs: number }).gameTimeMs,
          elapsedMs: until.elapsedMs,
          predicateMet: until.predicateMet,
          linearProgress: animations.tweens.find((t) => t.id === id)?.linearProgress ?? null,
          easedProgress: animations.tweens.find((t) => t.id === id)?.easedProgress ?? null,
          position: scene.objects.find((o) => o.id === id)?.position ?? null,
          scale: scene.objects.find((o) => o.id === id)?.scale ?? null,
          tuning: (d.tuning as Record<string, number>)["motion.placeMs"] ?? null,
        };
      };

      const a = sample(280);
      const b = sample(560);
      // Third point: 3x duration -> 1/3 progress, to prove it is not a fluke.
      const c = sample(840);
      return { id, a, b, c };
    });

    expect(result.id).toBeTruthy();
    expect(result.a.durationMs).toBe(280);
    expect(result.b.durationMs).toBe(560);
    expect(result.c.durationMs).toBe(840);
    expect(result.a.tuning).toBe(280);
    expect(result.b.tuning).toBe(560);
    expect(result.a.predicateMet).toBe(true);
    expect(result.b.predicateMet).toBe(true);
    expect(result.c.predicateMet).toBe(true);
    // "stepUntil 到同一条件" — same predicate, same dt, same elapsed game time.
    expect(result.a.gameTimeMs).toBe(result.b.gameTimeMs);
    expect(result.b.gameTimeMs).toBe(result.c.gameTimeMs);
    expect(result.a.elapsedMs).toBe(result.b.elapsedMs);

    // Doubling the duration halves the linear progress -> ratio exactly 2.
    const lpA = result.a.linearProgress!;
    const lpB = result.b.linearProgress!;
    const lpC = result.c.linearProgress!;
    expect(lpA).not.toBeNull();
    expect(lpB).not.toBeNull();
    expect(lpC).not.toBeNull();
    expect(lpA).toBeGreaterThan(lpB);
    expect(lpB).toBeGreaterThan(lpC);
    // Tolerance assertions (6-dp normalised digest values).
    expect(lpA / lpB).toBeCloseTo(2, 3);
    expect(lpA / lpC).toBeCloseTo(3, 3);

    // Analytic prediction from the real tween easing: Easing.Back.Out.
    const backOut = (amount: number) => {
      const s = 1.70158;
      return amount === 0 ? 0 : --amount * amount * ((s + 1) * amount + s) + 1;
    };
    for (const [label, sample] of [["280ms", result.a], ["560ms", result.b], ["840ms", result.c]] as const) {
      const predicted = backOut(sample.linearProgress!);
      expect(sample.easedProgress!, `${label} easedProgress must follow Back.Out`).toBeCloseTo(predicted, 3);
      // place() sets scale = max(p, 0.001) and y = baseY + (1 - min(p,1))*0.6.
      expect(sample.scale![0], `${label} digest scale must follow eased progress`).toBeCloseTo(Math.max(predicted, 0.001), 3);
    }
    // The digest's world position really moved (not just animation metadata).
    expect(result.a.position![1]).not.toBe(result.b.position![1]);
    expect(result.b.position![1]).not.toBe(result.c.position![1]);
    console.log(
      `[harness-regression] id=${result.id} ` +
      `280ms{lp=${lpA}, y=${result.a.position![1]}, s=${result.a.scale![0]}} ` +
      `560ms{lp=${lpB}, y=${result.b.position![1]}, s=${result.b.scale![0]}} ` +
      `840ms{lp=${lpC}, y=${result.c.position![1]}, s=${result.c.scale![0]}} ` +
      `ratio=${(lpA / lpB).toFixed(4)}`,
    );
  });
});
