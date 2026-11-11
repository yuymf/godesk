/**
 * G3D-PIXELGATE · 基线管理（跨环境版）。
 *
 * 铁律：基线是**证据**，不是"让测试变绿"的开关。
 *
 * ## 为什么要按环境分目录
 *
 * 基线是**某个渲染栈**的产物。实测（本卡 t_57c01185）同一份构建、同一个种子：
 *
 *   - 本机（Ubuntu 22.04 + Google Chrome 152 + SwiftShader）→ 与仓内基线 0 px
 *   - CI 等价环境（Ubuntu 24.04 + Playwright Chromium 153 + SwiftShader，即
 *     `mcr.microsoft.com/playwright:v1.63.0-noble`）→ 与本机基线 **1634/344064 =
 *     0.4749%**，差异集中在一块 (91,44) 346×348 的区域（平涂面法线插值/抗锯齿精度差）
 *
 * 而**同一个环境内**，连拍、跨 context、跨进程都是 **0 px**（实测三轮）。也就是说：
 * 跨环境有恒定的整体偏移，同环境内是确定性 0 —— 所以正确做法不是抬高 `maxDiffRatio`
 * （抬高会直接废掉这道门：贴图 404 只有 0.81% 差异），而是**每个环境一条自己的基线**，
 * 仍然零容忍。
 *
 * ## 目录布局
 *
 *   e2e/visual-baselines/<env-key>/<case>.png
 *
 * `<env-key>` 由**实际渲染栈**推出，形如 `ubuntu24-chromium-153`、`ubuntu22-google-chrome-152`：
 *
 *   <平台+发行版大版本>-<浏览器>-<浏览器大版本>
 *
 * 为什么带浏览器大版本、不带小版本：小版本更新通常不改光栅化，而大版本会（Chromium 每 4 周
 * 一个大版本）。带上大版本 = 浏览器大版本一升，基线就"缺失" → 明确红 → 人来决定是重建基线
 * 还是查回归。**这比大版本升级后静默偏一点、然后有人去调阈值要好。**
 *
 * ## 缺失 = FAIL（永远是 FAIL）
 *
 * 基线缺失时用例必须 FAIL，且错误信息里要列出"仓里现有哪些环境"和"怎么在正确环境里生成"。
 * 绝不允许"自动落基线然后绿"——那是把门改成窗户。
 *
 * ## 更新基线的合法理由（写进 docs/visual-regression-gate.md）
 *
 *   1. 有意的视觉改动（改 shader 参数 / 换贴图 / 调光照），且 diff 图已人工看过；
 *   2. 有意的截图口径改动（分辨率 / 机位 / 状态），且 PR 里写明；
 *   3. 上游依赖升级导致的全帧位移（浏览器 / three.js 版本），需要给出整帧 diff 证据。
 *
 * 不允许：为了让红灯变绿而重跑更新；不允许只更新一部分基线而不解释。
 * 更新后必须把 `diffRatio` 的实测值写进 PR 说明 —— "我更新了基线"不是理由。
 *
 * ## 生成基线只在手工 workflow 里做
 *
 * 正常 CI 流程**不许**出现 `GODESK_UPDATE_BASELINE=1`（`.github/workflows/visual-baseline.yml`
 * 是唯一允许它的地方，且必须手动触发、必须人工 review 落地的 PNG）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** 基线根目录（相对仓库根，便于在报告里引用）。 */
export const BASELINE_DIR = "e2e/visual-baselines";
/** 显式更新开关。只有它等于 "1" 才允许写基线。 */
export const UPDATE_ENV = "GODESK_UPDATE_BASELINE";
/** 环境键的显式覆盖（只给"确实知道自己在一个没被识别出来的环境里"的场景用）。 */
export const ENV_KEY_ENV = "GODESK_VISUAL_BASELINE_ENV";

export function updateBaselineEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[UPDATE_ENV] === "1";
}

export type OsRelease = { id?: string; versionId?: string };

/** 读 `/etc/os-release`（非 Linux / 读不到都返回空对象，不抛）。 */
export function readOsRelease(path = "/etc/os-release"): OsRelease {
  try {
    const text = readFileSync(path, "utf8");
    const pick = (key: string): string | undefined => {
      const match = text.match(new RegExp(`^${key}=("?)([^"\\n]*)\\1$`, "m"));
      return match?.[2]?.trim().toLowerCase();
    };
    return { id: pick("ID"), versionId: pick("VERSION_ID") };
  } catch {
    return {};
  }
}

/**
 * 平台段：`ubuntu24` / `debian12` / `darwin`。
 *
 * 为什么带发行版大版本：18.04 和 24.04 的 glibc / 字体 / 内核驱动路径不同，SwiftShader
 * 的实际输出不一定一样。带版本号让"某天 ubuntu-latest 换了底"变成**基线缺失**（明确红）
 * 而不是"悄悄偏移几像素"。非 Linux（macOS 开发机）只保留平台名。
 */
export function hostEnvSegment(platform: string = process.platform, osRelease: OsRelease = readOsRelease()): string {
  if (platform !== "linux") return platform;
  const id = osRelease.id;
  if (!id) return "linux";
  const major = osRelease.versionId?.split(".")[0];
  return major ? `${id}${major}` : id;
}

export type BaselineIdentity = {
  /** 实际启动的是哪个浏览器：`chromium`（Playwright 自带）/ `google-chrome`（系统 Chrome）/ … */
  browserLabel: string;
  /** 实际浏览器的完整版本号（`browser.version()`）。 */
  browserVersion: string;
};

/**
 * 环境键：`<平台段>-<浏览器>-<浏览器大版本>`。
 *
 * `GODESK_VISUAL_BASELINE_ENV` 可以覆盖它，但只该在"环境识别不出来、又确实知道自己是哪个
 * 环境"时用；覆盖值会原样打进日志与证据，评审能看见。
 */
export function describeBaselineEnv(
  identity: BaselineIdentity,
  options: { env?: NodeJS.ProcessEnv; platform?: string; osRelease?: OsRelease } = {},
): string {
  const override = options.env?.[ENV_KEY_ENV]?.trim();
  if (override) return override;
  const major = identity.browserVersion.trim().split(".")[0] || "unknown";
  const label = identity.browserLabel.trim().replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  return `${hostEnvSegment(options.platform, options.osRelease)}-${label}-${major}`;
}

/** 仓里已经提交了哪些环境的基线（给缺失报错用，让人一眼看到该补哪个）。 */
export function listBaselineEnvs(dir = BASELINE_DIR): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/** 基线绝对路径。`caseName` 里允许子目录（如 `hex-island/frozen-frame`）。 */
export function baselinePath(caseName: string, envKey: string): string {
  const repoRoot = resolve(process.cwd());
  return resolve(repoRoot, BASELINE_DIR, envKey, `${caseName}.png`);
}

export type BaselineDecision =
  | { action: "compare"; baseline: Buffer; path: string; envKey: string }
  | { action: "write"; path: string; envKey: string }
  | { action: "missing"; path: string; envKey: string; availableEnvs: string[] };

/**
 * 决定"比对 / 写入 / 缺失"。
 *
 * - 基线存在且未开更新开关 → compare。
 * - 基线不存在且开了更新开关 → write。
 * - 基线不存在且没开开关 → missing（调用方必须 FAIL，不许自动写）。
 * - 基线存在但开了更新开关 → write（显式更新，调用方应把结果打进报告）。
 *
 * `envKey` 必须由调用方按**实际渲染栈**算出来（见 {@link describeBaselineEnv}），
 * 不能默认成一台机器的值 —— 默认值会让 CI 悄悄比对本机基线。
 */
export function resolveBaseline(caseName: string, options: { envKey: string; env?: NodeJS.ProcessEnv }): BaselineDecision {
  const envKey = options.envKey;
  const env = options.env ?? process.env;
  const path = baselinePath(caseName, envKey);
  const exists = existsSync(path);
  const update = updateBaselineEnabled(env);
  if (update) return { action: "write", path, envKey };
  if (exists) return { action: "compare", baseline: readFileSync(path), path, envKey };
  return { action: "missing", path, envKey, availableEnvs: listBaselineEnvs() };
}

/** 写基线（只在显式更新路径上调用）。 */
export function writeBaseline(path: string, png: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
}

/** 相对仓库根的展示路径，报告里更好读。 */
export function displayPath(absolute: string): string {
  const root = resolve(process.cwd());
  return absolute.startsWith(root) ? absolute.slice(root.length + 1) : absolute;
}

/**
 * 基线缺失时的完整报错文本。抽成函数是为了能单测（"缺失必须 FAIL"这条规则要钉住），
 * 也为了让人照着字面就能修好。
 */
export function missingBaselineMessage(decision: Extract<BaselineDecision, { action: "missing" }>, caseName: string): string {
  const have = decision.availableEnvs.length ? decision.availableEnvs.join(", ") : "(none)";
  return (
    `pixel-gate: no baseline for env "${decision.envKey}" at ${displayPath(decision.path)}.\n` +
    `  Committed envs: ${have}\n` +
    `  Baselines are never auto-created (a silently generated baseline turns the gate into a rubber stamp).\n` +
    `  Fix: run the manual "Generate visual baseline" workflow, or on an equivalent machine:\n` +
    `    GODESK_UPDATE_BASELINE=1 GODESK_VISUAL_BASELINE_ENV=${decision.envKey} ` +
    `pnpm exec playwright test --config playwright.pixelgate.config.ts -g "基线门"\n` +
    `  then review the committed PNG for ${caseName} and say why in the PR.`
  );
}
