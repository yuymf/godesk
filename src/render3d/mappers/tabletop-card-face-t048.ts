/**
 * T048 · shared card face zones (procedural illustration band — no external copyright art).
 * Used by cardWithFace / plaqueWithFace; unit-tested for zone schema.
 */

export type CardFaceZoneId = "illustration" | "rewardBar" | "prestige" | "cost" | "title";

export type CardFaceZone = {
  id: CardFaceZoneId;
  /** Normalized [0,1] rect on face canvas: x,y,w,h */
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Canonical layout zones — forbid center-number-only faces. */
/** T063 · illustration panel dominates face; cost/border strip must not swallow art. */
/** UI-card-schema · taller cost + title bands for seat-close readout. */
export const CARD_FACE_ZONES: ReadonlyArray<CardFaceZone> = [
  { id: "illustration", x: 0.04, y: 0.03, w: 0.92, h: 0.52 },
  { id: "rewardBar", x: 0.04, y: 0.56, w: 0.92, h: 0.07 },
  { id: "prestige", x: 0.72, y: 0.58, w: 0.22, h: 0.14 },
  { id: "cost", x: 0.05, y: 0.74, w: 0.90, h: 0.20 },
  { id: "title", x: 0.05, y: 0.58, w: 0.64, h: 0.14 },
];

/** UI-card-schema · minimum seat-close glyph floors (canvas px at 512-wide face). */
export const CARD_SCHEMA_FLOORS = {
  costDotRadius: 24,
  costDigitPx: 32,
  titlePx: 42,
  prestigePx: 40,
  underlayPad: 6,
} as const;

const CHIP: Record<string, string> = {
  white: "#f4efe6",
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  black: "#1f2937",
  gold: "#eab308",
};

function hashSeed(parts: ReadonlyArray<string | number | undefined>): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p ?? "");
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(
  a: [number, number, number] | string,
  b: [number, number, number] | string,
  t: number,
): string {
  const toRgb = (v: [number, number, number] | string): [number, number, number] => {
    if (typeof v !== "string") return v;
    const h = v.replace("#", "");
    if (h.length >= 6) {
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    return [0, 0, 0];
  };
  const aa = toRgb(a);
  const bb = toRgb(b);

  const r = Math.round(aa[0] + (bb[0] - aa[0]) * t);
  const g = Math.round(aa[1] + (bb[1] - aa[1]) * t);
  const bl = Math.round(aa[2] + (bb[2] - aa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Paint procedural brush illustration into a zone (no external art). */
export function paintIllustrationBand(
  g: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  opts: { reward?: string; tier?: number; title?: string; base?: string },
): void {
  const seed = hashSeed([opts.reward, opts.tier, opts.title, opts.base]);
  const rnd = mulberry32(seed);
  const rewardHex = (opts.reward && CHIP[opts.reward]) || opts.base || "#8b5a2b";
  const rgb = hexToRgb(rewardHex.startsWith("#") ? rewardHex : "#8b5a2b");
  const parchment: [number, number, number] = [251, 246, 236];
  const shadow: [number, number, number] = [40, 30, 20];
  const accent: [number, number, number] = [
    Math.min(255, rgb[0] + 40),
    Math.min(255, rgb[1] + 20),
    Math.max(0, rgb[2] - 10),
  ];
  // T066 · structured hue+value fill (not flat wash / faint noise)
  const grad = g.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  grad.addColorStop(0, mix(parchment, rgb, 0.42));
  grad.addColorStop(0.45, mix(rgb, accent, 0.35));
  grad.addColorStop(1, mix(rgb, shadow, 0.45));
  g.fillStyle = grad;
  g.fillRect(box.x, box.y, box.w, box.h);

  // large theme color blocks — readable silhouettes
  g.globalAlpha = 0.78;
  for (let i = 0; i < 5; i += 1) {
    const bw = box.w * (0.22 + rnd() * 0.28);
    const bh = box.h * (0.28 + rnd() * 0.35);
    const bx = box.x + box.w * (0.05 + rnd() * 0.55);
    const by = box.y + box.h * (0.08 + rnd() * 0.45);
    g.fillStyle = mix(rgb, i % 2 === 0 ? accent : shadow, 0.25 + rnd() * 0.45);
    if (rnd() > 0.45) {
      g.beginPath();
      g.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, rnd() * 0.4, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(bx, by, bw, bh);
    }
  }

  // mid-tone ridges (value structure across band)
  for (let i = 0; i < 10; i += 1) {
    const y = box.y + box.h * (0.1 + rnd() * 0.8);
    const x0 = box.x + box.w * (0.04 + rnd() * 0.15);
    const x1 = box.x + box.w * (0.6 + rnd() * 0.35);
    g.strokeStyle = mix(rgb, parchment, 0.1 + rnd() * 0.4);
    g.globalAlpha = 0.55 + rnd() * 0.35;
    g.lineWidth = 4 + rnd() * 14;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x0, y);
    const midX = (x0 + x1) / 2;
    const midY = y + (rnd() - 0.5) * box.h * 0.4;
    g.quadraticCurveTo(midX, midY, x1, y + (rnd() - 0.5) * 10);
    g.stroke();
  }

  // bright highlight wedge (hue contrast)
  g.globalAlpha = 0.55;
  g.fillStyle = mix(parchment, accent, 0.55);
  g.beginPath();
  g.moveTo(box.x + box.w * 0.08, box.y + box.h * 0.15);
  g.lineTo(box.x + box.w * 0.42, box.y + box.h * 0.08);
  g.lineTo(box.x + box.w * 0.35, box.y + box.h * 0.48);
  g.closePath();
  g.fill();

  // T069 · motif kinds (gem diamond / building silhouette); T077 · stage-wide readable color masses; T087 · shared edge/contrast boost (no kernel special-case)
  // T108 · microcontrast: deeper counter + brighter parchment/accent slabs (shared; no gem/auction fork)
  const motifKind = Math.floor(rnd() * 3); // gem | building silhouette | combo
  g.globalAlpha = 1;
  // full-bleed reward mass — pure CHIP hue dominates far crop
  const solid = rewardHex.startsWith("#") ? rewardHex : mix(rgb, accent, 0.02);
  g.fillStyle = solid;
  g.fillRect(box.x, box.y, box.w, box.h);
  // near-black counter slab (value structure at stage-wide) — T087/T108 slightly deeper
  g.fillStyle = "#02040a";
  g.fillRect(box.x + box.w * 0.01, box.y + box.h * 0.05, box.w * 0.46, box.h * 0.9);
  // bright accent slab opposite — T108 lift parchment
  g.fillStyle = mix(parchment, "#ffffff", 0.28);
  g.fillRect(box.x + box.w * 0.5, box.y + box.h * 0.04, box.w * 0.48, box.h * 0.36);
  // secondary pure accent bar (higher chroma for stage-wide)
  g.fillStyle = mix(accent, rgb, 0.08);
  g.fillRect(box.x + box.w * 0.5, box.y + box.h * 0.42, box.w * 0.48, box.h * 0.26);
  if (motifKind === 0 || motifKind === 2) {
    const gx = box.x + box.w * 0.72;
    const gy = box.y + box.h * 0.62;
    const gw = box.w * 0.55;
    const gh = box.h * 0.78;
    g.fillStyle = mix(parchment, "#ffffff", 0.35);
    g.beginPath();
    g.moveTo(gx, gy - gh * 0.55);
    g.lineTo(gx + gw * 0.55, gy);
    g.lineTo(gx, gy + gh * 0.55);
    g.lineTo(gx - gw * 0.55, gy);
    g.closePath();
    g.fill();
    g.strokeStyle = "#05070c";
    g.lineWidth = Math.max(11, box.w * 0.055); // T087/T108 · thicker motif edge for stage-wide
    g.stroke();
    g.strokeStyle = "rgba(255,248,235,0.72)";
    g.lineWidth = Math.max(3.5, box.w * 0.02);
    g.stroke();
    g.fillStyle = mix(accent, parchment, 0.1);
    g.beginPath();
    g.moveTo(gx - gw * 0.32, gy - gh * 0.1);
    g.lineTo(gx + gw * 0.32, gy - gh * 0.1);
    g.lineTo(gx, gy + gh * 0.22);
    g.closePath();
    g.fill();
    if (motifKind === 2) {
      g.fillStyle = mix(shadow, "#000000", 0.4);
      g.fillRect(box.x + box.w * 0.06, box.y + box.h * 0.16, box.w * 0.32, box.h * 0.62);
    }
  } else {
    const bx = box.x + box.w * 0.72;
    const by = box.y + box.h * 0.88;
    const bw = box.w * 0.58;
    const bh = box.h * 0.7;
    g.fillStyle = mix(parchment, "#ffffff", 0.25);
    g.fillRect(bx - bw / 2, by - bh * 0.75, bw, bh * 0.75);
    g.fillStyle = mix(accent, parchment, 0.05);
    g.beginPath();
    g.moveTo(bx - bw * 0.62, by - bh * 0.75);
    g.lineTo(bx, by - bh * 1.28);
    g.lineTo(bx + bw * 0.62, by - bh * 0.75);
    g.closePath();
    g.fill();
    g.fillStyle = "#0b1220";
    g.fillRect(bx - bw * 0.14, by - bh * 0.55, bw * 0.28, bh * 0.52);
  }

  // T087/T108 · dual-edge ring: darker outer + brighter inner — stage-wide silhouette without gem/auction forks
  g.globalAlpha = 1;
  const inset = Math.max(2, Math.min(box.w, box.h) * 0.015);
  const edgeW = Math.max(8, Math.min(box.w, box.h) * 0.058);
  g.strokeStyle = "rgba(2,4,10,0.99)";
  g.lineWidth = edgeW;
  g.strokeRect(box.x + inset, box.y + inset, box.w - inset * 2, box.h - inset * 2);
  g.strokeStyle = "rgba(255,252,245,0.96)";
  g.lineWidth = Math.max(3.5, edgeW * 0.52);
  g.strokeRect(box.x + inset + edgeW * 0.5, box.y + inset + edgeW * 0.5, box.w - inset * 2 - edgeW, box.h - inset * 2 - edgeW);
  // T087 · high-contrast corner ticks (stage-wide landmark, shared)
  const tick = Math.max(10, Math.min(box.w, box.h) * 0.12);
  g.strokeStyle = "rgba(255,250,240,0.95)";
  g.lineWidth = Math.max(4, edgeW * 0.4);
  for (const [tx, ty, dx, dy] of [
    [box.x + inset + edgeW, box.y + inset + edgeW, tick, 0],
    [box.x + inset + edgeW, box.y + inset + edgeW, 0, tick],
    [box.x + box.w - inset - edgeW, box.y + box.h - inset - edgeW, -tick, 0],
    [box.x + box.w - inset - edgeW, box.y + box.h - inset - edgeW, 0, -tick],
  ] as const) {
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + dx, ty + dy);
    g.stroke();
  }
}

export type PaintCardFaceInput = {
  tier?: number;
  prestige?: number;
  reward?: string;
  cost?: Readonly<Record<string, number>>;
  title?: string;
  base?: string;
};

/**
 * Draw full card face into canvas using CARD_FACE_ZONES.
 * Returns zone pixel rects actually painted (for tests / Room guard).
 */
export function paintCardFace(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  input: PaintCardFaceInput,
): Record<CardFaceZoneId, { x: number; y: number; w: number; h: number }> {
  const zones: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const z of CARD_FACE_ZONES) {
    zones[z.id] = {
      x: Math.round(z.x * W),
      y: Math.round(z.y * H),
      w: Math.round(z.w * W),
      h: Math.round(z.h * H),
    };
  }
  // stock
  g.fillStyle = "#fbf6ec";
  g.fillRect(0, 0, W, H);
  // T087/T108 · thicker dark outer + brighter inner frame for stage-wide edge readout
  g.strokeStyle = "#1a0e08";
  g.lineWidth = 15;
  g.strokeRect(12, 12, W - 24, H - 24);
  g.strokeStyle = "#f0dcb8";
  g.lineWidth = 5.5;
  g.strokeRect(22, 22, W - 44, H - 44);

  const ill = zones.illustration!;
  paintIllustrationBand(g, ill, {
    reward: input.reward,
    tier: input.tier,
    title: input.title,
    base: input.base,
  });

  // reward color bar (full width under illustration) — not a tiny corner only
  const bar = zones.rewardBar!;
  const rewardColor = input.reward ? (CHIP[input.reward] ?? input.base ?? "#8b5a2b") : (input.base ?? "#a78bfa");
  g.fillStyle = rewardColor;
  g.fillRect(bar.x, bar.y, bar.w, bar.h);
  g.fillStyle = "rgba(255,255,255,0.25)";
  g.fillRect(bar.x, bar.y, bar.w, Math.max(2, bar.h * 0.35));

  // title / tier (NOT a giant center-only number)
  // UI-card-schema · darker underlay + larger seat-close title
  const titleBox = zones.title!;
  const floors = CARD_SCHEMA_FLOORS;
  if (input.title && !/^T\d\+/i.test(input.title)) {
    g.fillStyle = "rgba(251,246,236,0.92)";
    g.fillRect(titleBox.x, titleBox.y + 2, titleBox.w * 0.98, titleBox.h - 4);
    g.fillStyle = "#0f172a";
    g.font = `700 ${floors.titlePx}px /* UI-card-schema */ "Noto Serif CJK SC","Songti SC",serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(input.title.slice(0, 10), titleBox.x + 6, titleBox.y + titleBox.h / 2);
  } else if (input.tier != null) {
    g.fillStyle = "rgba(251,246,236,0.88)";
    g.fillRect(titleBox.x, titleBox.y + 2, titleBox.w * 0.45, titleBox.h - 4);
    g.fillStyle = "#1c1917";
    g.font = `700 ${floors.titlePx - 4}px /* UI-card-schema */ serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(`T${input.tier}`, titleBox.x + 6, titleBox.y + titleBox.h / 2);
  }

  // prestige badge (corner zone — secondary, not center-number-only)
  const pr = zones.prestige!;
  if (input.prestige != null) {
    const cx = pr.x + pr.w / 2;
    const cy = pr.y + pr.h / 2;
    const r = Math.max(floors.costDotRadius + 2, Math.min(pr.w, pr.h) * 0.46);
    g.fillStyle = "#fbbf24";
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#78350f";
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = "#451a03";
    g.font = `700 ${floors.prestigePx}px serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(input.prestige), cx, cy + 1);
  }

  // cost row — UI-card-schema · larger dots + dark underlay for seat-close
  const costBox = zones.cost!;
  g.fillStyle = "rgba(28,25,23,0.10)";
  g.fillRect(costBox.x, costBox.y, costBox.w, costBox.h);
  g.fillStyle = "rgba(255,252,245,0.92)";
  g.fillRect(costBox.x + 4, costBox.y + 4, costBox.w - 8, costBox.h - 8);
  const costEntries = Object.entries(input.cost ?? {}).filter(([, n]) => n > 0);
  const step = Math.max(56, floors.costDotRadius * 2 + 12);
  costEntries.forEach(([color, n], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = costBox.x + 32 + col * step;
    const cy = costBox.y + costBox.h / 2 + row * (floors.costDotRadius * 2 + 8) - (row ? 0 : 0);
    const cyDot = costBox.y + Math.min(costBox.h - floors.costDotRadius - 6, floors.costDotRadius + 10 + row * (floors.costDotRadius * 2 + 10));
    // under-disc for contrast on washed stock
    g.fillStyle = "rgba(15,23,42,0.22)";
    g.beginPath();
    g.arc(cx + 1, cyDot + 2, floors.costDotRadius + floors.underlayPad * 0.35, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = CHIP[color] ?? input.base ?? "#64748b";
    g.beginPath();
    g.arc(cx, cyDot, floors.costDotRadius, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#0f172a";
    g.lineWidth = 3.5;
    g.stroke();
    g.fillStyle = color === "white" || color === "gold" ? "#0f172a" : "#fff";
    g.font = `700 ${floors.costDigitPx}px /* UI-card-schema */ sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(n), cx, cyDot + 1);
  });

  // footer rule
  g.fillStyle = "rgba(55,40,25,0.45)";
  g.fillRect(48, H - 40, W - 96, 6);

  return zones as Record<CardFaceZoneId, { x: number; y: number; w: number; h: number }>;
}

/** True if layout is center-number-only (forbidden by T048). */
export function isCenterNumberOnlyFace(zonesUsed: ReadonlyArray<CardFaceZoneId>): boolean {
  const set = new Set(zonesUsed);
  return set.has("prestige") && !set.has("illustration") && !set.has("rewardBar");
}
