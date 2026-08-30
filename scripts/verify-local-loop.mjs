import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("could not reserve a local port"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

function fail(message) {
  throw new Error(`Local creator loop verification failed: ${message}`);
}

function ensure(condition, message) {
  if (!condition) fail(message);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function bodyForError(body) {
  if (typeof body === "string") return body.slice(0, 500);
  return JSON.stringify(body).slice(0, 1_000);
}

async function request(origin, path, init = {}, expectedStatus) {
  const response = await fetch(`${origin}${path}`, init);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  const valid = expectedStatus === undefined
    ? response.ok
    : response.status === expectedStatus;
  if (!valid) {
    fail(`${path}: expected ${expectedStatus ?? "2xx"}, got ${response.status}: ${bodyForError(body)}`);
  }
  return body;
}

function postJson(origin, path, value, expectedStatus) {
  return request(
    origin,
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    },
    expectedStatus,
  );
}

async function waitForWorker(origin, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/`);
      if (response.status > 0) return;
    } catch {
      // Wrangler is still starting.
    }
    await delay(100);
  }
  fail(`local Worker did not start:\n${output()}`);
}

async function waitForJob(origin, jobId) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const job = await request(origin, `/api/jobs/${encodeURIComponent(jobId)}`);
    if (job.status === "succeeded") return job;
    if (job.status === "failed") fail(`job ${jobId} failed: ${job.error ?? "unknown error"}`);
    await delay(250);
  }
  fail(`job ${jobId} did not finish within 30 seconds`);
}

function projectPath(projectId, suffix = "") {
  return `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
}

function shareApi(shareUrl, pathname) {
  const url = new URL(shareUrl);
  url.pathname = pathname;
  return url.toString();
}

async function claimSeat(origin, roomId, seat, shareUrl, extras = {}) {
  const pathname = `/api/sessions/${encodeURIComponent(roomId)}/seats`;
  const url = shareUrl ? shareApi(shareUrl, pathname) : `${origin}${pathname}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seat, ...extras }),
  });
  const body = await response.json();
  if (response.status !== 200) {
    fail(`claim seat ${seat}: expected 200, got ${response.status}: ${bodyForError(body)}`);
  }
  ensure(typeof body.seatToken === "string" && body.seatToken.startsWith("seat_"), "seat claim did not return a seatToken");
  return { status: response.status, session: body.session, seatToken: body.seatToken };
}

async function compileBuild(origin, projectId, expectedVersion, idempotencyKey) {
  const queued = await postJson(
    origin,
    `${projectPath(projectId)}/jobs`,
    { kind: "compile-build", expectedVersion, idempotencyKey },
    202,
  );
  const finished = await waitForJob(origin, queued.id);
  const build = finished.result?.build;
  ensure(build?.id, `compile job ${queued.id} returned no Build`);
  return { finished, build };
}

async function botPlaytest(origin, projectId, buildId, seed, idempotencyKey) {
  const queued = await postJson(
    origin,
    `${projectPath(projectId)}/jobs`,
    { kind: "bot-playtest", buildId, seed, idempotencyKey },
    202,
  );
  const finished = await waitForJob(origin, queued.id);
  ensure(finished.result?.id, `playtest job ${queued.id} returned no Playtest`);
  ensure(
    finished.result.evidenceType === "automated-playtest" ||
      finished.result.evidenceType === "automated-bot-simulation",
    `playtest job ${queued.id} did not label automated evidence`,
  );
  return { finished, playtest: finished.result };
}

async function verifyLoop(origin) {
  const brief = "三位玩家合作收集线索。玩家可以调查线索推进 2 点，也可以整理线索推进 1 点。累计达到 6 点完成目标，最多 12 回合。";
  const created = await postJson(origin, "/api/projects", {
    name: "可重复闭环验证",
  });
  const projectId = created.project.id;

  const generatedJob = await postJson(
    origin,
    `${projectPath(projectId)}/jobs`,
    {
      kind: "generate-rule-system",
      expectedVersion: created.project.version,
      idea: brief,
      name: "可重复闭环验证",
      sourceName: "local-loop-brief.txt",
      sourceKind: "brief",
      sourceContent: brief,
      idempotencyKey: "local-loop-generate-001",
    },
    202,
  );
  const generatedJobResult = await waitForJob(origin, generatedJob.id);
  const generated = generatedJobResult.result?.ruleSystem;
  ensure(generated?.runtimeSupport?.status === "draft", "generation must keep the Rule System in draft until the plan is approved");
  const proposedRuntime = generatedJobResult.result?.generationPlan?.proposedRuntime;
  ensure(proposedRuntime?.op === "configure_shared_goal", `expected proposed configure_shared_goal, got ${proposedRuntime?.op}`);
  ensure(proposedRuntime.config.goalTarget === 6, "generated shared target drifted");
  ensure(proposedRuntime.config.maxTurns === 12, "generated turn limit drifted");
  ensure(
    JSON.stringify(proposedRuntime.config.actions.map((action) => action.progress)) === JSON.stringify([2, 1]),
    "generated action progress drifted",
  );

  const sources = await request(origin, `${projectPath(projectId)}?view=sources`);
  ensure(sources.sources.some((source) => source.content === brief), "brief did not enter Source Library");

  let project = await request(origin, projectPath(projectId));
  const generationPlanView = await request(
    origin,
    `${projectPath(projectId)}?view=generation-plan`,
  );
  ensure(
    generationPlanView.generationPlan?.status === "pending",
    "generation did not persist a pending Generation Plan",
  );
  const approvedPlan = await postJson(
    origin,
    `${projectPath(projectId)}/changes`,
    {
      expectedVersion: project.version,
      idempotencyKey: "local-loop-approve-plan-001",
      operations: [{
        op: "approve_generation_plan",
        planId: generationPlanView.generationPlan.id,
      }],
    },
  );
  ensure(approvedPlan.generationPlan?.status === "approved", "Generation Plan was not approved");
  project = approvedPlan.project;
  const approvedRuleSystem = await request(origin, `${projectPath(projectId)}?view=rule-system`);
  ensure(approvedRuleSystem.runtimeSupport?.status === "executable", "approving the Generation Plan did not apply proposedRuntime");
  const firstKernel = approvedRuleSystem.runtimeSupport.kernel;
  ensure(firstKernel.type === "shared-goal-v1", `expected shared-goal-v1, got ${firstKernel.type}`);
  ensure(firstKernel.goalTarget === 6, "approved shared target drifted");
  ensure(firstKernel.maxTurns === 12, "approved turn limit drifted");
  ensure(
    JSON.stringify(firstKernel.actions.map((action) => action.progress)) === JSON.stringify([2, 1]),
    "approved action progress drifted",
  );
  const hypothesisChange = await postJson(
    origin,
    `${projectPath(projectId)}/changes`,
    {
      expectedVersion: project.version,
      idempotencyKey: "local-loop-hypothesis-001",
      operations: [{
        op: "add_design_hypothesis",
        hypothesis: {
          question: "更强的调查行动能否更快完成共同目标？",
          successSignal: "固定 seed 42 在更少回合内达到 6 点。",
        },
      }],
    },
  );
  const hypothesisId = hypothesisChange.hypotheses.at(-1)?.id;
  ensure(hypothesisId, "Design Hypothesis was not persisted");

  const firstCompile = await compileBuild(
    origin,
    projectId,
    hypothesisChange.project.version,
    "local-loop-build-001",
  );
  const firstBuild = firstCompile.build;
  const firstPlaytest = await botPlaytest(
    origin,
    projectId,
    firstBuild.id,
    42,
    "local-loop-playtest-001",
  );
  ensure(firstPlaytest.playtest.metrics.sharedGoal?.target === 6, "first Playtest lost shared target");
  ensure(firstPlaytest.playtest.metrics.sharedGoal?.progress >= 6, "first Playtest did not complete the target");

  const feedbackSession = await postJson(
    origin,
    `/api/builds/${encodeURIComponent(firstBuild.id)}/sessions`,
    {
      seed: 42,
      idempotencyKey: "local-loop-feedback-session-001",
      hypothesisId,
    },
    201,
  );
  ensure(
    feedbackSession.experiment?.hypothesisId === hypothesisId &&
      feedbackSession.experiment.question === "更强的调查行动能否更快完成共同目标？" &&
      feedbackSession.experiment.successSignal === "固定 seed 42 在更少回合内达到 6 点。",
    "feedback Room lost its Experiment Brief snapshot",
  );
  const feedbackSeat = await claimSeat(origin, feedbackSession.id, 0);
  const feedbackAction = await postJson(
    origin,
    `/api/sessions/${encodeURIComponent(feedbackSession.id)}/intents`,
    {
      intentId: "local-loop-feedback-intent-001",
      seat: 0,
      seatToken: feedbackSeat.seatToken,
      actionId: firstKernel.actions[0].id,
    },
  );
  ensure(feedbackAction.state.sharedGoal?.progress === 2, "feedback Room did not record the first Build action");
  const participantFeedback = await postJson(
    origin,
    `/api/sessions/${encodeURIComponent(feedbackSession.id)}/feedback`,
    {
      seat: 0,
      seatToken: feedbackSeat.seatToken,
      rating: 5,
      comment: "行动反馈很清楚，知道下一步要继续推进。",
    },
  );
  const feedbackSnapshot = participantFeedback.feedback.map(({ id, seat, rating, comment, moment }) => ({
    id,
    seat,
    rating,
    comment,
    moment,
  }));
  ensure(feedbackSnapshot.length === 1, "participant feedback was not stored for the Finding");
  ensure(
    feedbackSnapshot[0].moment?.actionSequence === 1 &&
      feedbackSnapshot[0].moment?.actionId === firstKernel.actions[0].id,
    "participant feedback lost its Accepted Action moment",
  );

  project = await request(origin, projectPath(projectId));
  const findingChange = await postJson(
    origin,
    `${projectPath(projectId)}/changes`,
    {
      expectedVersion: project.version,
      idempotencyKey: "local-loop-finding-001",
      operations: [{
        op: "record_validation_finding",
        finding: {
          hypothesisId,
          buildId: firstBuild.id,
          evidence: {
            type: "participant-feedback",
            sessionId: feedbackSession.id,
            feedback: feedbackSnapshot,
          },
          verdict: "supported",
          notes: "参与者反馈认为行动反馈清楚；这是参与者观察，不是真人验收声明。",
          nextChange: "把调查行动推进值从 2 调到 3，再用相同 seed 重新编译和试玩。",
        },
      }],
    },
  );
  const findingId = findingChange.findings.at(-1)?.id;
  ensure(findingId, "Validation Finding was not persisted");

  const reconfigured = await postJson(
    origin,
    `${projectPath(projectId)}/changes`,
    {
      expectedVersion: findingChange.project.version,
      idempotencyKey: "local-loop-reconfigure-001",
      operations: [{
        op: "configure_shared_goal",
        config: {
          goalTarget: firstKernel.goalTarget,
          maxTurns: firstKernel.maxTurns,
          actions: firstKernel.actions.map((action, index) => ({
            id: action.id,
            label: action.label,
            progress: index === 0 ? 3 : action.progress,
          })),
          unsupported: [
            "shared-goal-v1 only executes explicit shared progress actions and the shared target; other rule behavior remains unsupported.",
          ],
        },
      }],
    },
  );
  ensure(reconfigured.ruleSystem.runtimeSupport.kernel.actions[0].progress === 3, "reconfiguration did not change the Rule System");

  const secondCompile = await compileBuild(
    origin,
    projectId,
    reconfigured.project.version,
    "local-loop-build-002",
  );
  const secondBuild = secondCompile.build;
  ensure(secondBuild.id !== firstBuild.id, "reconfiguration reused the old immutable Build");
  const oldBuild = await request(origin, `/api/builds/${encodeURIComponent(firstBuild.id)}`);
  ensure(oldBuild.ruleSystem.runtimeSupport.kernel.actions[0].progress === 2, "old Build changed after reconfiguration");
  ensure(secondBuild.ruleSystem.runtimeSupport.kernel.actions[0].progress === 3, "new Build did not snapshot the reconfiguration");

  const secondPlaytest = await botPlaytest(
    origin,
    projectId,
    secondBuild.id,
    42,
    "local-loop-playtest-002",
  );
  ensure(secondPlaytest.playtest.metrics.sharedGoal?.progress >= 6, "second Playtest did not complete the target");

  const session = await postJson(
    origin,
    `/api/builds/${encodeURIComponent(secondBuild.id)}/sessions`,
    { seed: 42, idempotencyKey: "local-loop-session-001" },
    201,
  );
  ensure(session.state.sharedGoal?.progress === 0, "Shared Session did not start at zero progress");
  const creatorSeat = await claimSeat(origin, session.id, 0);
  const rejected = await postJson(
    origin,
    `/api/sessions/${encodeURIComponent(session.id)}/intents`,
    { intentId: "local-loop-wrong-seat-001", seat: 1, seatToken: "seat_local-loop-stranger", actionId: firstKernel.actions[0].id },
    409,
  );
  ensure(rejected.error === "seat_not_claimed", "unclaimed seat intent was not rejected");
  const acted = await postJson(
    origin,
    `/api/sessions/${encodeURIComponent(session.id)}/intents`,
    { intentId: "local-loop-intent-001", seat: 0, seatToken: creatorSeat.seatToken, actionId: firstKernel.actions[0].id },
  );
  ensure(acted.state.sharedGoal?.progress === 3, "Shared Session did not execute the revised action");

  const feedback = await postJson(
    origin,
    `/api/sessions/${encodeURIComponent(session.id)}/feedback`,
    {
      seat: 0,
      seatToken: creatorSeat.seatToken,
      rating: 5,
      comment: "固定 seed 下行动反馈可复核。",
    },
  );
  ensure(feedback.feedback?.length === 1, "Shared Session feedback was not stored");
  ensure(
    feedback.feedback[0].comment === "固定 seed 下行动反馈可复核。",
    "Shared Session feedback comment drifted",
  );
  ensure(
    feedback.feedback[0].moment?.actionSequence === 1 &&
      feedback.feedback[0].moment?.actionId === firstKernel.actions[0].id,
    "Shared Session feedback lost its Accepted Action moment",
  );

  const replay = await request(origin, `/api/replays/${encodeURIComponent(session.replayId)}`);
  ensure(replay.finalState.sharedGoal?.progress === 3, "Replay did not reconstruct the Shared Session");
  ensure(replay.acceptedActions.length === 1, "Replay action log has unexpected length");

  const publishedSession = await postJson(
    origin,
    `/api/builds/${encodeURIComponent(secondBuild.id)}/sessions`,
    { seed: 42, idempotencyKey: "local-loop-published-session-001", hypothesisId },
    201,
  );
  const publishVersion = await request(origin, projectPath(projectId));
  await postJson(
    origin,
    `${projectPath(projectId)}/changes`,
    {
      expectedVersion: publishVersion.version,
      idempotencyKey: "local-loop-publish-playtest-001",
      operations: [{
        op: "publish_shared_session",
        sessionId: publishedSession.id,
      }],
    },
  );
  const { playtestLink } = await request(
    origin,
    `${projectPath(projectId)}?view=playtest-link`,
  );
  ensure(playtestLink?.sessionId === publishedSession.id, "Playtest Link did not pin the published Session");
  ensure(playtestLink?.replayId === publishedSession.replayId, "Playtest Link lost its Replay id");
  ensure(new URL(playtestLink.url).pathname === `/try/${projectId}`, "Playtest Link path drifted");
  ensure(new URL(playtestLink.url).searchParams.get("share"), "Playtest Link is missing a share token");
  ensure(!new URL(playtestLink.url).searchParams.has("creator"), "Playtest Link still uses creator=");
  const playtestRedirect = await fetch(playtestLink.url, { redirect: "manual" });
  ensure(playtestRedirect.status === 302, "Playtest Link did not redirect");
  ensure(
    new URL(playtestRedirect.headers.get("location")).pathname === `/room/${publishedSession.id}`,
    "Playtest Link resolved to the wrong Shared Session",
  );

  const validation = await request(origin, `${projectPath(projectId)}?view=validation`);
  ensure(validation.hypotheses.some((item) => item.id === hypothesisId), "same project lost its Hypothesis");
  ensure(
    validation.findings.some(
      (item) =>
        item.id === findingId &&
        item.buildId === firstBuild.id &&
        item.nextChange === "把调查行动推进值从 2 调到 3，再用相同 seed 重新编译和试玩。" &&
        item.evidence.type === "participant-feedback" &&
        item.evidence.sessionId === feedbackSession.id &&
        item.evidence.feedback[0]?.comment === "行动反馈很清楚，知道下一步要继续推进。",
    ),
    "same project lost its participant-feedback Finding",
  );

  return {
    projectId,
    hypothesisId,
    findingId,
    firstBuildId: firstBuild.id,
    firstPlaytestId: firstPlaytest.playtest.id,
    secondBuildId: secondBuild.id,
    secondPlaytestId: secondPlaytest.playtest.id,
    sessionId: session.id,
    publishedSessionId: publishedSession.id,
    playtestUrl: playtestLink.url,
    replayId: session.replayId,
    feedbackSessionId: feedbackSession.id,
    invariants: [
      "source-library",
      "shared-goal-generation",
      "generation-plan-approval",
      "automated-playtest",
      "same-project-actionable-finding",
      "participant-feedback-finding",
      "experiment-brief-feedback-binding",
      "immutable-build-revision",
      "seat-isolation",
      "shared-session-intent",
      "shared-session-feedback",
      "feedback-moment-attribution",
      "replay-reconstruction",
      "stable-playtest-link",
    ],
  };
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const persistTo = await mkdtemp(join(tmpdir(), "godesk-local-loop-"));
const child = spawn(
  "pnpm",
  [
    "exec",
    "wrangler",
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--inspector-port",
    "0",
    "--persist-to",
    persistTo,
  ],
  { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
);

let output = "";
const collect = (chunk) => {
  output += chunk.toString();
};
child.stdout.on("data", collect);
child.stderr.on("data", collect);

try {
  await waitForWorker(origin, () => output);
  const result = await verifyLoop(origin);
  console.log(`Local creator loop verification passed at ${origin}.`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("close", resolve));
  }
  await rm(persistTo, { recursive: true, force: true });
}
