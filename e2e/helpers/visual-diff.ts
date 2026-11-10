/**
 * G3D-PIXELGATE · 像素比对基建（pixelmatch + pngjs）。
 *
 * 为什么选 pixelmatch + pngjs，而不是 odiff：
 *  - odiff 是原生二进制（Rust + node-gyp/预编译包），要给 CI 多一份平台矩阵；
 *    本项目 e2e 跑在 `wrangler dev` + 本地 Chrome 上，纯 JS 依赖能省掉一次原生编译失败面。
 *  - pixelmatch 是 Playwright 官方 `toHaveScreenshot` 底层用的同一个算法（YIQ 感知距离 +
 *    anti-aliasing 检测），所以这里的 `diffRatio` 与 Playwright 内建快照语义一致，阈值可迁移。
 *  - 性能足够：768×448（344,064 px）实测单次 diff < 20ms，像素门的成本大头是浏览器渲染，
 *    不是比对。
 *
 * 阈值口径（唯一的可配置项，默认值写死在 DEFAULT_PIXEL_THRESHOLD）：
 *  - `pixelThreshold`（0..1）：pixelmatch 的**单像素**颜色容差，默认 0.1。
 *    Playwright 的 `maxDiffPixelRatio` 场景下官方默认也是 0.2；本项目画面是低多边形平涂 +
 *    程序化噪声，0.1 能容忍 GPU 的 1/255 取整抖动而不会放过真实的色彩改动。
 *  - `maxDiffRatio`（0..1）：**整帧**允许的差异像素占比，默认 0（零容忍）。
 *    理由：harness 冻结后实测连拍与跨 context 重跑都是 0 像素（见 docs/visual-regression-gate.md
 *    §自证），所以这里不需要"宽容值"。任何非零差异都必须先被解释，再决定是改代码还是改基线。
 *    要放宽必须显式传参并在报告里写明理由。
 *
 * 本模块只做纯计算 + 落盘，不碰浏览器；截图流程见 ./visual-capture.ts。
 */
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** pixelmatch 单像素 YIQ 容差。默认 0.1（见文件头理由）。 */
export const DEFAULT_PIXEL_THRESHOLD = 0.1;
/** 整帧允许的差异像素占比。默认 0 = 零容忍（harness 冻结后实测可做到）。 */
export const DEFAULT_MAX_DIFF_RATIO = 0;
/** 差异图里"被判定为不同"的像素着色（magenta，Playwright 同款可读性）。 */
const DIFF_COLOR = [255, 0, 255] as const;

export type VisualDiffOptions = {
  /** 单像素容差，0..1。默认 {@link DEFAULT_PIXEL_THRESHOLD}。 */
  pixelThreshold?: number;
  /** 整帧差异占比上限，0..1。默认 {@link DEFAULT_MAX_DIFF_RATIO}。 */
  maxDiffRatio?: number;
  /** diff 图落盘路径。不传则不落盘（`diffImagePath` 为 null）。 */
  diffImagePath?: string;
  /** 左右对照图落盘目录（可选，便于人眼复核）。 */
  sideBySideDir?: string;
  /** 写进报告用的标签（用例名）。 */
  label?: string;
};

export type VisualDiffResult = {
  label: string;
  /** 判定不同的像素数（pixelmatch 计数，已含 anti-aliasing 抑制）。 */
  diffPixels: number;
  /** 整帧像素数。 */
  totalPixels: number;
  /** diffPixels / totalPixels，0..1。 */
  diffRatio: number;
  /** 本次使用的阈值（回写进报告，避免"阈值是多少"靠猜）。 */
  pixelThreshold: number;
  maxDiffRatio: number;
  /** 是否通过：diffRatio <= maxDiffRatio。 */
  passed: boolean;
  /** 差异图落盘路径（未落盘为 null）。 */
  diffImagePath: string | null;
  width: number;
  height: number;
};

/** 差异像素的外接矩形；null 表示无差异。用于"差异落在哪块区域"的定位。 */
export type DiffBounds = { x: number; y: number; width: number; height: number } | null;

function readPng(input: string | Buffer, what: string): PNG {
  if (typeof input === "string") {
    return PNG.sync.read(readFileSync(input));
  }
  try {
    return PNG.sync.read(input);
  } catch (error) {
    throw new Error(`visual-diff: ${what} is not a decodable PNG (${String(error)})`);
  }
}

/**
 * 比对两张 PNG。尺寸不一致直接抛错 —— 尺寸不同意味着"截图口径变了"，
 * 那种情况不该被 diffRatio 稀释成一个小数。
 */
export function comparePng(
  baseline: string | Buffer,
  actual: string | Buffer,
  options: VisualDiffOptions = {},
): VisualDiffResult {
  const pixelThreshold = options.pixelThreshold ?? DEFAULT_PIXEL_THRESHOLD;
  const maxDiffRatio = options.maxDiffRatio ?? DEFAULT_MAX_DIFF_RATIO;
  const label = options.label ?? "visual-diff";

  if (!(pixelThreshold >= 0 && pixelThreshold <= 1)) {
    throw new Error(`visual-diff: pixelThreshold must be 0..1, got ${pixelThreshold}`);
  }
  if (!(maxDiffRatio >= 0 && maxDiffRatio <= 1)) {
    throw new Error(`visual-diff: maxDiffRatio must be 0..1, got ${maxDiffRatio}`);
  }

  const before = readPng(baseline, "baseline");
  const after = readPng(actual, "actual");
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error(
      `visual-diff: size mismatch — baseline ${before.width}x${before.height} vs actual ${after.width}x${after.height}. ` +
        `A changed capture size is a capture-contract change, not a pixel regression.`,
    );
  }

  const { width, height } = before;
  const totalPixels = width * height;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(before.data, after.data, diff.data, width, height, {
    threshold: pixelThreshold,
    includeAA: false,
    alpha: 0.1,
    diffColor: [...DIFF_COLOR],
    aaColor: [255, 255, 0],
  });
  const diffRatio = totalPixels === 0 ? 0 : diffPixels / totalPixels;

  let diffImagePath: string | null = null;
  if (options.diffImagePath && diffPixels > 0) {
    mkdirSync(dirname(options.diffImagePath), { recursive: true });
    writeFileSync(options.diffImagePath, PNG.sync.write(diff));
    diffImagePath = options.diffImagePath;
  }

  if (options.sideBySideDir) {
    mkdirSync(options.sideBySideDir, { recursive: true });
    const safe = label.replace(/[^a-z0-9._-]+/gi, "_");
    writeFileSync(join(options.sideBySideDir, `${safe}.baseline.png`), PNG.sync.write(before));
    writeFileSync(join(options.sideBySideDir, `${safe}.actual.png`), PNG.sync.write(after));
    if (diffPixels > 0) writeFileSync(join(options.sideBySideDir, `${safe}.diff.png`), PNG.sync.write(diff));
  }

  return {
    label,
    diffPixels,
    totalPixels,
    diffRatio,
    pixelThreshold,
    maxDiffRatio,
    passed: diffRatio <= maxDiffRatio,
    diffImagePath,
    width,
    height,
  };
}

/**
 * 差异像素的外接矩形。让报告能回答"变了的是哪块"，
 * 而不只是"变了 0.8%" —— 例如贴图 404 应该集中在某个物体上。
 *
 * 必须用 pixelmatch 的 `diffMask: true`：默认模式下 output 会把**未变化的像素**
 * 也写成带 alpha 的暗淡副本，于是"0 像素差异"会算出一个整帧的假 bbox（实测踩过）。
 * diffMask 模式只给真正的差异像素上色。
 */
export function diffBounds(baseline: string | Buffer, actual: string | Buffer, pixelThreshold = DEFAULT_PIXEL_THRESHOLD): DiffBounds {
  const before = readPng(baseline, "baseline");
  const after = readPng(actual, "actual");
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error("visual-diff.diffBounds: size mismatch");
  }
  const { width, height } = before;
  const mask = new PNG({ width, height });
  const count = pixelmatch(before.data, after.data, mask.data, width, height, {
    threshold: pixelThreshold,
    includeAA: false,
    diffMask: true,
  });
  if (count === 0) return null;
  let minX = width, minY = height, maxX = -1, maxY = -1, seen = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask.data[(y * width + x) * 4 + 3] === 0) continue;
      seen += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (seen === 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** 人类可读的一行结论，直接进报告/日志。 */
export function formatDiff(result: VisualDiffResult): string {
  const pct = (result.diffRatio * 100).toFixed(4);
  return (
    `[${result.label}] diffPixels=${result.diffPixels}/${result.totalPixels} ` +
    `diffRatio=${result.diffRatio.toFixed(8)} (${pct}%) ` +
    `threshold(pixel=${result.pixelThreshold}, maxRatio=${result.maxDiffRatio}) ` +
    `${result.passed ? "PASS" : "FAIL"}`
  );
}
