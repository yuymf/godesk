import type {
  ApplyProjectChangesInput,
  ApplyProjectChangesResult,
  Changeset,
  CreatorJob,
  CreateProjectResult,
  DesignHypothesis,
  DuplicateRuleSystemResult,
  RestoreBuildResult,
  GenerationPlan,
  RuleSystem,
  GameProject,
  GameReplay,
  SharedSession,
  SharedSessionSnapshot,
  PlaytestRun,
  PlayableBuild,
  PlaytestLink,
  SourceLibraryEntry,
  SubmitJobInput,
  ValidationFinding,
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

export function getProjectActivity(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=activity`).then(
    readJson<{
      project: GameProject;
      jobs: CreatorJob[];
      sessions: SharedSession[];
    }>,
  );
}

function withShareToken(
  path: string,
  shareToken?: string,
  origin = window.location.origin,
) {
  if (!shareToken) return path;
  const url = new URL(path, origin);
  url.searchParams.set("share", shareToken);
  return `${url.pathname}${url.search}`;
}

export function sharedSessionSocketUrl(
  id: string,
  shareToken?: string,
  location: Pick<Location, "origin" | "protocol"> = window.location,
) {
  const url = new URL(
    `/api/sessions/${encodeURIComponent(id)}/events`,
    location.origin,
  );
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  if (shareToken) url.searchParams.set("share", shareToken);
  return url.toString();
}

export function publicSharedSession(
  session: SharedSessionSnapshot,
  origin: string,
  shareToken?: string,
): SharedSession {
  return {
    ...session,
    sessionUrl: new URL(
      withShareToken(
        `/room/${encodeURIComponent(session.id)}`,
        shareToken,
        origin,
      ),
      origin,
    ).toString(),
    replayUrl: new URL(
      withShareToken(
        `/replay/${encodeURIComponent(session.replayId)}`,
        shareToken,
        origin,
      ),
      origin,
    ).toString(),
  };
}

export function getRuleSystem(id: string) {
  return fetch(
    `/api/projects/${encodeURIComponent(id)}?view=rule-system`,
  ).then(readJson<RuleSystem>);
}

export function getGenerationPlan(id: string) {
  return fetch(
    `/api/projects/${encodeURIComponent(id)}?view=generation-plan`,
  ).then(readJson<{ generationPlan: GenerationPlan | null }>);
}

export function getPlaytestLink(id: string) {
  return fetch(
    `/api/projects/${encodeURIComponent(id)}?view=playtest-link`,
  ).then(readJson<{ playtestLink: PlaytestLink | null }>);
}

export function getRuleSystems(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=rule-systems`)
    .then(readJson<{ ruleSystems: RuleSystem[] }>)
    .then((result) => result.ruleSystems);
}

export function getChangesets(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=changesets`)
    .then(readJson<{ changesets: Changeset[] }>)
    .then((result) => result.changesets);
}

export function duplicateRuleSystem(
  projectId: string,
  ruleSystemId: string,
  input: {
    expectedVersion: number;
    idempotencyKey: string;
    name: string;
  },
) {
  return fetch(
    `/api/projects/${encodeURIComponent(projectId)}/rule-systems/${encodeURIComponent(ruleSystemId)}/duplicate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  ).then(readJson<DuplicateRuleSystemResult>);
}

export function restoreBuild(
  projectId: string,
  buildId: string,
  input: {
    expectedVersion: number;
    idempotencyKey: string;
  },
) {
  return fetch(
    `/api/projects/${encodeURIComponent(projectId)}/builds/${encodeURIComponent(buildId)}/restore`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  ).then(readJson<RestoreBuildResult>);
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

export async function waitForJob(
  id: string,
  onUpdate?: (job: CreatorJob) => void,
) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const job = await getJob(id);
    onUpdate?.(job);
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

export function getBuild(id: string, shareToken?: string) {
  return fetch(
    withShareToken(`/api/builds/${encodeURIComponent(id)}`, shareToken),
  ).then(
    readJson<PlayableBuild>,
  );
}

export function getPlaytests(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=playtests`)
    .then(readJson<{ playtests: PlaytestRun[] }>)
    .then((result) => result.playtests);
}

export function getSharedSessions(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=sessions`)
    .then(readJson<{ sessions: SharedSession[] }>)
    .then((result) => result.sessions);
}

export function getValidation(id: string) {
  return fetch(`/api/projects/${encodeURIComponent(id)}?view=validation`)
    .then(readJson<{
      hypotheses: DesignHypothesis[];
      findings: ValidationFinding[];
    }>);
}

export function createSharedSession(
  buildId: string,
  input: { seed: number; idempotencyKey: string; hypothesisId?: string },
) {
  return fetch(`/api/builds/${encodeURIComponent(buildId)}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(readJson<SharedSession>);
}

export function claimSessionSeat(
  id: string,
  input: { seat: number; seatToken?: string; displayName?: string },
  shareToken?: string,
) {
  return fetch(
    withShareToken(
      `/api/sessions/${encodeURIComponent(id)}/seats`,
      shareToken,
    ),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  ).then(readJson<{ session: SharedSession; seatToken: string }>);
}

export function submitSessionIntent(
  id: string,
  input: {
    intentId: string;
    seat: number;
    seatToken: string;
    actionId: string;
    payload?: Record<string, unknown>;
  },
  shareToken?: string,
) {
  return fetch(
    withShareToken(
      `/api/sessions/${encodeURIComponent(id)}/intents`,
      shareToken,
    ),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  ).then(readJson<SharedSession>);
}

export function submitSessionFeedback(
  id: string,
  input: {
    seat: number;
    seatToken: string;
    rating: 1 | 2 | 3 | 4 | 5;
    comment: string;
  },
  shareToken?: string,
) {
  return fetch(
    withShareToken(
      `/api/sessions/${encodeURIComponent(id)}/feedback`,
      shareToken,
    ),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  ).then(readJson<SharedSession>);
}

export function getReplay(id: string, shareToken?: string) {
  return fetch(
    withShareToken(`/api/replays/${encodeURIComponent(id)}`, shareToken),
  ).then(
    readJson<GameReplay>,
  );
}

export function listProjects() {
  return fetch("/api/projects")
    .then(readJson<{ projects: GameProject[] }>)
    .then((result) => result.projects);
}
