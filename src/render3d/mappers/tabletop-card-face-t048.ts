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
export const CARD_FACE_ZONES: ReadonlyArray<CardFaceZone> = [
  { id: "illustration", x: 0.06, y: 0.05, w: 0.88, h: 0.52 },
  { id: "rewardBar", x: 0.06, y: 0.58, w: 0.88, h: 0.05 },
  { id: "prestige", x: 0.74, y: 0.64, w: 0.18, h: 0.12 },
  { id: "cost", x: 0.06, y: 0.78, w: 0.88, h: 0.14 },
  { id: "title", x: 0.06, y: 0.64, w: 0.64, h: 0.12 },
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

  // T072 · stage-readable motifs (pay T069 far-distance debt): huge high-contrast blocks
  const motifKind = Math.floor(rnd() * 3);
  g.globalAlpha = 1;
  // full-bleed reward mass (dominates stage-wide crop)
  const solid = rewardHex.startsWith("#") ? rewardHex : mix(rgb, accent, 0.05);
  g.fillStyle = solid;
  g.fillRect(box.x + box.w * 0.04, box.y + box.h * 0.06, box.w * 0.92, box.h * 0.88);
  // dark counter-block for value structure
  g.fillStyle = mix(shadow, rgb, 0.25);
  g.fillRect(box.x + box.w * 0.08, box.y + box.h * 0.12, box.w * 0.36, box.h * 0.72);
  // parchment highlight slab
  g.fillStyle = mix(parchment, accent, 0.25);
  g.fillRect(box.x + box.w * 0.48, box.y + box.h * 0.1, box.w * 0.42, box.h * 0.28);
  if (motifKind === 0 || motifKind === 2) {
    const gx = box.x + box.w * 0.68;
    const gy = box.y + box.h * 0.55;
    const gw = box.w * 0.48;
    const gh = box.h * 0.7;
    g.fillStyle = mix(parchment, rgb, 0.15);
    g.beginPath();
    g.moveTo(gx, gy - gh * 0.55);
    g.lineTo(gx + gw * 0.55, gy);
    g.lineTo(gx, gy + gh * 0.55);
    g.lineTo(gx - gw * 0.55, gy);
    g.closePath();
    g.fill();
    g.strokeStyle = mix(shadow, parchment, 0.1);
    g.lineWidth = Math.max(5, box.w * 0.025);
    g.stroke();
    g.fillStyle = mix(accent, parchment, 0.2);
    g.beginPath();
    g.moveTo(gx - gw * 0.3, gy - gh * 0.08);
    g.lineTo(gx + gw * 0.3, gy - gh * 0.08);
    g.lineTo(gx, gy + gh * 0.18);
    g.closePath();
    g.fill();
    if (motifKind === 2) {
      g.fillStyle = mix(shadow, accent, 0.3);
      g.fillRect(box.x + box.w * 0.1, box.y + box.h * 0.2, box.w * 0.3, box.h * 0.55);
    }
  } else {
    const bx = box.x + box.w * 0.66;
    const by = box.y + box.h * 0.82;
    const bw = box.w * 0.52;
    const bh = box.h * 0.62;
    g.fillStyle = mix(parchment, shadow, 0.2);
    g.fillRect(bx - bw / 2, by - bh * 0.75, bw, bh * 0.75);
    g.fillStyle = mix(parchment, accent, 0.15);
    g.beginPath();
    g.moveTo(bx - bw * 0.62, by - bh * 0.75);
    g.lineTo(bx, by - bh * 1.22);
    g.lineTo(bx + bw * 0.62, by - bh * 0.75);
    g.closePath();
    g.fill();
    g.fillStyle = mix(shadow, parchment, 0.15);
    g.fillRect(bx - bw * 0.12, by - bh * 0.5, bw * 0.24, bh * 0.48);
  }

  g.globalAlpha = 1;
  g.strokeStyle = "rgba(55,40,25,0.45)";
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
