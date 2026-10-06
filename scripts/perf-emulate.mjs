#!/usr/bin/env node
// G3D-05 Chrome emulation performance harness (SPEC §4.6).
//
//   pnpm perf:emulate [--out DIR] [--profiles EP-D,EP-A] [--duration 120]
//                     [--long-minutes 10] [--trace-seconds 10] [--headless]
//                     [--channel chrome] [--room-url URL] [--strict]
//   pnpm perf:ci      [--out DIR]   # deterministic CI subset (SwiftShader)
//
// Desktop emulation gate: Playwright Chromium + CDP (Emulation.* /
// Network.emulateNetworkConditions) runs the five §4.6.2 profiles against a
// real hex-settlement Room on a local `wrangler dev` Worker and writes one JSON
// per profile. Frame numbers are emulated proxies, never device results
// (§4.6.4, docs/perf/emulation-protocol.md). Outputs stay OUT of the repo.
//
// CI gate (--ci): the same Room under SwiftShader, asserting only deterministic
// budgets (bytes, requests, draw calls, triangles, GPU estimate, leaks,
// context-loss rebuild). Exit code 1 on any budget failure.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  LONG_RUN_BUDGET, MB, PROFILE_BUDGETS, RESILIENCE_BUDGETS, TIER_BUDGETS, TRANSFER_BUDGETS, check,
} from "./perf/budgets.mjs";
import { createHexRoom, startWorker, withQuery } from "./perf/room.mjs";

const { values: args } = parseArgs({
  options: {
    ci: { type: "boolean", default: false },
    out: { type: "string" },
    profiles: { type: "string", default: "EP-D,EP-D4,EP-A,EP-A6,EP-I" },
    duration: { type: "string", default: "120" },
    "long-minutes": { type: "string", default: "10" },
    "trace-seconds": { type: "string", default: "10" },
    headless: { type: "boolean", default: false },
    channel: { type: "string" },
    "room-url": { type: "string" },
    seed: { type: "string", default: "7" },
    strict: { type: "boolean", default: false },
  },
});

/** three r186 module-level textures that outlive every renderer (see leak check). */
const ENGINE_SINGLETON_TEXTURES = 1;
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const log = (line) => console.log(`[perf ${new Date().toISOString()}] ${line}`);

// §4.6.2 network presets — identical to Chrome DevTools / Puppeteer (bytes per second).
const NETWORK = {
  none: { label: "不节流", offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
  "fast-4g": {
    label: "Fast 4G", offline: false, latency: 165,
    downloadThroughput: ((9 * 1000 * 1000) / 8) * 0.9, uploadThroughput: ((1.5 * 1000 * 1000) / 8) * 0.9,
  },
  "slow-4g": {
    label: "Slow 4G", offline: false, latency: 562.5,
    downloadThroughput: ((1.6 * 1000 * 1000) / 8) * 0.9, uploadThroughput: ((750 * 1000) / 8) * 0.9,
  },
};

const DESKTOP_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const PIXEL7_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36";
const IPHONE12PRO_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1";

// §4.6.2 profiles — explicit numbers, not device-descriptor names.
export const PROFILES = {
  "EP-D": {
    label: "EP-D 桌面", width: 1440, height: 900, dpr: 1, mobile: false, touch: false, ua: DESKTOP_UA,
    platform: "Linux x86_64", cpu: 1, network: "none", expectedTier: "high", tierQuery: null, hardwareConcurrency: null,
  },
  "EP-D4": {
    label: "EP-D4 弱桌面", width: 1440, height: 900, dpr: 1, mobile: false, touch: false, ua: DESKTOP_UA,
    platform: "Linux x86_64", cpu: 4, network: "none", expectedTier: "medium", tierQuery: "medium", hardwareConcurrency: null,
  },
  "EP-A": {
    label: "EP-A 中端 Android（Pixel 7 参数）", width: 412, height: 839, dpr: 2.625, mobile: true, touch: true,
    ua: PIXEL7_UA, platform: "Linux armv8l", cpu: 4, network: "fast-4g", expectedTier: "low", tierQuery: null,
    hardwareConcurrency: 8,
  },
  "EP-A6": {
    label: "EP-A6 低端 Android（Pixel 7 参数）", width: 412, height: 839, dpr: 2.625, mobile: true, touch: true,
    ua: PIXEL7_UA, platform: "Linux armv8l", cpu: 6, network: "slow-4g", expectedTier: "low", tierQuery: null,
    hardwareConcurrency: 4,
  },
  "EP-I": {
    label: "EP-I iPhone（iPhone 12 Pro 参数，Chromium 渲染）", width: 390, height: 844, dpr: 3, mobile: true,
    touch: true, ua: IPHONE12PRO_UA, platform: "iPhone", cpu: 4, network: "fast-4g", expectedTier: "low",
    tierQuery: null, hardwareConcurrency: 6,
  },
};

/** Deterministic PRNG (mulberry32) so the auto-game clicks are identical per seed. */
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function hostBenchmarkIndex(browser) {
  // Lighthouse's own computeBenchmarkIndex (resolved through @lhci/cli), unthrottled host.
  const require = createRequire(import.meta.url);
  const lhciRequire = createRequire(require.resolve("@lhci/cli/package.json"));
  const lighthouseDir = resolve(lhciRequire.resolve("lighthouse/package.json"), "..");
  const { pageFunctions } = await import(join(lighthouseDir, "core/lib/page-functions.js"));
  const page = await browser.newPage();
  try {
    await page.goto("about:blank");
    const index = await page.evaluate(`(${pageFunctions.computeBenchmarkIndex.toString()})()`);
    return Math.round(index);
  } finally {
    await page.close();
  }
}

async function applyProfile(cdp, profile) {
  const applied = {};
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const network = NETWORK[profile.network];
  await cdp.send("Network.emulateNetworkConditions", {
    offline: network.offline, latency: network.latency,
    downloadThroughput: network.downloadThroughput, uploadThroughput: network.uploadThroughput,
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: profile.width, height: profile.height, deviceScaleFactor: profile.dpr, mobile: profile.mobile,
    screenWidth: profile.width, screenHeight: profile.height,
  });
  await cdp.send("Emulation.setTouchEmulationEnabled",
    profile.touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await cdp.send("Emulation.setUserAgentOverride", { userAgent: profile.ua, platform: profile.platform });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
  if (profile.hardwareConcurrency) {
    try {
      await cdp.send("Emulation.setHardwareConcurrencyOverride", { hardwareConcurrency: profile.hardwareConcurrency });
      applied.hardwareConcurrencyOverride = { supported: true, requested: profile.hardwareConcurrency };
    } catch (error) {
      applied.hardwareConcurrencyOverride = { supported: false, error: String(error.message ?? error).slice(0, 200) };
    }
  }
  return applied;
}

/** Counts every request / encoded byte the page receives (CDP Network domain). */
function trackNetwork(cdp) {
  const started = new Map();
  const finished = [];
  let firstAt = null;
  cdp.on("Network.requestWillBeSent", (event) => {
    if (firstAt === null) firstAt = event.timestamp;
    if (!started.has(event.requestId)) started.set(event.requestId, { at: event.timestamp, url: event.request.url });
  });
  cdp.on("Network.loadingFinished", (event) => finished.push({ requestId: event.requestId, at: event.timestamp, bytes: event.encodedDataLength }));
  cdp.on("Network.loadingFailed", (event) => finished.push({ requestId: event.requestId, at: event.timestamp, bytes: 0, failed: true }));
  return {
    /** Requests started and bytes finished within `windowMs` of the first request. */
    within(windowMs) {
      if (firstAt === null) return { requests: 0, bytes: 0 };
      const limit = firstAt + windowMs / 1000;
      const requests = [...started.values()].filter((entry) => entry.at <= limit).length;
      const bytes = finished.filter((entry) => entry.at <= limit).reduce((sum, entry) => sum + entry.bytes, 0);
      return { requests, bytes };
    },
  };
}

async function waitForInteractive(page, timeoutMs) {
  await page.waitForFunction(
    () => {
      const snapshot = window.__godeskPerf?.snapshot();
      return Boolean(snapshot && snapshot.interactiveMs !== null);
    },
    undefined,
    { timeout: timeoutMs, polling: 250 },
  );
}

/** Bytes received before `render3d:interactive` (Resource Timing, same clock as the mark). */
async function interactiveBytes(page) {
  return page.evaluate(() => {
    const mark = performance.getEntriesByName("render3d:interactive").at(0);
    if (!mark) return null;
    const navigation = performance.getEntriesByType("navigation").at(0);
    let bytes = navigation ? navigation.transferSize || navigation.encodedBodySize || 0 : 0;
    for (const entry of performance.getEntriesByType("resource")) {
      if (entry.responseEnd <= mark.startTime) bytes += entry.transferSize || entry.encodedBodySize || 0;
    }
    return bytes;
  });
}

async function environment(page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      webgl2: Boolean(gl),
      unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory ?? null,
      pointerCoarse: matchMedia("(pointer: coarse)").matches,
      maxTouchPoints: navigator.maxTouchPoints,
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
    };
  });
}

async function claimSeat(page, seat) {
  const select = page.getByLabel("你的席位");
  await select.waitFor({ timeout: 60_000 });
  await select.selectOption(String(seat));
  await page.waitForTimeout(500);
}

/** One seeded legal action on whichever page currently has enabled board buttons. */
async function autoMove(pages, random) {
  for (const page of pages) {
    const board = page.getByRole("region", { name: "卡坦六角岛" });
    const buttons = board.locator("button:not([disabled])");
    const count = await buttons.count().catch(() => 0);
    if (!count) continue;
    const index = Math.floor(random() * count);
    const target = buttons.nth(index);
    try {
      await target.click({ timeout: 2_000 });
      return true;
    } catch {
      // Under CDP touch emulation Playwright's mouse actionability checks can
      // time out; the auto-game only needs the legal action to fire.
      try {
        await target.dispatchEvent("click");
        return true;
      } catch {
        return false;
      }
    }
  }
  return false;
}

async function autoPlay(pages, random, durationMs, onTick) {
  const end = Date.now() + durationMs;
  let moves = 0;
  while (Date.now() < end) {
    if (await autoMove(pages, random)) moves += 1;
    await onTick?.();
    await delay(600 + Math.floor(random() * 600));
  }
  return moves;
}

async function snapshot(page) {
  return page.evaluate(() => window.__godeskPerf?.snapshot() ?? null);
}

function summarizeBudgets(profileId, profile, snap, transfer) {
  const budgets = PROFILE_BUDGETS[profileId];
  const tierBudget = TIER_BUDGETS[profile.expectedTier];
  const tierNote = snap?.tier !== profile.expectedTier
    ? `画像默认档位 ${profile.expectedTier}，实际 ${snap?.tier ?? "未知"}（G3D-06 前无自动分级）`
    : undefined;
  return [
    check("interactiveMs", snap?.interactiveMs, budgets.interactiveMs),
    check("fpsMedian", snap?.fps, budgets.fpsMedian, "min", "模拟代理值"),
    check("p95FrameMs", snap?.frameTimeMs?.p95, budgets.p95FrameMs, "max", "模拟代理值"),
    check("jsHeapBytes", snap?.jsHeap?.usedBytes, budgets.jsHeapBytes),
    check("interactiveBytes", transfer.interactiveBytes, TRANSFER_BUDGETS.interactiveBytes),
    check("firstGameBytes", transfer.firstGame.bytes, tierBudget.firstGameBytes, "max", tierNote),
    check("firstGameRequests", transfer.firstGame.requests, TRANSFER_BUDGETS.firstGameRequests),
    check("drawCalls", snap?.renderer?.calls, tierBudget.drawCalls, "max", tierNote),
    check("drawCallsPeak", snap?.rendererPeak?.calls, tierBudget.drawCalls, "max", tierNote),
    check("triangles", snap?.renderer?.triangles, tierBudget.triangles, "max", tierNote),
    check("gpuMemoryEstimateBytes", snap?.gpuMemoryEstimateBytes, tierBudget.gpuMemoryBytes, "max", tierNote),
  ];
}

async function runProfile({ browser, profileId, roomUrl, outDir, durationMs, longMinutes, traceSeconds, seed, meta }) {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`unknown profile ${profileId}`);
  log(`${profileId}: start (${profile.label})`);
  const random = rng(seed);
  const context = await browser.newContext({ viewport: null });
  const driverContext = await browser.newContext({ viewport: { width: 360, height: 240 } });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const applied = await applyProfile(cdp, profile);
    const network = trackNetwork(cdp);
    const url = withQuery(roomUrl, { perf: 1, tier: profile.tierQuery });
    const navigationStart = Date.now();
    await page.goto(url, { waitUntil: "commit", timeout: 120_000 });
    await waitForInteractive(page, 180_000);
    const interactive = await interactiveBytes(page);
    const env = await environment(page);

    // Second seat: an unthrottled, tiny driver page (not measured).
    const driver = await driverContext.newPage();
    await driver.goto(roomUrl);
    await claimSeat(page, 0);
    await claimSeat(driver, 1);

    const sinceNavigation = Date.now() - navigationStart;
    if (sinceNavigation < TRANSFER_BUDGETS.firstGameWindowMs) await delay(TRANSFER_BUDGETS.firstGameWindowMs - sinceNavigation);
    const firstGame = network.within(TRANSFER_BUDGETS.firstGameWindowMs);

    await page.evaluate(() => window.__godeskPerf?.resetSamples());
    const moves = await autoPlay([page, driver], random, durationMs);
    const measured = await snapshot(page);

    let trace = null;
    if (profileId === "EP-A" && traceSeconds > 0) {
      const tracePath = join(outDir, `${profileId}.trace.json`);
      await browser.startTracing(page, { path: tracePath, screenshots: false });
      await autoPlay([page, driver], random, traceSeconds * 1000);
      await browser.stopTracing();
      trace = { path: tracePath, seconds: traceSeconds };
    }

    let longRun = null;
    if (profileId === "EP-A" && longMinutes > 0) {
      const minutes = [];
      for (let minute = 1; minute <= longMinutes; minute += 1) {
        // The scene is already warm here: every minute uses the same (no) warm-up discard.
        await page.evaluate(() => window.__godeskPerf?.resetSamples({ warmup: false }));
        await autoPlay([page, driver], random, 60_000);
        await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
        const snap = await snapshot(page);
        minutes.push({ minute, p50FrameMs: snap?.frameTimeMs?.p50 ?? null, jsHeapUsedBytes: snap?.jsHeap?.usedBytes ?? null });
        log(`${profileId}: long run minute ${minute}/${longMinutes} p50=${snap?.frameTimeMs?.p50} heap=${Math.round((snap?.jsHeap?.usedBytes ?? 0) / MB)}MB`);
      }
      const first = minutes[0];
      const last = minutes.at(-1);
      const growth = first?.p50FrameMs && last?.p50FrameMs ? (last.p50FrameMs - first.p50FrameMs) / first.p50FrameMs : null;
      const heapGrowth = first?.jsHeapUsedBytes != null && last?.jsHeapUsedBytes != null ? last.jsHeapUsedBytes - first.jsHeapUsedBytes : null;
      longRun = {
        minutes,
        budgets: [
          check("medianFrameGrowthRatio", growth === null ? null : Math.round(growth * 1000) / 1000, LONG_RUN_BUDGET.medianFrameGrowthRatio),
          check("heapGrowthBytes", heapGrowth, LONG_RUN_BUDGET.heapGrowthBytes),
        ],
      };
    }

    const transfer = { interactiveBytes: interactive, firstGame };
    const budgets = summarizeBudgets(profileId, profile, measured, transfer);
    const result = {
      schema: "godesk-perf-emulate/v1",
      profile: profileId,
      profileLabel: profile.label,
      chromeVersion: browser.version(),
      cpuThrottlingRate: profile.cpu,
      network: { preset: NETWORK[profile.network].label, ...NETWORK[profile.network], label: undefined },
      viewport: { width: profile.width, height: profile.height },
      devicePixelRatio: profile.dpr,
      touch: profile.touch,
      userAgent: profile.ua,
      unmaskedRenderer: env.unmaskedRenderer,
      hostBenchmarkIndex: meta.benchmarkIndex,
      tier: { expected: profile.expectedTier, actual: measured?.tier ?? null, source: measured?.tierSource ?? null },
      frameTimeMs: measured?.frameTimeMs ?? null,
      fps: measured?.fps ?? null,
      frames: measured?.frames ?? null,
      rendererInfo: measured?.renderer ?? null,
      gpuMemoryEstimateBytes: measured?.gpuMemoryEstimateBytes ?? null,
      jsHeap: measured?.jsHeap ?? null,
      transferBytes: { beforeInteractive: interactive, firstGame30s: firstGame.bytes },
      requestCount: { firstGame30s: firstGame.requests },
      interactiveMs: measured?.interactiveMs ?? null,
      autoGame: { seed, durationSeconds: durationMs / 1000, moves },
      emulation: {
        cdp: ["Emulation.setDeviceMetricsOverride", "Emulation.setTouchEmulationEnabled", "Emulation.setUserAgentOverride",
          "Emulation.setCPUThrottlingRate", "Network.emulateNetworkConditions"],
        ...applied,
        observed: env,
      },
      trace,
      longRun,
      budgets,
      host: meta.host,
      roomUrl: roomUrl.replace(/share=[^&]+/, "share=<redacted>"),
      capturedAt: new Date().toISOString(),
      disclaimer: "帧率、p95 帧时与长局趋势为桌面 Chrome 模拟测得代理值，不是真机验证结果（SPEC §4.6.4）。",
    };
    await writeFile(join(outDir, `${profileId}.json`), `${JSON.stringify(result, null, 2)}\n`);
    log(`${profileId}: fps=${result.fps} p95=${result.frameTimeMs?.p95} tti=${result.interactiveMs} draw=${result.rendererInfo?.calls} bytes=${firstGame.bytes} req=${firstGame.requests} moves=${moves}`);
    return result;
  } finally {
    await driverContext.close();
    await context.close();
  }
}

async function runCi({ browser, roomUrl, outDir }) {
  const results = [];
  const tier = TIER_BUDGETS.high;
  // 1. Cold load at the default tier: transfer, requests, draw calls, triangles, GPU estimate.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    const network = trackNetwork(cdp);
    const started = Date.now();
    await page.goto(withQuery(roomUrl, { perf: 1 }), { waitUntil: "commit" });
    await waitForInteractive(page, 120_000);
    const interactive = await interactiveBytes(page);
    await page.waitForTimeout(2_000);
    // G3D-07: PBR textures stream in after interactive; measure GPU memory / draw calls with them applied.
    const pbrState = await page.waitForFunction(() => {
      const value = document.querySelector('[data-testid="g3d-scene-host"]')?.getAttribute("data-pbr");
      return value && value !== "pending" ? value : null;
    }, undefined, { timeout: 20_000 }).then((handle) => handle.jsonValue()).catch(() => "timeout");
    await page.waitForTimeout(500);
    const snap = await snapshot(page);
    const wait = TRANSFER_BUDGETS.firstGameWindowMs - (Date.now() - started);
    if (wait > 0) await delay(wait);
    const firstGame = network.within(TRANSFER_BUDGETS.firstGameWindowMs);
    results.push(
      check("interactiveBytes", interactive, TRANSFER_BUDGETS.interactiveBytes),
      check("firstGameBytes(high)", firstGame.bytes, tier.firstGameBytes),
      check("firstGameRequests", firstGame.requests, TRANSFER_BUDGETS.firstGameRequests),
      check("drawCalls(high)", snap?.renderer?.calls, tier.drawCalls),
      check("drawCallsPeak(high)", snap?.rendererPeak?.calls, tier.drawCalls, "max", "含阴影重绘帧（G3D-07 静止时复用阴影贴图）"),
      check("triangles(high)", snap?.renderer?.triangles, tier.triangles),
      check("gpuMemoryEstimateBytes(high)", snap?.gpuMemoryEstimateBytes, tier.gpuMemoryBytes, "max", `pbr=${pbrState}`),
    );

    // 2. Leak: rebuild the 3D host N times; memory after each mount equals the
    //    first mount, app-owned resources are all disposed before
    //    renderer.dispose(), and the JS heap (after GC) does not keep growing.
    await cdp.send("HeapProfiler.enable").catch(() => {});
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
    const heapBefore = (await snapshot(page))?.jsHeap?.usedBytes ?? null;
    for (let cycle = 0; cycle < RESILIENCE_BUDGETS.leakCycles; cycle += 1) {
      await page.evaluate(() => window.__godeskPerf?.remount());
      await page.waitForFunction((expected) => (window.__godeskPerf?.snapshot()?.lifecycle.memoryOnMount.length ?? 0) >= expected,
        cycle + 2, { timeout: 30_000 });
    }
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
    const afterLeak = await snapshot(page);
    const life = afterLeak?.lifecycle;
    const baseline = life?.memoryOnMount[0];
    // G3D-07: a runtime downgrade (SwiftShader is slow) changes the resource mix — high adds the
    // PMREM environment texture — so each mount is compared with the first mount at the same tier.
    const firstByTier = new Map();
    for (const entry of life?.memoryOnMount ?? []) if (!firstByTier.has(entry.tier)) firstByTier.set(entry.tier, entry);
    const drift = life?.memoryOnMount.reduce((max, entry) => {
      const reference = firstByTier.get(entry.tier);
      return Math.max(max, Math.abs(entry.geometries - reference.geometries), Math.abs(entry.textures - reference.textures));
    }, 0) ?? null;
    const mountTiers = (life?.memoryOnMount ?? []).map((entry) => entry.tier ?? "?").join(",");
    const residualGeometries = life?.residualOnDispose.reduce((max, entry) => Math.max(max, entry.geometries), 0) ?? null;
    const residualTextures = life?.residualOnDispose.reduce((max, entry) => Math.max(max, entry.textures), 0) ?? null;
    const heapAfter = afterLeak?.jsHeap?.usedBytes ?? null;
    results.push(
      check("leak.memoryDriftAfter10Remounts", drift, 0, "max", `baseline ${JSON.stringify(baseline)}，mounts ${life?.mounts}，按同档位比较（各次挂载档位 ${mountTiers}）`),
      check("leak.residualGeometriesOnDispose", residualGeometries, 0, "max", `${life?.residualOnDispose.length ?? 0} 次卸载`),
      // three r186 binds a module-level 1×1 `emptyShadowTexture` (WebGLUniforms.js) before the
      // first shadow map exists; it is an engine singleton, not an app resource.
      check("leak.residualTexturesOnDispose", residualTextures, ENGINE_SINGLETON_TEXTURES, "max",
        "允许 three 内部 emptyShadowTexture 单例 1 个"),
      check("leak.activeHosts", life?.activeHosts, 1),
      check("leak.jsHeapGrowthBytes(report)", heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null, null, "max",
        "仅记录；堆预算由桌面模拟门断言"),
    );

    // 3. WebGL context loss: scene rebuilt <= 2 s after webglcontextlost.
    const lost = await page.evaluate(() => window.__godeskPerf?.loseContext() ?? false);
    await page.waitForTimeout(50);
    const restored = lost && (await page.evaluate(() => window.__godeskPerf?.restoreContext() ?? false));
    let rebuildMs = null;
    if (restored) {
      await page.waitForFunction(() => window.__godeskPerf?.snapshot()?.context.lastRebuildMs != null, undefined, { timeout: 10_000 })
        .catch(() => {});
      rebuildMs = (await snapshot(page))?.context.lastRebuildMs ?? null;
    }
    results.push(check("contextLoss.rebuildMs", rebuildMs, RESILIENCE_BUDGETS.contextRebuildMs, "max",
      lost ? undefined : "WEBGL_lose_context 不可用"));
    await context.close();
  }
  // 4. Low tier first-game transfer (forced ?tier=low).
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    const network = trackNetwork(cdp);
    const started = Date.now();
    await page.goto(withQuery(roomUrl, { perf: 1, tier: "low" }), { waitUntil: "commit" });
    await waitForInteractive(page, 120_000);
    const wait = TRANSFER_BUDGETS.firstGameWindowMs - (Date.now() - started);
    if (wait > 0) await delay(wait);
    const firstGame = network.within(TRANSFER_BUDGETS.firstGameWindowMs);
    results.push(check("firstGameBytes(low)", firstGame.bytes, TIER_BUDGETS.low.firstGameBytes));
    await context.close();
  }
  const env = await (async () => {
    const page = await browser.newPage();
    try { return await environment(page); } finally { await page.close(); }
  })();
  const report = {
    schema: "godesk-perf-ci/v1",
    chromeVersion: browser.version(),
    unmaskedRenderer: env.unmaskedRenderer,
    budgets: results,
    pass: results.every((entry) => entry.pass !== false),
    note: "CI 门只断言确定性预算；SwiftShader 为 CPU 软件渲染，帧率无参考意义，不断言（SPEC §4.6.1）。",
    capturedAt: new Date().toISOString(),
  };
  await writeFile(join(outDir, "ci-budgets.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function printTable(rows) {
  for (const row of rows) {
    const status = row.pass === null ? "—" : row.pass ? "PASS" : "FAIL";
    console.log(`  ${status.padEnd(4)} ${row.name.padEnd(36)} actual=${row.actual} limit=${row.limit ?? "—"}${row.note ? `  (${row.note})` : ""}`);
  }
}

async function main() {
  // Default output is git-ignored; JSON results are evidence, never committed (SPEC §4.6.1).
  const outDir = resolve(args.out ?? "perf-results");
  await mkdir(outDir, { recursive: true });
  const durationMs = Number(args.duration) * 1000;
  const longMinutes = Number(args["long-minutes"]);
  const traceSeconds = Number(args["trace-seconds"]);
  const seed = Number(args.seed);

  let worker = null;
  if (!args["room-url"]) worker = await startWorker({ log });
  // Every profile gets a fresh fixed-seed Room so all five start from the same
  // initial position (a reused Room would keep the previous profile's moves).
  let roomCount = 0;
  const freshRoom = async () => {
    if (args["room-url"]) return args["room-url"];
    roomCount += 1;
    const { roomUrl } = await createHexRoom(worker.origin, { seed, tag: `${Date.now()}-${roomCount}` });
    log(`room ${roomUrl.replace(/share=[^&]+/, "share=<redacted>")}`);
    return roomUrl;
  };
  const browser = await chromium.launch({
    headless: args.ci ? true : args.headless,
    ...(args.channel ? { channel: args.channel } : {}),
    // Chrome 144+ headless no longer falls back to SwiftShader on its own (SPEC F24);
    // on a hardware-GPU desktop this flag only permits, never forces, the fallback.
    args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"],
  });
  let exitCode = 0;
  try {
    if (args.ci) {
      const report = await runCi({ browser, roomUrl: await freshRoom(), outDir });
      console.log(`CI render budgets (${report.unmaskedRenderer}):`);
      printTable(report.budgets);
      if (!report.pass) exitCode = 1;
    } else {
      const benchmarkIndex = await hostBenchmarkIndex(browser);
      const meta = {
        benchmarkIndex,
        host: { platform: process.platform, arch: process.arch, node: process.version, headless: args.headless, channel: args.channel ?? "playwright-chromium" },
      };
      log(`host benchmarkIndex=${benchmarkIndex}`);
      const summary = [];
      for (const profileId of args.profiles.split(",").map((value) => value.trim()).filter(Boolean)) {
        const result = await runProfile({ browser, profileId, roomUrl: await freshRoom(), outDir, durationMs, longMinutes, traceSeconds, seed, meta });
        console.log(`${profileId}:`);
        printTable([...result.budgets, ...(result.longRun?.budgets ?? [])]);
        summary.push({ profile: profileId, fps: result.fps, p95: result.frameTimeMs?.p95, interactiveMs: result.interactiveMs,
          drawCalls: result.rendererInfo?.calls, triangles: result.rendererInfo?.triangles,
          bytes30s: result.transferBytes.firstGame30s, requests30s: result.requestCount.firstGame30s,
          failed: [...result.budgets, ...(result.longRun?.budgets ?? [])].filter((entry) => entry.pass === false).map((entry) => entry.name) });
      }
      await writeFile(join(outDir, "summary.json"), `${JSON.stringify({ benchmarkIndex, chromeVersion: browser.version(), summary }, null, 2)}\n`);
      if (args.strict && summary.some((entry) => entry.failed.length)) exitCode = 1;
    }
  } finally {
    await browser.close();
    await worker?.stop();
  }
  log(`results in ${outDir}`);
  process.exitCode = exitCode;
}

await main();
