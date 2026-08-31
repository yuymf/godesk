import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import { isDefaultExampleId } from "./default-examples";
import { publicShareUrl, signShareToken, shareSecret } from "./share-capability";

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int(),
  activeRuleSystemId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  capabilities: z.object({
    authentication: z.string(),
    compilation: z.string(),
    persistence: z.string(),
  }),
});

const boundImageSchema = z.object({
  sourceId: z.string(),
  url: z.string(),
  alt: z.string(),
});

const ruleSystemSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  restoredFromBuildId: z.string().optional(),
  name: z.string(),
  pitch: z.string(),
  participants: z.object({
    min: z.number().int().min(1).max(20),
    max: z.number().int().min(1).max(20),
    default: z.number().int().min(1).max(20),
    roles: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
    })).max(20),
  }),
  durationMinutes: z.number().int(),
  rules: z.array(z.object({
    id: z.string(),
    text: z.string(),
    sourceId: z.string().nullable(),
    provenance: z.enum(["source-anchored", "system-generated", "ai-proposed"]),
    confidence: z.number().min(0).max(1),
  })),
  constraints: z.array(z.object({
    id: z.string(),
    text: z.string(),
    sourceId: z.string().nullable(),
    provenance: z.enum(["source-anchored", "system-generated", "ai-proposed"]),
    confidence: z.number().min(0).max(1),
  })),
  entities: z.array(z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["resource", "card", "character", "token", "location", "concept", "object"]),
    quantity: z.number().int().positive().optional(),
    image: boundImageSchema.optional(),
    sourceId: z.string().nullable(),
    provenance: z.enum(["source-anchored", "system-generated", "ai-proposed"]),
    confidence: z.number().min(0).max(1),
  })),
  setup: z.array(z.string()),
  actions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    sourceId: z.string().nullable(),
    provenance: z.enum(["source-anchored", "system-generated", "ai-proposed"]),
    confidence: z.number().min(0).max(1),
  })),
  playSurface: z.object({
    kind: z.enum(["table", "cards", "conversation", "screen", "scene", "hybrid"]),
    layout: z.string(),
    regions: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      image: boundImageSchema.optional(),
    })),
  }),
  stages: z.array(z.object({ id: z.string(), name: z.string() })),
  outcomes: z.array(z.object({ id: z.string(), name: z.string() })),
  presentation: z.object({
    theme: z.string(),
    image: boundImageSchema.optional(),
    visuals: z.array(z.object({
      provenance: z.enum(["extracted", "generated", "kit", "uploaded"]),
      label: z.string(),
    })).min(1).max(8).optional(),
  }),
  runtimeSupport: z.union([
    z.object({
      status: z.literal("draft"),
      unsupported: z.array(z.string()),
    }),
    z.object({
      status: z.literal("executable"),
      unsupported: z.array(z.string()),
      kernel: z.union([
        z.object({
          type: z.literal("score-race-v1"),
          victoryTarget: z.number().int(),
          maxTurns: z.number().int(),
          actions: z.array(
            z.object({
              id: z.string(),
              label: z.string(),
              points: z.number().int(),
            }),
          ),
        }),
        z.object({
          type: z.literal("shared-goal-v1"),
          goalTarget: z.number().int(),
          maxTurns: z.number().int(),
          actions: z.array(
            z.object({
              id: z.string(),
              label: z.string(),
              progress: z.number().int(),
            }),
          ),
        }),
        z.object({
          type: z.literal("turn-taking-v1"),
          maxTurns: z.number().int(),
          actions: z.array(
            z.object({
              id: z.string(),
              label: z.string(),
            }),
          ),
        }),
        z.object({
          type: z.literal("take-away-v1"),
          initialPool: z.number().int(),
          actions: z.array(
            z.object({
              id: z.string(),
              label: z.string(),
              take: z.number().int(),
            }),
          ),
        }),
        z.object({
          type: z.literal("roll-and-move-v1"),
          dieSides: z.number().int(),
          targetPosition: z.number().int(),
          maxTurns: z.number().int(),
          actions: z.array(
            z.object({
              id: z.string(),
              label: z.string(),
            }),
          ),
        }),
        z.object({
          type: z.literal("draw-and-score-v1"),
          cardValues: z.array(z.number().int()),
          copiesPerValue: z.number().int(),
          victoryTarget: z.number().int(),
          actions: z.array(z.object({
            id: z.string(),
            label: z.string(),
          })),
        }),
        z.object({
          type: z.literal("push-your-luck-v1"),
          dieSides: z.number().int(),
          bustFace: z.number().int(),
          victoryTarget: z.number().int(),
          maxActions: z.number().int(),
          actions: z.array(z.object({
            id: z.enum(["roll", "bank"]),
            label: z.string(),
          })),
        }),
        z.object({
          type: z.literal("harbor-voyage-v1"),
          playerCount: z.number().int().min(2).max(3),
        }),
        z.object({
          type: z.literal("hidden-role-v1"),
          playerCount: z.number().int().min(2).max(6),
          roles: z.array(z.object({
            id: z.string(),
            name: z.string(),
            alignment: z.enum(["culprit", "town"]),
          })).min(2).max(6),
        }),
        z.object({
          type: z.literal("hand-play-v1"),
          playerCount: z.number().int().min(2).max(6),
          cardValues: z.array(z.number().int()).min(1),
          copiesPerValue: z.number().int().min(1),
          handSize: z.number().int().min(1).max(8),
          victoryTarget: z.number().int().min(1),
          actions: z.array(z.object({
            id: z.literal("play"),
            label: z.string(),
          })).length(1),
        }),
        z.object({
          type: z.literal("conversation-relay-v1"),
          victoryTarget: z.number().int(),
          maxTurns: z.number().int(),
          actions: z.array(z.object({
            id: z.string(),
            label: z.string(),
            points: z.number().int(),
          })),
        }),
      ]),
    }),
  ]),
});

const generationPlanSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  generationJobId: z.string(),
  ruleSystemId: z.string(),
  ruleSystemVersion: z.number().int(),
  status: z.enum(["pending", "approved"]),
  summary: z.string(),
  participants: ruleSystemSchema.shape.participants,
  durationMinutes: z.number().int(),
  playSurface: ruleSystemSchema.shape.playSurface,
  loop: z.array(z.string()),
  actions: z.array(z.object({
    label: z.string(),
    description: z.string(),
  })),
  outcomes: z.array(z.string()),
  assumptions: z.array(z.string()),
  unsupported: z.array(z.string()),
  sourceIds: z.array(z.string()),
  proposedRuntime: z.object({
    op: z.string(),
    config: z.record(z.string(), z.unknown()),
  }).optional(),
  createdAt: z.string(),
  approvedAt: z.string().optional(),
});

const sourceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  imageUse: z.enum(["visual-reference", "project-asset"]).optional(),
  name: z.string(),
  content: z.string(),
  readiness: z.string(),
  provenance: z.object({
    origin: z.string(),
    locator: z.string(),
    basedOnSourceIds: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
  createdAt: z.string(),
});

const changesetSchema = z.object({
  id: z.string(),
  previousVersion: z.number().int(),
  newVersion: z.number().int(),
  affectedEntities: z.array(z.string()),
  basedOnFindingId: z.string().optional(),
  restoredFromBuildId: z.string().optional(),
  createdAt: z.string(),
});

const designHypothesisSchema = z.object({
  id: z.string(),
  question: z.string(),
  successSignal: z.string(),
  createdAt: z.string(),
});

const validationEvidenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("automated-playtest"),
    playtestId: z.string(),
  }),
  z.object({
    type: z.literal("participant-feedback"),
    sessionId: z.string(),
    feedback: z.array(z.object({
      id: z.string(),
      seat: z.number().int().nonnegative(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().min(2).max(1_000),
      moment: z.object({
        actionSequence: z.number().int().positive(),
        actionId: z.string().min(1),
      }),
    })).min(1).max(8),
  }),
  z.object({
    type: z.literal("human-session"),
    sessionId: z.string(),
    seatedParticipants: z.array(z.object({
      seat: z.number().int().nonnegative(),
      name: z.string().min(1).max(80),
    })).min(2).max(20),
    creatorAttested: z.literal(true),
  }),
]);

const validationFindingSchema = z.object({
  id: z.string(),
  hypothesisId: z.string(),
  buildId: z.string(),
  evidence: validationEvidenceSchema,
  verdict: z.enum(["supported", "refuted", "inconclusive"]),
  notes: z.string(),
  nextChange: z.string(),
  createdAt: z.string(),
});

const buildSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  ruleSystemId: z.string(),
  ruleSystemVersion: z.number().int(),
  basedOnFindingId: z.string().optional(),
  ruleSystem: ruleSystemSchema,
  sourceIds: z.array(z.string()),
  warnings: z.array(z.string()),
  unsupportedBehavior: z.array(z.string()),
  presentationFloor: z.object({
    status: z.enum(["passed", "failed"]),
    reason: z.string(),
    visuals: z.array(z.object({
      provenance: z.enum(["extracted", "generated", "kit", "uploaded"]),
      label: z.string(),
    })),
  }),
  playabilityFloor: z.object({
    status: z.enum(["passed", "failed"]),
    reason: z.string(),
    genre: z.enum(["hidden-role", "hand-play", "conversation", "placement", "generic"]),
    kernelType: z.string().nullable(),
  }),
  createdAt: z.string(),
  playableUrl: z.string(),
});

const harborVoyageSchema = z.object({
  phase: z.enum(["placement", "movement", "pilot", "resolved"]),
  placementRound: z.number().int(),
  movementRound: z.number().int(),
  activeSeat: z.number().int(),
  players: z.array(z.object({
    seat: z.number().int(),
    name: z.string(),
    color: z.string(),
    cash: z.number().int(),
    workers: z.number().int(),
  })),
  punts: z.array(z.object({
    cargoId: z.enum(["amber", "cobalt", "cedar"]),
    name: z.string(),
    color: z.string(),
    die: z.number().int(),
    position: z.number().int(),
    value: z.number().int(),
    result: z.enum(["port", "shipyard", "pirates"]).optional(),
  })),
  placements: z.array(z.object({
    id: z.string(),
    seat: z.number().int(),
    targetId: z.enum([
      "amber",
      "cobalt",
      "cedar",
      "port-a",
      "port-b",
      "port-c",
      "yard-a",
      "yard-b",
      "yard-c",
      "pirates",
      "pilot-small",
      "pilot-large",
      "insurance",
    ]),
    cost: z.number().int(),
  })),
  lastRoll: z.record(z.string(), z.number().int()),
  boardedPirates: z.record(z.string(), z.array(z.number().int())),
  log: z.array(z.string()),
  winnerSeat: z.number().int().nullable(),
});

const sessionStateSchema = z.object({
  turn: z.number().int(),
  activeSeat: z.number().int(),
  scores: z.array(z.number().int()),
  status: z.enum(["active", "complete"]),
  winnerSeat: z.number().int().nullable(),
  sharedGoal: z.object({
    progress: z.number().int(),
    target: z.number().int(),
  }).optional(),
  turnTaking: z.object({
    maxTurns: z.number().int(),
  }).optional(),
  takeAway: z.object({
    initialPool: z.number().int(),
    remaining: z.number().int(),
  }).optional(),
  rollAndMove: z.object({
    positions: z.array(z.number().int()),
    targetPosition: z.number().int(),
    lastRoll: z.number().int().nullable(),
  }).optional(),
  drawAndScore: z.object({
    totalCards: z.number().int(),
    remainingCards: z.number().int(),
    lastDraw: z.number().int().nullable(),
  }).optional(),
  pushYourLuck: z.object({
    turnScore: z.number().int(),
    dieSides: z.number().int(),
    bustFace: z.number().int(),
    lastRoll: z.number().int().nullable(),
    maxActions: z.number().int(),
  }).optional(),
  voyage: harborVoyageSchema.optional(),
  hiddenRole: z.object({
    phase: z.enum(["discuss", "accuse", "resolved"]),
    playerCount: z.number().int(),
    roles: z.array(z.object({
      seat: z.number().int(),
      roleId: z.string(),
      name: z.string(),
      alignment: z.enum(["culprit", "town"]),
    })),
    spoken: z.array(z.number().int()),
    accused: z.array(z.number().int()),
    transcript: z.array(z.object({
      seat: z.number().int(),
      text: z.string(),
    })),
    accusations: z.array(z.object({
      seat: z.number().int(),
      targetSeat: z.number().int(),
    })),
    condemnedSeat: z.number().int().nullable(),
    winnerAlignment: z.enum(["culprit", "town"]).nullable(),
  }).optional(),
  handPlay: z.object({
    playerCount: z.number().int(),
    deck: z.array(z.number().int()),
    deckRemaining: z.number().int(),
    hands: z.array(z.array(z.number().int())),
    playArea: z.array(z.object({
      seat: z.number().int(),
      card: z.number().int(),
    })),
    lastPlay: z.object({
      seat: z.number().int(),
      card: z.number().int(),
    }).nullable(),
  }).optional(),
  conversation: z.object({
    transcript: z.array(z.object({
      seat: z.number().int(),
      actionId: z.string(),
      text: z.string(),
    })),
  }).optional(),
});

const acceptedActionSchema = z.object({
  sequence: z.number().int(),
  intentId: z.string(),
  seat: z.number().int(),
  actionId: z.string(),
  points: z.number().int(),
  payload: z.record(z.string(), z.unknown()).optional(),
  state: sessionStateSchema,
});

const sessionFeedbackSchema = z.object({
  id: z.string(),
  seat: z.number().int().nonnegative(),
  rating: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  comment: z.string(),
  moment: z.object({
    actionSequence: z.number().int().positive(),
    actionId: z.string().min(1),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const playtestSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  buildId: z.string(),
  seed: z.number().int(),
  evidenceType: z.literal("automated-bot-simulation"),
  terminalStatus: z.enum(["complete", "turn-limit"]),
  metrics: z.object({
    turns: z.number().int(),
    winnerSeat: z.number().int().nullable(),
    finalScores: z.array(z.number().int()),
    sharedGoal: z.object({
      progress: z.number().int(),
      target: z.number().int(),
    }).optional(),
    turnTaking: z.object({
      turns: z.number().int(),
      maxTurns: z.number().int(),
    }).optional(),
    takeAway: z.object({
      initialPool: z.number().int(),
      remaining: z.number().int(),
    }).optional(),
    rollAndMove: z.object({
      positions: z.array(z.number().int()),
      targetPosition: z.number().int(),
      lastRoll: z.number().int().nullable(),
    }).optional(),
    drawAndScore: z.object({
      totalCards: z.number().int(),
      remainingCards: z.number().int(),
      lastDraw: z.number().int().nullable(),
    }).optional(),
    pushYourLuck: z.object({
      turnScore: z.number().int(),
      dieSides: z.number().int(),
      bustFace: z.number().int(),
      lastRoll: z.number().int().nullable(),
      maxActions: z.number().int(),
    }).optional(),
  }),
  replayId: z.string(),
  createdAt: z.string(),
  replayUrl: z.string(),
});

const sharedSessionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  buildId: z.string(),
  seed: z.number().int(),
  state: sessionStateSchema,
  seats: z.array(z.object({
    seat: z.number().int().nonnegative(),
    displayName: z.string().max(80).optional(),
  })),
  acceptedActions: z.array(acceptedActionSchema),
  feedback: z.array(sessionFeedbackSchema),
  experiment: z.object({
    hypothesisId: z.string(),
    question: z.string(),
    successSignal: z.string(),
  }).nullable(),
  replayId: z.string(),
  createdAt: z.string(),
  sessionUrl: z.string(),
  replayUrl: z.string(),
});

const playtestLinkSchema = z.object({
  projectId: z.string(),
  sessionId: z.string(),
  buildId: z.string(),
  replayId: z.string(),
  updatedAt: z.string(),
  url: z.string(),
});

const replaySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  buildId: z.string(),
  seed: z.number().int(),
  evidenceType: z.enum(["automated-bot-simulation", "session-action-log"]),
  initialState: sessionStateSchema,
  acceptedActions: z.array(acceptedActionSchema),
  finalState: sessionStateSchema,
  createdAt: z.string(),
});

const jobBaseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  idempotencyKey: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  error: z.string().optional(),
});

const mutationResultSchema = z.object({
  project: projectSchema,
  ruleSystem: ruleSystemSchema,
  generationPlan: generationPlanSchema.nullable(),
  sources: z.array(sourceSchema),
  hypotheses: z.array(designHypothesisSchema),
  findings: z.array(validationFindingSchema),
  changeset: changesetSchema,
  warnings: z.array(z.string()),
  studioUrl: z.string(),
});

const compileResultSchema = z.object({
  project: projectSchema,
  build: buildSchema,
  changeset: changesetSchema,
  warnings: z.array(z.string()),
  studioUrl: z.string(),
});

const iterationResultSchema = mutationResultSchema.extend({
  iteration: z.object({
    prompt: z.string(),
    summary: z.string(),
    actionId: z.string(),
    actionLabel: z.string(),
    sourceId: z.string(),
    basedOnFindingId: z.string().optional(),
  }),
});

const jobSchema = z.union([
  jobBaseSchema.extend({
    kind: z.literal("generate-rule-system"),
    result: mutationResultSchema.extend({
      generationMode: z.literal("deterministic-rule-system-materialization"),
    }).optional(),
  }),
  jobBaseSchema.extend({
    kind: z.literal("iterate-rule-system"),
    result: iterationResultSchema.optional(),
  }),
  jobBaseSchema.extend({
    kind: z.literal("compile-build"),
    result: compileResultSchema.optional(),
  }),
  jobBaseSchema.extend({
    kind: z.literal("bot-playtest"),
    result: playtestSchema.optional(),
  }),
  jobBaseSchema.extend({
    kind: z.literal("render-preview"),
    result: z.object({
      buildId: z.string(),
      previewUrl: z.string(),
    }).optional(),
  }),
  jobBaseSchema.extend({
    kind: z.literal("export-build"),
    result: z.object({
      buildId: z.string(),
      artifactUrl: z.string(),
    }).optional(),
  }),
]);

const pageSchema = z.object({
  cursor: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  nextCursor: z.number().int().nonnegative().nullable(),
  total: z.number().int().nonnegative(),
});

const projectViewSchema = z.discriminatedUnion("view", [
  z.object({
    projectId: z.string(),
    view: z.literal("overview"),
    data: projectSchema,
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("rule-system"),
    data: ruleSystemSchema,
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("generation-plan"),
    data: z.object({
      generationPlan: generationPlanSchema.nullable(),
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("playtest-link"),
    data: z.object({ playtestLink: playtestLinkSchema.nullable() }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("rules"),
    data: z.object({
      rules: ruleSystemSchema.shape.rules,
      page: pageSchema,
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("constraints"),
    data: z.object({
      constraints: ruleSystemSchema.shape.constraints,
      page: pageSchema,
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("entities"),
    data: z.object({
      entities: ruleSystemSchema.shape.entities,
      page: pageSchema,
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("surface"),
    data: ruleSystemSchema.shape.playSurface,
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("outcomes"),
    data: z.object({
      outcomes: ruleSystemSchema.shape.outcomes,
      page: pageSchema,
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("entity"),
    data: z.union([
      sourceSchema,
      ruleSystemSchema.shape.rules.element,
      ruleSystemSchema.shape.constraints.element,
      ruleSystemSchema.shape.entities.element,
      ruleSystemSchema.shape.outcomes.element,
      buildSchema,
      playtestSchema,
      sharedSessionSchema,
      designHypothesisSchema,
      validationFindingSchema,
      jobSchema,
    ]),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("rule-systems"),
    data: z.object({
      ruleSystems: z.array(ruleSystemSchema),
      page: pageSchema,
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("sources"),
    data: z.object({ sources: z.array(sourceSchema), page: pageSchema }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("changesets"),
    data: z.object({
      changesets: z.array(changesetSchema),
      page: pageSchema,
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("builds"),
    data: z.object({ builds: z.array(buildSchema), page: pageSchema }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("playtests"),
    data: z.object({ playtests: z.array(playtestSchema), page: pageSchema }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("sessions"),
    data: z.object({ sessions: z.array(sharedSessionSchema), page: pageSchema }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("validation"),
    data: z.object({
      hypotheses: z.array(designHypothesisSchema),
      findings: z.array(validationFindingSchema),
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("jobs"),
    data: z.object({ jobs: z.array(jobSchema), page: pageSchema }),
  }),
]);

const operationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_source"),
    source: z.object({
      id: z.string().regex(/^source_[a-zA-Z0-9_-]+$/).optional(),
      kind: z.enum(["brief", "rulebook", "image"]),
      imageUse: z.enum(["visual-reference", "project-asset"]).optional(),
      name: z.string().min(1).max(120),
      content: z.string().max(100_000),
      provenance: z.object({
        origin: z.enum([
          "creator-authored",
          "creator-upload",
          "internal-fixture",
          "system-generated",
          "ai-proposed",
          "generative-api",
        ]),
        locator: z.string().max(500),
        basedOnSourceIds: z.array(
          z.string().regex(/^source_[a-zA-Z0-9_-]+$/),
        ).min(1).max(9).optional(),
      }),
    }),
  }),
  z.object({
    op: z.literal("update_rule_system"),
    fields: z.object({
      name: z.string().min(1).max(120).optional(),
      pitch: z.string().max(2_000).optional(),
      participants: ruleSystemSchema.shape.participants.optional(),
      durationMinutes: z.number().int().min(5).max(720).optional(),
      rules: ruleSystemSchema.shape.rules.max(500).optional(),
      constraints: ruleSystemSchema.shape.constraints.max(500).optional(),
      entities: ruleSystemSchema.shape.entities.max(500).optional(),
      setup: ruleSystemSchema.shape.setup.max(200).optional(),
      actions: ruleSystemSchema.shape.actions.max(500).optional(),
      playSurface: ruleSystemSchema.shape.playSurface.optional(),
      stages: ruleSystemSchema.shape.stages.max(500).optional(),
      outcomes: ruleSystemSchema.shape.outcomes.max(500).optional(),
      presentation: ruleSystemSchema.shape.presentation.optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_score_race"),
    config: z.object({
      victoryTarget: z.number().int().min(1).max(1_000),
      maxTurns: z.number().int().min(1).max(1_000),
      actions: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9-]{1,40}$/),
            label: z.string().min(1).max(80),
            points: z.number().int().min(1).max(100),
          }),
        )
        .min(1)
      .max(12),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_shared_goal"),
    config: z.object({
      goalTarget: z.number().int().min(1).max(1_000),
      maxTurns: z.number().int().min(1).max(1_000),
      actions: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9-]{1,40}$/),
            label: z.string().min(1).max(80),
            progress: z.number().int().min(1).max(100),
          }),
        )
        .min(1)
        .max(12),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_turn_taking"),
    config: z.object({
      maxTurns: z.number().int().min(1).max(1_000),
      actions: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9-]{1,40}$/),
            label: z.string().min(1).max(80),
          }),
        )
        .min(1)
        .max(12),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_take_away"),
    config: z.object({
      initialPool: z.number().int().min(2).max(1_000),
      actions: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9-]{1,40}$/),
            label: z.string().min(1).max(80),
            take: z.number().int().min(1).max(100),
          }),
        )
        .min(1)
        .max(12),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_roll_and_move"),
    config: z.object({
      dieSides: z.number().int().min(2).max(100),
      targetPosition: z.number().int().min(2).max(1_000),
      maxTurns: z.number().int().min(1).max(1_000),
      actions: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9-]{1,40}$/),
            label: z.string().min(1).max(80),
          }),
        )
        .length(1),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_draw_and_score"),
    config: z.object({
      cardValues: z.array(z.number().int().min(1).max(100)).min(1).max(100),
      copiesPerValue: z.number().int().min(1).max(100),
      victoryTarget: z.number().int().min(1).max(1_000),
      actions: z.array(z.object({
        id: z.string().regex(/^[a-z0-9-]{1,40}$/),
        label: z.string().min(1).max(80),
      })).length(1),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_push_your_luck"),
    config: z.object({
      dieSides: z.number().int().min(2).max(100),
      bustFace: z.number().int().min(1).max(100),
      victoryTarget: z.number().int().min(1).max(1_000),
      maxActions: z.number().int().min(1).max(10_000),
      actions: z.array(z.object({
        id: z.enum(["roll", "bank"]),
        label: z.string().min(1).max(80),
      })).length(2),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_harbor_voyage"),
    config: z.object({
      playerCount: z.number().int().min(2).max(3),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_hidden_role"),
    config: z.object({
      playerCount: z.number().int().min(2).max(6),
      roles: z.array(z.object({
        id: z.string().regex(/^[a-z0-9-]{1,40}$/),
        name: z.string().min(1).max(40),
        alignment: z.enum(["culprit", "town"]),
      })).min(2).max(6),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_hand_play"),
    config: z.object({
      playerCount: z.number().int().min(2).max(6),
      cardValues: z.array(z.number().int().min(1).max(20)).min(1).max(20),
      copiesPerValue: z.number().int().min(1).max(20),
      handSize: z.number().int().min(1).max(8),
      victoryTarget: z.number().int().min(1).max(1_000),
      actions: z.array(z.object({
        id: z.literal("play"),
        label: z.string().min(1).max(80),
      })).length(1),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("configure_conversation_relay"),
    config: z.object({
      victoryTarget: z.number().int().min(1).max(1_000),
      maxTurns: z.number().int().min(1).max(1_000),
      actions: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9-]{1,40}$/),
            label: z.string().min(1).max(80),
            points: z.number().int().min(1).max(100),
          }),
        )
        .min(1)
        .max(12),
      unsupported: z.array(z.string().min(1).max(500)).max(50).optional(),
    }),
  }),
  z.object({
    op: z.literal("activate_rule_system"),
    ruleSystemId: z.string().min(1),
  }),
  z.object({
    op: z.literal("approve_generation_plan"),
    planId: z.string().min(1),
  }),
  z.object({
    op: z.literal("add_design_hypothesis"),
    hypothesis: z.object({
      question: z.string().min(1).max(500),
      successSignal: z.string().min(1).max(500),
    }),
  }),
  z.object({
    op: z.literal("record_validation_finding"),
    finding: z.object({
      hypothesisId: z.string().min(1),
      buildId: z.string().min(1),
      evidence: validationEvidenceSchema,
      verdict: z.enum(["supported", "refuted", "inconclusive"]),
      notes: z.string().max(2_000),
      nextChange: z.string().min(1).max(1_000),
    }),
  }),
  z.object({
    op: z.literal("publish_shared_session"),
    sessionId: z.string().min(1),
  }),
]);

type JsonObject = Record<string, unknown>;

class ProjectRequestError extends Error {
  constructor(readonly body: JsonObject) {
    super(JSON.stringify(body));
  }
}

function result(value: JsonObject) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

async function bodyOrError(response: Response): Promise<JsonObject> {
  const body = await response.json<JsonObject>().catch(
    (): JsonObject => ({
      error: `http_${response.status}`,
    }),
  );
  if (response.ok) return body;
  throw new ProjectRequestError(body);
}

function toolError(reason: unknown) {
  const body =
    reason instanceof ProjectRequestError
      ? reason.body
      : { error: reason instanceof Error ? reason.message : "unknown_error" };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body) }],
    structuredContent: body,
    isError: true,
  };
}

function internalRequest(
  env: Env,
  creatorId: string,
  path: string,
  init?: RequestInit,
) {
  const stub = env.CREATOR_PROJECTS.getByName(creatorId);
  return stub.fetch(new Request(`https://projects.internal${path}`, init));
}

function studioUrl(origin: string, projectId: string) {
  return new URL(`/studio/${projectId}`, origin).toString();
}

async function playableBuild(
  value: JsonObject,
  origin: string,
  creatorId: string,
  secret: string,
) {
  const token = await signShareToken(
    { v: 1, c: creatorId, build: String(value.id) },
    secret,
  );
  return {
    ...value,
    playableUrl: publicShareUrl(`/play/${String(value.id)}`, origin, token),
  };
}

async function playablePlaytest(
  value: JsonObject,
  origin: string,
  creatorId: string,
  secret: string,
) {
  const token = await signShareToken(
    { v: 1, c: creatorId, replay: String(value.replayId) },
    secret,
  );
  return {
    ...value,
    replayUrl: publicShareUrl(
      `/replay/${String(value.replayId)}`,
      origin,
      token,
    ),
  };
}

async function playableSession(
  value: JsonObject,
  origin: string,
  creatorId: string,
  secret: string,
) {
  const token = await signShareToken(
    {
      v: 1,
      c: creatorId,
      room: String(value.id),
      build: String(value.buildId),
      replay: String(value.replayId),
    },
    secret,
  );
  const seats = Array.isArray(value.seats)
    ? value.seats.map((entry) => {
        const seat = entry as { seat: number; displayName?: string };
        return {
          seat: seat.seat,
          ...(seat.displayName ? { displayName: seat.displayName } : {}),
        };
      })
    : [];
  return {
    ...value,
    seats,
    sessionUrl: publicShareUrl(`/room/${String(value.id)}`, origin, token),
    replayUrl: publicShareUrl(
      `/replay/${String(value.replayId)}`,
      origin,
      token,
    ),
  };
}

async function playablePlaytestLink(
  value: JsonObject,
  origin: string,
  creatorId: string,
  secret: string,
) {
  const token = await signShareToken(
    {
      v: 1,
      c: creatorId,
      project: String(value.projectId),
      room: String(value.sessionId),
      build: String(value.buildId),
      replay: String(value.replayId),
    },
    secret,
  );
  return {
    ...value,
    url: publicShareUrl(
      `/try/${String(value.projectId)}`,
      origin,
      token,
    ),
  };
}

async function playableJob(value: JsonObject, origin: string, creatorId: string, secret: string) {
  const job = { ...value };
  const jobResult = value.result as JsonObject | undefined;
  if (!jobResult) return job;
  if (value.kind === "generate-rule-system" || value.kind === "iterate-rule-system") {
    job.result = playableMutation(jobResult, origin);
  } else if (value.kind === "compile-build" && jobResult.build) {
    job.result = playableMutation({
      ...jobResult,
      build: await playableBuild(jobResult.build as JsonObject, origin, creatorId, secret),
    }, origin);
  } else if (value.kind === "bot-playtest") {
    job.result = await playablePlaytest(jobResult, origin, creatorId, secret);
  } else if (value.kind === "render-preview") {
    job.result = {
      ...jobResult,
      previewUrl: new URL(
        `/play/${String(jobResult.buildId)}`,
        origin,
      ).toString(),
    };
  } else if (value.kind === "export-build") {
    job.result = {
      ...jobResult,
      artifactUrl: new URL(
        `/api/jobs/${String(value.id)}/artifact`,
        origin,
      ).toString(),
    };
  }
  return job;
}

function playableMutation(value: JsonObject, origin: string) {
  const result = { ...value };
  const studioPath = String(result.studioPath ?? "");
  delete result.studioPath;
  result.studioUrl = new URL(studioPath || "/", origin).toString();
  return result;
}

export function createGodeskMcpServer(
  env: Env,
  origin: string,
  creatorId: string,
  authentication: "local-development-only" | "oauth",
) {
  const server = new McpServer({
    name: "godesk",
    version: "0.2.0",
  });
  const registerTool = server.registerTool.bind(server);
  server.registerTool = ((
    ...[name, config, callback]: Parameters<typeof server.registerTool>
  ) =>
    registerTool(
      name,
      {
        ...config,
        _meta: {
          ...config._meta,
          securitySchemes: [
            {
              type: "oauth2",
              scopes: config.annotations?.readOnlyHint
                ? ["godesk:read"]
                : ["godesk:read", "godesk:write"],
            },
          ],
        },
      },
      callback,
    )) as typeof server.registerTool;
  const secret = shareSecret(env);
  const projectRequest = (path: string, init?: RequestInit) =>
    internalRequest(env, creatorId, path, init);

  server.registerTool(
    "list_projects",
    {
      title: "List GoDesk projects",
      description:
        "List the authenticated creator's authoritative Game Projects.",
      outputSchema: z.object({ projects: z.array(projectSchema) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        return result(
          await bodyOrError(await projectRequest("/projects")),
        );
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "create_project",
    {
      title: "Create a GoDesk project",
      description:
        "Create one authoritative Game Project and return its exact Web Studio URL.",
      inputSchema: z.object({
        name: z.string().min(1).max(80),
        templateId: z.enum(["harbor-13", "mistpeak-lodge", "idea-relay"]).optional(),
      }),
      outputSchema: z.object({
        project: projectSchema,
        studioUrl: z.string(),
        warnings: z.array(z.string()),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, templateId }) => {
      try {
        if (templateId !== undefined && !isDefaultExampleId(templateId)) {
          throw new Error("没有这个默认案例。");
        }
        const project = await bodyOrError(
          await projectRequest("/projects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, templateId, authentication }),
          }),
        );
        return result({
          project,
          studioUrl: studioUrl(origin, String(project.id)),
          warnings: templateId
            ? []
            : ["新项目尚未包含来源、结构化规则或 Game Entities。"],
        });
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "read_project",
    {
      title: "Read a bounded GoDesk project view",
      description:
        "Read one authoritative project view. Pass projectId on every call; no hidden session target is used.",
      inputSchema: z.object({
        projectId: z.string().min(1),
        view: z
          .enum([
            "overview",
            "rule-system",
            "generation-plan",
            "playtest-link",
            "rules",
            "constraints",
            "entities",
            "surface",
            "outcomes",
            "entity",
            "rule-systems",
            "sources",
            "changesets",
            "builds",
            "playtests",
            "sessions",
            "validation",
            "jobs",
          ])
          .default("overview"),
        entityType: z
          .enum([
            "source",
            "rule",
            "constraint",
            "entity",
            "outcome",
            "build",
            "playtest",
            "session",
            "hypothesis",
            "finding",
            "job",
          ])
          .optional(),
        entityId: z.string().min(1).optional(),
        cursor: z.number().int().nonnegative().default(0),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      outputSchema: projectViewSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, view, entityType, entityId, cursor, limit }) => {
      try {
        const query =
          view === "overview"
            ? ""
            : `?view=${view}&cursor=${cursor}&limit=${limit}${
                entityType ? `&entityType=${entityType}` : ""
              }${entityId ? `&entityId=${encodeURIComponent(entityId)}` : ""}`;
        const data = await bodyOrError(
          await projectRequest(`/projects/${projectId}${query}`),
        );
        if (view === "builds" && Array.isArray(data.builds)) {
          data.builds = await Promise.all(
            data.builds.map((build: unknown) =>
              playableBuild(build as JsonObject, origin, creatorId, secret),
            ),
          );
        }
        if (view === "playtests" && Array.isArray(data.playtests)) {
          data.playtests = await Promise.all(
            data.playtests.map((playtest: unknown) =>
              playablePlaytest(playtest as JsonObject, origin, creatorId, secret),
            ),
          );
        }
        if (view === "sessions" && Array.isArray(data.sessions)) {
          data.sessions = await Promise.all(
            data.sessions.map((session: unknown) =>
              playableSession(session as JsonObject, origin, creatorId, secret),
            ),
          );
        }
        if (view === "playtest-link" && data.playtestLink) {
          data.playtestLink = await playablePlaytestLink(
            data.playtestLink as JsonObject,
            origin,
            creatorId,
            secret,
          );
        }
        if (view === "jobs" && Array.isArray(data.jobs)) {
          data.jobs = await Promise.all(
            data.jobs.map((job: unknown) =>
              playableJob(job as JsonObject, origin, creatorId, secret),
            ),
          );
        }
        if (view === "entity") {
          if (entityType === "build") {
            Object.assign(data, await playableBuild(data, origin, creatorId, secret));
          } else if (entityType === "playtest") {
            Object.assign(data, await playablePlaytest(data, origin, creatorId, secret));
          } else if (entityType === "session") {
            Object.assign(data, await playableSession(data, origin, creatorId, secret));
          } else if (entityType === "job") {
            Object.assign(data, await playableJob(data, origin, creatorId, secret));
          }
        }
        return result({ projectId, view, data });
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "get_studio_url",
    {
      title: "Open the exact GoDesk Web Studio",
      description:
        "Verify a project exists and return the exact visible Web Studio URL.",
      inputSchema: z.object({ projectId: z.string().min(1) }),
      outputSchema: z.object({
        projectId: z.string(),
        studioUrl: z.string(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId }) => {
      try {
        await bodyOrError(
          await projectRequest(`/projects/${projectId}`),
        );
        return result({ projectId, studioUrl: studioUrl(origin, projectId) });
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "apply_project_patch",
    {
      title: "Apply a versioned GoDesk patch",
      description:
        "Atomically add traceable sources or update the active Rule System. Stale expectedVersion values apply nothing.",
      inputSchema: z.object({
        projectId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        idempotencyKey: z.string().min(1).max(200),
        operations: z.array(operationSchema).min(1).max(20),
      }),
      outputSchema: z.object({
        project: projectSchema,
        ruleSystem: ruleSystemSchema,
        generationPlan: generationPlanSchema.nullable(),
        sources: z.array(sourceSchema),
        hypotheses: z.array(designHypothesisSchema),
        findings: z.array(validationFindingSchema),
        changeset: changesetSchema,
        warnings: z.array(z.string()),
        studioUrl: z.string(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ...input }) => {
      try {
        return result(
          playableMutation(await bodyOrError(
            await projectRequest(`/projects/${projectId}/changes`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            }),
          ), origin),
        );
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "submit_job",
    {
      title: "Submit durable GoDesk work",
      description:
        "Submit idea-or-source Rule System materialization, a bounded natural-language Studio iteration, compilation, fixed-seed bot playtest, preview render, or build export work and return a durable job ID for tracking.",
      inputSchema: z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("generate-rule-system"),
          projectId: z.string().min(1),
          expectedVersion: z.number().int().positive(),
          idea: z.string().min(1).max(100_000).optional(),
          sourceContent: z.string().min(1).max(100_000).optional(),
          sourceName: z.string().min(1).max(120).optional(),
          sourceKind: z.enum(["brief", "rulebook"]).optional(),
          visualInputs: z.array(z.object({
            name: z.string().min(1).max(120),
            content: z.string()
              .regex(/^data:image\/(?:png|jpe?g|webp);base64,/)
              .max(100_000),
            pageNumber: z.number().int().positive(),
            imageUse: z.enum(["visual-reference", "project-asset"]),
          })).max(8).optional(),
          name: z.string().min(1).max(120).optional(),
          participants: ruleSystemSchema.shape.participants.optional(),
          durationMinutes: z.number().int().min(5).max(720).optional(),
          idempotencyKey: z.string().min(1).max(200),
        }).refine(
          (input) => Boolean(input.idea || input.sourceContent),
          { message: "idea or sourceContent is required" },
        ),
        z.object({
          kind: z.literal("iterate-rule-system"),
          projectId: z.string().min(1),
          expectedVersion: z.number().int().positive(),
          prompt: z.string().min(1).max(2_000),
          basedOnFindingId: z.string().min(1).optional(),
          idempotencyKey: z.string().min(1).max(200),
        }),
        z.object({
          kind: z.literal("compile-build"),
          projectId: z.string().min(1),
          expectedVersion: z.number().int().positive(),
          basedOnFindingId: z.string().min(1).optional(),
          idempotencyKey: z.string().min(1).max(200),
        }),
        z.object({
          kind: z.literal("bot-playtest"),
          projectId: z.string().min(1),
          buildId: z.string().min(1),
          seed: z.number().int(),
          idempotencyKey: z.string().min(1).max(200),
        }),
        z.object({
          kind: z.enum(["render-preview", "export-build"]),
          projectId: z.string().min(1),
          buildId: z.string().min(1),
          idempotencyKey: z.string().min(1).max(200),
        }),
      ]),
      outputSchema: jobSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ...input }) => {
      try {
        const job = await bodyOrError(
          await projectRequest(`/projects/${projectId}/jobs`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          }),
        );
        return result(await playableJob(job, origin, creatorId, secret));
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "track_job",
    {
      title: "Track durable GoDesk work",
      description:
        "Read one durable job's current status, terminal result, exact preview/replay/artifact handoff, or failure.",
      inputSchema: z.object({ jobId: z.string().min(1) }),
      outputSchema: jobSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ jobId }) => {
      try {
        const job = await bodyOrError(
          await projectRequest(`/jobs/${jobId}`),
        );
        return result(await playableJob(job, origin, creatorId, secret));
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "retry_job",
    {
      title: "Retry durable GoDesk work",
      description:
        "Requeue the same durable job with its persisted input and underlying idempotency keys. The job ID is retained.",
      inputSchema: z.object({ jobId: z.string().min(1) }),
      outputSchema: jobSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ jobId }) => {
      try {
        const job = await bodyOrError(
          await projectRequest(`/jobs/${jobId}/retry`, { method: "POST" }),
        );
        return result(await playableJob(job, origin, creatorId, secret));
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "read_build",
    {
      title: "Read an immutable GoDesk build",
      description:
        "Read a compiled Playable Build, its warnings, and exact playable URL.",
      inputSchema: z.object({ buildId: z.string().min(1) }),
      outputSchema: buildSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ buildId }) => {
      try {
        const build = await bodyOrError(
          await projectRequest(`/builds/${buildId}`),
        );
        return result(await playableBuild(build, origin, creatorId, secret));
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "create_shared_session",
    {
      title: "Create an authoritative GoDesk Shared Session",
      description:
        "Create a reconnectable Shared Session from one immutable executable Build.",
      inputSchema: z.object({
        buildId: z.string().min(1),
        seed: z.number().int(),
        idempotencyKey: z.string().min(1).max(200),
        hypothesisId: z.string().min(1).optional(),
      }),
      outputSchema: sharedSessionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ buildId, ...input }) => {
      try {
        const room = await bodyOrError(
          await projectRequest(`/builds/${buildId}/sessions`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          }),
        );
        return result(await playableSession(room, origin, creatorId, secret));
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "read_shared_session",
    {
      title: "Reconnect to a GoDesk Shared Session",
      description:
        "Read authoritative Session State and the accepted Action Log for a Shared Session.",
      inputSchema: z.object({ sessionId: z.string().min(1) }),
      outputSchema: sharedSessionSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ sessionId }) => {
      try {
        const room = await bodyOrError(
          await projectRequest(`/sessions/${sessionId}`),
        );
        return result(await playableSession(room, origin, creatorId, secret));
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "submit_session_intent",
    {
      title: "Submit a validated GoDesk Shared Session intent",
      description:
        "Submit one player intent. Only a legal active-seat action enters the authoritative Action Log.",
      inputSchema: z.object({
        sessionId: z.string().min(1),
        intentId: z.string().min(1).max(200),
        seat: z.number().int().nonnegative(),
        actionId: z.string().min(1).max(40),
        payload: z.record(z.string(), z.unknown()).optional(),
      }),
      outputSchema: sharedSessionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ sessionId, ...input }) => {
      try {
        const room = await bodyOrError(
          await projectRequest(`/sessions/${sessionId}/intents`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          }),
        );
        return result(await playableSession(room, origin, creatorId, secret));
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "read_replay",
    {
      title: "Read a non-mutating GoDesk replay",
      description:
        "Read an immutable Replay snapshot. This tool has no live Shared Session mutation path.",
      inputSchema: z.object({ replayId: z.string().min(1) }),
      outputSchema: replaySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ replayId }) => {
      try {
        return result(
          await bodyOrError(
            await projectRequest(`/replays/${replayId}`),
          ),
        );
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "duplicate_rule_system",
    {
      title: "Duplicate a GoDesk Rule System",
      description:
        "Branch one Rule System inside the same project, keep shared sources, and make the new variant active.",
      inputSchema: z.object({
        projectId: z.string().min(1),
        ruleSystemId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        idempotencyKey: z.string().min(1).max(200),
        name: z.string().min(1).max(120),
      }),
      outputSchema: z.object({
        project: projectSchema,
        ruleSystem: ruleSystemSchema,
        ruleSystems: z.array(ruleSystemSchema),
        changeset: changesetSchema,
        warnings: z.array(z.string()),
        studioUrl: z.string(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ruleSystemId, ...input }) => {
      try {
        return result(
          playableMutation(await bodyOrError(
            await projectRequest(
              `/projects/${projectId}/rule-systems/${ruleSystemId}/duplicate`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(input),
              },
            ),
          ), origin),
        );
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "restore_build_as_rule_system",
    {
      title: "Restore a GoDesk Build as an editable Rule System",
      description:
        "Copy one immutable Build snapshot into a new active editable Rule System while preserving the original Build, sessions, replays, and findings.",
      inputSchema: z.object({
        projectId: z.string().min(1),
        buildId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        idempotencyKey: z.string().min(1).max(200),
      }),
      outputSchema: z.object({
        project: projectSchema,
        ruleSystem: ruleSystemSchema,
        ruleSystems: z.array(ruleSystemSchema),
        changeset: changesetSchema,
        sourceBuildId: z.string(),
        warnings: z.array(z.string()),
        studioUrl: z.string(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, buildId, ...input }) => {
      try {
        return result(
          playableMutation(await bodyOrError(
            await projectRequest(
              `/projects/${projectId}/builds/${buildId}/restore`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(input),
              },
            ),
          ), origin),
        );
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "duplicate_project",
    {
      title: "Duplicate a GoDesk project",
      description:
        "Copy the current Rule System and sources into a new project without copying Builds.",
      inputSchema: z.object({
        projectId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        idempotencyKey: z.string().min(1).max(200),
        name: z.string().min(1).max(80),
      }),
      outputSchema: z.object({
        project: projectSchema,
        studioUrl: z.string(),
        warnings: z.array(z.string()),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ...input }) => {
      try {
        const project = await bodyOrError(
          await projectRequest(`/projects/${projectId}/duplicate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          }),
        );
        return result({
          project,
          studioUrl: studioUrl(origin, String(project.id)),
          warnings: [],
        });
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "delete_project",
    {
      title: "Permanently delete a GoDesk project",
      description:
        "Permanently delete exactly one project and its builds. confirmationProjectId must equal projectId.",
      inputSchema: z.object({
        projectId: z.string().min(1),
        confirmationProjectId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        idempotencyKey: z.string().min(1).max(200),
      }),
      outputSchema: z.object({ deletedProjectId: z.string() }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ...input }) => {
      try {
        return result(
          await bodyOrError(
            await projectRequest(`/projects/${projectId}`, {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            }),
          ),
        );
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  return server;
}

export function godeskMcpHandler(
  request: Request,
  env: Env,
  creatorId: string,
  authentication: "local-development-only" | "oauth",
) {
  const origin = new URL(request.url).origin;
  return createMcpHandler(
    () =>
      createGodeskMcpServer(
        env,
        origin,
        creatorId,
        authentication,
      ),
    { route: "/mcp" },
  );
}
