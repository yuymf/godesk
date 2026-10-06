// G3D-17 上线前清单 · 「HUD 不露原始动作 id」探针。
// 纯函数 findRawActionIds 由 scripts/launch-checklist.test.mjs 覆盖；collectRoomTexts 在 Playwright 页面里取文本。
// 背景（STATUS G3D-13 HUD 备注）：iPhone 12 Pro 上 Room 在棋盘下方露出合法动作原始按钮，文案含坐标串，
// 例如「放置道路 · -200:173|-250:87」。G3D-13 重做 HUD 后本探针应为 0。

/** 每条规则：id、说明、正则（全局）、可选的二次过滤。 */
export const RAW_ACTION_ID_RULES = [
  {
    id: "coordinate-edge",
    description: "边坐标串（顶点键用 | 连接）",
    pattern: /-?\d+(?:\.\d+)?:-?\d+(?:\.\d+)?(?:\|-?\d+(?:\.\d+)?:-?\d+(?:\.\d+)?)+/g,
  },
  {
    id: "coordinate-vertex",
    description: "顶点坐标键（x:y，像素取整的角点，见 topology-stub hexVertexId；排除时刻与小比分）",
    pattern: /(?<![\d:.|])-?\d+:-?\d+(?![\d:|])/g,
    keep: (match) => {
      const [a, b] = match.split(":");
      if (a.startsWith("-") || b.startsWith("-")) return true;
      const isClock = Number(a) < 24 && b.length === 2 && Number(b) < 60;
      // 角点坐标以 100 px 为边长取整（0 / 50 / 87 / 100 / 150 / 173 …）；两边都小于 24 视为比分 / 比例。
      return !isClock && Math.max(Number(a), Number(b)) >= 24;
    },
  },
  {
    id: "internal-id",
    description: "内部实体 id（action_ / room_ / build_ … 或 UUID）",
    pattern: /\b(?:action|intent|vertex|edge|hex|tile|room|build|project|replay|session|job)_[0-9a-z-]{4,}|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  },
  {
    id: "action-type",
    description: "Kernel 动作类型（snake_case，如 place_road / end_turn）",
    pattern: /\b[a-z]{2,}(?:_[a-z0-9]+)+\b/g,
  },
];

/**
 * 在一组文本里找原始动作 id。返回 { count, byRule, samples }；samples 最多 maxSamples 条（含来源文本片段）。
 * @param {Array<{ source: string, text: string }>} entries
 */
export function findRawActionIds(entries, { maxSamples = 12 } = {}) {
  const byRule = Object.fromEntries(RAW_ACTION_ID_RULES.map((rule) => [rule.id, 0]));
  const samples = [];
  const uniqueMatches = new Set();
  let count = 0;
  for (const { source, text } of entries) {
    if (!text) continue;
    // 边坐标串命中后从文本里去掉，避免同一串再被顶点规则重复计数。
    let remaining = String(text);
    for (const rule of RAW_ACTION_ID_RULES) {
      const matches = [...remaining.matchAll(rule.pattern)].map((m) => m[0]).filter((m) => (rule.keep ? rule.keep(m) : true));
      if (!matches.length) continue;
      byRule[rule.id] += matches.length;
      count += matches.length;
      for (const match of matches) {
        uniqueMatches.add(match);
        if (samples.length < maxSamples) samples.push({ rule: rule.id, match, source, context: snippet(remaining, match) });
      }
      remaining = remaining.replace(rule.pattern, " ");
    }
  }
  return { count, unique: uniqueMatches.size, byRule, samples };
}

function snippet(text, match) {
  const at = text.indexOf(match);
  if (at < 0) return match;
  return text.slice(Math.max(0, at - 24), at + match.length + 24).replace(/\s+/g, " ").trim();
}

/**
 * 在 Room 页面里收集「玩家可见 / 读屏可读」的文本：主区域 innerText（逐个可见叶子块）+ 交互元素的 aria-label / title。
 * 排除 perf 浮层与 <script>/<style>。
 */
export async function collectRoomTexts(page) {
  return page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const skip = (el) => el.closest('[data-testid="g3d-perf-overlay"], script, style, noscript, [hidden], [aria-hidden="true"]');
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const describe = (el) => {
      const label = el.getAttribute("aria-label") || el.getAttribute("data-testid") || el.className?.toString().split(" ")[0] || "";
      return `${el.tagName.toLowerCase()}${label ? `[${label.slice(0, 40)}]` : ""}`;
    };
    const entries = [];
    for (const el of root.querySelectorAll("button, a, li, p, span, strong, small, h1, h2, h3, h4, dd, dt, td, th, label, option, figcaption, output")) {
      if (skip(el) || !visible(el)) continue;
      // 只取直接文本，避免父子重复。
      const own = [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(" ").trim();
      if (own) entries.push({ source: describe(el), text: own });
    }
    for (const el of root.querySelectorAll("[aria-label], [title]")) {
      if (skip(el)) continue;
      const text = [el.getAttribute("aria-label"), el.getAttribute("title")].filter(Boolean).join(" ");
      if (text) entries.push({ source: `${describe(el)}@attr`, text });
    }
    return entries;
  });
}
