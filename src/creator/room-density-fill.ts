/**
 * UI-P4 · density fill — generic Room hand / build-group / seat-badge chrome.
 *
 * Driven by rule-system content + hand schema, legal-action / action-drawer,
 * and presentationFloor / kernel *capability* declarations.
 * No sample / kernel-name special-cases — capability + schema only.
 */

import type {
  GameEntity,
  PresentationFloorReadiness,
  RuleSystem,
  VisualTreatment,
} from "./project-contract";
import { kernelCapabilities } from "./kernel-capabilities";

export type DensityLocale = "zh" | "en";

export type DensityHandSlot = {
  key: string;
  label: string;
  qty: number | string;
  tone?: string;
};

export type DensityCostPip = {
  kind: string;
  amount: number;
  tone?: string;
};

export type DensityBuildAction = {
  id: string;
  label: string;
  /** Cost pips aligned with P1 card-schema (≥0). Empty = readiness chrome only. */
  costPips: DensityCostPip[];
  enabled: boolean;
  value: number | null;
};

export type DensitySeatBadge = {
  key: string;
  label: string;
  value: string | number;
  kind: "resource-summary" | "vp" | "capability" | "score" | "hand";
};

export type HandSchemaKind = {
  id: string;
  label: string;
  tone?: string;
};

const SLOT_TONES = [
  "#8b6914",
  "#5c6b4a",
  "#6b4c9a",
  "#2f4a3c",
  "#8b1e1e",
  "#4a5d73",
  "#6a5438",
  "#3d6b8a",
] as const;

function toneAt(i: number): string {
  return SLOT_TONES[i % SLOT_TONES.length]!;
}

function executableKernelType(ruleSystem: Pick<RuleSystem, "runtimeSupport">): string | null {
  const support = ruleSystem.runtimeSupport;
  if (!support || support.status !== "executable") return null;
  const type = (support.kernel as { type?: string } | undefined)?.type;
  return typeof type === "string" ? type : null;
}

/** Capabilities for the executable kernel, or [] when draft / unknown. */
export function densityCapabilities(
  ruleSystem: Pick<RuleSystem, "runtimeSupport">,
): readonly string[] {
  const type = executableKernelType(ruleSystem);
  if (!type) return [];
  return kernelCapabilities(type) ?? [];
}

/**
 * Resource / hand kinds from rule-system entities + optional content / gameSpec objects.
 * Count is the schema width the hand bar must meet (≥ resource kind count).
 */
export function readHandSchemaKinds(
  ruleSystem: Pick<RuleSystem, "entities" | "runtimeSupport" | "gameSpec">,
): HandSchemaKind[] {
  const kinds: HandSchemaKind[] = [];
  const seen = new Set<string>();

  const push = (id: string, label: string, tone?: string) => {
    const key = id.trim() || label.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    kinds.push({ id: key, label: label.trim() || key, tone });
  };

  for (const entity of ruleSystem.entities ?? []) {
    if (!isHandSchemaEntity(entity)) continue;
    push(entity.id || entity.name, entity.name || entity.id, toneAt(kinds.length));
  }

  const support = ruleSystem.runtimeSupport;
  if (support?.status === "executable") {
    const content = (support.kernel as { content?: unknown }).content;
    for (const kind of kindsFromContent(content)) {
      push(kind.id, kind.label, kind.tone ?? toneAt(kinds.length));
    }
  }

  const objects = (ruleSystem.gameSpec as { objects?: unknown } | undefined)?.objects;
  if (Array.isArray(objects)) {
    for (const obj of objects) {
      if (!obj || typeof obj !== "object") continue;
      const o = obj as { id?: unknown; name?: unknown; kind?: unknown; role?: unknown };
      const role = String(o.kind ?? o.role ?? "");
      if (!/resource|token|card|gem|piece|disc|hand/i.test(role) && role !== "") continue;
      const id = String(o.id ?? o.name ?? "");
      const name = String(o.name ?? o.id ?? "");
      if (id || name) push(id || name, name || id, toneAt(kinds.length));
    }
  }

  return kinds;
}

function isHandSchemaEntity(entity: GameEntity): boolean {
  return (
    entity.kind === "resource" ||
    entity.kind === "token" ||
    entity.kind === "card" ||
    entity.kind === "object"
  );
}

function kindsFromContent(content: unknown): HandSchemaKind[] {
  if (!content || typeof content !== "object") return [];
  const c = content as Record<string, unknown>;
  const out: HandSchemaKind[] = [];

  const resources = c.resources;
  if (Array.isArray(resources)) {
    for (const r of resources) {
      if (typeof r === "string") out.push({ id: r, label: r });
      else if (r && typeof r === "object") {
        const row = r as { id?: string; name?: string; label?: string };
        const id = row.id ?? row.name ?? row.label;
        if (id) out.push({ id, label: row.label ?? row.name ?? id });
      }
    }
  } else if (resources && typeof resources === "object" && !Array.isArray(resources)) {
    for (const key of Object.keys(resources as object)) {
      out.push({ id: key, label: key });
    }
  }

  // Gem / market style: cards array is not a hand kind; bank keys are.
  if (Array.isArray(c.cards) && out.length === 0) {
    /* development decks are not hand resource kinds */
  }

  return out;
}

export type DensityLiveHandState = {
  /** Private hand lengths by seat (hand-play). */
  handPlay?: { hands?: Record<number | string, readonly unknown[]> | readonly (readonly unknown[])[]; deckRemaining?: number };
  /** Gem / token bags by seat. */
  gemSeats?: Record<number | string, { gems?: Record<string, number> } | undefined>;
  /**
   * Per-seat piece / disc counts when capabilities include terminal-disc-count
   * (or similar count-ledger caps). Multi-slot — never collapsed to 棋子×N.
   */
  seatPieceCounts?: readonly number[];
  /** Optional live resource bag for the viewing seat (keys = kind ids). */
  myResources?: Record<string, number>;
  scores?: readonly number[];
  turn?: number;
  seatCount?: number;
  mySeat?: number | null;
};

/**
 * Build multi-slot hand bar from schema + live state.
 * Guarantees ≥ max(2, schemaKindCount) slots. Kills single-slot 「棋子×N」 / Discs×N.
 */
export function buildDensityHandSlots(input: {
  ruleSystem: Pick<RuleSystem, "entities" | "runtimeSupport" | "gameSpec">;
  live: DensityLiveHandState;
  locale: DensityLocale;
}): DensityHandSlot[] {
  const { ruleSystem, live, locale } = input;
  const caps = densityCapabilities(ruleSystem);
  const schema = readHandSchemaKinds(ruleSystem);
  const slots: DensityHandSlot[] = [];
  const mySeat = live.mySeat ?? null;

  // 1) Schema kinds with live qty overlay
  if (schema.length > 0) {
    for (let i = 0; i < schema.length; i++) {
      const kind = schema[i]!;
      const qty = qtyForKind(kind.id, live, mySeat);
      slots.push({
        key: `kind-${kind.id}`,
        label: kind.label,
        qty,
        tone: kind.tone ?? toneAt(i),
      });
    }
  }

  // 2) Capability-driven ledgers when schema empty / thin
  if (slots.length === 0 && caps.includes("gem-tokens") && mySeat !== null) {
    const gems = live.gemSeats?.[mySeat]?.gems ?? live.gemSeats?.[String(mySeat)]?.gems;
    if (gems) {
      let i = 0;
      for (const [gem, qty] of Object.entries(gems)) {
        slots.push({ key: `gem-${gem}`, label: gem, qty: Number(qty) || 0, tone: toneAt(i++) });
      }
    }
  }

  if (slots.length === 0 && caps.includes("private-hands") && mySeat !== null) {
    const handLen = handLengthAt(live.handPlay?.hands, mySeat);
    slots.push({
      key: "hand",
      label: locale === "zh" ? "手牌" : "Hand",
      qty: handLen,
      tone: toneAt(0),
    });
    if (typeof live.handPlay?.deckRemaining === "number") {
      slots.push({
        key: "deck",
        label: locale === "zh" ? "牌库" : "Deck",
        qty: live.handPlay.deckRemaining,
        tone: toneAt(1),
      });
    }
  }

  // terminal-disc-count → one slot per seat's piece ledger (multi-slot density)
  if (
    slots.length === 0 &&
    caps.includes("terminal-disc-count") &&
    live.seatPieceCounts &&
    live.seatPieceCounts.length >= 2
  ) {
    live.seatPieceCounts.forEach((count, seatIdx) => {
      const isYou = mySeat === seatIdx;
      slots.push({
        key: `pieces-seat-${seatIdx}`,
        label: isYou
          ? (locale === "zh" ? "我的棋子" : "Your pieces")
          : (locale === "zh" ? `座位 ${seatIdx}` : `Seat ${seatIdx}`),
        qty: count,
        tone: toneAt(seatIdx),
      });
    });
  }

  // Live myResources bag (capability resource-production / generic)
  if (
    slots.length === 0 &&
    live.myResources &&
    Object.keys(live.myResources).length > 0 &&
    (caps.includes("resource-production") || caps.includes("gem-tokens") || schema.length === 0)
  ) {
    let i = 0;
    for (const [id, qty] of Object.entries(live.myResources)) {
      slots.push({ key: `res-${id}`, label: id, qty: Number(qty) || 0, tone: toneAt(i++) });
    }
  }

  // Density floor: never a single aggregate 棋子/Discs slot; pad to ≥2 (and ≥ schema width)
  const minSlots = Math.max(2, schema.length);
  if (slots.length === 0) {
    const myScore = mySeat !== null ? (live.scores?.[mySeat] ?? 0) : (live.scores?.[0] ?? 0);
    slots.push({
      key: "score",
      label: locale === "zh" ? "得分" : "Score",
      qty: myScore,
      tone: toneAt(0),
    });
    slots.push({
      key: "turn",
      label: locale === "zh" ? "回合" : "Turn",
      qty: live.turn ?? 0,
      tone: toneAt(1),
    });
  }
  while (slots.length < minSlots) {
    if (!slots.some((s) => s.key === "turn")) {
      slots.push({
        key: "turn",
        label: locale === "zh" ? "回合" : "Turn",
        qty: live.turn ?? 0,
        tone: toneAt(slots.length),
      });
      continue;
    }
    if (!slots.some((s) => s.key === "seats")) {
      slots.push({
        key: "seats",
        label: locale === "zh" ? "席位" : "Seats",
        qty: live.seatCount ?? live.scores?.length ?? 0,
        tone: toneAt(slots.length),
      });
      continue;
    }
    slots.push({
      key: `pad-${slots.length}`,
      label: locale === "zh" ? "储备" : "Reserve",
      qty: 0,
      tone: toneAt(slots.length),
    });
  }

  // Guard: collapse of a lone "棋子"/"Discs" label is forbidden — expand if somehow present
  if (slots.length === 1 && /^(棋子|Discs|Pieces)$/i.test(slots[0]!.label)) {
    const only = slots[0]!;
    slots.push({
      key: "turn",
      label: locale === "zh" ? "回合" : "Turn",
      qty: live.turn ?? 0,
      tone: toneAt(1),
    });
    only.label = locale === "zh" ? "我的棋子" : "Your pieces";
  }

  return slots.slice(0, 8);
}

function handLengthAt(
  hands: DensityLiveHandState["handPlay"] extends infer H
    ? H extends { hands?: infer X }
      ? X
      : undefined
    : undefined,
  seat: number,
): number {
  if (!hands) return 0;
  if (Array.isArray(hands) && !isRecord(hands)) {
    const row = (hands as readonly (readonly unknown[])[])[seat];
    return Array.isArray(row) ? row.length : 0;
  }
  const record = hands as Record<number | string, readonly unknown[]>;
  const row = record[seat] ?? record[String(seat)];
  return Array.isArray(row) ? row.length : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function qtyForKind(kindId: string, live: DensityLiveHandState, mySeat: number | null): number {
  if (live.myResources && kindId in live.myResources) {
    return Number(live.myResources[kindId]) || 0;
  }
  if (mySeat !== null) {
    const gems = live.gemSeats?.[mySeat]?.gems ?? live.gemSeats?.[String(mySeat)]?.gems;
    if (gems && kindId in gems) return Number(gems[kindId]) || 0;
    const handLen = handLengthAt(live.handPlay?.hands, mySeat);
    if (kindId === "hand" || kindId === "cards") return handLen;
  }
  if (kindId === "deck" && typeof live.handPlay?.deckRemaining === "number") {
    return live.handPlay.deckRemaining;
  }
  const seatKind = /^seat[-_]?(\d+)$/i.exec(kindId);
  if (live.seatPieceCounts && seatKind) {
    const idx = Number(seatKind[1]);
    return live.seatPieceCounts[idx] ?? 0;
  }
  return 0;
}

/**
 * Generic build / primary-action group for Room shell when board does NOT own HUD.
 * Uses runtime legal actions when present, else rule-system action declarations.
 * Cost pips follow P1 card-schema (dots); disabled when not my turn / busy / no legal.
 */
export function buildDensityBuildGroup(input: {
  ruleSystemActions: ReadonlyArray<{ id: string; label: string; description?: string }>;
  runtimeActions: ReadonlyArray<{ id: string; label: string; value: number | null }>;
  isMyTurn: boolean;
  busy: boolean;
  locale: DensityLocale;
}): DensityBuildAction[] {
  const { ruleSystemActions, runtimeActions, isMyTurn, busy, locale } = input;
  const source =
    runtimeActions.length > 0
      ? runtimeActions.map((a) => ({
          id: a.id,
          label: a.label,
          value: a.value,
          description: undefined as string | undefined,
        }))
      : ruleSystemActions.map((a) => ({
          id: a.id,
          label: a.label,
          value: null as number | null,
          description: a.description,
        }));

  const rows =
    source.length > 0
      ? source
      : [
          {
            id: "primary",
            label: locale === "zh" ? "主操作" : "Primary",
            value: null as number | null,
            description: undefined as string | undefined,
          },
        ];

  const legal = Boolean(isMyTurn && !busy && runtimeActions.length > 0);

  return rows.slice(0, 6).map((action) => {
    const costPips = costPipsForAction(action);
    return {
      id: action.id,
      label: action.label,
      costPips,
      enabled: legal,
      value: action.value,
    };
  });
}

function costPipsForAction(action: {
  id: string;
  label: string;
  value: number | null;
  description?: string;
}): DensityCostPip[] {
  if (typeof action.value === "number" && Number.isFinite(action.value)) {
    const amount = Math.min(5, Math.abs(Math.trunc(action.value)));
    if (amount <= 0) return [];
    return [{ kind: "value", amount, tone: toneAt(0) }];
  }
  const blob = `${action.description ?? ""} ${action.label}`;
  // Generic "costs N of X" hints in action copy — not kernel-specific.
  const match = blob.match(/(\d+)\s*[=:×x]?\s*([A-Za-z\u4e00-\u9fff]{1,8})/u);
  if (match) {
    const amount = Math.min(5, Number(match[1]) || 0);
    if (amount > 0) return [{ kind: match[2]!, amount, tone: toneAt(1) }];
  }
  return [];
}

/**
 * Optional seat-card badges from capabilities + presentationFloor visuals.
 * Never branches on kernel type names — only capability ids / floor visuals.
 */
export function buildDensitySeatBadges(input: {
  capabilities: readonly string[];
  presentationFloor?: PresentationFloorReadiness | null;
  score: number;
  handCount: number;
  pieceCount?: number;
  resourceSummary?: string;
  vp?: number;
  vpToWin?: number;
  locale: DensityLocale;
}): DensitySeatBadge[] {
  const {
    capabilities,
    presentationFloor,
    score,
    handCount,
    pieceCount,
    resourceSummary,
    vp,
    vpToWin,
    locale,
  } = input;
  const badges: DensitySeatBadge[] = [];
  const floorVisuals = presentationFloor?.visuals ?? [];
  const floorWantsBadges =
    presentationFloor?.status === "passed" ||
    floorVisuals.some((v) => visualHintsBadge(v));

  badges.push({
    key: "score",
    label: locale === "zh" ? "分" : "Score",
    value: score,
    kind: "score",
  });

  if (
    (capabilities.includes("private-hands") ||
      capabilities.includes("card-play-scoring") ||
      capabilities.includes("seeded-deck")) &&
    handCount >= 0
  ) {
    badges.push({
      key: "hand",
      label: locale === "zh" ? "手" : "Hand",
      value: handCount,
      kind: "hand",
    });
  }

  if (
    (capabilities.includes("resource-production") ||
      capabilities.includes("gem-tokens") ||
      capabilities.includes("player-trading") ||
      floorWantsBadges) &&
    resourceSummary
  ) {
    badges.push({
      key: "resources",
      label: locale === "zh" ? "资源" : "Res",
      value: resourceSummary,
      kind: "resource-summary",
    });
  }

  const showVp =
    typeof vp === "number" &&
    (capabilities.includes("network-building") ||
      capabilities.includes("resource-production") ||
      capabilities.includes("noble-prestige") ||
      capabilities.includes("path-connectivity") ||
      floorWantsBadges);
  if (showVp) {
    badges.push({
      key: "vp",
      label: locale === "zh" ? "胜点" : "VP",
      value: typeof vpToWin === "number" ? `${vp}/${vpToWin}` : vp,
      kind: "vp",
    });
  }

  if (capabilities.includes("terminal-disc-count") && typeof pieceCount === "number") {
    badges.push({
      key: "pieces",
      label: locale === "zh" ? "子" : "Pcs",
      value: pieceCount,
      kind: "capability",
    });
  }

  if (capabilities.includes("noble-prestige") && typeof vp === "number" && !showVp) {
    badges.push({
      key: "prestige",
      label: locale === "zh" ? "声望" : "Prestige",
      value: vp,
      kind: "capability",
    });
  }

  // Dedupe by key; keep score + up to 3 extras for rail density
  const seen = new Set<string>();
  const out: DensitySeatBadge[] = [];
  for (const b of badges) {
    if (seen.has(b.key)) continue;
    seen.add(b.key);
    out.push(b);
  }
  return out.slice(0, 4);
}

function visualHintsBadge(visual: VisualTreatment): boolean {
  const label = `${visual.label} ${visual.provenance}`.toLowerCase();
  return /badge|hud|seat|vp|resource|hand|chrome|density/i.test(label);
}
