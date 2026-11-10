/**
 * G3D-PIXELGATE · 确定性截图流程。
 *
 * 像素门只有在"冻结的、可复现的同一帧"上才有意义。这个模块把"怎么拿到那一帧"
 * 固化成唯一路径，顺序是硬的（顺序反了会得出错误结论）：
 *
 *   1. 等 harness **稳定**：存在 → 等 3 个 rAF → 再查仍在，且
 *      `documentElement.dataset.godeskHarness === "1"` 仍在。
 *      （父卡实测 1/10 概率 harness 在就绪后被 detach 重挂；"存在即通过"会拍到
 *       正常墙钟下跑的帧，两张图必然不为 0，然后误判成"像素门不准"。）
 *   2. `freeze()` → 断言 `isFrozen() === true`。
 *   3. 连续两次 `digestJson()` 字节级相同（冻结没冻干净会在这里暴露）。
 *   4. 丢弃 warmup：`reset(seed)` 后 `step({frames: WARMUP_FRAMES})`。
 *      GoDesk 自己的 `perf.ts` 用 `WARMUP_FRAMES = 180`（shader compile / layout / GC 预热），
 *      实测 frame 0 vs frame 180 差 49.8% 像素 —— 不丢 warmup 的话基线毫无意义。
 *   5. 只有以上全过，才截图。
 *
 * 截图用 `page.screenshot({clip})` 而不是 `locator.screenshot()`：
 * GoDesk 的 3D 画布在首屏之下，元素截图会触发滚动等待并 30s 超时（实测）。
 * clip 坐标取自 `getBoundingClientRect()`，先 `scrollIntoView({behavior:"instant"})`。
 */
import { expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** 与 `src/render3d/perf.ts` 的 WARMUP_FRAMES 保持一致（180 帧 = 3s @ 60Hz）。 */
export const WARMUP_FRAMES = 180;
/** 确定性默认种子。用例里必须显式传，别依赖随机。 */
export const DEFAULT_SEED = 20261111;
/** 就绪稳定性探测的 rAF 次数（见文件头第 1 步）。 */
const STABILITY_FRAMES = 3;

/**
 * G3D-PIXELGATE 默认端口。
 *
 * 为什么不用 8799：`scripts/e2e-webserver.sh` 第一行就是 `pnpm build`，而
 * `playwright.config.ts` 的 `reuseExistingServer: !process.env.CI` 会在本地**静默复用**
 * 别人已经起的 server。两个进程抢同一个端口时，先到的那轮会拿到被换掉的 asset hash /
 * 被掐断的 DO 连接 → SceneHost 卸载 → `delete window.__godeskHarness`。
 * 于是像素门会拍到"harness 被摘掉、场景退回墙钟自由跑"的两帧，diff 必然不为 0 ——
 * 而人会误判成"像素门基建不准"，接着去调阈值掩盖真 bug。这是最坏的结果。
 *
 * 所以像素门默认独占一个专用端口，并且用 {@link assertPortExclusive} 自证独占。
 */
export const DEFAULT_PIXELGATE_PORT = 8823;

export type HarnessApi = {
  freeze(): boolean;
  resume(): boolean;
  isFrozen(): boolean;
  setDt(ms: number): number;
  getDt(): number;
  reset(seed?: number): string;
  now(): number;
  setSeed(seed: number): unknown;
  setTuning(partial: Record<string, number>): Record<string, number>;
  getTuning(): Record<string, number>;
  digest(): Record<string, unknown>;
  digestJson(): string;
  digestSha256(): Promise<string>;
  status(): Record<string, unknown>;
  playMotion(id: string): number;
  step(options: { frames?: number; durationMs?: number }): {
    elapsedMs: number;
    frames: number;
    physicsTicks: number;
    report: Record<string, unknown>;
  };
  stepUntil(
    predicate: string,
    options?: { timeoutMs?: number; maxFrames?: number },
  ): { predicateMet: boolean; elapsedMs: number; frames: number; predicate: string; error?: string };
};

type HarnessWindow = Window & { __godeskHarness?: HarnessApi };

/**
 * 端口独占自证：确认 `baseURL` 指向的 server 是本 spec 独占的那个端口。
 *
 * 做法不是"ping 一下 200 就算过"——共享端口同样会 200。这里断言三件事：
 *  1. `baseURL` 的端口等于本次 spec 期望的端口（防止有人把像素门悄悄指回 8799）；
 *  2. 目标端口只有一个监听者，且它的进程 cmdline 里带 `--port <期望端口>`
 *     （wrangler 的 argv 是唯一能从 OS 层确认"这是哪个实例"的证据）；
 *  3. 报告里落一条可复制的自证串。
 *
 * 拿不到进程信息时（容器 / 非本地后端）返回 `verifiable:false`，
 * 用例必须把这一点写进报告 —— 不许假装验证过。
 */
export type PortOwnership = {
  port: number;
  expectedPort: number;
  portMatches: boolean;
  verifiable: boolean;
  listeners: { pid: number; cmd: string }[];
  exclusive: boolean;
  note: string;
};

export async function assertPortExclusive(baseURL: string | undefined, expectedPort = DEFAULT_PIXELGATE_PORT): Promise<PortOwnership> {
  const url = new URL(baseURL ?? "");
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  const portMatches = port === expectedPort;
  let listeners: { pid: number; cmd: string }[] = [];
  let verifiable = false;

  /** wrangler dev 的两种 argv 形态都要认：
   *   - wrangler 自己：`... --port 8823 ...`
   *   - 真正 LISTEN 的 workerd 子进程：`... --socket-addr=entry=127.0.0.1:8823 ...`
   *  只认 `--port` 会把"端口确实独占"误判成"不独占"（实测踩过）。 */
  const bindsPort = (cmd: string): boolean =>
    new RegExp(`--port[=\\s]+${port}(\\s|$)`).test(cmd) ||
    new RegExp(`--socket-addr=entry=[^\\s:]+:${port}(\\s|$)`).test(cmd);

  const cmdlineOf = (pid: number): string => {
    try {
      // 只读：/proc/<pid>/cmdline 是 NUL 分隔的。
      return execFileSync("tr", ["\\0", " "], { input: readFileSync(`/proc/${pid}/cmdline`), encoding: "utf8" }).trim();
    } catch {
      return "";
    }
  };

  try {
    // 只读：列监听该端口的 PID（ss 在 Ubuntu 上默认可用）。
    const out = execFileSync("ss", ["-lntp", `sport = :${port}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const pids = [...new Set([...out.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1])))];
    listeners = pids.map((pid) => ({ pid, cmd: cmdlineOf(pid) }));
    verifiable = true;
  } catch {
    verifiable = false;
  }

  /**
   * 独占判定：该端口只有 **一个** 监听进程，且它的祖先链（最多 5 层）里
   * 有一个是本仓的 wrangler 且绑定这个端口。
   *
   * 为什么必须走祖先链：真正 LISTEN 的是 `workerd`，实测进程树是
   *   workerd --socket-addr=entry=127.0.0.1:8823
   *     └ node .../wrangler-dist/cli.js            (无 --port)
   *       └ node .../wrangler/bin/wrangler.js dev --port 8823   ← 只有这层带 --port
   *         └ pnpm exec wrangler dev ...
   * 只查自己或直接父进程会把"确实独占"误判成"不独占"（实测踩过）。
   */
  const MAX_ANCESTOR_DEPTH = 5;
  const ownsPort = (entry: { pid: number; cmd: string }): boolean => {
    if (bindsPort(entry.cmd)) return true;
    let pid = entry.pid;
    for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth += 1) {
      let ppid = 0;
      try {
        const ppidLine = readFileSync(`/proc/${pid}/status`, "utf8").split("\n").find((line) => line.startsWith("PPid:"));
        ppid = Number(ppidLine?.split(/\s+/)[1] ?? 0);
      } catch {
        return false;
      }
      if (!ppid || ppid <= 1) return false;
      if (bindsPort(cmdlineOf(ppid))) return true;
      pid = ppid;
    }
    return false;
  };

  const exclusive = verifiable && listeners.length === 1 && ownsPort(listeners[0]!);
  const note = !verifiable
    ? "cannot inspect listeners on this backend — ownership NOT proven"
    : !portMatches
      ? `baseURL port ${port} != expected ${expectedPort}`
      : exclusive
        ? `exclusive: pid ${listeners[0]!.pid} (${listeners[0]!.cmd.split("/").pop()?.slice(0, 40) ?? "?"}) owns :${port}`
        : `NOT exclusive on :${port} — ${listeners.length} listener(s): ${listeners.map((l) => `${l.pid}[${l.cmd.slice(0, 60)}]`).join(", ")}`;
  return { port, expectedPort, portMatches, verifiable, listeners, exclusive, note };
}

/** 场景宿主上被断言的就绪标记（与父卡 spec 同一组 dataset 键）。 */
export type HostReadyState = {
  boot: string | null;
  water: string | null;
  props: string | null;
  island: string | null;
  tier: string | null;
};

/**
 * 等 harness 稳定。不是"存在即通过"：存在 → 等 STABILITY_FRAMES 个 rAF →
 * 复查全局与 dataset 标记都还在。返回的 `samples` 用于报告（证明确实探测过）。
 */
export async function waitHarnessStable(page: Page, timeoutMs = 120_000): Promise<{ samples: number }> {
  await page.waitForFunction(() => Boolean((window as HarnessWindow).__godeskHarness), null, { timeout: timeoutMs });
  const stable = await page.evaluate(
    ({ frames }) =>
      new Promise<{ ok: boolean; samples: number; reason?: string }>((resolve) => {
        let n = 0;
        const tick = () => {
          n += 1;
          const alive = Boolean((window as HarnessWindow).__godeskHarness);
          const flag = document.documentElement.dataset.godeskHarness;
          if (!alive || flag !== "1") {
            resolve({ ok: false, samples: n, reason: `lost at rAF ${n} (alive=${alive}, flag=${flag ?? "null"})` });
            return;
          }
          if (n >= frames) {
            resolve({ ok: true, samples: n });
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { frames: STABILITY_FRAMES },
  );
  if (!stable.ok) {
    throw new Error(`visual-capture: harness was not stable — ${stable.reason}`);
  }
  return { samples: stable.samples };
}

/** 等场景真的把地形 / 水面 / 启动标记都点亮（否则两次运行可能采样到不同加载阶段）。 */
export async function waitSceneSettled(page: Page, timeoutMs = 120_000): Promise<HostReadyState> {
  const host = page.getByTestId("g3d-scene-host");
  await expect(host).toBeVisible({ timeout: timeoutMs });
  await expect
    .poll(
      () =>
        host.evaluate((el) => ({
          boot: el.dataset.boot ?? null,
          water: el.dataset.water ?? null,
          props: el.dataset.terrainProps ?? null,
          island: el.dataset.island ?? null,
          tier: el.dataset.tier ?? null,
        })),
      { timeout: timeoutMs },
    )
    .toMatchObject({ boot: "ready", water: "on", props: expect.any(String), island: expect.any(String) });
  return host.evaluate((el) => ({
    boot: el.dataset.boot ?? null,
    water: el.dataset.water ?? null,
    props: el.dataset.terrainProps ?? null,
    island: el.dataset.island ?? null,
    tier: el.dataset.tier ?? null,
  }));
}

export type FreezeOptions = {
  seed?: number;
  /** 冻结前推进的固定帧数（丢弃 warmup）。默认 {@link WARMUP_FRAMES}。 */
  warmupFrames?: number;
  /** 冻结后额外注入的 tuning 覆盖（真实的 gameplay 常量 seam）。 */
  tuning?: Record<string, number>;
  /** 冻结后再推进的帧数，用来把状态挪到指定时刻。默认 0。 */
  extraFrames?: number;
};

export type FreezeReport = {
  seed: number;
  warmupFrames: number;
  extraFrames: number;
  /** 冻结后虚拟时钟（ms）。 */
  gameTimeMs: number;
  frames: number;
  physicsTicks: number;
  tuning: Record<string, number>;
  /** 冻结后两次 digest 的 sha256（必须相等）。 */
  digestSha256: [string, string];
  /** 是否字节级相同。 */
  digestStable: boolean;
  /** 冻结后再探一次是否仍冻结。 */
  stillFrozen: boolean;
  /** 稳定性探测采样数。 */
  stabilitySamples: number;
};

/**
 * 把页面冻结到指定确定状态。内部顺序即文件头 1→4，任一环不过就抛错，
 * 绝不"先截图后验冻结"。
 */
export async function freezeDeterministic(page: Page, options: FreezeOptions = {}): Promise<FreezeReport> {
  const seed = options.seed ?? DEFAULT_SEED;
  const warmupFrames = options.warmupFrames ?? WARMUP_FRAMES;
  const extraFrames = options.extraFrames ?? 0;

  const { samples } = await waitHarnessStable(page);
  await waitSceneSettled(page);

  const report = await page.evaluate(
    ({ seed, warmupFrames, extraFrames, tuning }) => {
      const h = (window as HarnessWindow).__godeskHarness!;
      h.freeze();
      if (!h.isFrozen()) throw new Error("visual-capture: freeze() did not take effect");

      h.reset(seed);
      if (tuning) h.setTuning(tuning);
      if (warmupFrames > 0) h.step({ frames: warmupFrames });
      if (extraFrames > 0) h.step({ frames: extraFrames });

      // 冻结没冻干净会在这里暴露：两次 digest 必须字节级相同。
      const a = h.digestJson();
      const b = h.digestJson();
      const status = h.status() as { frames: number; physicsTicks: number; gameTimeMs: number };
      return {
        digestA: a,
        digestB: b,
        frozen: h.isFrozen(),
        gameTimeMs: status.gameTimeMs,
        frames: status.frames,
        physicsTicks: status.physicsTicks,
        tuning: h.getTuning(),
      };
    },
    { seed, warmupFrames, extraFrames, tuning: options.tuning ?? null },
  );

  if (report.digestA !== report.digestB) {
    throw new Error(
      "visual-capture: two consecutive digests differ while frozen — the harness did not freeze cleanly. " +
        "Do NOT raise the pixel threshold to hide this; report it back to the harness owner.",
    );
  }
  if (!report.frozen) throw new Error("visual-capture: harness un-froze between digest reads");

  // 再探一次（异步任务可能在两次 digest 之间把状态推走）。
  const stillFrozen = await page.evaluate(() => {
    const h = (window as HarnessWindow).__godeskHarness;
    return Boolean(h && h.isFrozen() && document.documentElement.dataset.godeskHarness === "1");
  });
  if (!stillFrozen) throw new Error("visual-capture: harness detached or unfroze after the freeze probe");

  const digestSha256: [string, string] = [
    await page.evaluate(() => (window as HarnessWindow).__godeskHarness!.digestSha256()),
    await page.evaluate(() => (window as HarnessWindow).__godeskHarness!.digestSha256()),
  ];
  if (digestSha256[0] !== digestSha256[1]) {
    throw new Error("visual-capture: digestSha256 differs across two reads — not frozen");
  }

  return {
    seed,
    warmupFrames,
    extraFrames,
    gameTimeMs: report.gameTimeMs,
    frames: report.frames,
    physicsTicks: report.physicsTicks,
    tuning: report.tuning,
    digestSha256,
    digestStable: true,
    stillFrozen,
    stabilitySamples: samples,
  };
}

/**
 * 把 3D 画布滚进视口中心并返回它的 clip 矩形。
 * 用 `behavior:"instant"`：平滑滚动会让截图落在动画中间态。
 */
export async function canvasClip(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("visual-capture: no canvas on page");
    canvas.scrollIntoView({ block: "center", behavior: "instant" });
  });
  // 给滚动 / 布局一帧的时间落定（不等动画，只等一帧）。
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("visual-capture: no canvas on page");
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      throw new Error(`visual-capture: canvas has no drawable area (${rect.width}x${rect.height})`);
    }
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });
}

/**
 * 截取冻结帧的 3D 画布。调用前必须已 {@link freezeDeterministic}。
 * 冻结态下 rAF 只重复呈现最后一帧，所以两次截图必然同源。
 */
export async function captureFrozenCanvas(page: Page, outPath?: string): Promise<Buffer> {
  const clip = await canvasClip(page);
  const png = await page.screenshot({ clip, timeout: 30_000, animations: "disabled" });
  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, png);
  }
  return png;
}

/** 连拍两次同一冻结帧 —— 基建自证用。返回两张 PNG。 */
export async function captureFrozenTwice(page: Page, outDir?: string): Promise<{ first: Buffer; second: Buffer }> {
  const first = await captureFrozenCanvas(page, outDir ? `${outDir}/shot-1.png` : undefined);
  const second = await captureFrozenCanvas(page, outDir ? `${outDir}/shot-2.png` : undefined);
  return { first, second };
}
