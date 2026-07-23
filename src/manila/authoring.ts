export type Interpretation = "A" | "B";

export type DivergenceDecision =
  | { status: "pending"; summary: string; origin: "none" }
  | {
      status: "accepted";
      summary: string;
      origin: "candidate" | "edited" | "interpretation";
      interpretation?: Interpretation;
    }
  | { status: "rejected"; summary: string; origin: "human" }
  | { status: "unresolved"; summary: string; origin: "human" };

type DivergenceSnapshot = {
  candidateText: string;
  decision: DivergenceDecision;
  replacementSource?: string;
};

export type DivergenceState = DivergenceSnapshot & {
  history: DivergenceSnapshot[];
};

export type DivergenceAction =
  | { type: "accept-candidate" }
  | { type: "edit-and-accept"; text: string }
  | { type: "choose-interpretation"; interpretation: Interpretation }
  | { type: "reject" }
  | { type: "mark-unresolved" }
  | { type: "replace-source"; source: string }
  | { type: "undo" };

const interpretationCopy = {
  A: "领航员把平底船移动到 13 时不触发海盗；只在移动轮结束后检查海盗。",
  B: "平底船以任何方式到达 13 都立刻触发海盗，包括领航员移动。",
} as const;

export function createDivergenceState(): DivergenceState {
  return {
    candidateText: interpretationCopy.B,
    decision: {
      status: "pending",
      summary: "等待人类决定，项目不能编译。",
      origin: "none",
    },
    history: [],
  };
}

function snapshot(state: DivergenceState): DivergenceSnapshot {
  return {
    candidateText: state.candidateText,
    decision: state.decision,
    replacementSource: state.replacementSource,
  };
}

function transition(
  state: DivergenceState,
  next: Partial<DivergenceSnapshot>,
): DivergenceState {
  return {
    ...state,
    ...next,
    history: [...state.history, snapshot(state)],
  };
}

export function divergenceReducer(
  state: DivergenceState,
  action: DivergenceAction,
): DivergenceState {
  switch (action.type) {
    case "accept-candidate":
      return transition(state, {
        decision: {
          status: "accepted",
          summary: state.candidateText,
          origin: "candidate",
          interpretation: "B",
        },
      });
    case "edit-and-accept": {
      const text = action.text.trim();
      if (!text) return state;
      return transition(state, {
        candidateText: text,
        decision: {
          status: "accepted",
          summary: text,
          origin: "edited",
        },
      });
    }
    case "choose-interpretation":
      return transition(state, {
        decision: {
          status: "accepted",
          summary: interpretationCopy[action.interpretation],
          origin: "interpretation",
          interpretation: action.interpretation,
        },
      });
    case "reject":
      return transition(state, {
        decision: {
          status: "rejected",
          summary: "候选已拒绝；这是必需规则，缺口仍会阻止编译。",
          origin: "human",
        },
      });
    case "mark-unresolved":
      return transition(state, {
        decision: {
          status: "unresolved",
          summary: "已暂缓决定；项目保持阻塞，不会静默跳过。",
          origin: "human",
        },
      });
    case "replace-source": {
      const source = action.source.trim();
      if (!source) return state;
      return transition(state, { replacementSource: source });
    }
    case "undo": {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      return {
        ...previous,
        history: state.history.slice(0, -1),
      };
    }
  }
}

export function isDivergenceBlocking(state: DivergenceState) {
  return state.decision.status !== "accepted";
}

export function divergenceImpact(state: DivergenceState) {
  if (state.decision.status !== "accepted") {
    return "编译保持阻塞；运行时不会获得这条海盗触发规则。";
  }
  if (state.decision.interpretation === "A") {
    return "运行时只在第二、第三次骰子移动结束后检查海盗；领航员移动到 13 不攻击。";
  }
  if (state.decision.interpretation === "B") {
    return "运行时会在领航员把船移动到 13 时立刻触发海盗攻击。";
  }
  return `运行时将使用人工编辑后的规则：${state.decision.summary}`;
}

export type ComponentCountDecision = "pending" | "rulebook-20" | "photo-16";
export type MissingAssetDecision = "pending" | "internal-placeholder" | "attached";

type ExerciseSnapshot = {
  rulebookAccepted: boolean;
  corruptMirrorRejected: boolean;
  puntCandidateAccepted: boolean;
  componentCountDecision: ComponentCountDecision;
  missingAssetDecision: MissingAssetDecision;
  attachedAsset?: string;
};

export type AuthoringExerciseState = ExerciseSnapshot & {
  history: ExerciseSnapshot[];
};

export type AuthoringExerciseAction =
  | { type: "accept-rulebook" }
  | { type: "reject-corrupt-mirror" }
  | { type: "accept-punt-candidate" }
  | { type: "choose-component-count"; decision: Exclude<ComponentCountDecision, "pending"> }
  | { type: "use-internal-placeholder" }
  | { type: "attach-asset"; asset: string }
  | { type: "undo" };

export function createAuthoringExerciseState(): AuthoringExerciseState {
  return {
    rulebookAccepted: false,
    corruptMirrorRejected: false,
    puntCandidateAccepted: false,
    componentCountDecision: "pending",
    missingAssetDecision: "pending",
    history: [],
  };
}

function exerciseSnapshot(state: AuthoringExerciseState): ExerciseSnapshot {
  return {
    rulebookAccepted: state.rulebookAccepted,
    corruptMirrorRejected: state.corruptMirrorRejected,
    puntCandidateAccepted: state.puntCandidateAccepted,
    componentCountDecision: state.componentCountDecision,
    missingAssetDecision: state.missingAssetDecision,
    attachedAsset: state.attachedAsset,
  };
}

function exerciseTransition(
  state: AuthoringExerciseState,
  next: Partial<ExerciseSnapshot>,
): AuthoringExerciseState {
  return {
    ...state,
    ...next,
    history: [...state.history, exerciseSnapshot(state)],
  };
}

export function authoringExerciseReducer(
  state: AuthoringExerciseState,
  action: AuthoringExerciseAction,
): AuthoringExerciseState {
  switch (action.type) {
    case "accept-rulebook":
      return exerciseTransition(state, { rulebookAccepted: true });
    case "reject-corrupt-mirror":
      return exerciseTransition(state, { corruptMirrorRejected: true });
    case "accept-punt-candidate":
      return exerciseTransition(state, { puntCandidateAccepted: true });
    case "choose-component-count":
      return exerciseTransition(state, {
        componentCountDecision: action.decision,
      });
    case "use-internal-placeholder":
      return exerciseTransition(state, {
        missingAssetDecision: "internal-placeholder",
        attachedAsset: undefined,
      });
    case "attach-asset": {
      const asset = action.asset.trim();
      if (!asset) return state;
      return exerciseTransition(state, {
        missingAssetDecision: "attached",
        attachedAsset: asset,
      });
    }
    case "undo": {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      return {
        ...previous,
        history: state.history.slice(0, -1),
      };
    }
  }
}

export function isSourceReviewComplete(state: AuthoringExerciseState) {
  return state.rulebookAccepted && state.corruptMirrorRejected;
}

export function isComponentReviewComplete(state: AuthoringExerciseState) {
  return (
    state.puntCandidateAccepted &&
    state.componentCountDecision === "rulebook-20" &&
    state.missingAssetDecision !== "pending"
  );
}

export function canCompileExercise(
  exercise: AuthoringExerciseState,
  divergence: DivergenceState,
) {
  return (
    isSourceReviewComplete(exercise) &&
    isComponentReviewComplete(exercise) &&
    !isDivergenceBlocking(divergence)
  );
}

export const publicationRemainsBlocked = true;
