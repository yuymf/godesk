export interface GameProject {
  id: string;
  name: string;
  version: number;
  activeRuleSystemId: string;
  createdAt: string;
  updatedAt: string;
  capabilities: {
    authentication: "local-development-only" | "oauth";
    compilation: "available" | "not-yet-implemented";
    persistence: "durable-object";
  };
}

export type ImageUse = "visual-reference" | "project-asset";

interface SourceLibraryEntryBase {
  id: string;
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
    basedOnSourceIds?: string[];
    confidence?: number;
  };
  createdAt: string;
}

export type SourceLibraryEntry = SourceLibraryEntryBase & (
  | { kind: "brief" | "rulebook"; imageUse?: never }
  | { kind: "image"; imageUse: ImageUse }
);

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

export interface PresentationFloorReadiness {
  status: "passed" | "failed";
  reason: string;
  visuals: VisualTreatment[];
}

export interface PlayabilityFloorReadiness {
  status: "passed" | "failed";
  reason: string;
  genre: "hidden-role" | "hand-play" | "conversation" | "placement" | "generic";
  kernelType: string | null;
}

export type PlaySurfaceKind =
  | "table"
  | "cards"
  | "conversation"
  | "screen"
  | "scene"
  | "hybrid";

export interface ParticipantRole {
  id: string;
  name: string;
  description: string;
}

export interface GameEntity {
  id: string;
  name: string;
  kind:
    | "resource"
    | "card"
    | "character"
    | "token"
    | "location"
    | "concept"
    | "object";
  quantity?: number;
  image?: BoundImage;
  sourceId: string | null;
  provenance: "source-anchored" | "system-generated" | "ai-proposed";
  confidence: number;
}

export interface RuleSystem {
  id: string;
  version: number;
  restoredFromBuildId?: string;
  name: string;
  pitch: string;
  participants: {
    min: number;
    max: number;
    default: number;
    roles: ParticipantRole[];
  };
  durationMinutes: number;
  rules: Array<{
    id: string;
    text: string;
    sourceId: string | null;
    provenance: "source-anchored" | "system-generated" | "ai-proposed";
    confidence: number;
  }>;
  constraints: Array<{
    id: string;
    text: string;
    sourceId: string | null;
    provenance: "source-anchored" | "system-generated" | "ai-proposed";
    confidence: number;
  }>;
  entities: GameEntity[];
  setup: string[];
  actions: Array<{
    id: string;
    label: string;
    description: string;
    sourceId: string | null;
    provenance: "source-anchored" | "system-generated" | "ai-proposed";
    confidence: number;
  }>;
  playSurface: {
    kind: PlaySurfaceKind;
    layout: string;
    regions: Array<{
      id: string;
      name: string;
      description: string;
      image?: BoundImage;
    }>;
  };
  stages: Array<{ id: string; name: string }>;
  outcomes: Array<{ id: string; name: string }>;
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
              type: "shared-goal-v1";
              goalTarget: number;
              maxTurns: number;
              actions: Array<{ id: string; label: string; progress: number }>;
            }
          | {
              type: "turn-taking-v1";
              maxTurns: number;
              actions: Array<{ id: string; label: string }>;
            }
          | {
              type: "take-away-v1";
              initialPool: number;
              actions: Array<{ id: string; label: string; take: number }>;
            }
          | {
              type: "roll-and-move-v1";
              dieSides: number;
              targetPosition: number;
              maxTurns: number;
              actions: Array<{ id: string; label: string }>;
            }
          | {
              type: "draw-and-score-v1";
              cardValues: number[];
              copiesPerValue: number;
              victoryTarget: number;
              actions: Array<{ id: string; label: string }>;
            }
          | {
              type: "push-your-luck-v1";
              dieSides: number;
              bustFace: number;
              victoryTarget: number;
              maxActions: number;
              actions: Array<{ id: "roll" | "bank"; label: string }>;
            }
          | {
              type: "harbor-voyage-v1";
              playerCount: number;
            }
          | {
              type: "hidden-role-v1";
              playerCount: number;
              roles: Array<{
                id: string;
                name: string;
                alignment: "culprit" | "town";
              }>;
            }
          | {
              type: "hand-play-v1";
              playerCount: number;
              cardValues: number[];
              copiesPerValue: number;
              handSize: number;
              victoryTarget: number;
              actions: Array<{ id: "play"; label: string }>;
            }
          | {
              type: "conversation-relay-v1";
              victoryTarget: number;
              maxTurns: number;
              actions: Array<{ id: string; label: string; points: number }>;
            };
  };
}

export interface GenerationPlan {
  id: string;
  projectId: string;
  generationJobId: string;
  ruleSystemId: string;
  ruleSystemVersion: number;
  status: "pending" | "approved";
  summary: string;
  participants: RuleSystem["participants"];
  durationMinutes: number;
  playSurface: RuleSystem["playSurface"];
  loop: string[];
  actions: Array<{ label: string; description: string }>;
  outcomes: string[];
  assumptions: string[];
  unsupported: string[];
  sourceIds: string[];
  proposedRuntime?: RuntimeConfigureOperation;
  createdAt: string;
  approvedAt?: string;
}

export interface PlaytestLink {
  projectId: string;
  sessionId: string;
  buildId: string;
  replayId: string;
  updatedAt: string;
  url: string;
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
  basedOnFindingId?: string;
  restoredFromBuildId?: string;
  createdAt: string;
}

export interface DesignHypothesis {
  id: string;
  question: string;
  successSignal: string;
  createdAt: string;
}

export interface ParticipantFeedbackObservation {
  id: string;
  seat: number;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  moment: FeedbackMoment;
}

export type ValidationEvidence =
  | {
      type: "automated-playtest";
      playtestId: string;
    }
  | {
      type: "participant-feedback";
      sessionId: string;
      feedback: ParticipantFeedbackObservation[];
    }
  | {
      type: "human-session";
      sessionId: string;
      seatedParticipants: Array<{ seat: number; name: string }>;
      creatorAttested: true;
    };

export interface ValidationFinding {
  id: string;
  hypothesisId: string;
  buildId: string;
  evidence: ValidationEvidence;
  verdict: "supported" | "refuted" | "inconclusive";
  notes: string;
  nextChange: string;
  createdAt: string;
}

export type ProjectChangeOperation =
  | {
      op: "add_source";
      source: {
        id?: string;
        kind: SourceLibraryEntry["kind"];
        imageUse?: ImageUse;
        name: string;
        content: string;
        provenance: SourceLibraryEntry["provenance"];
      };
    }
  | {
      op: "update_rule_system";
      fields: Partial<
        Pick<
          RuleSystem,
          | "name"
          | "pitch"
          | "participants"
          | "durationMinutes"
          | "rules"
          | "constraints"
          | "entities"
          | "setup"
          | "actions"
          | "playSurface"
          | "stages"
          | "outcomes"
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
      op: "configure_shared_goal";
      config: {
        goalTarget: number;
        maxTurns: number;
        actions: Array<{ id: string; label: string; progress: number }>;
        unsupported?: string[];
      };
    }
  | {
      op: "configure_turn_taking";
      config: {
        maxTurns: number;
        actions: Array<{ id: string; label: string }>;
        unsupported?: string[];
      };
    }
  | {
      op: "configure_take_away";
      config: {
        initialPool: number;
        actions: Array<{ id: string; label: string; take: number }>;
        unsupported?: string[];
      };
    }
  | {
      op: "configure_roll_and_move";
      config: {
        dieSides: number;
        targetPosition: number;
        maxTurns: number;
        actions: Array<{ id: string; label: string }>;
        unsupported?: string[];
      };
    }
  | {
      op: "configure_draw_and_score";
      config: {
        cardValues: number[];
        copiesPerValue: number;
        victoryTarget: number;
        actions: Array<{ id: string; label: string }>;
        unsupported?: string[];
      };
    }
  | {
      op: "configure_push_your_luck";
      config: {
        dieSides: number;
        bustFace: number;
        victoryTarget: number;
        maxActions: number;
        actions: Array<{ id: "roll" | "bank"; label: string }>;
        unsupported?: string[];
      };
    }
  | {
      op: "configure_harbor_voyage";
      config: {
        playerCount: number;
        unsupported?: string[];
      };
    }
  | {
      op: "configure_hidden_role";
      config: {
        playerCount: number;
        roles: Array<{
          id: string;
          name: string;
          alignment: "culprit" | "town";
        }>;
        unsupported?: string[];
      };
    }
  | {
      op: "configure_hand_play";
      config: {
        playerCount: number;
        cardValues: number[];
        copiesPerValue: number;
        handSize: number;
        victoryTarget: number;
        actions: Array<{ id: "play"; label: string }>;
        unsupported?: string[];
      };
    }
  | {
      op: "configure_conversation_relay";
      config: {
        victoryTarget: number;
        maxTurns: number;
        actions: Array<{ id: string; label: string; points: number }>;
        unsupported?: string[];
      };
    }
  | {
      op: "activate_rule_system";
      ruleSystemId: string;
    }
  | {
      op: "approve_generation_plan";
      planId: string;
    }
  | {
      op: "add_design_hypothesis";
      hypothesis: {
        question: string;
        successSignal: string;
      };
    }
  | {
      op: "record_validation_finding";
      finding: {
        hypothesisId: string;
        buildId: string;
        evidence: ValidationEvidence;
        verdict: ValidationFinding["verdict"];
        notes: string;
        nextChange: string;
      };
    }
  | {
      op: "publish_shared_session";
      sessionId: string;
    };

export type RuntimeConfigureOperation = Extract<
  ProjectChangeOperation,
  { op: `configure_${string}` }
>;

export interface ApplyProjectChangesInput {
  expectedVersion: number;
  idempotencyKey: string;
  operations: ProjectChangeOperation[];
}

export interface ApplyProjectChangesResult {
  project: GameProject;
  ruleSystem: RuleSystem;
  generationPlan: GenerationPlan | null;
  sources: SourceLibraryEntry[];
  hypotheses: DesignHypothesis[];
  findings: ValidationFinding[];
  changeset: Changeset;
  warnings: string[];
  studioUrl: string;
}

export interface DuplicateRuleSystemResult {
  project: GameProject;
  ruleSystem: RuleSystem;
  ruleSystems: RuleSystem[];
  changeset: Changeset;
  warnings: string[];
  studioUrl: string;
}

export interface RestoreBuildResult {
  project: GameProject;
  ruleSystem: RuleSystem;
  ruleSystems: RuleSystem[];
  changeset: Changeset;
  sourceBuildId: string;
  warnings: string[];
  studioUrl: string;
}

export interface PlayableBuild {
  id: string;
  projectId: string;
  ruleSystemId: string;
  ruleSystemVersion: number;
  basedOnFindingId?: string;
  ruleSystem: RuleSystem;
  sourceIds: string[];
  warnings: string[];
  unsupportedBehavior: string[];
  presentationFloor: PresentationFloorReadiness;
  playabilityFloor: PlayabilityFloorReadiness;
  createdAt: string;
  playableUrl: string;
}

export interface CompileBuildInput {
  expectedVersion: number;
  idempotencyKey: string;
  basedOnFindingId?: string;
}

export interface CompileBuildResult {
  project: GameProject;
  build: PlayableBuild;
  changeset: Changeset;
  warnings: string[];
  studioUrl: string;
}

export type CreatorJobKind =
  | "generate-rule-system"
  | "iterate-rule-system"
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
      kind: "generate-rule-system";
      expectedVersion: number;
      idea?: string;
      sourceName?: string;
      sourceKind?: "brief" | "rulebook";
      sourceContent?: string;
      visualInputs?: Array<{
        name: string;
        content: string;
        pageNumber: number;
        imageUse: ImageUse;
      }>;
      name?: string;
      participants?: RuleSystem["participants"];
      durationMinutes?: number;
      idempotencyKey: string;
    }
  | {
      kind: "iterate-rule-system";
      expectedVersion: number;
      prompt: string;
      idempotencyKey: string;
      basedOnFindingId?: string;
    }
  | {
      kind: "compile-build";
      expectedVersion: number;
      idempotencyKey: string;
      basedOnFindingId?: string;
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
  studioUrl: string;
  warnings: string[];
}

export interface SessionState {
  turn: number;
  activeSeat: number;
  scores: number[];
  status: "active" | "complete";
  winnerSeat: number | null;
  /** Present when the build kernel is shared-goal-v1. */
  sharedGoal?: {
    progress: number;
    target: number;
  };
  /** Present when the build kernel is turn-taking-v1. */
  turnTaking?: {
    maxTurns: number;
  };
  /** Present when the build kernel is take-away-v1. */
  takeAway?: {
    initialPool: number;
    remaining: number;
  };
  /** Present when the build kernel is roll-and-move-v1. */
  rollAndMove?: {
    positions: number[];
    targetPosition: number;
    lastRoll: number | null;
  };
  /** Present when the build kernel is draw-and-score-v1. Future deck order is intentionally private. */
  drawAndScore?: {
    totalCards: number;
    remainingCards: number;
    lastDraw: number | null;
  };
  /** Present when the build kernel is push-your-luck-v1. */
  pushYourLuck?: {
    turnScore: number;
    dieSides: number;
    bustFace: number;
    lastRoll: number | null;
    maxActions: number;
  };
  /** Present when the build kernel is harbor-voyage-v1. */
  voyage?: HarborVoyageTableState;
  /** Present when the build kernel is hidden-role-v1. Other seats' roles stay hidden. */
  hiddenRole?: {
    phase: "discuss" | "accuse" | "resolved";
    playerCount: number;
    roles: Array<{
      seat: number;
      roleId: string;
      name: string;
      alignment: "culprit" | "town";
    }>;
    spoken: number[];
    accused: number[];
    transcript: Array<{ seat: number; text: string }>;
    accusations: Array<{ seat: number; targetSeat: number }>;
    condemnedSeat: number | null;
    winnerAlignment: "culprit" | "town" | null;
  };
  /** Present when the build kernel is hand-play-v1. Other seats' hands stay hidden. */
  handPlay?: {
    playerCount: number;
    deck: number[];
    deckRemaining: number;
    hands: number[][];
    playArea: Array<{ seat: number; card: number }>;
    lastPlay: { seat: number; card: number } | null;
  };
  /** Present when the build kernel is conversation-relay-v1. */
  conversation?: {
    transcript: Array<{ seat: number; actionId: string; text: string }>;
  };
}

export interface AcceptedAction {
  sequence: number;
  intentId: string;
  seat: number;
  actionId: string;
  points: number;
  payload?: Record<string, unknown>;
  state: SessionState;
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
    sharedGoal?: {
      progress: number;
      target: number;
    };
    turnTaking?: {
      turns: number;
      maxTurns: number;
    };
    takeAway?: {
      initialPool: number;
      remaining: number;
    };
    rollAndMove?: {
      positions: number[];
      targetPosition: number;
      lastRoll: number | null;
    };
    drawAndScore?: {
      totalCards: number;
      remainingCards: number;
      lastDraw: number | null;
    };
    pushYourLuck?: {
      turnScore: number;
      dieSides: number;
      bustFace: number;
      lastRoll: number | null;
      maxActions: number;
    };
  };
  replayId: string;
  createdAt: string;
  replayUrl: string;
}

export interface SessionSeat {
  seat: number;
  displayName?: string;
}

export interface SessionFeedback {
  id: string;
  seat: number;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  moment: FeedbackMoment;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackMoment {
  actionSequence: number;
  actionId: string;
}

export interface ExperimentBrief {
  hypothesisId: string;
  question: string;
  successSignal: string;
}

export interface SharedSession {
  id: string;
  projectId: string;
  buildId: string;
  seed: number;
  state: SessionState;
  seats: SessionSeat[];
  acceptedActions: AcceptedAction[];
  feedback: SessionFeedback[];
  experiment: ExperimentBrief | null;
  replayId: string;
  createdAt: string;
  sessionUrl: string;
  replayUrl: string;
}

export type SharedSessionSnapshot = Omit<
  SharedSession,
  "sessionUrl" | "replayUrl"
>;

export interface SharedSessionSnapshotEvent {
  type: "session.snapshot";
  session: SharedSessionSnapshot;
}

export interface GameReplay {
  id: string;
  projectId: string;
  buildId: string;
  seed: number;
  evidenceType: "automated-bot-simulation" | "session-action-log";
  initialState: SessionState;
  acceptedActions: AcceptedAction[];
  finalState: SessionState;
  createdAt: string;
}
