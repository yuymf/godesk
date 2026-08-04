export interface GameProject {
  id: string;
  name: string;
  version: number;
  activeDefinitionId: string;
  createdAt: string;
  updatedAt: string;
  capabilities: {
    authentication: "local-development-only" | "oauth";
    compilation: "available" | "not-yet-implemented";
    persistence: "durable-object";
  };
}

export interface SourceLibraryEntry {
  id: string;
  kind: "brief" | "rulebook" | "image";
  name: string;
  content: string;
  readiness: "ready";
  provenance: {
    origin:
      | "creator-authored"
      | "creator-upload"
      | "internal-fixture"
      | "system-generated"
      | "ai-proposed"
      | "generative-api";
    locator: string;
    confidence?: number;
  };
  createdAt: string;
}

export interface BoundImage {
  sourceId: string;
  url: string;
  alt: string;
}

export type VisualProvenance =
  | "extracted"
  | "generated"
  | "kit"
  | "uploaded";

export interface VisualTreatment {
  provenance: VisualProvenance;
  label: string;
}

export interface VisualFloorReadiness {
  status: "passed" | "failed";
  reason: string;
  visuals: VisualTreatment[];
}

export interface GameDefinition {
  id: string;
  version: number;
  name: string;
  pitch: string;
  playerCount: number;
  durationMinutes: number;
  rules: Array<{
    id: string;
    text: string;
    sourceId: string | null;
    provenance: "source-anchored" | "system-generated" | "ai-proposed";
    confidence: number;
  }>;
  components: Array<{
    id: string;
    name: string;
    quantity: number;
    image?: BoundImage;
    sourceId: string | null;
    provenance: "source-anchored" | "system-generated" | "ai-proposed";
    confidence: number;
  }>;
  setup: string[];
  actions: Array<{
    id: string;
    label: string;
    description: string;
    sourceId: string | null;
    provenance: "source-anchored" | "system-generated" | "ai-proposed";
    confidence: number;
  }>;
  board: {
    layout: string;
    zones: Array<{
      id: string;
      name: string;
      description: string;
      image?: BoundImage;
    }>;
  };
  phases: Array<{ id: string; name: string }>;
  scenarios: Array<{ id: string; name: string }>;
  presentation: {
    theme: string;
    image?: BoundImage;
    visuals?: VisualTreatment[];
  };
  runtimeSupport:
    | { status: "draft"; unsupported: string[] }
    | {
        status: "executable";
        unsupported: string[];
        kernel:
          | {
              type: "score-race-v1";
              victoryTarget: number;
              maxTurns: number;
              actions: Array<{ id: string; label: string; points: number }>;
            }
          | {
              type: "harbor-voyage-v1";
              playerCount: number;
            };
      };
}

export type HarborVoyageTableState = {
  phase: "placement" | "movement" | "pilot" | "resolved";
  placementRound: number;
  movementRound: number;
  activeSeat: number;
  players: Array<{
    seat: number;
    name: string;
    color: string;
    cash: number;
    workers: number;
  }>;
  punts: Array<{
    cargoId: "amber" | "cobalt" | "cedar";
    name: string;
    color: string;
    die: number;
    position: number;
    value: number;
    result?: "port" | "shipyard" | "pirates";
  }>;
  placements: Array<{
    id: string;
    seat: number;
    targetId: string;
    cost: number;
  }>;
  lastRoll: Partial<Record<"amber" | "cobalt" | "cedar", number>>;
  boardedPirates: Partial<Record<"amber" | "cobalt" | "cedar", number[]>>;
  log: string[];
  winnerSeat: number | null;
};

export interface Changeset {
  id: string;
  previousVersion: number;
  newVersion: number;
  affectedEntities: string[];
  createdAt: string;
}

export type ProjectChangeOperation =
  | {
      op: "add_source";
      source: {
        id?: string;
        kind: SourceLibraryEntry["kind"];
        name: string;
        content: string;
        provenance: SourceLibraryEntry["provenance"];
      };
    }
  | {
      op: "update_definition";
      fields: Partial<
        Pick<
          GameDefinition,
          | "name"
          | "pitch"
          | "playerCount"
          | "durationMinutes"
          | "rules"
          | "components"
          | "setup"
          | "actions"
          | "board"
          | "phases"
          | "scenarios"
          | "presentation"
        >
      >;
    }
  | {
      op: "configure_score_race";
      config: {
        victoryTarget: number;
        maxTurns: number;
        actions: Array<{ id: string; label: string; points: number }>;
        unsupported?: string[];
      };
    }
  | {
      op: "activate_definition";
      definitionId: string;
    };

export interface ApplyProjectChangesInput {
  expectedVersion: number;
  idempotencyKey: string;
  operations: ProjectChangeOperation[];
}

export interface ApplyProjectChangesResult {
  project: GameProject;
  definition: GameDefinition;
  sources: SourceLibraryEntry[];
  changeset: Changeset;
  warnings: string[];
  editorUrl: string;
}

export interface DuplicateDefinitionResult {
  project: GameProject;
  definition: GameDefinition;
  definitions: GameDefinition[];
  changeset: Changeset;
  warnings: string[];
  editorUrl: string;
}

export interface PlayableBuild {
  id: string;
  projectId: string;
  definitionId: string;
  definitionVersion: number;
  definition: GameDefinition;
  sourceIds: string[];
  warnings: string[];
  unsupportedBehavior: string[];
  visualFloor: VisualFloorReadiness;
  createdAt: string;
  playableUrl: string;
}

export interface CompileBuildInput {
  expectedVersion: number;
  idempotencyKey: string;
}

export interface CompileBuildResult {
  project: GameProject;
  build: PlayableBuild;
  changeset: Changeset;
  warnings: string[];
  editorUrl: string;
}

export type CreatorJobKind =
  | "generate-definition"
  | "compile-build"
  | "bot-playtest"
  | "render-preview"
  | "export-build";

export interface CreatorJob {
  id: string;
  projectId: string;
  kind: CreatorJobKind;
  status: "queued" | "running" | "succeeded" | "failed";
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  result?: Record<string, unknown>;
  error?: string;
}

export type SubmitJobInput =
  | {
      kind: "generate-definition";
      expectedVersion: number;
      brief?: string;
      description?: string;
      sourceName?: string;
      sourceKind?: "brief" | "rulebook";
      sourceContent?: string;
      harvestedImages?: Array<{
        name: string;
        content: string;
        pageNumber: number;
      }>;
      name?: string;
      playerCount?: number;
      durationMinutes?: number;
      idempotencyKey: string;
    }
  | {
      kind: "compile-build";
      expectedVersion: number;
      idempotencyKey: string;
    }
  | {
      kind: "bot-playtest";
      buildId: string;
      seed: number;
      idempotencyKey: string;
    }
  | {
      kind: "render-preview" | "export-build";
      buildId: string;
      idempotencyKey: string;
    };

export interface CreateProjectResult {
  project: GameProject;
  editorUrl: string;
  warnings: string[];
}

export interface TableState {
  turn: number;
  activeSeat: number;
  scores: number[];
  status: "active" | "complete";
  winnerSeat: number | null;
  /** Present when the build kernel is harbor-voyage-v1. */
  voyage?: HarborVoyageTableState;
}

export interface AcceptedAction {
  sequence: number;
  intentId: string;
  seat: number;
  actionId: string;
  points: number;
  state: TableState;
}

export interface PlaytestRun {
  id: string;
  projectId: string;
  buildId: string;
  seed: number;
  evidenceType: "automated-bot-simulation";
  terminalStatus: "complete" | "turn-limit";
  metrics: {
    turns: number;
    winnerSeat: number | null;
    finalScores: number[];
  };
  replayId: string;
  createdAt: string;
  replayUrl: string;
}

export interface GameRoom {
  id: string;
  projectId: string;
  buildId: string;
  seed: number;
  state: TableState;
  acceptedActions: AcceptedAction[];
  replayId: string;
  createdAt: string;
  roomUrl: string;
  replayUrl: string;
}

export interface GameReplay {
  id: string;
  projectId: string;
  buildId: string;
  seed: number;
  evidenceType: "automated-bot-simulation" | "room-action-log";
  initialState: TableState;
  acceptedActions: AcceptedAction[];
  finalState: TableState;
  createdAt: string;
}
