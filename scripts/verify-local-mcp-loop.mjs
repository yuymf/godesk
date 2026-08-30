import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

function fail(message) {
  throw new Error(`Local MCP loop verification failed: ${message}`);
}

function ensure(condition, message) {
  if (!condition) fail(message);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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

function pathOf(url) {
  return new URL(url).pathname;
}

function bodyForError(body) {
  return typeof body === "string"
    ? body.slice(0, 800)
    : JSON.stringify(body).slice(0, 1_200);
}

async function parseMcpPayload(response) {
  const text = await response.text();
  if (!text.trim()) return undefined;
  if ((response.headers.get("content-type") ?? "").includes("application/json")) {
    return JSON.parse(text);
  }
  const events = text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice("data: ".length)));
  if (!events.length) fail(`MCP response had no data event: ${text.slice(0, 800)}`);
  return events.at(-1);
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

async function verifyLoop(origin) {
  const mcpHeaders = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "x-godesk-dev-creator": "local-mcp-loop",
    "x-godesk-mcp-surface": "codex",
  };
  let nextId = 1;
  let sessionId;

  async function rpc(message, expectPayload = true) {
    const headers = { ...mcpHeaders };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    const response = await fetch(`${origin}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      const body = await response.text();
      fail(`MCP ${message.method}: HTTP ${response.status}: ${body}`);
    }
    const returnedSessionId = response.headers.get("mcp-session-id");
    if (returnedSessionId) sessionId = returnedSessionId;
    if (!expectPayload) return undefined;
    return parseMcpPayload(response);
  }

  async function callTool(name, args) {
    const payload = await rpc({
      jsonrpc: "2.0",
      id: nextId++,
      method: "tools/call",
      params: { name, arguments: args },
    });
    const result = payload?.result;
    if (!result || result.isError) {
      fail(`${name} returned an MCP error: ${bodyForError(result?.content ?? payload)}`);
    }
    ensure(result.structuredContent, `${name} returned no structuredContent`);
    return result.structuredContent;
  }

  async function readProject(projectId, view = "overview") {
    const result = await callTool("read_project", { projectId, view });
    ensure(result.view === view, `read_project returned ${result.view}, expected ${view}`);
    return result.data;
  }

  async function waitForJob(jobId) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const job = await callTool("track_job", { jobId });
      if (job.status === "succeeded") return job;
      if (job.status === "failed") fail(`job ${jobId} failed: ${job.error ?? "unknown error"}`);
      await delay(250);
    }
    fail(`job ${jobId} did not finish within 30 seconds`);
  }

  function shareApi(shareUrl, pathname) {
    const url = new URL(shareUrl);
    url.pathname = pathname;
    return url;
  }

  async function claimSeat(roomId, seat, shareUrl, extras = {}) {
    const response = await fetch(shareApi(shareUrl, `/api/sessions/${roomId}/seats`), {
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

  const initialized = await rpc({
    jsonrpc: "2.0",
    id: nextId++,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "godesk-local-mcp-verifier", version: "1.0.0" },
    },
  });
  ensure(initialized?.result?.serverInfo?.name === "godesk", "MCP initialize did not identify GoDesk");
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, false);

  const listed = await rpc({
    jsonrpc: "2.0",
    id: nextId++,
    method: "tools/list",
    params: {},
  });
  const toolNames = (listed?.result?.tools ?? []).map((tool) => tool.name);
  const requiredTools = [
    "list_projects",
    "create_project",
    "read_project",
    "get_studio_url",
    "apply_project_patch",
    "submit_job",
    "track_job",
    "read_build",
    "create_shared_session",
    "read_shared_session",
    "submit_session_intent",
    "read_replay",
    "restore_build_as_rule_system",
  ];
  for (const name of requiredTools) {
    ensure(toolNames.includes(name), `MCP tool ${name} was not discoverable`);
  }
  for (const staleName of [
    "apply_game_patch",
    "duplicate_definition",
    "activate_definition",
    "create_room",
  ]) {
    ensure(!toolNames.includes(staleName), `obsolete MCP tool ${staleName} is still exposed`);
  }

  const listedProjects = await callTool("list_projects", {});
  ensure(Array.isArray(listedProjects.projects), "list_projects returned no project list");

  const brief = "三位玩家合作收集线索。玩家可以调查线索推进 2 点，也可以整理线索推进 1 点。累计达到 6 点完成目标，最多 12 回合。";
  const created = await callTool("create_project", { name: "MCP 闭环验证" });
  const projectId = created.project.id;
  ensure(created.studioUrl.endsWith(`/studio/${projectId}`), "create_project returned the wrong Studio URL");
  const studio = await callTool("get_studio_url", { projectId });
  ensure(studio.studioUrl === created.studioUrl, "get_studio_url disagrees with create_project");

  const generatedJob = await callTool("submit_job", {
    kind: "generate-rule-system",
    projectId,
    expectedVersion: created.project.version,
    idea: brief,
    sourceContent: brief,
    sourceName: "mcp-loop-brief.txt",
    sourceKind: "brief",
    name: "MCP 闭环验证",
    idempotencyKey: "local-mcp-generate-001",
  });
  const generated = await waitForJob(generatedJob.id);
  ensure(generated.result?.generationPlan?.status === "pending", "MCP generation did not return a pending Generation Plan");
  ensure(generated.result?.ruleSystem?.runtimeSupport?.status === "draft", "MCP generation must keep the Rule System in draft");
  ensure(generated.result?.generationPlan?.proposedRuntime?.op === "configure_shared_goal", "MCP generation did not propose shared-goal-v1");
  ensure(generated.result.generationPlan.proposedRuntime.config.goalTarget === 6, "MCP generation changed the shared target");
  const sourceView = await readProject(projectId, "sources");
  ensure(sourceView.sources.some((source) => source.content === brief), "MCP generation did not persist the source");
  const generatedRuleSystem = await readProject(projectId, "rule-system");
  ensure(generatedRuleSystem.runtimeSupport?.status === "draft", "MCP read_project lost the draft Rule System");
  const pendingPlan = await readProject(projectId, "generation-plan");
  ensure(pendingPlan.generationPlan?.status === "pending", "MCP read_project lost the pending plan");
  ensure(pendingPlan.generationPlan?.proposedRuntime?.op === "configure_shared_goal", "MCP read_project lost proposedRuntime");

  const visualBriefId = "source_mcp_visual_brief";
  const visualReferenceId = "source_mcp_visual_reference";
  const generatedImageId = "source_mcp_generated_image";
  const generatedImage = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAABwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=";
  await callTool("apply_project_patch", {
    projectId,
    expectedVersion: (await readProject(projectId)).version,
    idempotencyKey: "local-mcp-generated-visual-001",
    operations: [
      {
        op: "add_source",
        source: {
          id: visualReferenceId,
          kind: "image",
          imageUse: "visual-reference",
          name: "MCP harbor style reference",
          content: generatedImage,
          provenance: { origin: "creator-upload", locator: "Creator reference upload" },
        },
      },
      {
        op: "add_source",
        source: {
          id: visualBriefId,
          kind: "brief",
          name: "MCP visual direction",
          content: "Mist-green clue card with bold paper-cut harbor silhouettes and no text.",
          provenance: { origin: "creator-authored", locator: "Creator prompt" },
        },
      },
      {
        op: "add_source",
        source: {
          id: generatedImageId,
          kind: "image",
          imageUse: "project-asset",
          name: "MCP generated clue card",
          content: generatedImage,
          provenance: {
            origin: "generative-api",
            locator: "Codex host-user quota",
            basedOnSourceIds: [visualBriefId, visualReferenceId],
          },
        },
      },
      {
        op: "update_rule_system",
        fields: {
          presentation: {
            theme: "mist-green-clue-cards",
            image: { sourceId: generatedImageId, url: generatedImage, alt: "Mist-green clue card" },
            visuals: [{ provenance: "generated", label: "Generated clue-card art" }],
          },
        },
      },
    ],
  });
  const visualSources = await readProject(projectId, "sources");
  ensure(
    visualSources.sources.some((source) =>
      source.id === generatedImageId &&
      JSON.stringify(source.provenance.basedOnSourceIds) ===
        JSON.stringify([visualBriefId, visualReferenceId])
    ),
    "MCP generated image lost its visual brief and reference lineage",
  );

  const approved = await callTool("apply_project_patch", {
    projectId,
    expectedVersion: (await readProject(projectId)).version,
    idempotencyKey: "local-mcp-approve-001",
    operations: [{
      op: "approve_generation_plan",
      planId: pendingPlan.generationPlan.id,
    }],
  });
  ensure(approved.generationPlan?.status === "approved", "MCP did not approve the Generation Plan");
  const approvedProject = await readProject(projectId);
  const approvedRuleSystem = await readProject(projectId, "rule-system");
  ensure(approvedRuleSystem.runtimeSupport?.status === "executable", "MCP approve did not apply proposedRuntime");
  ensure(approvedRuleSystem.runtimeSupport.kernel?.type === "shared-goal-v1", "MCP approve did not produce shared-goal-v1");
  ensure(approvedRuleSystem.runtimeSupport.kernel.goalTarget === 6, "MCP approve changed the shared target");

  const compileJob = await callTool("submit_job", {
    kind: "compile-build",
    projectId,
    expectedVersion: approvedProject.version,
    idempotencyKey: "local-mcp-compile-001",
  });
  const compiled = await waitForJob(compileJob.id);
  const build = compiled.result?.build;
  ensure(build?.id, "MCP compile did not return a Build");
  ensure(pathOf(build.playableUrl) === `/play/${build.id}`, "MCP compile returned the wrong Build URL");
  const buildRead = await callTool("read_build", { buildId: build.id });
  ensure(buildRead.id === build.id, "read_build returned a different Build");
  ensure(buildRead.ruleSystemVersion === approvedRuleSystem.version, "Build did not snapshot the approved Rule System version");
  ensure(
    buildRead.sourceIds.includes(generatedImageId) &&
      buildRead.sourceIds.includes(visualBriefId) &&
      buildRead.sourceIds.includes(visualReferenceId),
    "Build did not retain generated image, visual brief, and reference provenance",
  );

  const previewJob = await callTool("submit_job", {
    kind: "render-preview",
    projectId,
    buildId: build.id,
    idempotencyKey: "local-mcp-preview-001",
  });
  const preview = await waitForJob(previewJob.id);
  ensure(pathOf(preview.result?.previewUrl) === `/play/${build.id}`, "MCP preview did not return the exact Build URL");

  const playtestJob = await callTool("submit_job", {
    kind: "bot-playtest",
    projectId,
    buildId: build.id,
    seed: 42,
    idempotencyKey: "local-mcp-playtest-001",
  });
  const playtested = await waitForJob(playtestJob.id);
  const playtest = playtested.result;
  ensure(playtest?.evidenceType === "automated-bot-simulation", "MCP bot playtest lost its automated evidence label");
  ensure(playtest?.replayId, "MCP bot playtest did not return a Replay");
  const botReplay = await callTool("read_replay", { replayId: playtest.replayId });
  ensure(botReplay.id === playtest.replayId, "MCP Replay read returned the wrong Replay");
  ensure(botReplay.acceptedActions.length > 0, "MCP bot Replay contains no accepted actions");

  const currentProject = await readProject(projectId);
  const hypothesisChange = await callTool("apply_project_patch", {
    projectId,
    expectedVersion: currentProject.version,
    idempotencyKey: "local-mcp-feedback-hypothesis-001",
    operations: [{
      op: "add_design_hypothesis",
      hypothesis: {
        question: "参与者能否理解 MCP 生成的行动反馈？",
        successSignal: "参与者评论明确指出下一步行动容易判断。",
      },
    }],
  });
  const hypothesisId = hypothesisChange.hypotheses.at(-1)?.id;
  ensure(hypothesisId, "MCP could not persist a feedback hypothesis");

  const session = await callTool("create_shared_session", {
    buildId: build.id,
    seed: 42,
    idempotencyKey: "local-mcp-session-001",
    hypothesisId,
  });
  ensure(session.state.sharedGoal?.progress === 0, "MCP Shared Session did not start at zero");
  ensure(
    session.experiment?.hypothesisId === hypothesisId &&
      session.experiment.question === "参与者能否理解 MCP 生成的行动反馈？" &&
      session.experiment.successSignal === "参与者评论明确指出下一步行动容易判断。",
    "MCP Shared Session lost its Experiment Brief snapshot",
  );
  const actionId = approvedRuleSystem.runtimeSupport.kernel.actions[0].id;
  const acted = await callTool("submit_session_intent", {
    sessionId: session.id,
    intentId: "local-mcp-intent-001",
    seat: 0,
    actionId,
  });
  ensure(acted.state.sharedGoal?.progress === 2, "MCP Shared Session did not accept the legal action");
  const reopened = await callTool("read_shared_session", { sessionId: session.id });
  ensure(reopened.state.sharedGoal?.progress === 2, "MCP Shared Session did not persist its action");
  ensure(reopened.acceptedActions.length === 1, "MCP Shared Session action log has unexpected length");

  const publicRoomUrl = new URL(session.sessionUrl);
  ensure(publicRoomUrl.searchParams.get("share"), "MCP session URL is missing a share token");
  ensure(!publicRoomUrl.searchParams.has("creator"), "MCP session URL still uses creator=");
  const feedbackSeat = await claimSeat(session.id, 0, session.sessionUrl);
  const publicFeedback = await fetch(
    shareApi(session.sessionUrl, `/api/sessions/${session.id}/feedback`),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seat: 0,
        seatToken: feedbackSeat.seatToken,
        rating: 5,
        comment: "MCP 生成的行动反馈清楚，下一步容易判断。",
      }),
    },
  ).then((response) => response.json());
  const feedbackSnapshot = publicFeedback.feedback.map(({ id, seat, rating, comment, moment }) => ({
    id,
    seat,
    rating,
    comment,
    moment,
  }));
  ensure(feedbackSnapshot.length === 1, "public MCP loop did not persist participant feedback");
  ensure(
    feedbackSnapshot[0].moment?.actionSequence === 1 &&
      feedbackSnapshot[0].moment?.actionId === actionId,
    "public MCP loop feedback lost its Accepted Action moment",
  );
  const feedbackRead = await callTool("read_shared_session", { sessionId: session.id });
  ensure(feedbackRead.feedback[0]?.comment === "MCP 生成的行动反馈清楚，下一步容易判断。", "MCP did not read the public feedback");
  const publishedSession = await callTool("create_shared_session", {
    buildId: build.id,
    seed: 42,
    idempotencyKey: "local-mcp-published-session-001",
    hypothesisId,
  });
  const published = await callTool("apply_project_patch", {
    projectId,
    expectedVersion: hypothesisChange.project.version,
    idempotencyKey: "local-mcp-publish-playtest-001",
    operations: [{
      op: "publish_shared_session",
      sessionId: publishedSession.id,
    }],
  });
  const publishedView = await readProject(projectId, "playtest-link");
  ensure(
    publishedView.playtestLink?.sessionId === publishedSession.id,
    "MCP Playtest Link did not pin the published Session",
  );
  ensure(
    publishedView.playtestLink?.replayId === publishedSession.replayId,
    "MCP Playtest Link lost its Replay id",
  );
  ensure(new URL(publishedView.playtestLink.url).searchParams.get("share"), "MCP Playtest Link is missing a share token");
  ensure(!new URL(publishedView.playtestLink.url).searchParams.has("creator"), "MCP Playtest Link still uses creator=");
  const stableResponse = await fetch(publishedView.playtestLink.url, {
    redirect: "manual",
  });
  ensure(stableResponse.status === 302, "MCP Playtest Link did not redirect");
  ensure(
    new URL(stableResponse.headers.get("location")).pathname ===
      `/room/${publishedSession.id}`,
    "MCP Playtest Link resolved to the wrong Room",
  );
  const feedbackFinding = await callTool("apply_project_patch", {
    projectId,
    expectedVersion: published.project.version,
    idempotencyKey: "local-mcp-feedback-finding-001",
    operations: [{
      op: "record_validation_finding",
      finding: {
        hypothesisId,
        buildId: build.id,
        evidence: {
          type: "participant-feedback",
          sessionId: session.id,
          feedback: feedbackSnapshot,
        },
        verdict: "supported",
        notes: "参与者反馈认为下一步行动容易判断；这不是 human-session 证据。",
        nextChange: "保留清晰行动反馈，再用相同 seed 测试更紧凑的回合节奏。",
      },
    }],
  });
  const feedbackFindingId = feedbackFinding.findings.at(-1)?.id;
  ensure(feedbackFindingId, "MCP could not persist a participant-feedback Finding");
  const validation = await readProject(projectId, "validation");
  ensure(
    validation.findings.some((finding) =>
      finding.id === feedbackFindingId &&
      finding.evidence.type === "participant-feedback" &&
      finding.evidence.feedback[0]?.comment === "MCP 生成的行动反馈清楚，下一步容易判断。"
    ),
    "MCP validation view lost the participant-feedback Finding",
  );

  const beforeIterationProject = await readProject(projectId);
  const beforeIterationRuleSystem = await readProject(projectId, "rule-system");
  const beforeIterationKernel = beforeIterationRuleSystem.runtimeSupport?.kernel;
  ensure(beforeIterationKernel?.type === "shared-goal-v1", "MCP iteration lost the shared-goal Kernel");
  const iterationActions = beforeIterationKernel.actions.map((action, index) => ({
    id: action.id,
    label: action.label,
    progress: index === 0 ? action.progress + 1 : action.progress,
  }));
  const iterated = await callTool("apply_project_patch", {
    projectId,
    expectedVersion: beforeIterationProject.version,
    idempotencyKey: "local-mcp-feedback-iterate-001",
    operations: [{
      op: "configure_shared_goal",
      config: {
        goalTarget: beforeIterationKernel.goalTarget,
        maxTurns: beforeIterationKernel.maxTurns,
        actions: iterationActions,
        unsupported: beforeIterationRuleSystem.runtimeSupport.unsupported,
      },
    }],
  });
  const iteratedKernel = iterated.ruleSystem.runtimeSupport?.kernel;
  ensure(iterated.project.version > beforeIterationProject.version, "MCP feedback iteration did not version the project");
  ensure(iteratedKernel?.type === "shared-goal-v1" && iteratedKernel.actions[0]?.progress === 3, "MCP feedback iteration did not apply the focused action change");

  const iterationCompileJob = await callTool("submit_job", {
    kind: "compile-build",
    projectId,
    expectedVersion: iterated.project.version,
    basedOnFindingId: feedbackFindingId,
    idempotencyKey: "local-mcp-feedback-compile-001",
  });
  const iterationCompiled = await waitForJob(iterationCompileJob.id);
  const iteratedBuild = iterationCompiled.result?.build;
  ensure(iteratedBuild?.id && iteratedBuild.id !== build.id, "MCP feedback iteration did not create a new immutable Build");
  ensure(iteratedBuild.basedOnFindingId === feedbackFindingId, "MCP iteration Build lost its motivating Finding");
  ensure(iterationCompiled.result?.changeset?.basedOnFindingId === feedbackFindingId, "MCP iteration Changeset lost its motivating Finding");
  ensure(iteratedBuild.ruleSystemVersion === iterated.ruleSystem.version, "MCP iteration Build did not snapshot the new Rule System version");
  ensure(iteratedBuild.ruleSystem.runtimeSupport.kernel.actions[0]?.progress === 3, "MCP iteration Build lost the focused action change");
  const oldBuildRead = await callTool("read_build", { buildId: build.id });
  ensure(oldBuildRead.ruleSystem.runtimeSupport.kernel.actions[0]?.progress === 2, "MCP iteration mutated the motivating Build");

  const iterationPlaytestJob = await callTool("submit_job", {
    kind: "bot-playtest",
    projectId,
    buildId: iteratedBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-feedback-playtest-001",
  });
  const iterationPlaytested = await waitForJob(iterationPlaytestJob.id);
  const iterationPlaytest = iterationPlaytested.result;
  ensure(iterationPlaytest?.evidenceType === "automated-bot-simulation", "MCP iteration lost the automated evidence label");
  ensure(iterationPlaytest?.replayId, "MCP iteration did not produce a Replay");
  const iterationReplay = await callTool("read_replay", { replayId: iterationPlaytest.replayId });
  ensure(iterationReplay.finalState.sharedGoal?.progress >= 6, "MCP iteration Replay did not reach the shared target");
  const sessionReplay = await callTool("read_replay", { replayId: session.replayId });
  ensure(sessionReplay.acceptedActions.length === 1, "MCP Shared Session Replay did not reconstruct its action");
  const beforeRestore = await readProject(projectId);
  const restored = await callTool("restore_build_as_rule_system", {
    projectId,
    buildId: build.id,
    expectedVersion: beforeRestore.version,
    idempotencyKey: "local-mcp-restore-build-001",
  });
  ensure(restored.sourceBuildId === build.id, "MCP restore lost the source Build ID");
  ensure(restored.ruleSystem.id !== build.ruleSystemId, "MCP restore reused the historical Rule System ID");
  ensure(restored.ruleSystem.version === 1, "MCP restore did not create a new editable Rule System");
  ensure(restored.ruleSystem.restoredFromBuildId === build.id, "MCP restored Rule System lost lineage");
  ensure(restored.changeset.restoredFromBuildId === build.id, "MCP restore Changeset lost lineage");
  ensure(restored.project.activeRuleSystemId === restored.ruleSystem.id, "MCP restore did not activate the new Rule System");
  const oldBuildAfterRestore = await callTool("read_build", { buildId: build.id });
  ensure(oldBuildAfterRestore.ruleSystem.runtimeSupport.kernel.actions[0]?.progress === 2, "MCP restore mutated the source Build");
  const sessionReplayAfterRestore = await callTool("read_replay", { replayId: session.replayId });
  ensure(sessionReplayAfterRestore.acceptedActions.length === 1, "MCP restore mutated historical Replay evidence");

  const turnBrief = [
    "三位玩家轮流行动。",
    "扩展当前共同创意并回应已有内容。",
    "加入一个新约束并说明它如何改变创意。",
    "整个会话最多进行 4 回合，达到上限后结束。",
  ].join("\n");
  const turnCreated = await callTool("create_project", { name: "MCP 轮流行动验证" });
  const turnProjectId = turnCreated.project.id;
  const turnGeneratedJob = await callTool("submit_job", {
    kind: "generate-rule-system",
    projectId: turnProjectId,
    expectedVersion: turnCreated.project.version,
    idea: "三位玩家轮流扩展一个共同创意或加入约束，最多 4 回合。",
    sourceContent: turnBrief,
    sourceName: "mcp-turn-taking-brief.txt",
    sourceKind: "brief",
    name: "MCP 轮流行动验证",
    idempotencyKey: "local-mcp-turn-generate-001",
  });
  const turnGenerated = await waitForJob(turnGeneratedJob.id);
  ensure(turnGenerated.result?.ruleSystem?.runtimeSupport?.status === "draft", "MCP turn-taking generation must stay draft");
  const turnProposed = turnGenerated.result?.generationPlan?.proposedRuntime;
  ensure(turnProposed?.op === "configure_turn_taking", "MCP generation did not propose turn-taking-v1");
  ensure(turnProposed.config.maxTurns === 4, "MCP turn-taking generation changed the turn limit");
  ensure(turnProposed.config.actions.length === 2, "MCP turn-taking generation lost explicit actions");
  const turnKernel = turnProposed.config;
  const turnPlan = await readProject(turnProjectId, "generation-plan");
  ensure(turnPlan.generationPlan?.status === "pending", "MCP turn-taking generation did not create a pending plan");
  const turnApproved = await callTool("apply_project_patch", {
    projectId: turnProjectId,
    expectedVersion: (await readProject(turnProjectId)).version,
    idempotencyKey: "local-mcp-turn-approve-001",
    operations: [{
      op: "approve_generation_plan",
      planId: turnPlan.generationPlan.id,
    }],
  });
  const turnCompileJob = await callTool("submit_job", {
    kind: "compile-build",
    projectId: turnProjectId,
    expectedVersion: turnApproved.project.version,
    idempotencyKey: "local-mcp-turn-compile-001",
  });
  const turnCompiled = await waitForJob(turnCompileJob.id);
  const turnBuild = turnCompiled.result?.build;
  ensure(turnBuild?.ruleSystem?.runtimeSupport?.kernel?.type === "turn-taking-v1", "MCP turn-taking Build lost its Kernel");
  const turnPlaytestJob = await callTool("submit_job", {
    kind: "bot-playtest",
    projectId: turnProjectId,
    buildId: turnBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-turn-playtest-001",
  });
  const turnPlaytested = await waitForJob(turnPlaytestJob.id);
  const turnPlaytest = turnPlaytested.result;
  ensure(turnPlaytest?.terminalStatus === "turn-limit", "MCP turn-taking bot did not stop at the turn limit");
  ensure(turnPlaytest?.metrics?.turnTaking?.turns === 4, "MCP turn-taking metrics lost the final turn");
  ensure(turnPlaytest?.metrics?.turnTaking?.maxTurns === 4, "MCP turn-taking metrics lost maxTurns");
  ensure(turnPlaytest?.metrics?.winnerSeat === null, "MCP turn-taking bot invented a winner");
  const turnSession = await callTool("create_shared_session", {
    buildId: turnBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-turn-session-001",
  });
  ensure(turnSession.state.turnTaking?.maxTurns === 4, "MCP turn-taking Session lost maxTurns");
  ensure(turnSession.state.winnerSeat === null, "MCP turn-taking Session invented a winner");
  const turnActed = await callTool("submit_session_intent", {
    sessionId: turnSession.id,
    intentId: "local-mcp-turn-intent-001",
    seat: 0,
    actionId: turnKernel.actions[0].id,
  });
  ensure(turnActed.state.turn === 1 && turnActed.state.activeSeat === 1, "MCP turn-taking Session did not advance round-robin");
  ensure(turnActed.acceptedActions[0]?.points === 0, "MCP turn-taking action invented points");
  const turnReplay = await callTool("read_replay", { replayId: turnSession.replayId });
  ensure(turnReplay.acceptedActions.length === 1, "MCP turn-taking Replay did not reconstruct its action");
  ensure(turnReplay.finalState.turnTaking?.maxTurns === 4, "MCP turn-taking Replay lost maxTurns");

  const takeBrief = "两名玩家轮流从桌上的15枚石子中拿走石子。每回合可以拿1枚或拿2枚。拿到最后一枚石子的人获胜。";
  const takeCreated = await callTool("create_project", { name: "MCP 十五枚石子验证" });
  const takeProjectId = takeCreated.project.id;
  const takeGeneratedJob = await callTool("submit_job", {
    kind: "generate-rule-system",
    projectId: takeProjectId,
    expectedVersion: takeCreated.project.version,
    idea: takeBrief,
    sourceContent: takeBrief,
    sourceName: "mcp-take-away-brief.txt",
    sourceKind: "brief",
    name: "MCP 十五枚石子验证",
    idempotencyKey: "local-mcp-take-generate-001",
  });
  const takeGenerated = await waitForJob(takeGeneratedJob.id);
  ensure(takeGenerated.result?.ruleSystem?.runtimeSupport?.status === "draft", "MCP take-away generation must stay draft");
  const takeProposed = takeGenerated.result?.generationPlan?.proposedRuntime;
  ensure(takeProposed?.op === "configure_take_away", "MCP generation did not propose take-away-v1");
  ensure(takeProposed.config.initialPool === 15, "MCP take-away generation changed the initial pool");
  ensure(JSON.stringify(takeProposed.config.actions.map((action) => action.take)) === "[1,2]", "MCP take-away generation changed legal takes");
  const takeKernel = takeProposed.config;
  const takePlan = await readProject(takeProjectId, "generation-plan");
  const takeApproved = await callTool("apply_project_patch", {
    projectId: takeProjectId,
    expectedVersion: (await readProject(takeProjectId)).version,
    idempotencyKey: "local-mcp-take-approve-001",
    operations: [{
      op: "approve_generation_plan",
      planId: takePlan.generationPlan.id,
    }],
  });
  const takeCompileJob = await callTool("submit_job", {
    kind: "compile-build",
    projectId: takeProjectId,
    expectedVersion: takeApproved.project.version,
    idempotencyKey: "local-mcp-take-compile-001",
  });
  const takeCompiled = await waitForJob(takeCompileJob.id);
  const takeBuild = takeCompiled.result?.build;
  ensure(takeBuild?.ruleSystem?.runtimeSupport?.kernel?.type === "take-away-v1", "MCP take-away Build lost its Kernel");
  const takePlaytestJob = await callTool("submit_job", {
    kind: "bot-playtest",
    projectId: takeProjectId,
    buildId: takeBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-take-playtest-001",
  });
  const takePlaytested = await waitForJob(takePlaytestJob.id);
  const takePlaytest = takePlaytested.result;
  ensure(takePlaytest?.terminalStatus === "complete", "MCP take-away bot did not finish the pool");
  ensure(takePlaytest?.metrics?.takeAway?.remaining === 0, "MCP take-away metrics did not reach zero");
  ensure(Number.isInteger(takePlaytest?.metrics?.winnerSeat), "MCP take-away bot did not report a winner");
  const takeSession = await callTool("create_shared_session", {
    buildId: takeBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-take-session-001",
  });
  ensure(takeSession.state.takeAway?.remaining === 15, "MCP take-away Session lost its initial pool");
  const takeActed = await callTool("submit_session_intent", {
    sessionId: takeSession.id,
    intentId: "local-mcp-take-intent-001",
    seat: 0,
    actionId: takeKernel.actions[1].id,
  });
  ensure(takeActed.state.takeAway?.remaining === 13, "MCP take-away Session did not decrement the pool");
  const takeReplay = await callTool("read_replay", { replayId: takeSession.replayId });
  ensure(takeReplay.finalState.takeAway?.remaining === 13, "MCP take-away Replay did not reconstruct the pool");

  const rollBrief = "两名玩家轮流掷一颗六面骰子，并按点数前进相应格数。率先到达20格的玩家获胜。";
  const rollCreated = await callTool("create_project", { name: "MCP 二十格竞速验证" });
  const rollProjectId = rollCreated.project.id;
  const rollGeneratedJob = await callTool("submit_job", {
    kind: "generate-rule-system",
    projectId: rollProjectId,
    expectedVersion: rollCreated.project.version,
    idea: rollBrief,
    sourceContent: rollBrief,
    sourceName: "mcp-roll-and-move-brief.txt",
    sourceKind: "brief",
    name: "MCP 二十格竞速验证",
    idempotencyKey: "local-mcp-roll-generate-001",
  });
  const rollGenerated = await waitForJob(rollGeneratedJob.id);
  ensure(rollGenerated.result?.ruleSystem?.runtimeSupport?.status === "draft", "MCP roll-and-move generation must stay draft");
  const rollProposed = rollGenerated.result?.generationPlan?.proposedRuntime;
  ensure(rollProposed?.op === "configure_roll_and_move", "MCP generation did not propose roll-and-move-v1");
  ensure(rollProposed.config.dieSides === 6, "MCP roll-and-move generation changed the die");
  ensure(rollProposed.config.targetPosition === 20, "MCP roll-and-move generation changed the target");
  ensure(rollProposed.config.maxTurns === 80, "MCP roll-and-move generation changed the visible safety limit");
  const rollKernel = rollProposed.config;
  const rollPlan = await readProject(rollProjectId, "generation-plan");
  const rollApproved = await callTool("apply_project_patch", {
    projectId: rollProjectId,
    expectedVersion: (await readProject(rollProjectId)).version,
    idempotencyKey: "local-mcp-roll-approve-001",
    operations: [{
      op: "approve_generation_plan",
      planId: rollPlan.generationPlan.id,
    }],
  });
  const rollCompileJob = await callTool("submit_job", {
    kind: "compile-build",
    projectId: rollProjectId,
    expectedVersion: rollApproved.project.version,
    idempotencyKey: "local-mcp-roll-compile-001",
  });
  const rollCompiled = await waitForJob(rollCompileJob.id);
  const rollBuild = rollCompiled.result?.build;
  ensure(rollBuild?.ruleSystem?.runtimeSupport?.kernel?.type === "roll-and-move-v1", "MCP roll-and-move Build lost its Kernel");
  const rollPlaytestJob = await callTool("submit_job", {
    kind: "bot-playtest",
    projectId: rollProjectId,
    buildId: rollBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-roll-playtest-001",
  });
  const rollPlaytested = await waitForJob(rollPlaytestJob.id);
  const rollPlaytest = rollPlaytested.result;
  ensure(rollPlaytest?.terminalStatus === "complete", "MCP roll-and-move bot did not reach the target");
  ensure(Number.isInteger(rollPlaytest?.metrics?.winnerSeat), "MCP roll-and-move bot did not report a winner");
  ensure(Math.max(...rollPlaytest.metrics.rollAndMove.positions) === 20, "MCP roll-and-move metrics did not reach the target");
  const rollSession = await callTool("create_shared_session", {
    buildId: rollBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-roll-session-001",
  });
  ensure(JSON.stringify(rollSession.state.rollAndMove?.positions) === "[0,0]", "MCP roll-and-move Session did not start both seats at zero");
  const rollActed = await callTool("submit_session_intent", {
    sessionId: rollSession.id,
    intentId: "local-mcp-roll-intent-001",
    seat: 0,
    actionId: rollKernel.actions[0].id,
  });
  const firstRoll = rollActed.state.rollAndMove?.lastRoll;
  ensure(Number.isInteger(firstRoll) && firstRoll >= 1 && firstRoll <= 6, "MCP roll-and-move Session returned an invalid die result");
  ensure(rollActed.state.rollAndMove.positions[0] === firstRoll, "MCP roll-and-move Session did not advance by the roll");
  const rollReplay = await callTool("read_replay", { replayId: rollSession.replayId });
  ensure(rollReplay.finalState.rollAndMove?.lastRoll === firstRoll, "MCP roll-and-move Replay lost the die result");

  const drawBrief = "两名玩家轮流从洗牌后的牌库顶抽一张牌。牌库里有点数1到6的牌，每个点数各2张。玩家把抽到的点数加入自己的总分。率先达到15分者获胜；牌库用完仍无人达到时，总分最高者获胜。";
  const drawCreated = await callTool("create_project", { name: "MCP 抽牌竞分验证" });
  const drawProjectId = drawCreated.project.id;
  const drawGeneratedJob = await callTool("submit_job", {
    kind: "generate-rule-system",
    projectId: drawProjectId,
    expectedVersion: drawCreated.project.version,
    idea: drawBrief,
    sourceContent: drawBrief,
    sourceName: "mcp-draw-and-score-brief.txt",
    sourceKind: "brief",
    name: "MCP 抽牌竞分验证",
    idempotencyKey: "local-mcp-draw-generate-001",
  });
  const drawGenerated = await waitForJob(drawGeneratedJob.id);
  ensure(drawGenerated.result?.ruleSystem?.runtimeSupport?.status === "draft", "MCP draw generation must stay draft");
  const drawProposed = drawGenerated.result?.generationPlan?.proposedRuntime;
  ensure(drawProposed?.op === "configure_draw_and_score", "MCP generation did not propose draw-and-score-v1");
  ensure(JSON.stringify(drawProposed.config.cardValues) === "[1,2,3,4,5,6]", "MCP draw generation changed card values");
  ensure(drawProposed.config.copiesPerValue === 2, "MCP draw generation changed copies per value");
  ensure(drawProposed.config.victoryTarget === 15, "MCP draw generation changed the victory target");
  const drawKernel = drawProposed.config;
  const drawPlan = await readProject(drawProjectId, "generation-plan");
  const drawApproved = await callTool("apply_project_patch", {
    projectId: drawProjectId,
    expectedVersion: (await readProject(drawProjectId)).version,
    idempotencyKey: "local-mcp-draw-approve-001",
    operations: [{ op: "approve_generation_plan", planId: drawPlan.generationPlan.id }],
  });
  const drawCompileJob = await callTool("submit_job", {
    kind: "compile-build",
    projectId: drawProjectId,
    expectedVersion: drawApproved.project.version,
    idempotencyKey: "local-mcp-draw-compile-001",
  });
  const drawCompiled = await waitForJob(drawCompileJob.id);
  const drawBuild = drawCompiled.result?.build;
  ensure(drawBuild?.ruleSystem?.runtimeSupport?.kernel?.type === "draw-and-score-v1", "MCP draw Build lost its Kernel");
  const drawPlaytestJob = await callTool("submit_job", {
    kind: "bot-playtest",
    projectId: drawProjectId,
    buildId: drawBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-draw-playtest-001",
  });
  const drawPlaytested = await waitForJob(drawPlaytestJob.id);
  const drawPlaytest = drawPlaytested.result;
  ensure(drawPlaytest?.terminalStatus === "complete", "MCP draw bot did not finish");
  ensure(drawPlaytest?.metrics?.drawAndScore?.remainingCards >= 0, "MCP draw metrics lost deck state");
  const drawSession = await callTool("create_shared_session", {
    buildId: drawBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-draw-session-001",
  });
  ensure(drawSession.state.drawAndScore?.remainingCards === 12, "MCP draw Session lost the finite deck");
  ensure(!("deck" in drawSession.state) && !("cards" in drawSession.state.drawAndScore), "MCP draw Session exposed future deck order");
  const drawActed = await callTool("submit_session_intent", {
    sessionId: drawSession.id,
    intentId: "local-mcp-draw-intent-001",
    seat: 0,
    actionId: drawKernel.actions[0].id,
  });
  const firstDraw = drawActed.state.drawAndScore?.lastDraw;
  ensure(Number.isInteger(firstDraw) && firstDraw >= 1 && firstDraw <= 6, "MCP draw Session returned an invalid card");
  ensure(drawActed.state.scores[0] === firstDraw, "MCP draw Session did not score the card");
  ensure(drawActed.state.drawAndScore.remainingCards === 11, "MCP draw Session did not consume one card");
  const drawReplay = await callTool("read_replay", { replayId: drawSession.replayId });
  ensure(drawReplay.finalState.drawAndScore?.lastDraw === firstDraw, "MCP draw Replay lost the card result");

  const pushBrief = "两名玩家轮流进行回合。回合开始时未存分为0。当前玩家可以反复掷一颗六面骰子：掷出2到6就把点数加入本回合未存分，并可选择继续掷或收手；掷出1则本回合未存分清零并立即换人。选择收手时，把本回合未存分加入自己的总分并换人。率先达到20分者获胜。";
  const pushCreated = await callTool("create_project", { name: "MCP 冒险押注验证" });
  const pushProjectId = pushCreated.project.id;
  const pushGeneratedJob = await callTool("submit_job", {
    kind: "generate-rule-system",
    projectId: pushProjectId,
    expectedVersion: pushCreated.project.version,
    idea: pushBrief,
    sourceContent: pushBrief,
    sourceName: "mcp-push-your-luck-brief.txt",
    sourceKind: "brief",
    name: "MCP 冒险押注验证",
    idempotencyKey: "local-mcp-push-generate-001",
  });
  const pushGenerated = await waitForJob(pushGeneratedJob.id);
  ensure(pushGenerated.result?.ruleSystem?.runtimeSupport?.status === "draft", "MCP push generation must stay draft");
  const pushProposed = pushGenerated.result?.generationPlan?.proposedRuntime;
  ensure(pushProposed?.op === "configure_push_your_luck", "MCP generation did not propose push-your-luck-v1");
  ensure(pushProposed.config.dieSides === 6 && pushProposed.config.bustFace === 1, "MCP push generation changed die semantics");
  ensure(pushProposed.config.victoryTarget === 20, "MCP push generation changed the victory target");
  ensure(JSON.stringify(pushProposed.config.actions.map((action) => action.id)) === '["roll","bank"]', "MCP push generation lost its decisions");
  const pushKernel = pushProposed.config;
  const pushPlan = await readProject(pushProjectId, "generation-plan");
  const pushApproved = await callTool("apply_project_patch", {
    projectId: pushProjectId,
    expectedVersion: (await readProject(pushProjectId)).version,
    idempotencyKey: "local-mcp-push-approve-001",
    operations: [{ op: "approve_generation_plan", planId: pushPlan.generationPlan.id }],
  });
  const pushCompileJob = await callTool("submit_job", {
    kind: "compile-build",
    projectId: pushProjectId,
    expectedVersion: pushApproved.project.version,
    idempotencyKey: "local-mcp-push-compile-001",
  });
  const pushCompiled = await waitForJob(pushCompileJob.id);
  const pushBuild = pushCompiled.result?.build;
  ensure(pushBuild?.ruleSystem?.runtimeSupport?.kernel?.type === "push-your-luck-v1", "MCP push Build lost its Kernel");
  const pushPlaytestJob = await callTool("submit_job", {
    kind: "bot-playtest",
    projectId: pushProjectId,
    buildId: pushBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-push-playtest-001",
  });
  const pushPlaytested = await waitForJob(pushPlaytestJob.id);
  const pushPlaytest = pushPlaytested.result;
  ensure(pushPlaytest?.terminalStatus === "complete", "MCP push bot did not reach a winner");
  ensure(Number.isInteger(pushPlaytest?.metrics?.winnerSeat), "MCP push bot did not report a winner");
  ensure(pushPlaytest.metrics.finalScores[pushPlaytest.metrics.winnerSeat] >= 20, "MCP push winner did not reach target");
  const pushSession = await callTool("create_shared_session", {
    buildId: pushBuild.id,
    seed: 42,
    idempotencyKey: "local-mcp-push-session-001",
  });
  ensure(pushSession.state.pushYourLuck?.turnScore === 0, "MCP push Session did not start unbanked score at zero");
  const pushBusted = await callTool("submit_session_intent", {
    sessionId: pushSession.id,
    intentId: "local-mcp-push-bust-001",
    seat: 0,
    actionId: "roll",
  });
  ensure(pushBusted.state.pushYourLuck.lastRoll === 1, "MCP push fixed seed did not reproduce the bust");
  ensure(pushBusted.state.activeSeat === 1 && pushBusted.state.pushYourLuck.turnScore === 0, "MCP push bust did not clear and pass turn");
  const pushSafe = await callTool("submit_session_intent", {
    sessionId: pushSession.id,
    intentId: "local-mcp-push-safe-001",
    seat: 1,
    actionId: "roll",
  });
  ensure(pushSafe.state.pushYourLuck.lastRoll === 5 && pushSafe.state.pushYourLuck.turnScore === 5, "MCP push safe roll did not accumulate");
  const pushBanked = await callTool("submit_session_intent", {
    sessionId: pushSession.id,
    intentId: "local-mcp-push-bank-001",
    seat: 1,
    actionId: "bank",
  });
  ensure(pushBanked.state.scores[1] === 5 && pushBanked.state.activeSeat === 0, "MCP push bank did not persist score and pass turn");
  const pushReplay = await callTool("read_replay", { replayId: pushSession.replayId });
  ensure(pushReplay.finalState.scores[1] === 5 && pushReplay.acceptedActions.length === 3, "MCP push Replay lost the decision sequence");

  return {
    projectId,
    studioUrl: created.studioUrl,
    generationJobId: generatedJob.id,
    planId: pendingPlan.generationPlan.id,
    buildId: build.id,
    iteratedBuildId: iteratedBuild.id,
    restoredRuleSystemId: restored.ruleSystem.id,
    previewJobId: previewJob.id,
    playtestJobId: playtestJob.id,
    playtestId: playtest.id,
    iterationPlaytestId: iterationPlaytest.id,
    sessionId: session.id,
    publishedSessionId: publishedSession.id,
    playtestUrl: publishedView.playtestLink.url,
    replayId: session.replayId,
    hypothesisId,
    feedbackFindingId,
    visualBriefId,
    visualReferenceId,
    generatedImageId,
    turnProjectId,
    turnGenerationJobId: turnGeneratedJob.id,
    turnBuildId: turnBuild.id,
    turnPlaytestId: turnPlaytest.id,
    turnSessionId: turnSession.id,
    turnReplayId: turnSession.replayId,
    takeProjectId,
    takeGenerationJobId: takeGeneratedJob.id,
    takeBuildId: takeBuild.id,
    takePlaytestId: takePlaytest.id,
    takeSessionId: takeSession.id,
    takeReplayId: takeSession.replayId,
    rollProjectId,
    rollGenerationJobId: rollGeneratedJob.id,
    rollBuildId: rollBuild.id,
    rollPlaytestId: rollPlaytest.id,
    rollSessionId: rollSession.id,
    rollReplayId: rollSession.replayId,
    drawProjectId,
    drawGenerationJobId: drawGeneratedJob.id,
    drawBuildId: drawBuild.id,
    drawPlaytestId: drawPlaytest.id,
    drawSessionId: drawSession.id,
    drawReplayId: drawSession.replayId,
    pushProjectId,
    pushGenerationJobId: pushGeneratedJob.id,
    pushBuildId: pushBuild.id,
    pushPlaytestId: pushPlaytest.id,
    pushSessionId: pushSession.id,
    pushReplayId: pushSession.replayId,
    discoveredToolCount: toolNames.length,
    invariants: [
      "mcp-initialize",
      "mcp-tool-discovery",
      "mcp-prompt-source-generation",
      "mcp-generation-plan-approval",
      "mcp-build-preview",
      "mcp-automated-playtest",
      "mcp-shared-session-intent",
      "mcp-stable-playtest-link",
      "mcp-participant-feedback-finding",
      "mcp-feedback-moment-attribution",
      "mcp-experiment-brief-feedback-binding",
      "mcp-feedback-driven-iteration",
      "mcp-finding-build-lineage",
      "mcp-generated-asset-lineage",
      "mcp-visual-reference-separation",
      "mcp-replay-reconstruction",
      "mcp-build-restore-lineage",
      "mcp-turn-taking-loop",
      "mcp-take-away-loop",
      "mcp-roll-and-move-loop",
      "mcp-draw-and-score-loop",
      "mcp-push-your-luck-loop",
    ],
  };
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const persistTo = await mkdtemp(join(tmpdir(), "godesk-local-mcp-loop-"));
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
  console.log(`Local MCP control-plane loop verification passed at ${origin}.`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("close", resolve));
  }
  await rm(persistTo, { recursive: true, force: true });
}
