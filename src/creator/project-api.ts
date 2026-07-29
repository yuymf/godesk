import type {
  ApplyProjectChangesInput,
  ApplyProjectChangesResult,
  Changeset,
  CreatorJob,
  CreateProjectResult,
  DuplicateDefinitionResult,
  GameDefinition,
  GameProject,
  GameReplay,
  GameRoom,
  PlaytestRun,
  PlayableBuild,
  SourceLibraryEntry,
  SubmitJobInput,
} from "./project-contract";
import type { DefaultExampleId } from "./default-examples";

export class ProjectApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: unknown,
  ) {
    super(message);
  }
}

async function readJson<T>(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ProjectApiError(
      body.error ?? "GoDesk 服务暂时不可用。",
      response.status,
      body,
    );
  }
  return response.json() as Promise<T>;
}

export function createProject(name: string, templateId?: DefaultExampleId) {
  return fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, templateId }),
  }).then(readJson<CreateProjectResult>);
}

export function getProject(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}`).then(
    readJson<GameProject>,
  );
}

export function getDefinition(id: string) {
  return fetch(
    `/api/projects/${encodeURIComponent(id)}?view=definition`,
  ).then(readJson<GameDefinition>);
}

export function getDefinitions(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=definitions`)
    .then(readJson<{ definitions: GameDefinition[] }>)
    .then((result) => result.definitions);
}

export function getChangesets(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=changesets`)
    .then(readJson<{ changesets: Changeset[] }>)
    .then((result) => result.changesets);
}

export function duplicateDefinition(
  projectId: string,
  definitionId: string,
  input: {
    expectedVersion: number;
    idempotencyKey: string;
    name: string;
  },
) {
  return fetch(
    `/api/projects/${encodeURIComponent(projectId)}/definitions/${encodeURIComponent(definitionId)}/duplicate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  ).then(readJson<DuplicateDefinitionResult>);
}

export function getSources(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=sources`)
    .then(readJson<{ sources: SourceLibraryEntry[] }>)
    .then((result) => result.sources);
}

export function applyProjectChanges(
  id: string,
  input: ApplyProjectChangesInput,
) {
  return fetch(`/api/projects/${encodeURIComponent(id)}/changes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(readJson<ApplyProjectChangesResult>);
}

export function submitJob(id: string, input: SubmitJobInput) {
  return fetch(`/api/projects/${encodeURIComponent(id)}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(readJson<CreatorJob>);
}

export function getJob(id: string) {
  return fetch(`/api/jobs/${encodeURIComponent(id)}`).then(
    readJson<CreatorJob>,
  );
}

export function retryJob(id: string) {
  return fetch(`/api/jobs/${encodeURIComponent(id)}/retry`, {
    method: "POST",
  }).then(readJson<CreatorJob>);
}

export async function waitForJob(id: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const job = await getJob(id);
    if (job.status === "succeeded" || job.status === "failed") return job;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  throw new Error(`任务 ${id} 仍未结束。`);
}

export function getJobs(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=jobs`)
    .then(readJson<{ jobs: CreatorJob[] }>)
    .then((result) => result.jobs);
}

export function getBuilds(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=builds`)
    .then(readJson<{ builds: PlayableBuild[] }>)
    .then((result) => result.builds);
}

export function getBuild(id: string) {
  return fetch(`/api/builds/${encodeURIComponent(id)}`).then(
    readJson<PlayableBuild>,
  );
}

export function getPlaytests(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=playtests`)
    .then(readJson<{ playtests: PlaytestRun[] }>)
    .then((result) => result.playtests);
}

export function getRooms(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=rooms`)
    .then(readJson<{ rooms: GameRoom[] }>)
    .then((result) => result.rooms);
}

export function createRoom(
  buildId: string,
  input: { seed: number; idempotencyKey: string },
) {
  return fetch(`/api/builds/${encodeURIComponent(buildId)}/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(readJson<GameRoom>);
}

export function getRoom(id: string) {
  return fetch(`/api/rooms/${encodeURIComponent(id)}`).then(
    readJson<GameRoom>,
  );
}

export function submitRoomIntent(
  id: string,
  input: { intentId: string; seat: number; actionId: string },
) {
  return fetch(`/api/rooms/${encodeURIComponent(id)}/intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(readJson<GameRoom>);
}

export function getReplay(id: string) {
  return fetch(`/api/replays/${encodeURIComponent(id)}`).then(
    readJson<GameReplay>,
  );
}

export function listProjects() {
  return fetch("/api/projects")
    .then(readJson<{ projects: GameProject[] }>)
    .then((result) => result.projects);
}
