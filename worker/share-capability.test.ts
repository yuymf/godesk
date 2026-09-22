import { describe, expect, it } from "vitest";
import {
  capabilityMatches,
  publicShareUrl,
  resourceKindFromPath,
  shareSecret,
  signShareToken,
  verifyShareToken,
} from "./share-capability";
import { hashSeatToken, issueSeatToken, otherSeatForHash, publicSeats } from "./seat-capability";

describe("share capability", () => {
  it("signs a token that only matches its bound resources", async () => {
    const secret = "test-share-secret";
    const token = await signShareToken({
      v: 1,
      c: "creator-a",
      room: "room_1",
      build: "build_1",
      replay: "replay_1",
    }, secret);
    const capability = await verifyShareToken(token, secret);
    expect(capability).toMatchObject({ c: "creator-a", room: "room_1" });
    expect(capabilityMatches(capability!, "room", "room_1")).toBe(true);
    expect(capabilityMatches(capability!, "room", "room_other")).toBe(false);
    expect(capabilityMatches(capability!, "build", "build_1")).toBe(true);
    expect(await verifyShareToken(token, "other-secret")).toBeNull();
    expect(publicShareUrl("/room/room_1", "https://godesk.test", token)).toContain("share=");
    expect(publicShareUrl("/room/room_1", "https://godesk.test", token)).not.toContain("creator=");
  });

  it("uses the local default only on localhost when the secret is missing", () => {
    const env = { GODESK_SHARE_SECRET: "  " } as Env;
    expect(shareSecret(env, "localhost")).toBe("godesk-local-share-secret");
    expect(shareSecret(env, "127.0.0.1")).toBe("godesk-local-share-secret");
    expect(shareSecret(env, "godesk.test")).toBe("godesk-local-share-secret");
  });

  it("fails closed on non-local hosts when the secret is missing", () => {
    const env = { GODESK_SHARE_SECRET: "" } as Env;
    expect(() => shareSecret(env, "godesk.yumengfan220.workers.dev")).toThrow(
      "GODESK_SHARE_SECRET is required",
    );
    expect(() => shareSecret({} as Env, "example.com")).toThrow(
      "GODESK_SHARE_SECRET is required",
    );
  });

  it("uses the configured secret on any host", () => {
    const env = { GODESK_SHARE_SECRET: " prod-share-secret " } as Env;
    expect(shareSecret(env, "example.com")).toBe("prod-share-secret");
    expect(shareSecret(env, "localhost")).toBe("prod-share-secret");
  });

  it("maps public paths to resource kinds", () => {
    expect(resourceKindFromPath("/room/room_1")).toEqual({ kind: "room", resourceId: "room_1" });
    expect(resourceKindFromPath("/api/sessions/room_1/intents")).toEqual({
      kind: "room",
      resourceId: "room_1",
    });
    expect(resourceKindFromPath("/try/project_1")).toEqual({
      kind: "try",
      resourceId: "project_1",
    });
  });
});

describe("seat capability", () => {
  it("never exposes the seat token hash on the public seat", async () => {
    const seatToken = issueSeatToken();
    const seatTokenHash = await hashSeatToken(seatToken);
    expect(publicSeats([{ seat: 0, seatTokenHash, displayName: "Ada" }])).toEqual([
      { seat: 0, displayName: "Ada" },
    ]);
    expect(otherSeatForHash(
      [{ seat: 0, seatTokenHash }, { seat: 1, seatTokenHash: "other" }],
      1,
      seatTokenHash,
    )?.seat).toBe(0);
  });
});
