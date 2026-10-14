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
export const CARD_FACE_ZONES: ReadonlyArray<CardFaceZone> = [
  { id: "illustration", x: 0.08, y: 0.07, w: 0.84, h: 0.38 },
  { id: "rewardBar", x: 0.08, y: 0.46, w: 0.84, h: 0.06 },
  { id: "prestige", x: 0.72, y: 0.54, w: 0.18, h: 0.14 },
  { id: "cost", x: 0.08, y: 0.70, w: 0.84, h: 0.18 },
  { id: "title", x: 0.08, y: 0.54, w: 0.60, h: 0.12 },
];

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

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
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
  // soft gradient wash
  const grad = g.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  grad.addColorStop(0, mix(parchment, rgb, 0.35));
  grad.addColorStop(0.55, mix(parchment, rgb, 0.55));
  grad.addColorStop(1, mix(rgb, [40, 30, 20], 0.25));
  g.fillStyle = grad;
  g.fillRect(box.x, box.y, box.w, box.h);
  // brush strokes
  for (let i = 0; i < 14; i += 1) {
    const y = box.y + box.h * (0.12 + rnd() * 0.76);
    const x0 = box.x + box.w * (0.05 + rnd() * 0.2);
    const x1 = box.x + box.w * (0.55 + rnd() * 0.4);
    g.strokeStyle = mix(rgb, parchment, 0.15 + rnd() * 0.5);
    g.globalAlpha = 0.35 + rnd() * 0.45;
    g.lineWidth = 3 + rnd() * 10;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x0, y);
    const midX = (x0 + x1) / 2;
    const midY = y + (rnd() - 0.5) * box.h * 0.35;
    g.quadraticCurveTo(midX, midY, x1, y + (rnd() - 0.5) * 8);
    g.stroke();
  }
  g.globalAlpha = 1;
  // vignette frame inside band
  g.strokeStyle = "rgba(55,40,25,0.35)";
  g.lineWidth = 3;
  g.strokeRect(box.x + 4, box.y + 4, box.w - 8, box.h - 8);
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
  g.strokeStyle = "#5b3a1a";
  g.lineWidth = 10;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.strokeStyle = "#d4b896";
  g.lineWidth = 3;
  g.strokeRect(24, 24, W - 48, H - 48);

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
  const titleBox = zones.title!;
  if (input.title && !/^T\d\+/i.test(input.title)) {
    g.fillStyle = "#1f2937";
    g.font = '700 28px "Noto Serif CJK SC","Songti SC",serif';
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(input.title.slice(0, 10), titleBox.x + 4, titleBox.y + titleBox.h / 2);
  } else if (input.tier != null) {
    g.fillStyle = "rgba(55,40,25,0.55)";
    g.font = "700 26px serif";
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(`T${input.tier}`, titleBox.x + 4, titleBox.y + titleBox.h / 2);
  }

  // prestige badge (corner zone — secondary, not center-number-only)
  const pr = zones.prestige!;
  if (input.prestige != null) {
    const cx = pr.x + pr.w / 2;
    const cy = pr.y + pr.h / 2;
    const r = Math.min(pr.w, pr.h) * 0.42;
    g.fillStyle = "#fbbf24";
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#92400e";
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = "#78350f";
    g.font = "700 36px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(input.prestige), cx, cy + 1);
  }

  // cost row
  const costBox = zones.cost!;
  const costEntries = Object.entries(input.cost ?? {}).filter(([, n]) => n > 0);
  costEntries.forEach(([color, n], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = costBox.x + 28 + col * 52;
    const cy = costBox.y + 28 + row * 44;
    g.fillStyle = CHIP[color] ?? input.base ?? "#64748b";
    g.beginPath();
    g.arc(cx, cy, 18, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = color === "white" || color === "gold" ? "#1f2937" : "#fff";
    g.font = "700 20px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(n), cx, cy);
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
