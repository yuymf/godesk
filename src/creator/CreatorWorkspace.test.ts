import { describe, expect, it } from "vitest";
import {
  buildCanOpenSharedSession,
  draftExpectedVersion,
  findingContinuationPrompt,
  generationSourceFields,
  latestBuildPlaytestComparison,
  latestStudioPlayTarget,
  latestActiveCreatorJob,
  parseRuleSystemStructure,
  participantFeedbackFindingNotes,
  participantFeedbackInbox,
  projectActivityRequiresFullRefresh,
  roomActionTitle,
  roomSurfaceCopy,
  shouldStartRuleSystemDraft,
  upsertCreatorJob,
  validationStudioHref,
  visibleCreatorJob,
} from "./CreatorWorkspace";
import type { CreatorJob, PlayableBuild, PlaytestRun, SharedSession } from "./project-contract";
import { normalizeAppPathname } from "../App";
import { DEFAULT_EXAMPLES } from "./default-examples";
import {
  publicSharedSession,
  sharedSessionSocketUrl,
} from "./project-api";

describe("Creator Studio optimistic draft baseline", () => {
  const queuedJob = {
    id: "job_demo",
    projectId: "project_demo",
    kind: "compile-build" as const,
    status: "queued" as const,
    idempotencyKey: "key_demo",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
  };

  it("replaces a polled job snapshot instead of duplicating it", () => {
    const runningJob = {
      ...queuedJob,
      status: "running" as const,
      updatedAt: "2026-08-11T00:00:01.000Z",
    };

    expect(upsertCreatorJob([queuedJob], runningJob)).toEqual([runningJob]);
  });

  it("shows the newest durable task that is still active", () => {
    const runningJob = {
      ...queuedJob,
      status: "running" as const,
      updatedAt: "2026-08-11T00:00:01.000Z",
    };
    const completedJob = {
      ...queuedJob,
      id: "job_newer_but_done",
      status: "succeeded" as const,
      updatedAt: "2026-08-11T00:00:02.000Z",
    };

    expect(latestActiveCreatorJob([completedJob, runningJob])).toEqual(runningJob);
    expect(visibleCreatorJob([completedJob, runningJob])).toEqual(runningJob);
  });

  it("keeps the latest durable result visible when no task is active", () => {
    const completedJob = {
      ...queuedJob,
      status: "succeeded" as const,
      updatedAt: "2026-08-11T00:00:02.000Z",
    };

    expect(visibleCreatorJob([completedJob])).toEqual(completedJob);
  });

  it("does a full Studio refresh only when project or job activity changes", () => {
    expect(projectActivityRequiresFullRefresh(3, 3, [queuedJob], [queuedJob])).toBe(false);
    expect(projectActivityRequiresFullRefresh(3, 3, [queuedJob], [{
      ...queuedJob,
      result: { warnings: ["same activity, richer payload"] },
    } as CreatorJob])).toBe(false);
    expect(projectActivityRequiresFullRefresh(3, 4, [queuedJob], [queuedJob])).toBe(true);
    expect(projectActivityRequiresFullRefresh(3, 3, [queuedJob], [{
      ...queuedJob,
      status: "running",
      updatedAt: "2026-08-11T00:00:01.000Z",
    }])).toBe(true);
  });

  it("compares only the newest two builds with matching playtest seeds", () => {
    const build = (id: string, createdAt: string) => ({ id, createdAt }) as PlayableBuild;
    const playtest = (
      id: string,
      buildId: string,
      seed: number,
      createdAt: string,
    ) => ({ id, buildId, seed, createdAt }) as PlaytestRun;
    const oldBuild = build("build_old", "2026-08-11T00:00:00.000Z");
    const baselineBuild = build("build_baseline", "2026-08-11T00:00:01.000Z");
    const candidateBuild = build("build_candidate", "2026-08-11T00:00:02.000Z");
    const baselinePlaytest = playtest("playtest_baseline", baselineBuild.id, 42, "2026-08-11T00:00:03.000Z");
    const candidatePlaytest = playtest("playtest_candidate", candidateBuild.id, 42, "2026-08-11T00:00:04.000Z");

    expect(latestBuildPlaytestComparison(
      [candidateBuild, oldBuild, baselineBuild],
      [playtest("playtest_old", oldBuild.id, 42, "2026-08-11T00:00:05.000Z"), candidatePlaytest, baselinePlaytest],
    )).toEqual({
      baselineBuild,
      baselinePlaytest,
      candidateBuild,
      candidatePlaytest,
    });
  });

  it("does not compare two builds without the same seed", () => {
    const baselineBuild = { id: "build_baseline", createdAt: "2026-08-11T00:00:00.000Z" } as PlayableBuild;
    const candidateBuild = { id: "build_candidate", createdAt: "2026-08-11T00:00:01.000Z" } as PlayableBuild;

    expect(latestBuildPlaytestComparison(
      [baselineBuild, candidateBuild],
      [
        { buildId: baselineBuild.id, seed: 1, createdAt: "2026-08-11T00:00:02.000Z" } as PlaytestRun,
        { buildId: candidateBuild.id, seed: 42, createdAt: "2026-08-11T00:00:03.000Z" } as PlaytestRun,
      ],
    )).toBeUndefined();
  });

  it("targets the newest Build and only its newest Shared Session for Studio play", () => {
    const olderBuild = {
      id: "build_old",
      createdAt: "2026-08-11T00:00:00.000Z",
    } as PlayableBuild;
    const latestBuild = {
      id: "build_latest",
      createdAt: "2026-08-11T00:00:02.000Z",
    } as PlayableBuild;
    const oldBuildSession = {
      id: "room_wrong_build",
      buildId: olderBuild.id,
      createdAt: "2026-08-11T00:00:04.000Z",
    } as SharedSession;
    const olderLatestBuildSession = {
      id: "room_older",
      buildId: latestBuild.id,
      createdAt: "2026-08-11T00:00:01.000Z",
    } as SharedSession;
    const newestLatestBuildSession = {
      id: "room_newest",
      buildId: latestBuild.id,
      createdAt: "2026-08-11T00:00:03.000Z",
    } as SharedSession;

    expect(latestStudioPlayTarget(
      [olderBuild, latestBuild],
      [oldBuildSession, newestLatestBuildSession, olderLatestBuildSession],
    )).toEqual({ build: latestBuild, session: newestLatestBuildSession });
  });

  it("opens a Shared Session only for executable Builds that pass the visual floor", () => {
    const build = {
      ruleSystem: { runtimeSupport: { status: "executable" } },
      presentationFloor: { status: "passed" },
    } as PlayableBuild;
    expect(buildCanOpenSharedSession(build)).toBe(true);
    expect(buildCanOpenSharedSession({
      ...build,
      presentationFloor: { status: "failed" },
    } as PlayableBuild)).toBe(false);
    expect(buildCanOpenSharedSession({
      ...build,
      ruleSystem: { runtimeSupport: { status: "draft" } },
    } as PlayableBuild)).toBe(false);
  });

  it("keeps the version where editing began after polling sees a newer project", () => {
    expect(draftExpectedVersion(3, 4)).toBe(3);
  });

  it("uses the visible version when no Rule System draft exists", () => {
    expect(draftExpectedVersion(null, 4)).toBe(4);
  });

  it("keeps the installation surface on a trailing-slash URL", () => {
    expect(normalizeAppPathname("/chatgpt-plugin/")).toBe("/chatgpt-plugin");
    expect(normalizeAppPathname("////")).toBe("/");
  });

  it("builds Room WebSocket and share URLs without losing creator scope", () => {
    expect(sharedSessionSocketUrl("room/a b", "creator/demo", {
      origin: "https://godesk.example",
      protocol: "https:",
    })).toBe(
      "wss://godesk.example/api/sessions/room%2Fa%20b/events?creator=creator%2Fdemo",
    );
    expect(publicSharedSession({
      id: "room/a b",
      projectId: "project_demo",
      buildId: "build_demo",
      seed: 42,
      state: {
        turn: 0,
        activeSeat: 0,
        scores: [0],
        status: "active",
        winnerSeat: null,
      },
      seats: [],
      acceptedActions: [],
      feedback: [],
      experiment: null,
      replayId: "replay/a b",
      createdAt: "2026-08-11T00:00:00.000Z",
    }, "https://godesk.example", "creator/demo")).toMatchObject({
      sessionUrl:
        "https://godesk.example/room/room%2Fa%20b?creator=creator%2Fdemo",
      replayUrl:
        "https://godesk.example/replay/replay%2Fa%20b?creator=creator%2Fdemo",
    });
  });

  it("orders participant feedback by its latest persisted update", () => {
    const session = (id: string, feedbackId: string, updatedAt: string) => ({
      id,
      feedback: [{
        id: feedbackId,
        seat: 0,
        rating: 4,
        comment: `${feedbackId} comment`,
        moment: { actionSequence: 1, actionId: "act" },
        createdAt: updatedAt,
        updatedAt,
      }],
    }) as SharedSession;
    const older = session("room_old", "feedback_old", "2026-08-11T00:00:01.000Z");
    const newer = session("room_new", "feedback_new", "2026-08-11T00:00:02.000Z");

    expect(participantFeedbackInbox([older, newer]).map(({ feedback }) => feedback.id))
      .toEqual(["feedback_new", "feedback_old"]);
  });

  it("prefills a Finding observation with the exact Feedback Moment", () => {
    expect(participantFeedbackFindingNotes({
      id: "feedback_demo",
      seat: 2,
      rating: 3,
      comment: "目标清楚，但第二个选择没有张力。",
      moment: { actionSequence: 4, actionId: "investigate" },
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
    }, "调查线索")).toBe(
      "座位 2 · 行动 #4 调查线索 · 3/5\n目标清楚，但第二个选择没有张力。",
    );
  });

  it("starts the optimistic baseline when Source Library editing begins", () => {
    expect(shouldStartRuleSystemDraft("", "first source note")).toBe(true);
    expect(shouldStartRuleSystemDraft("first source note", "edited note")).toBe(false);
    expect(shouldStartRuleSystemDraft("", "   ")).toBe(false);
  });

  it("omits an empty optional source from idea-only generation", () => {
    expect(generationSourceFields("", "idea.txt", "brief")).toEqual({});
    expect(generationSourceFields("", "idea visual material", "brief", true)).toEqual({
      sourceName: "idea visual material",
      sourceKind: "brief",
    });
    expect(generationSourceFields("rules", "rules.txt", "brief")).toEqual({
      sourceContent: "rules",
      sourceName: "rules.txt",
      sourceKind: "brief",
    });
  });

  it("carries a playtest back to the same project validation form", () => {
    expect(validationStudioHref("project_demo", {
      buildId: "build_demo",
      evidenceType: "automated-playtest",
      evidenceId: "playtest_demo",
    })).toBe(
      "/studio/project_demo?build=build_demo&evidenceType=automated-playtest&evidence=playtest_demo#validation",
    );
  });

  it("carries participant feedback back to the same project validation form", () => {
    expect(validationStudioHref("project_demo", {
      buildId: "build_demo",
      evidenceType: "participant-feedback",
      evidenceId: "room_demo",
      hypothesisId: "hypothesis_demo",
    })).toBe(
      "/studio/project_demo?build=build_demo&evidenceType=participant-feedback&evidence=room_demo&hypothesis=hypothesis_demo#validation",
    );
  });

  it("creates a same-project Codex continuation prompt from one Finding", () => {
    expect(findingContinuationPrompt("project_demo", {
      id: "finding_demo",
      nextChange: "把回合上限从 8 调到 6",
    })).toBe(
      "继续 GoDesk 项目 project_demo：应用 Validation Finding finding_demo 的下一版改动“把回合上限从 8 调到 6”，在同一项目编译新 Build，并用相同 seed 自动试玩比较。",
    );
  });

  it("keeps the room action labels switchable without mixing languages", () => {
    expect(roomActionTitle("zh", 0)).toBe("行动 1");
    expect(roomActionTitle("en", 0)).toBe("Action 1");
  });

  it("offers a non-tabletop conversation game on the creator home", () => {
    expect(DEFAULT_EXAMPLES).toContainEqual(expect.objectContaining({
      id: "idea-relay",
      title: "灵感接力",
    }));
  });

  it("renders conversation games without tabletop presentation labels", () => {
    expect(roomSurfaceCopy("conversation", "zh")).toEqual({
      label: "对话游戏",
      title: "共同创作区",
      visual: "Rule System 对话呈现",
    });
    expect(roomSurfaceCopy("table", "zh").label).toBe("桌面游戏");
    expect(roomSurfaceCopy("scene", "zh").label).toBe("场景游戏");
  });

  it("rejects incomplete Rule System structure drafts before saving", () => {
    expect(() => parseRuleSystemStructure('{"rules":[]}')).toThrow(
      "Rule System 结构 JSON 缺少必填字段。",
    );
  });
});
