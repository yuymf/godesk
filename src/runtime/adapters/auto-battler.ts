/**
 * Tide Arena / 潮阵 — Executable Kernel stub for `auto-battler-v1`.
 *
 * Product name: Tide Arena / 潮阵 (never use third-party auto-battler brands).
 * This file is a registration落点 marker for M1. Full shop / bench / board /
 * combat loop is intentionally unimplemented; adapter methods fail-closed.
 *
 * Wire next (see g3d-evidence …/tide-arena/00-kernel-loci.md):
 * - KERNEL_CAPABILITIES + MECHANIC_CAPABILITIES + inferRequestedMechanics
 * - project-contract kernel union + configure_auto_battler
 * - worker/runtime.ts createInitialState / acceptIntent branches
 * - worker/job-runner.ts thin bind from NL cues
 * - room-presentation + Tabletop/SceneHost presentation path
 */
import type {
  PlayKernelAdapter,
  PlayKernelConfig,
  PlayState,
} from "../play-kernel";

export const AUTO_BATTLER_KERNEL_TYPE = "auto-battler-v1" as const;

export type AutoBattlerConfig = {
  playerCount: number;
};

/** Opaque genre payload — expand when implementing shop/bench/board/combat. */
export type AutoBattlerGenre = {
  /** Stub marker so Session / HUD can detect the kernel without inventing rules. */
  stub: true;
};

function parseAutoBattlerConfig(
  raw: Record<string, unknown>,
): AutoBattlerConfig | null {
  const playerCount = raw.playerCount;
  if (
    typeof playerCount !== "number" ||
    !Number.isInteger(playerCount) ||
    playerCount < 2
  ) {
    return null;
  }
  return { playerCount };
}

export function createAutoBattlerKernelConfig(
  playerCount = 2,
): PlayKernelConfig {
  return {
    kernelType: AUTO_BATTLER_KERNEL_TYPE,
    playerCount,
    phases: [
      { id: "stub", name: "Stub" },
      { id: "ended", name: "Ended" },
    ],
    adapter: { playerCount },
  };
}

/**
 * Fail-closed stub adapter. Lists no legal actions; reduce always returns null
 * so Shared Session cannot invent Tide Arena rules before the real loop lands.
 */
export const autoBattlerAdapter: PlayKernelAdapter<
  AutoBattlerGenre,
  AutoBattlerConfig
> = {
  kernelType: AUTO_BATTLER_KERNEL_TYPE,
  parseConfig: parseAutoBattlerConfig,
  createGenreState() {
    return { stub: true };
  },
  initialPhase() {
    return "stub";
  },
  listLegalActions(_state: PlayState<AutoBattlerGenre>, _playerId: number) {
    return [];
  },
  reduce() {
    return null;
  },
};
