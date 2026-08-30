import type { DefaultExampleId } from "./default-examples";

export const COMPOSER_DRAFT_KEY = "godesk-composer-draft";

export type ComposerDraft = {
  name: string;
  description: string;
  rulesText: string;
  resume: "generate" | "example" | null;
  exampleId?: DefaultExampleId;
};

type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function defaultStorage(): DraftStorage | undefined {
  try {
    const storage = globalThis.sessionStorage;
    return storage ?? undefined;
  } catch {
    return undefined;
  }
}

function isExampleId(value: unknown): value is DefaultExampleId {
  return value === "harbor-13" || value === "mistpeak-lodge" || value === "idea-relay";
}

export function readComposerDraft(storage: DraftStorage | undefined = defaultStorage()) {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(COMPOSER_DRAFT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<ComposerDraft>;
    if (typeof parsed.description !== "string" || typeof parsed.rulesText !== "string") {
      return undefined;
    }
    const resume = parsed.resume === "generate" || parsed.resume === "example"
      ? parsed.resume
      : null;
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : "我的游戏",
      description: parsed.description,
      rulesText: parsed.rulesText,
      resume,
      exampleId: resume === "example" && isExampleId(parsed.exampleId) ? parsed.exampleId : undefined,
    } satisfies ComposerDraft;
  } catch {
    return undefined;
  }
}

export function writeComposerDraft(
  draft: ComposerDraft,
  storage: DraftStorage | undefined = defaultStorage(),
) {
  storage?.setItem(COMPOSER_DRAFT_KEY, JSON.stringify(draft));
}

export function clearComposerDraft(storage: DraftStorage | undefined = defaultStorage()) {
  storage?.removeItem(COMPOSER_DRAFT_KEY);
}
