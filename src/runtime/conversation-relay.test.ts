import { describe, expect, it } from "vitest";
import {
  applyConversationRelayIntent,
  createConversationRelayState,
} from "./conversation-relay";

describe("conversation-relay-v1", () => {
  it("rejects empty speech and records spoken text", () => {
    const empty = applyConversationRelayIntent(
      createConversationRelayState(),
      0,
      "extend",
      { text: " " },
    );
    expect(empty).toBeNull();
    const spoken = applyConversationRelayIntent(
      createConversationRelayState(),
      1,
      "constraint",
      { text: "雨夜里多了一盏灯。" },
    );
    expect(spoken).toEqual({
      text: "雨夜里多了一盏灯。",
      state: {
        transcript: [{
          seat: 1,
          actionId: "constraint",
          text: "雨夜里多了一盏灯。",
        }],
      },
    });
  });
});
