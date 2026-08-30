import { describe, expect, it } from "vitest";
import {
  COMPOSER_DRAFT_KEY,
  clearComposerDraft,
  readComposerDraft,
  writeComposerDraft,
} from "./composer-draft";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
}

describe("hobbyist composer draft", () => {
  it("round-trips the idea so a login bounce can resume generate", () => {
    const storage = memoryStorage();
    writeComposerDraft(
      {
        name: "3人剧本杀",
        description: "三个人在别墅里讨论谁是凶手。",
        rulesText: "",
        resume: "generate",
      },
      storage,
    );

    expect(readComposerDraft(storage)).toEqual({
      name: "3人剧本杀",
      description: "三个人在别墅里讨论谁是凶手。",
      rulesText: "",
      resume: "generate",
      exampleId: undefined,
    });
  });

  it("keeps a ready-made example resume across login", () => {
    const storage = memoryStorage();
    writeComposerDraft(
      {
        name: "我的游戏",
        description: "",
        rulesText: "",
        resume: "example",
        exampleId: "idea-relay",
      },
      storage,
    );

    expect(readComposerDraft(storage)?.resume).toBe("example");
    expect(readComposerDraft(storage)?.exampleId).toBe("idea-relay");
  });

  it("ignores a broken payload instead of blocking the composer", () => {
    const storage = memoryStorage();
    storage.setItem(COMPOSER_DRAFT_KEY, "{not-json");
    expect(readComposerDraft(storage)).toBeUndefined();
  });

  it("clears the draft when starting a new game", () => {
    const storage = memoryStorage();
    writeComposerDraft(
      {
        name: "轻桌游",
        description: "两到四人在棋盘上抢地盘。",
        rulesText: "",
        resume: null,
      },
      storage,
    );
    clearComposerDraft(storage);
    expect(readComposerDraft(storage)).toBeUndefined();
  });
});
