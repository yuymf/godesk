import { DurableObject } from "cloudflare:workers";
import {
  authorizeRequest,
  finishWebLogin,
  protectedResourceMetadata,
  requiredScopes,
  startWebLogin,
} from "./auth";
import { godeskMcpHandler } from "./mcp";
import {
  acceptIntent,
  executableRuntime,
  initialTableState,
  runBotSimulation,
} from "./runtime";
import type {
  ApplyProjectChangesInput,
  ApplyProjectChangesResult,
  Changeset,
  CompileBuildInput,
  CompileBuildResult,
  CreatorJob,
  CreatorJobKind,
  CreateProjectResult,
  DuplicateDefinitionResult,
  GameDefinition,
  GameProject,
  GameReplay,
  GameRoom,
  PlaytestRun,
  PlayableBuild,
  ProjectChangeOperation,
  SourceLibraryEntry,
  SubmitJobInput,
} from "../src/creator/project-contract";
import {
  instantiateDefaultExample,
  isDefaultExampleId,
} from "./default-examples";

const PROJECT_PREFIX = "/projects/";
const READ_ONLY_MCP_TOOLS = new Set([
  "list_projects",
  "read_project",
  "get_editor_url",
  "track_job",
  "read_build",
  "read_room",
  "read_replay",
]);

async function mcpScopes(request: Request) {
  if (request.method !== "POST") return ["godesk:read"];
  const payload = await request.clone().json<
    | { method?: string; params?: { name?: string } }
    | Array<{ method?: string; params?: { name?: string } }>
  >().catch(() => undefined);
  const messages = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const mutates = messages.some(
    (message) =>
      message.method === "tools/call" &&
      !READ_ONLY_MCP_TOOLS.has(String(message.params?.name)),
  );
  return mutates ? ["godesk:read", "godesk:write"] : ["godesk:read"];
}

interface ProjectRecord {
  project: GameProject;
  definition: GameDefinition;
  definitions: GameDefinition[];
  sources: SourceLibraryEntry[];
  changesets: Changeset[];
  builds: StoredPlayableBuild[];
  playtests: StoredPlaytest[];
  rooms: StoredRoom[];
  jobs: CreatorJob[];
}

type StoredPlayableBuild = Omit<PlayableBuild, "playableUrl">;
type StoredPlaytest = Omit<PlaytestRun, "replayUrl">;
type StoredRoom = Omit<GameRoom, "roomUrl" | "replayUrl">;
type StoredReplay = GameReplay;
type StoredCompileBuildResult = Omit<
  CompileBuildResult,
  "build" | "editorUrl"
> & {
  build: StoredPlayableBuild;
  editorPath: string;
};
type StoredApplyProjectChangesResult = Omit<
  ApplyProjectChangesResult,
  "editorUrl"
> & { editorPath: string };
type StoredDuplicateDefinitionResult = Omit<
  DuplicateDefinitionResult,
  "editorUrl"
> & { editorPath: string };

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function error(message: string, status: number) {
  return json({ error: message }, status);
}

function paginated<T>(
  values: T[],
  url: URL,
  key: string,
) {
  const cursor = Math.max(
    0,
    Number.parseInt(url.searchParams.get("cursor") ?? "0", 10) || 0,
  );
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
    ),
  );
  const items = values.slice(cursor, cursor + limit);
  const nextCursor =
    cursor + items.length < values.length ? cursor + items.length : null;
  return {
    [key]: items,
    page: { cursor, limit, nextCursor, total: values.length },
  };
}

function initialDefinition(id: string): GameDefinition {
  return {
    id,
    version: 1,
    name: "未命名初始版本",
    pitch: "",
    playerCount: 2,
    durationMinutes: 45,
    rules: [],
    components: [],
    setup: [],
    actions: [],
    board: { layout: "", zones: [] },
    phases: [],
    scenarios: [],
    presentation: { theme: "unassigned" },
    runtimeSupport: { status: "draft", unsupported: [] },
  };
}

function projectRecord(value: ProjectRecord | GameProject): ProjectRecord {
  if ("project" in value) return value;
  const definition = initialDefinition(value.activeDefinitionId);
  return {
    project: value,
    definition,
    definitions: [definition],
    sources: [],
    changesets: [],
    builds: [],
    playtests: [],
    rooms: [],
    jobs: [],
  };
}

function normalizedDefinition(
  definition: GameDefinition,
  fallbackVersion: number,
): GameDefinition {
  return {
    ...definition,
    version: definition.version ?? fallbackVersion,
    rules: (definition.rules ?? []).map((rule) => ({
      ...rule,
      provenance:
        rule.provenance ??
        (rule.sourceId ? "source-anchored" : "ai-proposed"),
      confidence: rule.confidence ?? (rule.sourceId ? 1 : 0.5),
    })),
    components: (definition.components ?? []).map((component) => ({
      ...component,
      provenance:
        component.provenance ??
        (component.sourceId ? "source-anchored" : "ai-proposed"),
      confidence: component.confidence ?? (component.sourceId ? 1 : 0.5),
    })),
    setup: definition.setup ?? [],
    actions: (definition.actions ?? []).map((action) => ({
      ...action,
      provenance:
        action.provenance ??
        (action.sourceId ? "source-anchored" : "ai-proposed"),
      confidence: action.confidence ?? (action.sourceId ? 1 : 0.5),
    })),
    board: definition.board ?? { layout: "", zones: [] },
    phases: definition.phases ?? [],
    scenarios: definition.scenarios ?? [],
    presentation: definition.presentation ?? { theme: "unassigned" },
  };
}

function normalizedBuild(build: StoredPlayableBuild): StoredPlayableBuild {
  return {
    ...build,
    definition: normalizedDefinition(
      build.definition,
      build.definitionVersion,
    ),
  };
}

function normalizedProjectRecord(value: ProjectRecord | GameProject) {
  const record = projectRecord(value);
  const definitions = (record.definitions ?? [record.definition]).map(
    (definition) =>
      normalizedDefinition(definition, record.project.version),
  );
  const definition =
    definitions.find(
      (candidate) => candidate.id === record.project.activeDefinitionId,
    ) ?? definitions[0];
  return {
    ...record,
    definition,
    definitions,
    project: {
      ...record.project,
      capabilities: {
        ...record.project.capabilities,
        compilation: "available" as const,
      },
    },
    builds: (record.builds ?? []).map(normalizedBuild),
    playtests: record.playtests ?? [],
    rooms: record.rooms ?? [],
    jobs: record.jobs ?? [],
  };
}

function validChangeRequest(value: unknown): value is ApplyProjectChangesInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<ApplyProjectChangesInput>;
  return (
    Number.isInteger(input.expectedVersion) &&
    typeof input.idempotencyKey === "string" &&
    input.idempotencyKey.length > 0 &&
    Array.isArray(input.operations) &&
    input.operations.length > 0 &&
    input.operations.length <= 20 &&
    input.operations.every(
      (operation) =>
        operation !== null &&
        typeof operation === "object" &&
        typeof (operation as { op?: unknown }).op === "string",
    )
  );
}

function applyOperation(
  record: ProjectRecord,
  operation: ProjectChangeOperation,
  affectedEntities: string[],
) {
  if (!operation || typeof operation !== "object") {
    throw new Error("unsupported_operation");
  }
  if (operation.op === "add_source") {
    const source = operation.source;
    if (
      !source ||
      !["brief", "rulebook", "image"].includes(source.kind) ||
      typeof source.name !== "string" ||
      !source.name.trim() ||
      typeof source.content !== "string" ||
      !source.provenance ||
      !["creator-authored", "creator-upload", "internal-fixture"].includes(
        source.provenance.origin,
      ) ||
      typeof source.provenance.locator !== "string"
    ) {
      throw new Error("invalid_source");
    }
    const entry: SourceLibraryEntry = {
      id: `source_${crypto.randomUUID()}`,
      kind: source.kind,
      name: source.name.trim().slice(0, 120),
      content: source.content.slice(0, 100_000),
      readiness: "ready",
      provenance: {
        origin: source.provenance.origin,
        locator: source.provenance.locator.slice(0, 500),
      },
      createdAt: new Date().toISOString(),
    };
    record.sources.push(entry);
    affectedEntities.push(`source:${entry.id}`);
    return;
  }

  if (operation.op === "update_definition") {
    const fields = operation.fields;
    if (
      !fields ||
      typeof fields !== "object" ||
      fields.name !== undefined &&
      (typeof fields.name !== "string" || !fields.name.trim())
    ) {
      throw new Error("invalid_definition");
    }
    if (
      fields.pitch !== undefined &&
      typeof fields.pitch !== "string"
    ) {
      throw new Error("invalid_definition");
    }
    if (
      fields.playerCount !== undefined &&
      (!Number.isInteger(fields.playerCount) ||
        fields.playerCount < 1 ||
        fields.playerCount > 20)
    ) {
      throw new Error("invalid_definition");
    }
    if (
      fields.durationMinutes !== undefined &&
      (!Number.isInteger(fields.durationMinutes) ||
        fields.durationMinutes < 5 ||
        fields.durationMinutes > 720)
    ) {
      throw new Error("invalid_definition");
    }
    const validAnchor = (
      item: {
        sourceId: string | null;
        provenance: string;
        confidence: number;
      },
    ) =>
      (item.sourceId === null || typeof item.sourceId === "string") &&
      ["source-anchored", "system-generated", "ai-proposed"].includes(
        item.provenance,
      ) &&
      typeof item.confidence === "number" &&
      item.confidence >= 0 &&
      item.confidence <= 1;
    if (
      fields.rules !== undefined &&
      (!Array.isArray(fields.rules) ||
        fields.rules.length > 500 ||
        fields.rules.some(
          (rule) =>
            !rule ||
            typeof rule.id !== "string" ||
            !rule.id ||
            typeof rule.text !== "string" ||
            !validAnchor(rule),
        ))
    ) {
      throw new Error("invalid_definition");
    }
    if (
      fields.components !== undefined &&
      (!Array.isArray(fields.components) ||
        fields.components.length > 500 ||
        fields.components.some(
          (component) =>
            !component ||
            typeof component.id !== "string" ||
            !component.id ||
            typeof component.name !== "string" ||
            !Number.isInteger(component.quantity) ||
            component.quantity < 1 ||
            !validAnchor(component),
        ))
    ) {
      throw new Error("invalid_definition");
    }
    if (
      fields.setup !== undefined &&
      (!Array.isArray(fields.setup) ||
        fields.setup.length > 200 ||
        fields.setup.some((step) => typeof step !== "string"))
    ) {
      throw new Error("invalid_definition");
    }
    if (
      fields.actions !== undefined &&
      (!Array.isArray(fields.actions) ||
        fields.actions.length > 500 ||
        fields.actions.some(
          (action) =>
            !action ||
            typeof action.id !== "string" ||
            !action.id ||
            typeof action.label !== "string" ||
            typeof action.description !== "string" ||
            !validAnchor(action),
        ))
    ) {
      throw new Error("invalid_definition");
    }
    if (
      fields.board !== undefined &&
      (!fields.board ||
        typeof fields.board.layout !== "string" ||
        !Array.isArray(fields.board.zones) ||
        fields.board.zones.length > 500 ||
        fields.board.zones.some(
          (zone) =>
            !zone ||
            typeof zone.id !== "string" ||
            !zone.id ||
            typeof zone.name !== "string" ||
            typeof zone.description !== "string",
        ))
    ) {
      throw new Error("invalid_definition");
    }
    const validNamedList = (items: Array<{ id: string; name: string }>) =>
      items.length <= 500 &&
      items.every(
        (item) =>
          item &&
          typeof item.id === "string" &&
          Boolean(item.id) &&
          typeof item.name === "string",
      );
    if (
      (fields.phases !== undefined &&
        (!Array.isArray(fields.phases) || !validNamedList(fields.phases))) ||
      (fields.scenarios !== undefined &&
        (!Array.isArray(fields.scenarios) ||
          !validNamedList(fields.scenarios))) ||
      (fields.presentation !== undefined &&
        (!fields.presentation ||
          typeof fields.presentation.theme !== "string"))
    ) {
      throw new Error("invalid_definition");
    }
    record.definition = {
      ...record.definition,
      ...(fields.name === undefined
        ? {}
        : { name: fields.name.trim().slice(0, 120) }),
      ...(fields.pitch === undefined
        ? {}
        : { pitch: fields.pitch.trim().slice(0, 2_000) }),
      ...(fields.playerCount === undefined
        ? {}
        : { playerCount: fields.playerCount }),
      ...(fields.durationMinutes === undefined
        ? {}
        : { durationMinutes: fields.durationMinutes }),
      ...(fields.rules === undefined
        ? {}
        : { rules: structuredClone(fields.rules) }),
      ...(fields.components === undefined
        ? {}
        : { components: structuredClone(fields.components) }),
      ...(fields.setup === undefined
        ? {}
        : { setup: structuredClone(fields.setup) }),
      ...(fields.actions === undefined
        ? {}
        : { actions: structuredClone(fields.actions) }),
      ...(fields.board === undefined
        ? {}
        : { board: structuredClone(fields.board) }),
      ...(fields.phases === undefined
        ? {}
        : { phases: structuredClone(fields.phases) }),
      ...(fields.scenarios === undefined
        ? {}
        : { scenarios: structuredClone(fields.scenarios) }),
      ...(fields.presentation === undefined
        ? {}
        : { presentation: structuredClone(fields.presentation) }),
    };
    affectedEntities.push(`definition:${record.definition.id}`);
    return;
  }

  if (operation.op === "configure_score_race") {
    const { config } = operation;
    if (
      !config ||
      typeof config !== "object" ||
      !Number.isInteger(config.victoryTarget) ||
      config.victoryTarget < 1 ||
      config.victoryTarget > 1_000 ||
      !Number.isInteger(config.maxTurns) ||
      config.maxTurns < 1 ||
      config.maxTurns > 1_000 ||
      !Array.isArray(config.actions) ||
      config.actions.length < 1 ||
      config.actions.length > 12 ||
      config.actions.some(
        (action) =>
          !action ||
          typeof action.id !== "string" ||
          !/^[a-z0-9-]{1,40}$/.test(action.id) ||
          typeof action.label !== "string" ||
          !action.label.trim() ||
          !Number.isInteger(action.points) ||
          action.points < 1 ||
          action.points > 100,
      )
    ) {
      throw new Error("invalid_runtime");
    }
    if (new Set(config.actions.map((action) => action.id)).size !== config.actions.length) {
      throw new Error("invalid_runtime");
    }
    const runtimeSource: SourceLibraryEntry = {
      id: `source_${crypto.randomUUID()}`,
      kind: "brief",
      name: `${record.definition.name} · score-race-v1 配置`,
      content: JSON.stringify(config),
      readiness: "ready",
      provenance: {
        origin: "system-generated",
        locator: "configure_score_race operation",
        confidence: 1,
      },
      createdAt: new Date().toISOString(),
    };
    record.sources.push(runtimeSource);
    record.definition = {
      ...record.definition,
      rules: [
        {
          id: "runtime-turn-order",
          text: "玩家按座位顺序轮流选择一个可用行动并获得对应分数。",
          sourceId: runtimeSource.id,
          provenance: "system-generated",
          confidence: 1,
        },
        {
          id: "runtime-victory",
          text: `率先达到 ${config.victoryTarget} 分者获胜；若 ${config.maxTurns} 回合仍无人达到，则最高分获胜。`,
          sourceId: runtimeSource.id,
          provenance: "system-generated",
          confidence: 1,
        },
      ],
      components: [
        {
          id: "runtime-score-track",
          name: "分数轨道与玩家标记",
          quantity: record.definition.playerCount,
          sourceId: runtimeSource.id,
          provenance: "system-generated",
          confidence: 1,
        },
      ],
      setup: ["将分数轨道置于所有玩家可见的位置。", "每位玩家选择一个座位标记。"],
      actions: config.actions.map((action) => ({
        id: action.id,
        label: action.label.trim().slice(0, 80),
        description: `获得 ${action.points} 分。`,
        sourceId: runtimeSource.id,
        provenance: "system-generated" as const,
        confidence: 1,
      })),
      board: {
        layout: "shared-score-track",
        zones: [
          {
            id: "score-track",
            name: "分数轨道",
            description: "记录所有座位当前得分。",
          },
        ],
      },
      phases: [{ id: "runtime-turns", name: "轮流行动" }],
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "score-race-v1",
          victoryTarget: config.victoryTarget,
          maxTurns: config.maxTurns,
          actions: config.actions.map((action) => ({
            ...action,
            label: action.label.trim().slice(0, 80),
          })),
        },
      },
    };
    affectedEntities.push(`source:${runtimeSource.id}`);
    affectedEntities.push(`runtime:${record.definition.id}`);
    return;
  }

  if (operation.op === "activate_definition") {
    if (typeof operation.definitionId !== "string") {
      throw new Error("invalid_definition");
    }
    const definition = record.definitions.find(
      (candidate) => candidate.id === operation.definitionId,
    );
    if (!definition) throw new Error("invalid_definition");
    record.definition = structuredClone(definition);
    record.project = {
      ...record.project,
      activeDefinitionId: definition.id,
    };
    affectedEntities.push(`active-definition:${definition.id}`);
    return;
  }

  throw new Error("unsupported_operation");
}

function proposedAffectedEntities(
  definitionId: string,
  operations: ProjectChangeOperation[],
) {
  return operations.map((operation) => {
    if (operation.op === "add_source") return "source:new";
    if (operation.op === "configure_score_race") {
      return `runtime:${definitionId}`;
    }
    if (operation.op === "activate_definition") {
      return `active-definition:${operation.definitionId}`;
    }
    return `definition:${definitionId}`;
  });
}

async function buildId(
  projectId: string,
  definitionVersion: number,
  definition: GameDefinition,
  sourceIds: string[],
) {
  const input = JSON.stringify({
    projectId,
    definitionVersion,
    definition,
    sourceIds,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `build_${hex.slice(0, 24)}`;
}

function referencedSourceIds(definition: GameDefinition) {
  return [
    ...new Set(
      [...definition.rules, ...definition.components, ...definition.actions]
        .map((entry) => entry.sourceId)
        .filter((sourceId): sourceId is string => Boolean(sourceId)),
    ),
  ].sort();
}

function buildWarnings(record: ProjectRecord) {
  const referencedIds = referencedSourceIds(record.definition);
  const availableIds = new Set(record.sources.map((source) => source.id));
  return [
    ...(record.definition.rules.length
      ? []
      : ["Game Definition 还没有结构化规则。"]),
    ...(record.definition.components.length
      ? []
      : ["Game Definition 还没有组件清单。"]),
    ...(referencedIds.length
      ? []
      : ["规则与组件尚未锚定 Source Library，当前规则事实无法追溯。"]),
    ...(referencedIds.some((sourceId) => !availableIds.has(sourceId))
      ? ["Game Definition 引用了不存在的 Source Library 条目。"]
      : []),
  ];
}

function publicBuild(build: StoredPlayableBuild, origin: string): PlayableBuild {
  const normalized = normalizedBuild(build);
  return {
    ...normalized,
    playableUrl: new URL(`/play/${normalized.id}`, origin).toString(),
  };
}

function publicPlaytest(
  playtest: StoredPlaytest,
  origin: string,
): PlaytestRun {
  return {
    ...playtest,
    replayUrl: new URL(`/replay/${playtest.replayId}`, origin).toString(),
  };
}

function publicRoom(room: StoredRoom, origin: string): GameRoom {
  return {
    ...room,
    roomUrl: new URL(`/room/${room.id}`, origin).toString(),
    replayUrl: new URL(`/replay/${room.replayId}`, origin).toString(),
  };
}

function publicMutation<
  T extends { editorPath: string },
>(value: T, origin: string): Omit<T, "editorPath"> & { editorUrl: string } {
  const { editorPath, ...rest } = value;
  return {
    ...rest,
    editorUrl: new URL(editorPath, origin).toString(),
  };
}

function reconstructActions(
  build: StoredPlayableBuild,
  acceptedActions: GameReplay["acceptedActions"],
) {
  const runtime = executableRuntime(build.definition);
  if (!runtime) throw new Error("runtime_not_executable");
  let state = initialTableState(build.definition.playerCount);
  const reconstructed = acceptedActions.map((logged, index) => {
    const accepted = acceptIntent(
      state,
      runtime,
      {
        intentId: logged.intentId,
        seat: logged.seat,
        actionId: logged.actionId,
      },
      index + 1,
    );
    if (!accepted) throw new Error("action_log_invalid");
    state = accepted.state;
    return accepted;
  });
  return { state, acceptedActions: reconstructed };
}

function reconstructRoom(
  room: StoredRoom,
  build: StoredPlayableBuild,
): StoredRoom {
  const reconstructed = reconstructActions(build, room.acceptedActions);
  return {
    ...room,
    state: reconstructed.state,
    acceptedActions: reconstructed.acceptedActions,
  };
}

function reconstructReplay(
  replay: StoredReplay,
  build: StoredPlayableBuild,
): StoredReplay {
  const reconstructed = reconstructActions(build, replay.acceptedActions);
  return {
    ...replay,
    initialState: initialTableState(build.definition.playerCount),
    acceptedActions: reconstructed.acceptedActions,
    finalState: reconstructed.state,
  };
}

function publicJob(job: CreatorJob, origin: string): CreatorJob {
  if (!job.result) return job;
  if (job.kind === "compile-build" && job.result.build) {
    const build = publicBuild(
      job.result.build as unknown as StoredPlayableBuild,
      origin,
    );
    return {
      ...job,
      result: {
        ...job.result,
        build,
        warnings: build.warnings,
        editorUrl: new URL(
          `/editor/${job.projectId}`,
          origin,
        ).toString(),
      },
    };
  }
  if (
    job.kind === "generate-definition" &&
    typeof job.result.editorPath === "string"
  ) {
    const { editorPath, ...result } = job.result;
    return {
      ...job,
      result: {
        ...result,
        editorUrl: new URL(editorPath, origin).toString(),
      },
    };
  }
  if (job.kind === "bot-playtest") {
    return {
      ...job,
      result: {
        ...job.result,
        replayUrl: new URL(
          `/replay/${String(job.result.replayId)}`,
          origin,
        ).toString(),
      },
    };
  }
  if (job.kind === "render-preview") {
    return {
      ...job,
      result: {
        ...job.result,
        previewUrl: new URL(
          `/play/${String(job.result.buildId)}`,
          origin,
        ).toString(),
      },
    };
  }
  return {
    ...job,
    result: {
      ...job.result,
      artifactUrl: new URL(`/api/jobs/${job.id}/artifact`, origin).toString(),
    },
  };
}

export class CreatorProjects extends DurableObject<Env> {
  private async saveJob(job: CreatorJob, input?: SubmitJobInput) {
    const projectKey = `${PROJECT_PREFIX}${job.projectId}`;
    const stored =
      await this.ctx.storage.get<ProjectRecord | GameProject>(projectKey);
    const values: Record<string, unknown> = {
      [`job:${job.id}`]: job,
      [`job-idempotency:${job.projectId}:${job.idempotencyKey}`]: job,
    };
    if (input) values[`job-input:${job.id}`] = input;
    if (stored) {
      const record = normalizedProjectRecord(stored);
      record.jobs = [
        job,
        ...record.jobs.filter((candidate) => candidate.id !== job.id),
      ];
      values[projectKey] = record;
    }
    await this.ctx.storage.put(values);
  }

  private async schedulePendingJobRecovery() {
    const jobs = await this.ctx.storage.list<CreatorJob>({ prefix: "job:" });
    const pending = [...jobs.values()].some(
      (job) => job.status === "queued" || job.status === "running",
    );
    if (pending) {
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  private async runJob(jobId: string, submittedInput?: SubmitJobInput) {
    let job = await this.ctx.storage.get<CreatorJob>(`job:${jobId}`);
    if (!job || job.status === "succeeded" || job.status === "failed") return;
    if (
      job.status === "running" &&
      Date.now() - Date.parse(job.updatedAt) < 25_000
    ) {
      return;
    }
    const input =
      submittedInput ??
      await this.ctx.storage.get<SubmitJobInput>(`job-input:${jobId}`);
    if (!input) {
      job = {
        ...job,
        status: "failed",
        error: "job_input_missing",
        updatedAt: new Date().toISOString(),
      };
      await this.saveJob(job);
      await this.schedulePendingJobRecovery();
      return;
    }
    job = { ...job, status: "running", updatedAt: new Date().toISOString() };
    await this.saveJob(job);
    await this.ctx.storage.setAlarm(Date.now() + 30_000);

    try {
      let operation: Response;
      if (input.kind === "generate-definition") {
        operation = await this.fetch(
          new Request(
            `https://projects.internal/projects/${job.projectId}/changes`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                expectedVersion: input.expectedVersion,
                idempotencyKey: `job:${input.idempotencyKey}`,
                operations: [
                  {
                    op: "add_source",
                    source: {
                      kind: "brief",
                      name: `${input.name?.trim() || "生成任务"} brief`,
                      content: input.brief,
                      provenance: {
                        origin: "creator-authored",
                        locator: `generation job ${job.id}`,
                      },
                    },
                  },
                  {
                    op: "update_definition",
                    fields: {
                      ...(input.name ? { name: input.name } : {}),
                      pitch: input.brief,
                      ...(input.playerCount
                        ? { playerCount: input.playerCount }
                        : {}),
                      ...(input.durationMinutes
                        ? { durationMinutes: input.durationMinutes }
                        : {}),
                    },
                  },
                ],
              }),
            },
          ),
        );
      } else if (input.kind === "compile-build") {
        operation = await this.fetch(
          new Request(
            `https://projects.internal/projects/${job.projectId}/builds`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                expectedVersion: input.expectedVersion,
                idempotencyKey: `job:${input.idempotencyKey}`,
              }),
            },
          ),
        );
      } else if (input.kind === "bot-playtest") {
        operation = await this.fetch(
          new Request(
            `https://projects.internal/builds/${input.buildId}/playtests`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                seed: input.seed,
                idempotencyKey: `job:${input.idempotencyKey}`,
              }),
            },
          ),
        );
      } else {
        const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
          `build:${input.buildId}`,
        );
        const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
        operation =
          build && build.projectId === job.projectId
            ? json({ buildId: build.id })
            : error("build_not_found", 404);
      }
      const operationBody = await operation.json<Record<string, unknown>>();
      if (operation.ok && input.kind === "generate-definition") {
        operationBody.generationMode = "deterministic-brief-materialization";
        operationBody.warnings = [
          "此任务只把 brief 持久化为可编辑 Definition；复杂规则解释仍由 Codex 提案并经受控 patch 接受。",
        ];
      }
      job = operation.ok
        ? {
            ...job,
            status: "succeeded",
            result: operationBody,
            updatedAt: new Date().toISOString(),
          }
        : {
            ...job,
            status: "failed",
            error: String(operationBody.error ?? `http_${operation.status}`),
            updatedAt: new Date().toISOString(),
          };
    } catch (reason) {
      job = {
        ...job,
        status: "failed",
        error: reason instanceof Error ? reason.message : "job_failed",
        updatedAt: new Date().toISOString(),
      };
    }
    await this.saveJob(job);
    await this.schedulePendingJobRecovery();
  }

  async alarm() {
    const jobs = await this.ctx.storage.list<CreatorJob>({ prefix: "job:" });
    for (const job of [...jobs.values()].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    )) {
      if (job.status === "queued" || job.status === "running") {
        await this.runJob(job.id);
      }
    }
    await this.schedulePendingJobRecovery();
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/projects") {
      const input = await request.json<{
        name?: unknown;
        authentication?: unknown;
        templateId?: unknown;
      }>();
      if (typeof input.name !== "string" || !input.name.trim()) {
        return error("项目名称不能为空。", 400);
      }
      if (input.templateId !== undefined && !isDefaultExampleId(input.templateId)) {
        return error("没有这个默认案例。", 400);
      }

      const now = new Date().toISOString();
      const projectId = `project_${crypto.randomUUID()}`;
      const definitionId = `definition_${crypto.randomUUID()}`;
      const project: GameProject = {
        id: projectId,
        name: input.name.trim().slice(0, 80),
        version: 1,
        activeDefinitionId: definitionId,
        createdAt: now,
        updatedAt: now,
        capabilities: {
          authentication:
            input.authentication === "oauth"
              ? "oauth"
              : "local-development-only",
          compilation: "available",
          persistence: "durable-object",
        },
      };
      const example = input.templateId
        ? instantiateDefaultExample(input.templateId, definitionId, now)
        : undefined;
      const definition = example?.definition ?? initialDefinition(definitionId);
      const record: ProjectRecord = {
        project,
        definition,
        definitions: [definition],
        sources: example?.sources ?? [],
        changesets: [],
        builds: [],
        playtests: [],
        rooms: [],
        jobs: [],
      };
      await this.ctx.storage.put(`${PROJECT_PREFIX}${project.id}`, record);
      return json(project, 201);
    }

    const duplicateMatch = url.pathname.match(/^\/projects\/([^/]+)\/duplicate$/);
    if (request.method === "POST" && duplicateMatch) {
      const input = await request.json<{
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        name?: unknown;
      }>().catch(() => ({
        expectedVersion: undefined,
        idempotencyKey: undefined,
        name: undefined,
      }));
      if (
        !Number.isInteger(input.expectedVersion) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey ||
        typeof input.name !== "string" ||
        !input.name.trim()
      ) {
        return error("复制请求无效。", 400);
      }
      const sourceKey = `${PROJECT_PREFIX}${duplicateMatch[1]}`;
      const idempotencyKey =
        `idempotency:${duplicateMatch[1]}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existing = await transaction.get<GameProject>(idempotencyKey);
        if (existing) return { status: 201, value: existing };
        const stored =
          await transaction.get<ProjectRecord | GameProject>(sourceKey);
        if (!stored) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const source = normalizedProjectRecord(stored);
        if (source.project.version !== input.expectedVersion) {
          return {
            status: 409,
            value: {
              error: "version_conflict",
              currentVersion: source.project.version,
              affectedEntities: [`project:${source.project.id}`],
              currentState: {
                project: source.project,
                definition: source.definition,
              },
            },
          };
        }
        const now = new Date().toISOString();
        const projectId = `project_${crypto.randomUUID()}`;
        const definitionId = `definition_${crypto.randomUUID()}`;
        const project: GameProject = {
          ...source.project,
          id: projectId,
          name: String(input.name).trim().slice(0, 80),
          version: 1,
          activeDefinitionId: definitionId,
          createdAt: now,
          updatedAt: now,
        };
        const record: ProjectRecord = {
          project,
          definition: {
            ...structuredClone(source.definition),
            id: definitionId,
          },
          definitions: [{
            ...structuredClone(source.definition),
            id: definitionId,
          }],
          sources: structuredClone(source.sources),
          changesets: [],
          builds: [],
          playtests: [],
          rooms: [],
          jobs: [],
        };
        await transaction.put({
          [`${PROJECT_PREFIX}${projectId}`]: record,
          [idempotencyKey]: project,
        });
        return { status: 201, value: project };
      });
      return json(outcome.value, outcome.status);
    }

    const duplicateDefinitionMatch = url.pathname.match(
      /^\/projects\/([^/]+)\/definitions\/([^/]+)\/duplicate$/,
    );
    if (request.method === "POST" && duplicateDefinitionMatch) {
      const input = await request.json<{
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        name?: unknown;
      }>().catch((): {
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        name?: unknown;
      } => ({}));
      if (
        !Number.isInteger(input.expectedVersion) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey ||
        typeof input.name !== "string" ||
        !input.name.trim()
      ) {
        return error("Definition 复制请求无效。", 400);
      }
      const projectId = duplicateDefinitionMatch[1];
      const definitionId = duplicateDefinitionMatch[2];
      const definitionName = input.name.trim().slice(0, 120);
      const projectKey = `${PROJECT_PREFIX}${projectId}`;
      const idempotencyKey =
        `definition-duplicate:${projectId}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existing =
          await transaction.get<StoredDuplicateDefinitionResult>(idempotencyKey);
        if (existing) return { status: 201, value: existing };
        const stored =
          await transaction.get<ProjectRecord | GameProject>(projectKey);
        if (!stored) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(stored);
        const source = record.definitions.find(
          (definition) => definition.id === definitionId,
        );
        if (!source) {
          return { status: 404, value: { error: "definition_not_found" } };
        }
        if (record.project.version !== input.expectedVersion) {
          return {
            status: 409,
            value: {
              error: "version_conflict",
              currentVersion: record.project.version,
              affectedEntities: [`definition:${definitionId}`],
              currentState: {
                project: record.project,
                definition: record.definition,
                definitions: record.definitions,
              },
            },
          };
        }
        const now = new Date().toISOString();
        const definition: GameDefinition = {
          ...structuredClone(source),
          id: `definition_${crypto.randomUUID()}`,
          version: 1,
          name: definitionName,
        };
        const previousVersion = record.project.version;
        record.project = {
          ...record.project,
          activeDefinitionId: definition.id,
          version: previousVersion + 1,
          updatedAt: now,
        };
        record.definition = definition;
        record.definitions = [...record.definitions, definition];
        const changeset: Changeset = {
          id: `changeset_${crypto.randomUUID()}`,
          previousVersion,
          newVersion: record.project.version,
          affectedEntities: [
            `definition:${definition.id}`,
            `active-definition:${definition.id}`,
          ],
          createdAt: now,
        };
        record.changesets.push(changeset);
        const result: StoredDuplicateDefinitionResult = {
          project: record.project,
          definition,
          definitions: record.definitions,
          changeset,
          warnings: buildWarnings(record),
          editorPath: `/editor/${record.project.id}`,
        };
        await transaction.put({
          [projectKey]: record,
          [idempotencyKey]: result,
        });
        return { status: 201, value: result };
      });
      return json(outcome.value, outcome.status);
    }

    const deleteMatch = url.pathname.match(/^\/projects\/([^/]+)$/);
    if (request.method === "DELETE" && deleteMatch) {
      const input = await request.json<{
        expectedVersion?: unknown;
        confirmationProjectId?: unknown;
        idempotencyKey?: unknown;
      }>().catch(() => ({
        expectedVersion: undefined,
        confirmationProjectId: undefined,
        idempotencyKey: undefined,
      }));
      if (
        !Number.isInteger(input.expectedVersion) ||
        input.confirmationProjectId !== deleteMatch[1] ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey
      ) {
        return error("删除请求需要精确项目 ID、版本和幂等键。", 400);
      }
      const projectKey = `${PROJECT_PREFIX}${deleteMatch[1]}`;
      const deletionKey = `deletion:${deleteMatch[1]}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const deleted = await transaction.get<{ deletedProjectId: string }>(
          deletionKey,
        );
        if (deleted) return { status: 200, value: deleted };
        const stored =
          await transaction.get<ProjectRecord | GameProject>(projectKey);
        if (!stored) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(stored);
        if (record.project.version !== input.expectedVersion) {
          return {
            status: 409,
            value: {
              error: "version_conflict",
              currentVersion: record.project.version,
              affectedEntities: [`project:${record.project.id}`],
              currentState: {
                project: record.project,
                definition: record.definition,
              },
            },
          };
        }
        const idempotencyLists = await Promise.all([
          transaction.list({ prefix: `idempotency:${record.project.id}:` }),
          transaction.list({
            prefix: `definition-duplicate:${record.project.id}:`,
          }),
          ...record.builds.flatMap((build) => [
            transaction.list({ prefix: `playtest:${build.id}:` }),
            transaction.list({ prefix: `room:${build.id}:` }),
          ]),
        ]);
        await transaction.delete([
          projectKey,
          ...record.builds.map((build) => `build:${build.id}`),
          ...record.playtests.flatMap((playtest) => [
            `playtest:${playtest.id}`,
            `replay:${playtest.replayId}`,
          ]),
          ...record.rooms.flatMap((room) => [
            `room:${room.id}`,
            `replay:${room.replayId}`,
          ]),
          ...record.jobs.flatMap((job) => [
            `job:${job.id}`,
            `job-input:${job.id}`,
            `job-idempotency:${job.projectId}:${job.idempotencyKey}`,
          ]),
          ...idempotencyLists.flatMap((entries) => [...entries.keys()]),
        ]);
        const value = { deletedProjectId: record.project.id };
        await transaction.put(deletionKey, value);
        return { status: 200, value };
      });
      return json(outcome.value, outcome.status);
    }

    const changeMatch = url.pathname.match(/^\/projects\/([^/]+)\/changes$/);
    if (request.method === "POST" && changeMatch) {
      const input = await request.json().catch(() => undefined);
      if (!validChangeRequest(input)) {
        return error("变更请求无效。", 400);
      }

      const projectKey = `${PROJECT_PREFIX}${changeMatch[1]}`;
      const idempotencyKey = `idempotency:${changeMatch[1]}:${input.idempotencyKey}`;
      try {
        const outcome = await this.ctx.storage.transaction(async (transaction) => {
          const existingResult =
            await transaction.get<StoredApplyProjectChangesResult>(
              idempotencyKey,
            );
          if (existingResult) {
            return { status: 200, value: existingResult };
          }

          const stored =
            await transaction.get<ProjectRecord | GameProject>(projectKey);
          if (!stored) {
            return { status: 404, value: { error: "project_not_found" } };
          }
          const record = normalizedProjectRecord(stored);
          if (record.project.version !== input.expectedVersion) {
            return {
              status: 409,
              value: {
                error: "version_conflict",
                currentVersion: record.project.version,
                affectedEntities: proposedAffectedEntities(
                  record.definition.id,
                  input.operations,
                ),
                currentState: {
                  project: record.project,
                  definition: record.definition,
                  sources: record.sources,
                },
              },
            };
          }

          const affectedEntities: string[] = [];
          for (const operation of input.operations) {
            applyOperation(record, operation, affectedEntities);
          }
          if (
            input.operations.some(
              (operation) =>
                operation.op === "update_definition" ||
                operation.op === "configure_score_race",
            )
          ) {
            record.definition = {
              ...record.definition,
              version: record.definition.version + 1,
            };
          }
          record.definitions = record.definitions.map((definition) =>
            definition.id === record.definition.id
              ? record.definition
              : definition
          );
          const previousVersion = record.project.version;
          const now = new Date().toISOString();
          record.project = {
            ...record.project,
            version: previousVersion + 1,
            updatedAt: now,
          };
          const changeset: Changeset = {
            id: `changeset_${crypto.randomUUID()}`,
            previousVersion,
            newVersion: record.project.version,
            affectedEntities,
            createdAt: now,
          };
          record.changesets.push(changeset);
          const result: StoredApplyProjectChangesResult = {
            project: record.project,
            definition: record.definition,
            sources: record.sources,
            changeset,
            warnings: buildWarnings(record),
            editorPath: `/editor/${record.project.id}`,
          };
          await transaction.put({
            [projectKey]: record,
            [idempotencyKey]: result,
          });
          return { status: 200, value: result };
        });
        return json(outcome.value, outcome.status);
      } catch (reason) {
        if (
          reason instanceof Error &&
          [
            "invalid_source",
            "invalid_definition",
            "invalid_runtime",
            "unsupported_operation",
          ].includes(reason.message)
        ) {
          return error("变更内容无效。", 400);
        }
        throw reason;
      }
    }

    const submitJobMatch = url.pathname.match(/^\/projects\/([^/]+)\/jobs$/);
    if (request.method === "POST" && submitJobMatch) {
      const input: {
        kind?: unknown;
        expectedVersion?: unknown;
        buildId?: unknown;
        seed?: unknown;
        brief?: unknown;
        name?: unknown;
        playerCount?: unknown;
        durationMinutes?: unknown;
        idempotencyKey?: unknown;
      } = await request.json().catch(() => ({})) as {
        kind?: unknown;
        expectedVersion?: unknown;
        buildId?: unknown;
        seed?: unknown;
        brief?: unknown;
        name?: unknown;
        playerCount?: unknown;
        durationMinutes?: unknown;
        idempotencyKey?: unknown;
      };
      const projectId = submitJobMatch[1];
      const validKind = [
        "generate-definition",
        "compile-build",
        "bot-playtest",
        "render-preview",
        "export-build",
      ].includes(String(input.kind));
      const validBuildInput =
        input.kind === "bot-playtest" ||
        input.kind === "render-preview" ||
        input.kind === "export-build";
      if (
        !validKind ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey ||
        ((input.kind === "compile-build" ||
          input.kind === "generate-definition") &&
          !Number.isInteger(input.expectedVersion)) ||
        (input.kind === "generate-definition" &&
          (typeof input.brief !== "string" ||
            !input.brief.trim() ||
            input.brief.length > 100_000 ||
            (input.name !== undefined &&
              (typeof input.name !== "string" || !input.name.trim())) ||
            (input.playerCount !== undefined &&
              (!Number.isInteger(input.playerCount) ||
                Number(input.playerCount) < 1 ||
                Number(input.playerCount) > 20)) ||
            (input.durationMinutes !== undefined &&
              (!Number.isInteger(input.durationMinutes) ||
                Number(input.durationMinutes) < 5 ||
                Number(input.durationMinutes) > 720)))) ||
        (validBuildInput &&
          (typeof input.buildId !== "string" || !input.buildId)) ||
        (input.kind === "bot-playtest" && !Number.isInteger(input.seed))
      ) {
        return error("任务请求无效。", 400);
      }

      const projectKey = `${PROJECT_PREFIX}${projectId}`;
      const jobIdempotencyKey =
        `job-idempotency:${projectId}:${input.idempotencyKey}`;
      let job = await this.ctx.storage.get<CreatorJob>(jobIdempotencyKey);
      if (job?.status === "succeeded" || job?.status === "failed") {
        return json(job, 202);
      }
      const acceptedInput = input as SubmitJobInput;

      const stored =
        await this.ctx.storage.get<ProjectRecord | GameProject>(projectKey);
      if (!stored) return error("没有找到这个 Game Project。", 404);
      const now = new Date().toISOString();
      job ??= {
        id: `job_${crypto.randomUUID()}`,
        projectId,
        kind: input.kind as CreatorJobKind,
        status: "queued",
        idempotencyKey: input.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      };
      await this.saveJob(job, acceptedInput);
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
      this.ctx.waitUntil(this.runJob(job.id, acceptedInput));
      return json(job, 202);
    }

    const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)$/);
    if (request.method === "GET" && jobMatch) {
      const job = await this.ctx.storage.get<CreatorJob>(`job:${jobMatch[1]}`);
      return job ? json(job) : error("没有找到这个任务。", 404);
    }

    const retryJobMatch = url.pathname.match(/^\/jobs\/([^/]+)\/retry$/);
    if (request.method === "POST" && retryJobMatch) {
      let job = await this.ctx.storage.get<CreatorJob>(
        `job:${retryJobMatch[1]}`,
      );
      if (!job) return error("没有找到这个任务。", 404);
      if (job.status === "succeeded") return json(job, 202);
      const input = await this.ctx.storage.get<SubmitJobInput>(
        `job-input:${job.id}`,
      );
      if (!input) return error("任务输入已丢失，不能安全重试。", 409);
      job = {
        ...job,
        status: "queued",
        result: undefined,
        error: undefined,
        updatedAt: new Date().toISOString(),
      };
      await this.saveJob(job, input);
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
      this.ctx.waitUntil(this.runJob(job.id, input));
      return json(job, 202);
    }

    const jobArtifactMatch = url.pathname.match(/^\/jobs\/([^/]+)\/artifact$/);
    if (request.method === "GET" && jobArtifactMatch) {
      const job = await this.ctx.storage.get<CreatorJob>(
        `job:${jobArtifactMatch[1]}`,
      );
      if (
        !job ||
        job.kind !== "export-build" ||
        job.status !== "succeeded" ||
        typeof job.result?.buildId !== "string"
      ) {
        return error("导出物尚不可用。", 404);
      }
      const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
        `build:${job.result.buildId}`,
      );
      const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
      if (!build) return error("build_not_found", 404);
      return new Response(JSON.stringify(build, null, 2), {
        headers: {
          "content-disposition": `attachment; filename="${build.id}.godesk.json"`,
          "content-type": "application/json; charset=utf-8",
        },
      });
    }

    const compileMatch = url.pathname.match(/^\/projects\/([^/]+)\/builds$/);
    if (request.method === "POST" && compileMatch) {
      const input = await request.json().catch(() => undefined) as
        | Partial<CompileBuildInput>
        | undefined;
      if (
        !input ||
        !Number.isInteger(input.expectedVersion) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey
      ) {
        return error("编译请求无效。", 400);
      }

      const projectKey = `${PROJECT_PREFIX}${compileMatch[1]}`;
      const idempotencyKey =
        `idempotency:${compileMatch[1]}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existingResult =
          await transaction.get<StoredCompileBuildResult>(idempotencyKey);
        if (existingResult) return { status: 201, value: existingResult };

        const stored =
          await transaction.get<ProjectRecord | GameProject>(projectKey);
        if (!stored) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(stored);
        if (record.project.version !== input.expectedVersion) {
          return {
            status: 409,
            value: {
              error: "version_conflict",
              currentVersion: record.project.version,
              affectedEntities: [`build:${record.definition.id}`],
              currentState: {
                project: record.project,
                definition: record.definition,
              },
            },
          };
        }

        const sourceIds = referencedSourceIds(record.definition);
        const id = await buildId(
          record.project.id,
          record.definition.version,
          record.definition,
          sourceIds,
        );
        const existingBuild = record.builds.find(
          (candidate) => candidate.id === id,
        );
        if (existingBuild) {
          const existingChangeset =
            [...record.changesets].reverse().find((changeset) =>
              changeset.affectedEntities.includes(`build:${id}`)
            ) ?? {
              id: `changeset_existing_${id}`,
              previousVersion: record.project.version,
              newVersion: record.project.version,
              affectedEntities: [`build:${id}`],
              createdAt: existingBuild.createdAt,
            };
          const result: StoredCompileBuildResult = {
            project: record.project,
            build: existingBuild,
            changeset: existingChangeset,
            warnings: existingBuild.warnings,
            editorPath: `/editor/${record.project.id}`,
          };
          await transaction.put(idempotencyKey, result);
          return { status: 200, value: result };
        }
        const now = new Date().toISOString();
        const build: StoredPlayableBuild = {
          id,
          projectId: record.project.id,
          definitionId: record.definition.id,
          definitionVersion: record.definition.version,
          definition: structuredClone(record.definition),
          sourceIds,
          warnings: buildWarnings(record),
          unsupportedBehavior: [
            ...record.definition.runtimeSupport.unsupported,
            ...(record.definition.runtimeSupport.status === "executable"
              ? []
              : ["rule-execution"]),
          ],
          createdAt: now,
        };
        const previousVersion = record.project.version;
        record.project = {
          ...record.project,
          version: previousVersion + 1,
          updatedAt: now,
        };
        const changeset: Changeset = {
          id: `changeset_${crypto.randomUUID()}`,
          previousVersion,
          newVersion: record.project.version,
          affectedEntities: [`build:${build.id}`],
          createdAt: now,
        };
        record.changesets.push(changeset);
        if (!record.builds.some((candidate) => candidate.id === build.id)) {
          record.builds.push(build);
        }
        const result: StoredCompileBuildResult = {
          project: record.project,
          build,
          changeset,
          warnings: build.warnings,
          editorPath: `/editor/${record.project.id}`,
        };
        await transaction.put({
          [projectKey]: record,
          [`build:${build.id}`]: build,
          [idempotencyKey]: result,
        });
        return { status: 201, value: result };
      });
      return json(outcome.value, outcome.status);
    }

    const buildMatch = url.pathname.match(/^\/builds\/([^/]+)$/);
    if (request.method === "GET" && buildMatch) {
      const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
        `build:${buildMatch[1]}`,
      );
      return storedBuild
        ? json(normalizedBuild(storedBuild))
        : error("没有找到这个 Playable Build。", 404);
    }

    const playtestCreateMatch = url.pathname.match(
      /^\/builds\/([^/]+)\/playtests$/,
    );
    if (request.method === "POST" && playtestCreateMatch) {
      const input = await request.json<{
        seed?: unknown;
        idempotencyKey?: unknown;
      }>().catch(() => ({ seed: undefined, idempotencyKey: undefined }));
      if (
        !Number.isInteger(input.seed) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey
      ) {
        return error("试玩请求需要整数 seed 和幂等键。", 400);
      }
      const idempotencyKey =
        `playtest:${playtestCreateMatch[1]}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existing = await transaction.get<StoredPlaytest>(idempotencyKey);
        if (existing) return { status: 201, value: existing };
        const storedBuild = await transaction.get<StoredPlayableBuild>(
          `build:${playtestCreateMatch[1]}`,
        );
        const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
        if (!build) {
          return { status: 404, value: { error: "build_not_found" } };
        }
        if (!executableRuntime(build.definition)) {
          return {
            status: 422,
            value: { error: "runtime_not_executable" },
          };
        }
        const simulation = runBotSimulation(
          build.definition,
          Number(input.seed),
        );
        const now = new Date().toISOString();
        const replayId = `replay_${crypto.randomUUID()}`;
        const playtest: StoredPlaytest = {
          id: `playtest_${crypto.randomUUID()}`,
          projectId: build.projectId,
          buildId: build.id,
          seed: Number(input.seed),
          evidenceType: "automated-bot-simulation",
          terminalStatus: simulation.terminalStatus,
          metrics: {
            turns: simulation.finalState.turn,
            winnerSeat: simulation.finalState.winnerSeat,
            finalScores: simulation.finalState.scores,
          },
          replayId,
          createdAt: now,
        };
        const replay: StoredReplay = {
          id: replayId,
          projectId: build.projectId,
          buildId: build.id,
          seed: Number(input.seed),
          evidenceType: "automated-bot-simulation",
          initialState: simulation.initialState,
          acceptedActions: simulation.acceptedActions,
          finalState: simulation.finalState,
          createdAt: now,
        };
        const projectKey = `${PROJECT_PREFIX}${build.projectId}`;
        const storedProject =
          await transaction.get<ProjectRecord | GameProject>(projectKey);
        if (!storedProject) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(storedProject);
        record.playtests.push(playtest);
        await transaction.put({
          [projectKey]: record,
          [`playtest:${playtest.id}`]: playtest,
          [`replay:${replay.id}`]: replay,
          [idempotencyKey]: playtest,
        });
        return { status: 201, value: playtest };
      });
      return json(outcome.value, outcome.status);
    }

    const roomCreateMatch = url.pathname.match(/^\/builds\/([^/]+)\/rooms$/);
    if (request.method === "POST" && roomCreateMatch) {
      const input = await request.json<{
        seed?: unknown;
        idempotencyKey?: unknown;
      }>().catch(() => ({ seed: undefined, idempotencyKey: undefined }));
      if (
        !Number.isInteger(input.seed) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey
      ) {
        return error("房间请求需要整数 seed 和幂等键。", 400);
      }
      const idempotencyKey =
        `room:${roomCreateMatch[1]}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existing = await transaction.get<StoredRoom>(idempotencyKey);
        if (existing) return { status: 201, value: existing };
        const storedBuild = await transaction.get<StoredPlayableBuild>(
          `build:${roomCreateMatch[1]}`,
        );
        const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
        if (!build) {
          return { status: 404, value: { error: "build_not_found" } };
        }
        if (!executableRuntime(build.definition)) {
          return {
            status: 422,
            value: { error: "runtime_not_executable" },
          };
        }
        const now = new Date().toISOString();
        const replayId = `replay_${crypto.randomUUID()}`;
        const state = initialTableState(build.definition.playerCount);
        const room: StoredRoom = {
          id: `room_${crypto.randomUUID()}`,
          projectId: build.projectId,
          buildId: build.id,
          seed: Number(input.seed),
          state,
          acceptedActions: [],
          replayId,
          createdAt: now,
        };
        const replay: StoredReplay = {
          id: replayId,
          projectId: build.projectId,
          buildId: build.id,
          seed: Number(input.seed),
          evidenceType: "room-action-log",
          initialState: state,
          acceptedActions: [],
          finalState: state,
          createdAt: now,
        };
        const projectKey = `${PROJECT_PREFIX}${build.projectId}`;
        const storedProject =
          await transaction.get<ProjectRecord | GameProject>(projectKey);
        if (!storedProject) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(storedProject);
        record.rooms.push(room);
        await transaction.put({
          [projectKey]: record,
          [`room:${room.id}`]: room,
          [`replay:${replay.id}`]: replay,
          [idempotencyKey]: room,
        });
        return { status: 201, value: room };
      });
      return json(outcome.value, outcome.status);
    }

    const roomIntentMatch = url.pathname.match(/^\/rooms\/([^/]+)\/intents$/);
    if (request.method === "POST" && roomIntentMatch) {
      const input = await request.json<{
        intentId?: unknown;
        seat?: unknown;
        actionId?: unknown;
      }>().catch(() => ({
        intentId: undefined,
        seat: undefined,
        actionId: undefined,
      }));
      if (
        typeof input.intentId !== "string" ||
        !input.intentId ||
        !Number.isInteger(input.seat) ||
        typeof input.actionId !== "string" ||
        !input.actionId
      ) {
        return error("行动意图无效。", 400);
      }
      const roomKey = `room:${roomIntentMatch[1]}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const storedRoom = await transaction.get<StoredRoom>(roomKey);
        if (!storedRoom) {
          return { status: 404, value: { error: "room_not_found" } };
        }
        const storedBuild = await transaction.get<StoredPlayableBuild>(
          `build:${storedRoom.buildId}`,
        );
        const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
        const runtime = build && executableRuntime(build.definition);
        if (!build || !runtime) {
          return {
            status: 422,
            value: { error: "runtime_not_executable" },
          };
        }
        const room = reconstructRoom(storedRoom, build);
        if (
          room.acceptedActions.some(
            (action) => action.intentId === input.intentId,
          )
        ) {
          return { status: 200, value: room };
        }
        const accepted = acceptIntent(
          room.state,
          runtime,
          {
            intentId: String(input.intentId),
            seat: Number(input.seat),
            actionId: String(input.actionId),
          },
          room.acceptedActions.length + 1,
        );
        if (!accepted) {
          return {
            status: 409,
            value: { error: "intent_rejected", state: room.state },
          };
        }
        const updatedRoom: StoredRoom = {
          ...room,
          state: accepted.state,
          acceptedActions: [...room.acceptedActions, accepted],
        };
        const replay = await transaction.get<StoredReplay>(
          `replay:${room.replayId}`,
        );
        if (!replay) {
          return { status: 500, value: { error: "replay_not_found" } };
        }
        const updatedReplay: StoredReplay = {
          ...replay,
          acceptedActions: updatedRoom.acceptedActions,
          finalState: updatedRoom.state,
        };
        const projectKey = `${PROJECT_PREFIX}${room.projectId}`;
        const storedProject =
          await transaction.get<ProjectRecord | GameProject>(projectKey);
        if (!storedProject) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(storedProject);
        record.rooms = record.rooms.map((candidate) =>
          candidate.id === updatedRoom.id ? updatedRoom : candidate,
        );
        await transaction.put({
          [roomKey]: updatedRoom,
          [`replay:${room.replayId}`]: updatedReplay,
          [projectKey]: record,
        });
        return { status: 200, value: updatedRoom };
      });
      return json(outcome.value, outcome.status);
    }

    const playtestMatch = url.pathname.match(/^\/playtests\/([^/]+)$/);
    if (request.method === "GET" && playtestMatch) {
      const playtest = await this.ctx.storage.get<StoredPlaytest>(
        `playtest:${playtestMatch[1]}`,
      );
      return playtest ? json(playtest) : error("没有找到这个试玩。", 404);
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);
    if (request.method === "GET" && roomMatch) {
      const room = await this.ctx.storage.get<StoredRoom>(
        `room:${roomMatch[1]}`,
      );
      if (!room) return error("没有找到这个房间。", 404);
      const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
        `build:${room.buildId}`,
      );
      const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
      if (!build) return error("房间引用的 Build 不存在。", 500);
      return json(reconstructRoom(room, build));
    }

    const replayMatch = url.pathname.match(/^\/replays\/([^/]+)$/);
    if (request.method === "GET" && replayMatch) {
      const replay = await this.ctx.storage.get<StoredReplay>(
        `replay:${replayMatch[1]}`,
      );
      if (!replay) return error("没有找到这个回放。", 404);
      const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
        `build:${replay.buildId}`,
      );
      const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
      if (!build) return error("回放引用的 Build 不存在。", 500);
      return json(reconstructReplay(replay, build));
    }

    if (request.method === "GET" && url.pathname.startsWith(PROJECT_PREFIX)) {
      const stored = await this.ctx.storage.get<ProjectRecord | GameProject>(
        url.pathname,
      );
      if (!stored) return error("没有找到这个 Game Project。", 404);
      const record = normalizedProjectRecord(stored);
      if (!url.searchParams.has("view")) return json(record.project);
      const view = url.searchParams.get("view");
      if (view === "definition") return json(record.definition);
      if (view === "rules") {
        return json(paginated(record.definition.rules, url, "rules"));
      }
      if (view === "components") {
        return json(
          paginated(record.definition.components, url, "components"),
        );
      }
      if (view === "board") return json(record.definition.board);
      if (view === "scenarios") {
        return json(
          paginated(record.definition.scenarios, url, "scenarios"),
        );
      }
      if (view === "entity") {
        const entityType = url.searchParams.get("entityType");
        const entityId = url.searchParams.get("entityId");
        if (!entityType || !entityId) {
          return error("entity 视图需要 entityType 和 entityId。", 400);
        }
        const collections: Record<string, Array<{ id: string }>> = {
          source: record.sources,
          rule: record.definition.rules,
          component: record.definition.components,
          scenario: record.definition.scenarios,
          build: record.builds,
          playtest: record.playtests,
          room: record.rooms,
          job: record.jobs,
        };
        const entity = collections[entityType]?.find(
          (candidate) => candidate.id === entityId,
        );
        return entity ? json(entity) : error("没有找到这个项目实体。", 404);
      }
      if (view === "definitions") {
        return json(paginated(record.definitions, url, "definitions"));
      }
      if (view === "sources") {
        return json(paginated(record.sources, url, "sources"));
      }
      if (view === "changesets") {
        return json(paginated(record.changesets, url, "changesets"));
      }
      if (view === "builds") {
        return json(paginated(record.builds, url, "builds"));
      }
      if (view === "playtests") {
        return json(paginated(record.playtests, url, "playtests"));
      }
      if (view === "rooms") {
        const rooms = record.rooms.map((room) => {
          const build = record.builds.find(
            (candidate) => candidate.id === room.buildId,
          );
          return build ? reconstructRoom(room, build) : room;
        });
        return json(paginated(rooms, url, "rooms"));
      }
      if (view === "jobs") {
        return json(paginated(record.jobs, url, "jobs"));
      }
      return error("没有这个项目视图。", 400);
    }

    if (request.method === "GET" && url.pathname === "/projects") {
      const entries = await this.ctx.storage.list<ProjectRecord | GameProject>({
        prefix: PROJECT_PREFIX,
      });
      return json({
        projects: [...entries.values()]
          .map((entry) => normalizedProjectRecord(entry).project)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      });
    }

    return error("没有这个项目操作。", 404);
  }
}

async function projectApi(
  request: Request,
  env: Env,
  creatorId: string,
  authentication: "local-development-only" | "oauth",
) {
  const url = new URL(request.url);
  const stub = env.CREATOR_PROJECTS.getByName(creatorId);

  if (request.method === "POST" && url.pathname === "/api/projects") {
    const input = await request
      .json<{ name?: unknown; templateId?: unknown }>()
      .catch(() => ({
        name: undefined,
        templateId: undefined,
      }));
    const response = await stub.fetch(
      new Request("https://projects.internal/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          templateId: input.templateId,
          authentication,
        }),
      }),
    );
    if (!response.ok) return response;
    const project = await response.json<GameProject>();
    const result: CreateProjectResult = {
      project,
      editorUrl: new URL(`/editor/${project.id}`, url.origin).toString(),
      warnings: input.templateId
        ? []
        : ["新项目尚未包含来源、结构化规则或组件。"],
    };
    return json(result, 201);
  }

  if (request.method === "GET" && url.pathname === "/api/projects") {
    return stub.fetch("https://projects.internal/projects");
  }

  const duplicateMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/duplicate$/,
  );
  if (request.method === "POST" && duplicateMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal${PROJECT_PREFIX}${duplicateMatch[1]}/duplicate`,
        request,
      ),
    );
    if (!response.ok) return response;
    const project = await response.json<GameProject>();
    return json(
      {
        project,
        editorUrl: new URL(`/editor/${project.id}`, url.origin).toString(),
        warnings: [],
      } satisfies CreateProjectResult,
      response.status,
    );
  }

  const duplicateDefinitionMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/definitions\/([^/]+)\/duplicate$/,
  );
  if (request.method === "POST" && duplicateDefinitionMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/projects/${duplicateDefinitionMatch[1]}/definitions/${duplicateDefinitionMatch[2]}/duplicate`,
        request,
      ),
    );
    if (!response.ok) return response;
    return json(
      publicMutation(
        await response.json<StoredDuplicateDefinitionResult>(),
        url.origin,
      ),
      response.status,
    );
  }

  const deleteMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (request.method === "DELETE" && deleteMatch) {
    return stub.fetch(
      new Request(
        `https://projects.internal${PROJECT_PREFIX}${deleteMatch[1]}`,
        request,
      ),
    );
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/projects/")) {
    const id = url.pathname.slice("/api/projects/".length);
    const internalUrl = new URL(
      `https://projects.internal${PROJECT_PREFIX}${id}`,
    );
    internalUrl.search = url.search;
    const response = await stub.fetch(internalUrl);
    if (!response.ok) return response;
    const view = url.searchParams.get("view");
    if (view === "builds") {
      const body = await response.json<{
        builds: StoredPlayableBuild[];
        page: unknown;
      }>();
      return json({
        ...body,
        builds: body.builds.map((build) => publicBuild(build, url.origin)),
      });
    }
    if (view === "playtests") {
      const body = await response.json<{ playtests: StoredPlaytest[] }>();
      return json({
        ...body,
        playtests: body.playtests.map((playtest) =>
          publicPlaytest(playtest, url.origin),
        ),
      });
    }
    if (view === "rooms") {
      const body = await response.json<{ rooms: StoredRoom[] }>();
      return json({
        ...body,
        rooms: body.rooms.map((room) => publicRoom(room, url.origin)),
      });
    }
    if (view === "jobs") {
      const body = await response.json<{ jobs: CreatorJob[] }>();
      return json({
        ...body,
        jobs: body.jobs.map((job) => publicJob(job, url.origin)),
      });
    }
    return response;
  }

  const changeMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/changes$/);
  if (request.method === "POST" && changeMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal${PROJECT_PREFIX}${changeMatch[1]}/changes`,
        request,
      ),
    );
    if (!response.ok) return response;
    return json(
      publicMutation(
        await response.json<StoredApplyProjectChangesResult>(),
        url.origin,
      ),
      response.status,
    );
  }

  const submitJobMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/jobs$/,
  );
  if (request.method === "POST" && submitJobMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/projects/${submitJobMatch[1]}/jobs`,
        request,
      ),
    );
    if (!response.ok) return response;
    return json(
      publicJob(await response.json<CreatorJob>(), url.origin),
      response.status,
    );
  }

  const jobArtifactMatch = url.pathname.match(
    /^\/api\/jobs\/([^/]+)\/artifact$/,
  );
  if (request.method === "GET" && jobArtifactMatch) {
    return stub.fetch(
      `https://projects.internal/jobs/${jobArtifactMatch[1]}/artifact`,
    );
  }

  const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (request.method === "GET" && jobMatch) {
    const response = await stub.fetch(
      `https://projects.internal/jobs/${jobMatch[1]}`,
    );
    if (!response.ok) return response;
    return json(publicJob(await response.json<CreatorJob>(), url.origin));
  }

  const retryJobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/retry$/);
  if (request.method === "POST" && retryJobMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/jobs/${retryJobMatch[1]}/retry`,
        request,
      ),
    );
    if (!response.ok) return response;
    return json(
      publicJob(await response.json<CreatorJob>(), url.origin),
      response.status,
    );
  }

  const compileMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/builds$/);
  if (request.method === "POST" && compileMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal${PROJECT_PREFIX}${compileMatch[1]}/builds`,
        request,
      ),
    );
    if (!response.ok) return response;
    const result = await response.json<StoredCompileBuildResult>();
    return json(
      publicMutation({
        ...result,
        build: publicBuild(result.build, url.origin),
      }, url.origin),
      response.status,
    );
  }

  const buildMatch = url.pathname.match(/^\/api\/builds\/([^/]+)$/);
  if (request.method === "GET" && buildMatch) {
    const response = await stub.fetch(
      `https://projects.internal/builds/${buildMatch[1]}`,
    );
    if (!response.ok) return response;
    const build = await response.json<StoredPlayableBuild>();
    return json(publicBuild(build, url.origin));
  }

  const playtestCreateMatch = url.pathname.match(
    /^\/api\/builds\/([^/]+)\/playtests$/,
  );
  if (request.method === "POST" && playtestCreateMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/builds/${playtestCreateMatch[1]}/playtests`,
        request,
      ),
    );
    if (!response.ok) return response;
    const playtest = await response.json<StoredPlaytest>();
    return json(publicPlaytest(playtest, url.origin), response.status);
  }

  const roomCreateMatch = url.pathname.match(
    /^\/api\/builds\/([^/]+)\/rooms$/,
  );
  if (request.method === "POST" && roomCreateMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/builds/${roomCreateMatch[1]}/rooms`,
        request,
      ),
    );
    if (!response.ok) return response;
    const room = await response.json<StoredRoom>();
    return json(publicRoom(room, url.origin), response.status);
  }

  const roomIntentMatch = url.pathname.match(
    /^\/api\/rooms\/([^/]+)\/intents$/,
  );
  if (request.method === "POST" && roomIntentMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/rooms/${roomIntentMatch[1]}/intents`,
        request,
      ),
    );
    if (!response.ok) return response;
    const room = await response.json<StoredRoom>();
    return json(publicRoom(room, url.origin), response.status);
  }

  const playtestMatch = url.pathname.match(/^\/api\/playtests\/([^/]+)$/);
  if (request.method === "GET" && playtestMatch) {
    const response = await stub.fetch(
      `https://projects.internal/playtests/${playtestMatch[1]}`,
    );
    if (!response.ok) return response;
    return json(
      publicPlaytest(await response.json<StoredPlaytest>(), url.origin),
    );
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (request.method === "GET" && roomMatch) {
    const response = await stub.fetch(
      `https://projects.internal/rooms/${roomMatch[1]}`,
    );
    if (!response.ok) return response;
    return json(publicRoom(await response.json<StoredRoom>(), url.origin));
  }

  const replayMatch = url.pathname.match(/^\/api\/replays\/([^/]+)$/);
  if (request.method === "GET" && replayMatch) {
    return stub.fetch(
      `https://projects.internal/replays/${replayMatch[1]}`,
    );
  }

  return error("没有这个 API。", 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (
      url.pathname === "/.well-known/oauth-protected-resource" ||
      url.pathname === "/.well-known/oauth-protected-resource/mcp"
    ) {
      return protectedResourceMetadata(request, env);
    }
    if (url.pathname === "/login") {
      return startWebLogin(request, env);
    }
    if (url.pathname === "/oauth/callback") {
      return finishWebLogin(request, env);
    }
    if (url.pathname === "/mcp") {
      const identity = await authorizeRequest(
        request,
        env,
        await mcpScopes(request),
      );
      if (identity instanceof Response) return identity;
      return godeskMcpHandler(
        request,
        env,
        identity.creatorId,
        identity.mode === "oauth" ? "oauth" : "local-development-only",
      )(
        request,
        env,
        ctx,
      );
    }
    if (url.pathname.startsWith("/api/")) {
      const identity = await authorizeRequest(
        request,
        env,
        requiredScopes(request),
      );
      if (identity instanceof Response) return identity;
      return projectApi(
        request,
        env,
        identity.creatorId,
        identity.mode === "oauth" ? "oauth" : "local-development-only",
      );
    }
    if (
      url.pathname === "/" ||
      /^\/(editor|play|room|replay)\//.test(url.pathname)
    ) {
      const identity = await authorizeRequest(request, env, ["godesk:read"]);
      if (identity instanceof Response) {
        const login = new URL("/login", url.origin);
        login.searchParams.set("returnTo", `${url.pathname}${url.search}`);
        return Response.redirect(login, 302);
      }
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
