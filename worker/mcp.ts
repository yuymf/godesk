import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import { isDefaultExampleId } from "./default-examples";

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int(),
  activeDefinitionId: z.string(),
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

const definitionSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  name: z.string(),
  pitch: z.string(),
  playerCount: z.number().int(),
  durationMinutes: z.number().int(),
  rules: z.array(z.object({
    id: z.string(),
    text: z.string(),
    sourceId: z.string().nullable(),
    provenance: z.enum(["source-anchored", "system-generated", "ai-proposed"]),
    confidence: z.number().min(0).max(1),
  })),
  components: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().int().positive(),
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
  board: z.object({
    layout: z.string(),
    zones: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      image: boundImageSchema.optional(),
    })),
  }),
  phases: z.array(z.object({ id: z.string(), name: z.string() })),
  scenarios: z.array(z.object({ id: z.string(), name: z.string() })),
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
          type: z.literal("harbor-voyage-v1"),
          playerCount: z.number().int().min(2).max(3),
        }),
      ]),
    }),
  ]),
});

const sourceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  content: z.string(),
  readiness: z.string(),
  provenance: z.object({
    origin: z.string(),
    locator: z.string(),
    confidence: z.number().min(0).max(1).optional(),
  }),
  createdAt: z.string(),
});

const changesetSchema = z.object({
  id: z.string(),
  previousVersion: z.number().int(),
  newVersion: z.number().int(),
  affectedEntities: z.array(z.string()),
  createdAt: z.string(),
});

const buildSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  definitionId: z.string(),
  definitionVersion: z.number().int(),
  definition: definitionSchema,
  sourceIds: z.array(z.string()),
  warnings: z.array(z.string()),
  unsupportedBehavior: z.array(z.string()),
  createdAt: z.string(),
  playableUrl: z.string(),
});

const tableStateSchema = z.object({
  turn: z.number().int(),
  activeSeat: z.number().int(),
  scores: z.array(z.number().int()),
  status: z.enum(["active", "complete"]),
  winnerSeat: z.number().int().nullable(),
});

const acceptedActionSchema = z.object({
  sequence: z.number().int(),
  intentId: z.string(),
  seat: z.number().int(),
  actionId: z.string(),
  points: z.number().int(),
  state: tableStateSchema,
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
  }),
  replayId: z.string(),
  createdAt: z.string(),
  replayUrl: z.string(),
});

const roomSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  buildId: z.string(),
  seed: z.number().int(),
  state: tableStateSchema,
  acceptedActions: z.array(acceptedActionSchema),
  replayId: z.string(),
  createdAt: z.string(),
  roomUrl: z.string(),
  replayUrl: z.string(),
});

const replaySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  buildId: z.string(),
  seed: z.number().int(),
  evidenceType: z.enum(["automated-bot-simulation", "room-action-log"]),
  initialState: tableStateSchema,
  acceptedActions: z.array(acceptedActionSchema),
  finalState: tableStateSchema,
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
  definition: definitionSchema,
  sources: z.array(sourceSchema),
  changeset: changesetSchema,
  warnings: z.array(z.string()),
  editorUrl: z.string(),
});

const compileResultSchema = z.object({
  project: projectSchema,
  build: buildSchema,
  changeset: changesetSchema,
  warnings: z.array(z.string()),
  editorUrl: z.string(),
});

const jobSchema = z.union([
  jobBaseSchema.extend({
    kind: z.literal("generate-definition"),
    result: mutationResultSchema.extend({
      generationMode: z.literal("deterministic-brief-materialization"),
    }).optional(),
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
    view: z.literal("definition"),
    data: definitionSchema,
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("rules"),
    data: z.object({
      rules: definitionSchema.shape.rules,
      page: pageSchema,
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("components"),
    data: z.object({
      components: definitionSchema.shape.components,
      page: pageSchema,
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("board"),
    data: definitionSchema.shape.board,
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("scenarios"),
    data: z.object({
      scenarios: definitionSchema.shape.scenarios,
      page: pageSchema,
    }),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("entity"),
    data: z.union([
      sourceSchema,
      definitionSchema.shape.rules.element,
      definitionSchema.shape.components.element,
      definitionSchema.shape.scenarios.element,
      buildSchema,
      playtestSchema,
      roomSchema,
      jobSchema,
    ]),
  }),
  z.object({
    projectId: z.string(),
    view: z.literal("definitions"),
    data: z.object({
      definitions: z.array(definitionSchema),
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
    view: z.literal("rooms"),
    data: z.object({ rooms: z.array(roomSchema), page: pageSchema }),
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
      }),
    }),
  }),
  z.object({
    op: z.literal("update_definition"),
    fields: z.object({
      name: z.string().min(1).max(120).optional(),
      pitch: z.string().max(2_000).optional(),
      playerCount: z.number().int().min(1).max(20).optional(),
      durationMinutes: z.number().int().min(5).max(720).optional(),
      rules: definitionSchema.shape.rules.max(500).optional(),
      components: definitionSchema.shape.components.max(500).optional(),
      setup: definitionSchema.shape.setup.max(200).optional(),
      actions: definitionSchema.shape.actions.max(500).optional(),
      board: definitionSchema.shape.board.optional(),
      phases: definitionSchema.shape.phases.max(500).optional(),
      scenarios: definitionSchema.shape.scenarios.max(500).optional(),
      presentation: definitionSchema.shape.presentation.optional(),
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
    }),
  }),
  z.object({
    op: z.literal("activate_definition"),
    definitionId: z.string().min(1),
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

function editorUrl(origin: string, projectId: string) {
  return new URL(`/editor/${projectId}`, origin).toString();
}

function playableBuild(value: JsonObject, origin: string) {
  return {
    ...value,
    playableUrl: new URL(`/play/${String(value.id)}`, origin).toString(),
  };
}

function playablePlaytest(value: JsonObject, origin: string) {
  return {
    ...value,
    replayUrl: new URL(`/replay/${String(value.replayId)}`, origin).toString(),
  };
}

function playableRoom(value: JsonObject, origin: string) {
  return {
    ...value,
    roomUrl: new URL(`/room/${String(value.id)}`, origin).toString(),
    replayUrl: new URL(`/replay/${String(value.replayId)}`, origin).toString(),
  };
}

function playableJob(value: JsonObject, origin: string) {
  const job = { ...value };
  const jobResult = value.result as JsonObject | undefined;
  if (!jobResult) return job;
  if (value.kind === "generate-definition") {
    job.result = playableMutation(jobResult, origin);
  } else if (value.kind === "compile-build" && jobResult.build) {
    job.result = playableMutation({
      ...jobResult,
      build: playableBuild(jobResult.build as JsonObject, origin),
    }, origin);
  } else if (value.kind === "bot-playtest") {
    job.result = playablePlaytest(jobResult, origin);
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
  const editorPath = String(result.editorPath ?? "");
  delete result.editorPath;
  result.editorUrl = new URL(editorPath || "/", origin).toString();
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
    version: "0.1.0",
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
        "Create one authoritative Game Project and return its exact Web Editor URL.",
      inputSchema: z.object({
        name: z.string().min(1).max(80),
        templateId: z.enum(["harbor-13", "mistpeak-lodge"]).optional(),
      }),
      outputSchema: z.object({
        project: projectSchema,
        editorUrl: z.string(),
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
          editorUrl: editorUrl(origin, String(project.id)),
          warnings: templateId
            ? []
            : ["新项目尚未包含来源、结构化规则或组件。"],
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
            "definition",
            "rules",
            "components",
            "board",
            "scenarios",
            "entity",
            "definitions",
            "sources",
            "changesets",
            "builds",
            "playtests",
            "rooms",
            "jobs",
          ])
          .default("overview"),
        entityType: z
          .enum([
            "source",
            "rule",
            "component",
            "scenario",
            "build",
            "playtest",
            "room",
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
          data.builds = data.builds.map((build: unknown) =>
            playableBuild(build as JsonObject, origin),
          );
        }
        if (view === "playtests" && Array.isArray(data.playtests)) {
          data.playtests = data.playtests.map((playtest: unknown) =>
            playablePlaytest(playtest as JsonObject, origin),
          );
        }
        if (view === "rooms" && Array.isArray(data.rooms)) {
          data.rooms = data.rooms.map((room: unknown) =>
            playableRoom(room as JsonObject, origin),
          );
        }
        if (view === "jobs" && Array.isArray(data.jobs)) {
          data.jobs = data.jobs.map((job: unknown) =>
            playableJob(job as JsonObject, origin),
          );
        }
        if (view === "entity") {
          if (entityType === "build") {
            Object.assign(data, playableBuild(data, origin));
          } else if (entityType === "playtest") {
            Object.assign(data, playablePlaytest(data, origin));
          } else if (entityType === "room") {
            Object.assign(data, playableRoom(data, origin));
          } else if (entityType === "job") {
            Object.assign(data, playableJob(data, origin));
          }
        }
        return result({ projectId, view, data });
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "get_editor_url",
    {
      title: "Open the exact GoDesk editor",
      description:
        "Verify a project exists and return the exact visible Web Editor URL.",
      inputSchema: z.object({ projectId: z.string().min(1) }),
      outputSchema: z.object({
        projectId: z.string(),
        editorUrl: z.string(),
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
        return result({ projectId, editorUrl: editorUrl(origin, projectId) });
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "apply_game_patch",
    {
      title: "Apply a versioned GoDesk patch",
      description:
        "Atomically add traceable sources or update the active Game Definition. Stale expectedVersion values apply nothing.",
      inputSchema: z.object({
        projectId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        idempotencyKey: z.string().min(1).max(200),
        operations: z.array(operationSchema).min(1).max(20),
      }),
      outputSchema: z.object({
        project: projectSchema,
        definition: definitionSchema,
        sources: z.array(sourceSchema),
        changeset: changesetSchema,
        warnings: z.array(z.string()),
        editorUrl: z.string(),
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
        "Submit brief materialization, compilation, fixed-seed bot playtest, preview render, or build export work and return a durable job ID for tracking.",
      inputSchema: z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("generate-definition"),
          projectId: z.string().min(1),
          expectedVersion: z.number().int().positive(),
          brief: z.string().min(1).max(100_000).optional(),
          sourceContent: z.string().min(1).max(100_000).optional(),
          sourceName: z.string().min(1).max(120).optional(),
          sourceKind: z.enum(["brief", "rulebook"]).optional(),
          harvestedImages: z.array(z.object({
            name: z.string().min(1).max(120),
            content: z.string()
              .regex(/^data:image\/(?:png|jpe?g|webp);base64,/)
              .max(100_000),
            pageNumber: z.number().int().positive(),
          })).max(8).optional(),
          name: z.string().min(1).max(120).optional(),
          playerCount: z.number().int().min(1).max(20).optional(),
          durationMinutes: z.number().int().min(5).max(720).optional(),
          idempotencyKey: z.string().min(1).max(200),
        }).refine(
          (input) => Boolean(input.brief || input.sourceContent),
          { message: "brief or sourceContent is required" },
        ),
        z.object({
          kind: z.literal("compile-build"),
          projectId: z.string().min(1),
          expectedVersion: z.number().int().positive(),
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
        return result(playableJob(job, origin));
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
        return result(playableJob(job, origin));
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
        return result(playableJob(job, origin));
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
        return result(playableBuild(build, origin));
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "create_room",
    {
      title: "Create an authoritative GoDesk room",
      description:
        "Create a reconnectable room from one immutable executable build.",
      inputSchema: z.object({
        buildId: z.string().min(1),
        seed: z.number().int(),
        idempotencyKey: z.string().min(1).max(200),
      }),
      outputSchema: roomSchema,
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
          await projectRequest(`/builds/${buildId}/rooms`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          }),
        );
        return result(playableRoom(room, origin));
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "read_room",
    {
      title: "Reconnect to a GoDesk room",
      description:
        "Read authoritative Table State and the accepted Action Log for a room.",
      inputSchema: z.object({ roomId: z.string().min(1) }),
      outputSchema: roomSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ roomId }) => {
      try {
        const room = await bodyOrError(
          await projectRequest(`/rooms/${roomId}`),
        );
        return result(playableRoom(room, origin));
      } catch (reason) {
        return toolError(reason);
      }
    },
  );

  server.registerTool(
    "submit_room_intent",
    {
      title: "Submit a validated GoDesk room intent",
      description:
        "Submit one player intent. Only a legal active-seat action enters the authoritative Action Log.",
      inputSchema: z.object({
        roomId: z.string().min(1),
        intentId: z.string().min(1).max(200),
        seat: z.number().int().nonnegative(),
        actionId: z.string().min(1).max(40),
      }),
      outputSchema: roomSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ roomId, ...input }) => {
      try {
        const room = await bodyOrError(
          await projectRequest(`/rooms/${roomId}/intents`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          }),
        );
        return result(playableRoom(room, origin));
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
        "Read an immutable replay snapshot. This tool has no live-room mutation path.",
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
    "duplicate_definition",
    {
      title: "Duplicate a GoDesk Game Definition",
      description:
        "Branch one Game Definition inside the same project, keep shared sources, and make the new variant active.",
      inputSchema: z.object({
        projectId: z.string().min(1),
        definitionId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        idempotencyKey: z.string().min(1).max(200),
        name: z.string().min(1).max(120),
      }),
      outputSchema: z.object({
        project: projectSchema,
        definition: definitionSchema,
        definitions: z.array(definitionSchema),
        changeset: changesetSchema,
        warnings: z.array(z.string()),
        editorUrl: z.string(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, definitionId, ...input }) => {
      try {
        return result(
          playableMutation(await bodyOrError(
            await projectRequest(
              `/projects/${projectId}/definitions/${definitionId}/duplicate`,
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
        "Copy the current definition and sources into a new project without copying builds.",
      inputSchema: z.object({
        projectId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        idempotencyKey: z.string().min(1).max(200),
        name: z.string().min(1).max(80),
      }),
      outputSchema: z.object({
        project: projectSchema,
        editorUrl: z.string(),
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
          editorUrl: editorUrl(origin, String(project.id)),
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
