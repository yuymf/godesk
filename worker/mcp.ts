import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import { isDefaultExampleId } from "../src/creator/default-examples";
import {
  publicBuild,
  publicJob,
  publicMutation,
  publicPlaytest,
  publicPlaytestLink,
  publicSession,
} from "./public-urls";
import { shareSecret } from "./share-capability";

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
  runtimeSupport: z.object({
    status: z.enum(["draft", "executable"]),
    unsupported: z.array(z.string()),
    kernel: z.unknown().optional(),
  }),
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

const sessionStateSchema = z.object({
  turn: z.number().int(),
  activeSeat: z.number().int(),
  scores: z.array(z.number().int()),
  status: z.enum(["active", "complete"]),
  winnerSeat: z.number().int().nullable(),
}).catchall(z.unknown());

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
  }).catchall(z.unknown()),
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
    kind: z.literal("export-build"),
    result: z.object({
      buildId: z.string(),
      artifactUrl: z.string(),
    }).optional(),
  }),
]);

const projectViewSchema = z.object({
  projectId: z.string(),
  view: z.string(),
  data: z.unknown(),
});

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

function asBuild(value: JsonObject) {
  return { ...value, id: String(value.id ?? "") };
}

function asPlaytest(value: JsonObject) {
  return { ...value, replayId: String(value.replayId ?? "") };
}

function asSession(value: JsonObject) {
  return {
    ...value,
    id: String(value.id ?? ""),
    buildId: String(value.buildId ?? ""),
    replayId: String(value.replayId ?? ""),
    seats: Array.isArray(value.seats)
      ? value.seats as Array<{ seat: number; displayName?: string }>
      : undefined,
  };
}

function asPlaytestLink(value: JsonObject) {
  return {
    ...value,
    projectId: String(value.projectId ?? ""),
    sessionId: String(value.sessionId ?? ""),
    buildId: String(value.buildId ?? ""),
    replayId: String(value.replayId ?? ""),
  };
}

function asJob(value: JsonObject) {
  return {
    ...value,
    id: String(value.id ?? ""),
    projectId: String(value.projectId ?? ""),
    kind: String(value.kind ?? ""),
    result: value.result && typeof value.result === "object"
      ? value.result as Record<string, unknown>
      : undefined,
  };
}

function asStudio(value: JsonObject) {
  return {
    ...value,
    studioPath: typeof value.studioPath === "string" ? value.studioPath : "/",
  };
}

export function createGodeskMcpServer(
  env: Env,
  origin: string,
  creatorId: string,
  authentication: "local-development-only" | "oauth",
  mount = "/",
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
  const secret = shareSecret(env, new URL(origin).hostname);
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
              publicBuild(asBuild(build as JsonObject), origin, creatorId, secret, mount),
            ),
          );
        }
        if (view === "playtests" && Array.isArray(data.playtests)) {
          data.playtests = await Promise.all(
            data.playtests.map((playtest: unknown) =>
              publicPlaytest(asPlaytest(playtest as JsonObject), origin, creatorId, secret, mount),
            ),
          );
        }
        if (view === "sessions" && Array.isArray(data.sessions)) {
          data.sessions = await Promise.all(
            data.sessions.map((session: unknown) =>
              publicSession(asSession(session as JsonObject), origin, creatorId, secret, mount),
            ),
          );
        }
        if (view === "playtest-link" && data.playtestLink) {
          data.playtestLink = await publicPlaytestLink(
            asPlaytestLink(data.playtestLink as JsonObject),
            origin,
            creatorId,
            secret,
            mount,
          );
        }
        if (view === "jobs" && Array.isArray(data.jobs)) {
          data.jobs = await Promise.all(
            data.jobs.map((job: unknown) =>
              publicJob(asJob(job as JsonObject), origin, creatorId, secret, mount),
            ),
          );
        }
        if (view === "entity") {
          if (entityType === "build") {
            Object.assign(data, await publicBuild(asBuild(data), origin, creatorId, secret, mount));
          } else if (entityType === "playtest") {
            Object.assign(data, await publicPlaytest(asPlaytest(data), origin, creatorId, secret, mount));
          } else if (entityType === "session") {
            Object.assign(data, await publicSession(asSession(data), origin, creatorId, secret, mount));
          } else if (entityType === "job") {
            Object.assign(data, await publicJob(asJob(data), origin, creatorId, secret, mount));
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
          publicMutation(asStudio(await bodyOrError(
            await projectRequest(`/projects/${projectId}/changes`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            }),
          )), origin, mount),
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
        "Submit idea-or-source Rule System materialization, a bounded natural-language Studio iteration, compilation, fixed-seed bot playtest, or build export work and return a durable job ID for tracking. Open a Build preview at the compile or read_build playableUrl; do not enqueue a preview job.",
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
          kind: z.literal("export-build"),
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
        return result(await publicJob(asJob(job), origin, creatorId, secret, mount));
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
        return result(await publicJob(asJob(job), origin, creatorId, secret, mount));
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
        return result(await publicJob(asJob(job), origin, creatorId, secret, mount));
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
        return result(await publicBuild(asBuild(build), origin, creatorId, secret, mount));
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
        return result(await publicSession(asSession(room), origin, creatorId, secret, mount));
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
        return result(await publicSession(asSession(room), origin, creatorId, secret, mount));
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
        return result(await publicSession(asSession(room), origin, creatorId, secret, mount));
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
          publicMutation(asStudio(await bodyOrError(
            await projectRequest(
              `/projects/${projectId}/rule-systems/${ruleSystemId}/duplicate`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(input),
              },
            ),
          )), origin, mount),
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
          publicMutation(asStudio(await bodyOrError(
            await projectRequest(
              `/projects/${projectId}/builds/${buildId}/restore`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(input),
              },
            ),
          )), origin, mount),
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
  const mount = request.headers.get("x-godesk-mount") ?? "/";
  return createMcpHandler(
    () =>
      createGodeskMcpServer(
        env,
        origin,
        creatorId,
        authentication,
        mount,
      ),
    { route: "/mcp" },
  );
}
