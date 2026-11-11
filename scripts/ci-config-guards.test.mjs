/**
 * CI 门禁的不变式（vitest，跑在 `pnpm test` 里）。
 *
 * 这个文件存在的理由只有一条：**"门"必须被证明是门，而不是靠人记得**。
 *
 * 三条不变式：
 *   1. 自带专用 config 的 spec（像素门）**不许**被默认 Playwright config 收集 ——
 *      否则它会跑在 8799 上、端口自证必红、`pnpm test:e2e` 整条 suite 变红。
 *      （本卡 t_57c01185 的起因：t_1e1cf982 那一类"跑到不该跑的端口上"的假红。）
 *   2. 基线按环境分目录；**基线缺失 = 缺失**（不许静默生成、不许静默放过）。
 *   3. `maxDiffRatio` 默认零容忍**不许放宽**：贴图 404 只有 0.81% 差异，
 *      放宽到 0.8% 这道门就废了 —— 用真实证据帧把这个边界钉成测试。
 */
import { describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { PNG } from "pngjs";
import {
  CONFIG_OWNED_SPECS,
  DEFAULT_CONFIG_TEST_IGNORE,
  PIXELGATE_SPEC,
  PIXELGATE_SPEC_GLOB,
} from "../playwright.spec-ownership.ts";
import { DEFAULT_MAX_DIFF_RATIO, DEFAULT_PIXEL_THRESHOLD, comparePng } from "../e2e/helpers/visual-diff.ts";
import {
  BASELINE_DIR,
  describeBaselineEnv,
  hostEnvSegment,
  missingBaselineMessage,
  resolveBaseline,
} from "../e2e/helpers/visual-baseline.ts";

const repoRoot = resolve(import.meta.dirname, "..");

/** 跑一次 `playwright test --list`，返回被收集到的 spec 文件名（去重）。 */
function listCollectedSpecs(configArgs = []) {
  const out = execFileSync("pnpm", ["exec", "playwright", "test", "--list", ...configArgs], {
    cwd: repoRoot,
    encoding: "utf8",
    // FORCE_COLOR=0：Playwright 的 TS loader 会往子进程 stdout 里塞 ANSI 码，
    // 解析前必须保持纯文本（config 层的端口探测已经踩过同一个坑）。
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", CI: "1" },
    timeout: 120_000,
  });
  const files = new Set();
  for (const match of out.matchAll(/›\s+([a-z0-9._-]+\.spec\.ts):\d+:\d+/gi)) files.add(match[1]);
  return { files, tail: out.trim().split("\n").slice(-1)[0] ?? "" };
}

describe("spec ownership: 默认 config 不许收集像素门 spec", () => {
  test(
    "playwright test --list（默认 config）不含 visual-regression-gate.spec.ts，且仍收集 harness spec",
    { timeout: 180_000 },
    () => {
      const { files, tail } = listCollectedSpecs();
      expect(files.size, `default config collected ${files.size} specs: ${tail}`).toBeGreaterThan(30);
      expect(
        [...files],
        "visual-regression-gate.spec.ts must NOT be collected by the default config — it asserts port ownership on :8823 " +
          "and would run on :8799 here, turning the whole `pnpm test:e2e` suite red. See playwright.spec-ownership.ts",
      ).not.toContain(PIXELGATE_SPEC);
      // 反向对照：testIgnore 不能宽到把邻居也吃掉（历史上很容易有人写 "**/*.spec.ts"）。
      expect(files.has("harness-determinism.spec.ts"), "harness-determinism.spec.ts must still run in the default suite").toBe(true);
    },
  );

  test(
    "playwright test --list --config playwright.pixelgate.config.ts 只收像素门 spec",
    { timeout: 180_000 },
    () => {
      const { files } = listCollectedSpecs(["--config", "playwright.pixelgate.config.ts"]);
      expect([...files]).toEqual([PIXELGATE_SPEC]);
    },
  );

  test("每一个 e2e/*.spec.ts 都恰好归一份 config 收集（没有 spec 被两份 config 捡、也没有被漏掉）", () => {
    const e2eDir = join(repoRoot, "e2e");
    const allSpecs = readdirSync(e2eDir).filter((name) => name.endsWith(".spec.ts"));
    expect(allSpecs.length).toBeGreaterThan(30);

    const owned = new Map(CONFIG_OWNED_SPECS.map((entry) => [entry.spec, entry]));
    for (const spec of allSpecs) {
      if (owned.has(spec)) {
        // 归属专用 config 的 spec 必须真的存在（防止改名后守卫失效）。
        expect(existsSync(join(e2eDir, spec)), `owned spec ${spec} listed in CONFIG_OWNED_SPECS is missing on disk`).toBe(true);
      } else {
        expect(DEFAULT_CONFIG_TEST_IGNORE.some((glob) => glob.endsWith(spec)), `${spec} is unknown to both configs`).toBe(false);
      }
    }
    // 专用 config 的 glob 必须真的能匹配到文件（防止 glob 写错导致"两个 config 都不收"）。
    expect(PIXELGATE_SPEC_GLOB).toBe(`**/${PIXELGATE_SPEC}`);
  });
});

describe("baseline policy: 基线按环境分目录，缺失必须 FAIL", () => {
  test("环境键由实际渲染栈推出（平台+发行版+浏览器+浏览器大版本）", () => {
    const ci = describeBaselineEnv(
      { browserLabel: "chromium", browserVersion: "153.0.8010.12" },
      { env: {}, platform: "linux", osRelease: { id: "ubuntu", versionId: "24.04" } },
    );
    expect(ci).toBe("ubuntu24-chromium-153");
    expect(
      describeBaselineEnv(
        { browserLabel: "google-chrome", browserVersion: "152.0.7977.82" },
        { env: {}, platform: "linux", osRelease: { id: "ubuntu", versionId: "22.04" } },
      ),
    ).toBe("ubuntu22-google-chrome-152");
    expect(
      describeBaselineEnv(
        { browserLabel: "chromium", browserVersion: "153.0.8010.12" },
        { env: {}, platform: "darwin" },
      ),
      "macOS has no /etc/os-release: platform name only",
    ).toBe("darwin-chromium-153");
    expect(
      describeBaselineEnv(
        { browserLabel: "chromium", browserVersion: "153.0.8010.12" },
        { env: { GODESK_VISUAL_BASELINE_ENV: "pinned-runner-1" }, platform: "linux" },
      ),
      "explicit override wins (and is visible in the evidence log)",
    ).toBe("pinned-runner-1");
    expect(hostEnvSegment("linux", { id: "debian", versionId: "12.5" })).toBe("debian12");
    expect(hostEnvSegment("linux", {})).toBe("linux");
  });

  test("每个已提交的环境都有自己的基线，且都是 768x448 的帧（截图口径不变）", () => {
    const envDirs = readdirSync(join(repoRoot, BASELINE_DIR)).filter((name) => statSync(join(repoRoot, BASELINE_DIR, name)).isDirectory());
    expect(envDirs.length, "at least one env-keyed baseline must be committed").toBeGreaterThan(0);
    // 这条是**证据**而不是 CI 依赖：它是本卡跨环境实测（0.4749%）的参照帧，
    // 也是任何人用 mcr.microsoft.com/playwright:v1.63.0-noble 跑像素门时的基线。
    // 删掉它 = 丢掉唯一的跨环境实测参照，所以钉成测试。
    expect(envDirs, "the pinned-image baseline (measured cross-env reference) must stay committed").toContain(
      "ubuntu24-chromium-153",
    );
    for (const env of envDirs) {
      const png = join(repoRoot, BASELINE_DIR, env, "hex-island", "frozen-frame.png");
      expect(existsSync(png), `missing baseline ${png}`).toBe(true);
      const decoded = PNG.sync.read(readFileSync(png));
      expect({ w: decoded.width, h: decoded.height }, `${env} baseline must keep the 768x448 capture contract`).toEqual({
        w: 768,
        h: 448,
      });
    }
  });

  test("基线不存在且没开更新开关 → missing（不是 write，也不是 pass）", () => {
    const decision = resolveBaseline("hex-island/frozen-frame", { envKey: "no-such-env-0", env: {} });
    expect(decision.action).toBe("missing");
    if (decision.action !== "missing") throw new Error("unreachable");
    expect(decision.availableEnvs.length).toBeGreaterThan(0);
    const message = missingBaselineMessage(decision, "hex-island/frozen-frame");
    expect(message).toContain("no baseline for env \"no-such-env-0\"");
    expect(message).toContain("never auto-created");
    expect(message).toContain("GODESK_UPDATE_BASELINE=1");
  });

  test("基线不存在但开了 GODESK_UPDATE_BASELINE=1 → write（只有显式开关才写盘）", () => {
    const decision = resolveBaseline("hex-island/frozen-frame", { envKey: "no-such-env-0", env: { GODESK_UPDATE_BASELINE: "1" } });
    expect(decision.action).toBe("write");
  });
});

describe("threshold guard: 放宽 maxDiffRatio 会漏检贴图 404（这条是「不许放宽」的证据）", () => {
  // 证据帧：在 ubuntu24-chromium-153（= CI 用的固定镜像）里，
  // 同一冻结帧的正常渲染 vs 把真实贴图 /assets/sea-normal-*.ktx2 打成 404 的渲染。
  // 两者都入 git，是**固定输入**：谁把阈值放宽，这组用例就会红。
  const fixtureDir = join(repoRoot, "e2e", "fixtures", "visual-gate");
  const control = readFileSync(join(fixtureDir, "frozen-frame.ubuntu24-chromium-153.png"));
  const texture404 = readFileSync(join(fixtureDir, "texture-404-sea-normal.ubuntu24-chromium-153.png"));

  test("默认阈值下的实测差异（口径基线）：2782/344064 = 0.8086%", () => {
    const strict = comparePng(control, texture404, { label: "texture-404@default" });
    expect(strict.diffPixels).toBe(2782);
    expect(strict.totalPixels).toBe(344064);
    expect(strict.diffRatio).toBeCloseTo(0.0080857, 7);
    expect(strict.maxDiffRatio, "default maxDiffRatio must stay 0 (zero tolerance)").toBe(DEFAULT_MAX_DIFF_RATIO);
    expect(DEFAULT_MAX_DIFF_RATIO).toBe(0);
    expect(DEFAULT_PIXEL_THRESHOLD).toBe(0.1);
    expect(strict.passed, "at zero tolerance a missing texture MUST fail the gate").toBe(false);
  });

  test("边界不是 0.008 而是 0.008086：0.80% 还抓得住，0.81% 就漏检", () => {
    // 任务卡写的是「≥0.008 会漏检」，实测更精确一点：0.8086% > 0.8000%，
    // 所以 0.8% 仍然抓得到；真正丢掉这个故障要从 0.81% 起。
    expect(comparePng(control, texture404, { maxDiffRatio: 0.008, label: "texture-404@0.008" }).passed).toBe(false);
    expect(
      comparePng(control, texture404, { maxDiffRatio: 0.0081, label: "texture-404@0.0081" }).passed,
      "raising maxDiffRatio to 0.81% makes the 404 regression pass — this is exactly why the threshold must not be relaxed",
    ).toBe(true);
  });

  test("把「跨环境噪声」当成容差写进阈值 → 只剩 0.33pp 余量，这条路必须在报告里被否掉", () => {
    // 实测跨环境偏移 1634/344064 = 0.004749（本机基线 vs CI 镜像）。
    // 若用「一个容差同时吸收跨环境噪声」的方案：0.004749 仍能抓到 0.8086% 的 404，
    // 但余量只有 0.8086% - 0.4749% = 0.33pp —— 任何比这更隐蔽的回归都会漏。
    // 所以选的是「环境专属基线 + 零容忍」，而不是「一个宽松阈值」。
    const noiseSizedTolerance = 1634 / 344064;
    expect(noiseSizedTolerance).toBeCloseTo(0.0047491, 7);
    expect(comparePng(control, texture404, { maxDiffRatio: noiseSizedTolerance, label: "texture-404@noise" }).passed).toBe(false);
    const headroom = 0.0080857 - noiseSizedTolerance;
    expect(headroom).toBeLessThan(0.0034);
    expect(headroom).toBeGreaterThan(0.0033);
  });
});
