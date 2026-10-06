/**
 * Regression: `webSocketClose` echoed the peer's close code back into
 * `socket.close(code)`. When the browser drops without a Close frame the
 * runtime reports 1006 (or 1005 for an empty Close frame); those codes are
 * reserved and `close()` throws `Invalid WebSocket close code`, which surfaced
 * as `Uncaught Error at webSocketClose` in `wrangler dev` and left the local
 * server wedged during long Playwright / judge runs.
 */
import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { CreatorProjects, sendableCloseCode } from "./creator-projects-do";

function stub(name: string) {
  return env.CREATOR_PROJECTS.get(env.CREATOR_PROJECTS.idFromName(name));
}

function serverSocket() {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  client.accept();
  return { client, server };
}

describe("session socket close", () => {
  it.each([1005, 1006, 1015])("does not throw for reserved close code %i", async (code) => {
    await runInDurableObject(stub(`ws-close-${code}`), async (instance: CreatorProjects) => {
      const { server } = serverSocket();
      expect(() => instance.webSocketClose(server, code, "")).not.toThrow();
    });
  });

  it("still reciprocates a normal close and tolerates an already-closed socket", async () => {
    await runInDurableObject(stub("ws-close-normal"), async (instance: CreatorProjects) => {
      const { server, client } = serverSocket();
      const closed = new Promise<number>((resolve) =>
        client.addEventListener("close", (event) => resolve(event.code)));
      expect(() => instance.webSocketClose(server, 1000, "bye")).not.toThrow();
      expect(await closed).toBe(1000);
      expect(() => instance.webSocketClose(server, 1001, "again")).not.toThrow();
    });
  });

  it("maps only reserved / out-of-range codes away", () => {
    expect(sendableCloseCode(1000)).toBe(1000);
    expect(sendableCloseCode(1001)).toBe(1001);
    expect(sendableCloseCode(1011)).toBe(1011);
    expect(sendableCloseCode(4001)).toBe(4001);
    for (const reserved of [0, 999, 1004, 1005, 1006, 1015, 1016, 2999, 5000]) {
      expect(sendableCloseCode(reserved)).toBe(1000);
    }
  });
});
