/**
 * G3D-PIXELGATE · 基线管理。
 *
 * 铁律：基线是**证据**，不是"让测试变绿"的开关。
 *
 * - 存哪：`e2e/visual-baselines/<case>.png`，**入 git**（单独目录，便于 code review 时
 *   逐图看 diff）。和测试代码同仓，评审时基线变化会出现在 diff 里 —— 这是故意的：
 *   基线悄悄变了必须被看到。
 * - 怎么更新：只有显式 `GODESK_UPDATE_BASELINE=1` 才会写盘。默认情况下基线缺失 =
 *   用例 FAIL（不是"自动生成基线然后绿"）。这条是防止"第一次跑就自动落基线"变成后门。
 * - 什么情况下允许更新（写进 docs/visual-regression-gate.md）：
 *   1. 有意的视觉改动（改 shader 参数 / 换贴图 / 调光照），且 diff 图已人工看过；
 *   2. 有意的截图口径改动（分辨率 / 机位 / 状态），且 PR 里写明；
 *   3. 上游依赖升级导致的全帧位移（浏览器 / three.js 版本），需要给出整帧 diff 证据。
 *   不允许：为了让红灯变绿而重跑更新；不允许只更新一部分基线而不解释。
 *
 * 更新后必须把 `diffRatio` 的实测值写进 PR 说明 —— "我更新了基线"不是理由。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** 基线根目录（相对仓库根，便于在报告里引用）。 */
export const BASELINE_DIR = "e2e/visual-baselines";
/** 显式更新开关。只有它等于 "1" 才允许写基线。 */
export const UPDATE_ENV = "GODESK_UPDATE_BASELINE";

export function updateBaselineEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[UPDATE_ENV] === "1";
}

/** 基线绝对路径。`case` 里允许子目录（如 `hex-island/frozen-frame`）。 */
export function baselinePath(caseName: string): string {
  const repoRoot = resolve(process.cwd());
  return resolve(repoRoot, BASELINE_DIR, `${caseName}.png`);
}

export type BaselineDecision =
  | { action: "compare"; baseline: Buffer; path: string }
  | { action: "write"; path: string }
  | { action: "missing"; path: string };

/**
 * 决定"比对 / 写入 / 缺失"。
 *
 * - 基线存在且未开更新开关 → compare。
 * - 基线不存在且开了更新开关 → write。
 * - 基线不存在且没开开关 → missing（调用方必须 FAIL，不许自动写）。
 * - 基线存在但开了更新开关 → write（显式更新，调用方应把结果打进报告）。
 */
export function resolveBaseline(caseName: string, env: NodeJS.ProcessEnv = process.env): BaselineDecision {
  const path = baselinePath(caseName);
  const exists = existsSync(path);
  const update = updateBaselineEnabled(env);
  if (update) return { action: "write", path };
  if (exists) return { action: "compare", baseline: readFileSync(path), path };
  return { action: "missing", path };
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
