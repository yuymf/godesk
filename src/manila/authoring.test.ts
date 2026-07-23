import { describe, expect, it } from "vitest";
import {
  authoringExerciseReducer,
  canCompileExercise,
  createAuthoringExerciseState,
  createDivergenceState,
  divergenceImpact,
  divergenceReducer,
  isComponentReviewComplete,
  isDivergenceBlocking,
  isSourceReviewComplete,
  publicationRemainsBlocked,
} from "./authoring";

describe("divergence decisions", () => {
  it("blocks compilation until a human accepts a rule", () => {
    const initial = createDivergenceState();
    expect(isDivergenceBlocking(initial)).toBe(true);

    const accepted = divergenceReducer(initial, {
      type: "choose-interpretation",
      interpretation: "A",
    });
    expect(isDivergenceBlocking(accepted)).toBe(false);
    expect(accepted.decision.status).toBe("accepted");
    expect(divergenceImpact(accepted)).toContain("领航员移动到 13 不攻击");
  });

  it("supports candidate acceptance and edited acceptance", () => {
    const initial = createDivergenceState();
    const candidate = divergenceReducer(initial, { type: "accept-candidate" });
    expect(candidate.decision).toMatchObject({
      status: "accepted",
      origin: "candidate",
      interpretation: "B",
    });

    const edited = divergenceReducer(initial, {
      type: "edit-and-accept",
      text: "只在骰子移动结束时检查海盗。",
    });
    expect(edited.decision).toMatchObject({
      status: "accepted",
      origin: "edited",
      summary: "只在骰子移动结束时检查海盗。",
    });
  });

  it("keeps rejected and unresolved required rules blocked", () => {
    const initial = createDivergenceState();
    expect(
      isDivergenceBlocking(divergenceReducer(initial, { type: "reject" })),
    ).toBe(true);
    expect(
      isDivergenceBlocking(
        divergenceReducer(initial, { type: "mark-unresolved" }),
      ),
    ).toBe(true);
  });

  it("replaces a source and undoes the last decision", () => {
    const initial = createDivergenceState();
    const sourced = divergenceReducer(initial, {
      type: "replace-source",
      source: "designer-clarification.md",
    });
    expect(sourced.replacementSource).toBe("designer-clarification.md");

    const chosen = divergenceReducer(sourced, {
      type: "choose-interpretation",
      interpretation: "A",
    });
    const undoneChoice = divergenceReducer(chosen, { type: "undo" });
    expect(undoneChoice.decision.status).toBe("pending");

    const undoneSource = divergenceReducer(undoneChoice, { type: "undo" });
    expect(undoneSource.replacementSource).toBeUndefined();
  });
});

describe("seeded authoring exercise", () => {
  it("requires both source-quality decisions", () => {
    const initial = createAuthoringExerciseState();
    const accepted = authoringExerciseReducer(initial, {
      type: "accept-rulebook",
    });
    expect(isSourceReviewComplete(accepted)).toBe(false);

    const reviewed = authoringExerciseReducer(accepted, {
      type: "reject-corrupt-mirror",
    });
    expect(isSourceReviewComplete(reviewed)).toBe(true);
  });

  it("requires the source-backed count and a missing-asset disposition", () => {
    let state = createAuthoringExerciseState();
    state = authoringExerciseReducer(state, { type: "accept-punt-candidate" });
    state = authoringExerciseReducer(state, {
      type: "choose-component-count",
      decision: "photo-16",
    });
    state = authoringExerciseReducer(state, {
      type: "use-internal-placeholder",
    });
    expect(isComponentReviewComplete(state)).toBe(false);

    state = authoringExerciseReducer(state, {
      type: "choose-component-count",
      decision: "rulebook-20",
    });
    expect(isComponentReviewComplete(state)).toBe(true);
  });

  it("compiles only after source, component, and rule decisions pass", () => {
    let exercise = createAuthoringExerciseState();
    exercise = authoringExerciseReducer(exercise, { type: "accept-rulebook" });
    exercise = authoringExerciseReducer(exercise, {
      type: "reject-corrupt-mirror",
    });
    exercise = authoringExerciseReducer(exercise, {
      type: "accept-punt-candidate",
    });
    exercise = authoringExerciseReducer(exercise, {
      type: "choose-component-count",
      decision: "rulebook-20",
    });
    exercise = authoringExerciseReducer(exercise, {
      type: "attach-asset",
      asset: "port-reference.png",
    });

    const pending = createDivergenceState();
    expect(canCompileExercise(exercise, pending)).toBe(false);

    const decided = divergenceReducer(pending, {
      type: "choose-interpretation",
      interpretation: "A",
    });
    expect(canCompileExercise(exercise, decided)).toBe(true);
    expect(publicationRemainsBlocked).toBe(true);
  });

  it("undoes the last seeded exercise mutation", () => {
    const initial = createAuthoringExerciseState();
    const attached = authoringExerciseReducer(initial, {
      type: "attach-asset",
      asset: "port-reference.png",
    });
    const undone = authoringExerciseReducer(attached, { type: "undo" });
    expect(undone.missingAssetDecision).toBe("pending");
    expect(undone.attachedAsset).toBeUndefined();
  });
});
