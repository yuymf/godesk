export type ConversationRelayState = {
  transcript: Array<{ seat: number; actionId: string; text: string }>;
};

export function createConversationRelayState(): ConversationRelayState {
  return { transcript: [] };
}

export function applyConversationRelayIntent(
  state: ConversationRelayState,
  seat: number,
  actionId: string,
  payload?: Record<string, unknown>,
): { state: ConversationRelayState; text: string } | null {
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (text.length < 2) return null;
  return {
    text,
    state: {
      transcript: [...state.transcript, { seat, actionId, text }],
    },
  };
}
