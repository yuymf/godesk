import { describe, expect, it } from "vitest";
import {
  publicBuild,
  publicJob,
  publicMutation,
  publicSession,
} from "./public-urls";

describe("public URLs", () => {
  it("signs playable and session URLs with the same mount", async () => {
    const build = await publicBuild(
      { id: "build_1" },
      "https://godesk.test",
      "creator-a",
      "share-secret",
      "/chatgpt-plugin",
    );
    expect(new URL(build.playableUrl).pathname).toBe("/chatgpt-plugin/play/build_1");
    expect(new URL(build.playableUrl).searchParams.get("share")).toBeTruthy();

    const storedSession = {
      id: "room_1",
      buildId: "build_1",
      replayId: "replay_1",
      seats: [{ seat: 0, seatTokenHash: "hidden", displayName: "A" }],
    };
    const session = await publicSession(
      storedSession,
      "https://godesk.test",
      "creator-a",
      "share-secret",
      "/chatgpt-plugin",
    );
    expect(session.seats).toEqual([{ seat: 0, displayName: "A" }]);
    expect(new URL(session.sessionUrl).pathname).toBe("/chatgpt-plugin/room/room_1");
    expect(new URL(session.replayUrl).pathname).toBe("/chatgpt-plugin/replay/replay_1");
  });

  it("converts generate and iterate job studioPath the same way", async () => {
    const generated = await publicJob(
      {
        id: "job_gen",
        projectId: "project_1",
        kind: "generate-rule-system",
        result: { studioPath: "/studio/project_1" },
      },
      "https://godesk.test",
    );
    const iterated = await publicJob(
      {
        id: "job_iter",
        projectId: "project_1",
        kind: "iterate-rule-system",
        result: { studioPath: "/studio/project_1" },
      },
      "https://godesk.test",
    );
    expect(generated.result).toEqual({
      studioUrl: "https://godesk.test/studio/project_1",
    });
    expect(iterated.result).toEqual({
      studioUrl: "https://godesk.test/studio/project_1",
    });
    expect(publicMutation(
      { studioPath: "/studio/project_1", warnings: [] },
      "https://godesk.test",
    )).toEqual({
      warnings: [],
      studioUrl: "https://godesk.test/studio/project_1",
    });
  });
});
