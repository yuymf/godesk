/**
 * T037 · shared procedural card/plaque face schema (no external copyright art).
 * Encoded into piece.label → node.tag; never drawn as raw debug strings like `T1+0|green`.
 */

export type CardFaceSchema = {
  kind: "card";
  tier?: number;
  prestige?: number;
  /** Reward / discount color key. */
  reward?: string;
  cost?: Readonly<Record<string, number>>;
  title?: string;
};

export type PlaqueFaceSchema = {
  kind: "plaque";
  title: string;
  prestige?: number;
  requirements?: Readonly<Record<string, number>>;
};

export type FaceSchema = CardFaceSchema | PlaqueFaceSchema;

const COST_KEYS = ["white", "blue", "green", "red", "black", "gold"] as const;
const COST_SHORT: Record<string, string> = {
  white: "w", blue: "b", green: "g", red: "r", black: "k", gold: "o",
};
const SHORT_COST: Record<string, string> = {
  w: "white", b: "blue", g: "green", r: "red", k: "black", o: "gold",
};

function encodeCost(cost: Readonly<Record<string, number>> | undefined): string {
  if (!cost) return "";
  const parts: string[] = [];
  for (const key of COST_KEYS) {
    const n = Math.max(0, Math.floor(Number(cost[key] ?? 0)));
    if (n > 0) parts.push(`${COST_SHORT[key]}${n}`);
  }
  return parts.join("");
}

function decodeCost(raw: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /([wbgrko])(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const color = SHORT_COST[m[1]!];
    if (color) out[color] = Number(m[2]);
  }
  return out;
}

/** Encode a development / lot card face. */
export function encodeCardFace(input: Omit<CardFaceSchema, "kind">): string {
  const parts = ["face", "card"];
  if (input.tier != null) parts.push(`t${input.tier}`);
  if (input.prestige != null) parts.push(`p${input.prestige}`);
  if (input.reward) parts.push(`rw:${input.reward}`);
  const c = encodeCost(input.cost);
  if (c) parts.push(`c${c}`);
  if (input.title) parts.push(`n:${input.title.replace(/\|/g, "/")}`);
  return parts.join("|");
}

/** Encode a noble / plaque face. */
export function encodePlaqueFace(input: Omit<PlaqueFaceSchema, "kind">): string {
  const parts = ["face", "plaque", `n:${input.title.replace(/\|/g, "/")}`];
  if (input.prestige != null) parts.push(`p${input.prestige}`);
  const c = encodeCost(input.requirements);
  if (c) parts.push(`q${c}`);
  return parts.join("|");
}

export function parseFaceSchema(raw: string | undefined | null): FaceSchema | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s.startsWith("face|")) {
    // Legacy debug forms used before T037 — treat as opaque title only (never redraw as T1+0|x).
    const legacy = /^T(\d)\+(\d+)(?:\|([a-z]+))?$/i.exec(s);
    if (legacy) {
      return {
        kind: "card",
        tier: Number(legacy[1]),
        prestige: Number(legacy[2]),
        reward: legacy[3],
      };
    }
    return null;
  }
  const parts = s.split("|");
  const kind = parts[1] === "plaque" ? "plaque" : "card";
  let tier: number | undefined;
  let prestige: number | undefined;
  let reward: string | undefined;
  let title: string | undefined;
  let cost: Record<string, number> | undefined;
  let requirements: Record<string, number> | undefined;
  for (const p of parts.slice(2)) {
    if (p.startsWith("t") && /^\d+$/.test(p.slice(1))) tier = Number(p.slice(1));
    else if (p.startsWith("p") && /^\d+$/.test(p.slice(1))) prestige = Number(p.slice(1));
    else if (p.startsWith("rw:")) reward = p.slice(3);
    else if (p.startsWith("c")) cost = decodeCost(p.slice(1));
    else if (p.startsWith("q")) requirements = decodeCost(p.slice(1));
    else if (p.startsWith("n:")) title = p.slice(2);
  }
  if (kind === "plaque") {
    return { kind: "plaque", title: title ?? "★", prestige, requirements };
  }
  return { kind: "card", tier, prestige, reward, cost, title };
}

/** ObjectKinds that carry face schema in label — do not spawn floating parchment nameplates. */
export const FACE_SCHEMA_KINDS = new Set(["card", "plaque"]);
