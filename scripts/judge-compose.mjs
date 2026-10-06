#!/usr/bin/env node
/**
 * G3D-JUDGE 左右对照图（dev tooling；输出不入库）。左 = 参考（settlecoast.com），右 = 汐屿。
 *
 *   node scripts/judge-compose.mjs <round> [--variant page|canvas|both]
 *
 * 默认 page：桌面汐屿用 1440×900 整页截图（参照图是 1280×800 含浏览器框的整屏，比的是观感不是像素）。
 * 每个参照变体（a3 / b2 / b3 / e-road / f2 / g-trade …）各出一张，配同一视图字母的汐屿截图。
 *
 * 参考：/workspace/g3d-evidence/judge/ref/<vp>-<letter>-<name>.png（如 desktop-a-default.png、
 *   iphone-b-terrain-closeup.png）。匹配宽松：按视口（desktop | iphone/mobile）+ 视图字母，
 *   名字后缀可以不同；缺参考图时左栏画「参考图缺失」占位，不报错。
 * 汐屿：round-<N>/tidewell/<vp>-<id>-page.png（整页视口）或 <vp>-<id>.png（3D 画布）。
 * 输出：round-<N>/compare/<vp>-<id>[-canvas].png + index.json。
 * 用 Playwright 画布合成（不引入 sharp 依赖；中文标签走系统 CJK 字体）。
 */
import { chromium } from "@playwright/test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const round = args.find((a) => !a.startsWith("--"));
if (!round) {
  console.error("usage: node scripts/judge-compose.mjs <round> [--variant page|canvas|both]");
  process.exit(2);
}
const vi = args.indexOf("--variant");
const VARIANT = vi >= 0 ? args[vi + 1] : "page";
const ROOT = process.env.JUDGE_ROOT || "/workspace/g3d-evidence/judge";
const REF = path.join(ROOT, "ref");
const SHOTS = path.join(ROOT, `round-${round}`, "tidewell");
const OUT = path.join(ROOT, `round-${round}`, "compare");
const VIEWS = [
  ["a", "a-default", "默认整盘"],
  ["b", "b-terrain-closeup", "地形近景"],
  ["c", "c-coast", "海岸 / 水面 / 崖壁 / 港口"],
  ["d", "d-hand-hud", "资源手牌 + HUD"],
  ["e", "e-placement", "可放置位高亮"],
  ["f", "f-dice", "掷骰"],
  ["g", "g-midgame", "中局（多棋子）"],
];
const VP_ALIASES = { desktop: ["desktop", "pc", "web"], iphone: ["iphone", "mobile", "phone", "ios"] };

async function listPng(dir) {
  try {
    return (await readdir(dir)).filter((f) => /\.png$/i.test(f));
  } catch {
    return [];
  }
}

/**
 * 宽松匹配参考图：<vp别名>[-_]<字母>[数字变体][-_ ...].png（如 desktop-b2-terrain-151pct.png）。
 * 返回该视图的全部参考变体，完全同名的排第一。
 */
function findRefs(refs, vp, letter, id) {
  const aliases = VP_ALIASES[vp] ?? [vp];
  const re = new RegExp(`^(${aliases.join("|")})[-_ ]?${letter}\\d*(?:[-_ .]|$)`, "i");
  const all = refs.filter((f) => re.test(f)).sort();
  const exact = all.find((f) => f.toLowerCase() === `${vp}-${id}.png`);
  return exact ? [exact, ...all.filter((f) => f !== exact)] : all;
}

async function dataUrl(file) {
  return `data:image/png;base64,${(await readFile(file)).toString("base64")}`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const refs = await listPng(REF);
  const shots = await listPng(SHOTS);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent("<html><body style='margin:0'></body></html>");
  const index = [];
  const variants = VARIANT === "both" ? ["page", "canvas"] : [VARIANT];
  for (const vp of ["desktop", "iphone"]) {
    for (const [letter, id, title] of VIEWS) {
      const matched = findRefs(refs, vp, letter, id);
      for (const refName of matched.length ? matched : [null]) {
      for (const variant of variants) {
        // d-hand-hud 只有整页图（-page 是整页滚动全图）；其它视图按变体取。
        const candidates = id === "d-hand-hud"
          ? [variant === "page" ? `${vp}-${id}.png` : null].filter(Boolean)
          : [variant === "page" ? `${vp}-${id}-page.png` : `${vp}-${id}.png`];
        const shotName = candidates.find((c) => shots.includes(c));
        if (!shotName) continue;
        const stem = refName && refName !== `${vp}-${id}.png` ? refName.replace(/\.png$/i, "") : `${vp}-${id}`;
        const outName = `${stem}${variant === "canvas" ? "-canvas" : ""}.png`;
        const png = await page.evaluate(
          async ({ ref, shot, labels, height }) => {
            const load = async (src) => {
              if (!src) return null;
              const img = new Image();
              img.src = src;
              await img.decode();
              return img;
            };
            const [a, b] = await Promise.all([load(ref), load(shot)]);
            const scaleTo = (img) => (img ? { w: Math.round((img.width * height) / img.height), h: height } : null);
            const sb = scaleTo(b);
            const sa = scaleTo(a) ?? { w: sb.w, h: height };
            const pad = 16;
            const bar = 56;
            const c = document.createElement("canvas");
            c.width = sa.w + sb.w + pad * 3;
            c.height = height + bar + pad * 2;
            const x = c.getContext("2d");
            x.fillStyle = "#1d1f24";
            x.fillRect(0, 0, c.width, c.height);
            const font = '"Noto Sans CJK SC", "Noto Sans CJK JP", "PingFang SC", sans-serif';
            x.fillStyle = "#f2efe8";
            x.font = `600 24px ${font}`;
            x.fillText(labels.left, pad, 36);
            x.fillText(labels.right, sa.w + pad * 2, 36);
            x.font = `400 15px ${font}`;
            x.fillStyle = "#a9a59c";
            x.fillText(labels.leftFile, pad, bar + 2);
            x.fillText(labels.rightFile, sa.w + pad * 2, bar + 2);
            const top = bar + pad;
            if (a) x.drawImage(a, pad, top, sa.w, sa.h);
            else {
              x.fillStyle = "#2b2e35";
              x.fillRect(pad, top, sa.w, sa.h);
              x.strokeStyle = "#5c6070";
              x.setLineDash([10, 8]);
              x.strokeRect(pad + 1, top + 1, sa.w - 2, sa.h - 2);
              x.fillStyle = "#c9c4b8";
              x.font = `600 28px ${font}`;
              x.textAlign = "center";
              x.fillText("参考图缺失 (ref missing)", pad + sa.w / 2, top + sa.h / 2);
              x.textAlign = "left";
            }
            x.drawImage(b, sa.w + pad * 2, top, sb.w, sb.h);
            return c.toDataURL("image/png").split(",")[1];
          },
          {
            ref: refName ? await dataUrl(path.join(REF, refName)) : null,
            shot: await dataUrl(path.join(SHOTS, shotName)),
            labels: {
              left: `参照 settlecoast · ${vp} · ${letter} ${title}`,
              right: `汐屿 · round-${round} · ${vp} · ${letter} ${title}`,
              leftFile: refName ? `ref/${refName}` : "ref/（缺失）",
              rightFile: `round-${round}/tidewell/${shotName}`,
            },
            height: vp === "iphone" ? 1400 : 900, // 全高：桌面 900（参照 800 放大到同高）
          },
        );
        const file = path.join(OUT, outName);
        await writeFile(file, Buffer.from(png, "base64"));
        index.push({ vp, view: id, variant, ref: refName ? path.join(REF, refName) : null, shot: path.join(SHOTS, shotName), out: file });
        console.log(`${refName ? "pair " : "noref"} ${file}`);
      }
      }
    }
  }
  await writeFile(path.join(OUT, "index.json"), JSON.stringify({ round, refsFound: refs, pairs: index }, null, 2));
  const missing = index.filter((p) => !p.ref).length;
  console.log(`wrote ${index.length} compare images (${missing} without reference) → ${OUT}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
