import { describe, expect, it } from "vitest";
import { createGodeskMcpServer } from "./mcp";
import {
  isCodeModeEnabled,
  listEnabledToolNames,
  searchOps,
  tagsForToolName,
  type CodeModeOp,
} from "./mcp-code-mode";

const stubEnv = {
  GODESK_SHARE_SECRET: "godesk-local-share-secret",
} as Env;

describe("MCP Code Mode — progressive disclosure helpers", () => {
  it("isCodeModeEnabled respects env and options override", () => {
    expect(isCodeModeEnabled(stubEnv)).toBe(false);
    expect(
      isCodeModeEnabled({ ...stubEnv, GODESK_MCP_CODE_MODE: "1" } as Env),
    ).toBe(true);
    expect(
      isCodeModeEnabled({ ...stubEnv, GODESK_MCP_CODE_MODE: "true" } as Env),
    ).toBe(true);
    expect(
      isCodeModeEnabled(
        { ...stubEnv, GODESK_MCP_CODE_MODE: "1" } as Env,
        { codeMode: false },
      ),
    ).toBe(false);
    expect(isCodeModeEnabled(stubEnv, { codeMode: true })).toBe(true);
  });

  it("tagsForToolName and searchOps filter by name/tags/query", () => {
    expect(tagsForToolName("list_projects")).toEqual(
      expect.arrayContaining(["godesk", "project"]),
    );
    expect(tagsForToolName("submit_job")).toEqual(
      expect.arrayContaining(["job"]),
    );

    const catalog = [
      {
        name: "list_projects",
        title: "List",
        description: "authoritative projects",
        tags: tagsForToolName("list_projects"),
      },
      {
        name: "submit_job",
        title: "Submit",
        description: "enqueue work",
        tags: tagsForToolName("submit_job"),
      },
    ] as CodeModeOp[];

    expect(searchOps(catalog, { name: "list_" }).map((o) => o.name)).toEqual([
      "list_projects",
    ]);
    expect(searchOps(catalog, { tags: ["job"] }).map((o) => o.name)).toEqual([
      "submit_job",
    ]);
    expect(
      searchOps(catalog, { query: "authoritative" }).map((o) => o.name),
    ).toEqual(["list_projects"]);
  });
});

describe("MCP Code Mode — createGodeskMcpServer surface", () => {
  it("default (code mode off): keeps original tools such as list_projects", () => {
    const server = createGodeskMcpServer(
      stubEnv,
      "https://godesk.test",
      "creator-test",
      "local-development-only",
    );
    const names = listEnabledToolNames(server);
    expect(names).toContain("list_projects");
    expect(names).toContain("create_project");
    expect(names).not.toContain("search");
    expect(names).not.toContain("execute");
  });

  it("code mode on: listTools only search + execute", () => {
    const server = createGodeskMcpServer(
      stubEnv,
      "https://godesk.test",
      "creator-test",
      "local-development-only",
      "/",
      { codeMode: true },
    );
    expect(listEnabledToolNames(server)).toEqual(["execute", "search"]);
  });
});
