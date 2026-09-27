/**
 * MCP Code Mode 弱化版（渐进披露）：listTools 仅暴露 search + execute，
 * 完整操作目录留在服务端；无 Worker 沙箱、不执行模型写的 JS。
 *
 * 开关：环境变量 GODESK_MCP_CODE_MODE=1|true，或 createGodeskMcpServer options.codeMode。
 * 默认关闭，现有多工具面不变。
 */
import type { McpServer, RegisteredTool } from "@modelcontextprotocol/server";
import { z } from "zod";

export type CodeModeEnv = Env & { GODESK_MCP_CODE_MODE?: string };

export type CodeModeOptions = {
  /** 显式覆盖；未设则读 GODESK_MCP_CODE_MODE */
  codeMode?: boolean;
};

export type CodeModeOp = {
  name: string;
  title?: string;
  description?: string;
  tags: string[];
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  registered: RegisteredTool;
  /** 原 registerTool 回调；execute 直接调用（绕过 disabled 闸门） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoke: (args: any) => Promise<unknown> | unknown;
};

export function isCodeModeEnabled(
  env: CodeModeEnv,
  options?: CodeModeOptions,
): boolean {
  if (options?.codeMode !== undefined) return options.codeMode;
  const raw = env.GODESK_MCP_CODE_MODE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** 从工具名推导粗粒度标签，供 search 筛选 */
export function tagsForToolName(name: string): string[] {
  const tags = new Set<string>(["godesk"]);
  if (
    name.includes("project") ||
    name === "get_studio_url" ||
    name === "apply_project_patch"
  ) {
    tags.add("project");
  }
  if (name.includes("job")) tags.add("job");
  if (name.includes("session") || name.includes("intent")) tags.add("session");
  if (name.includes("build")) tags.add("build");
  if (name.includes("rule_system") || name.includes("rule")) {
    tags.add("rule_system");
  }
  if (name.includes("replay")) tags.add("replay");
  if (name.includes("delete") || name.includes("duplicate")) {
    tags.add("mutation");
  }
  return [...tags];
}

export type SearchOpsQuery = {
  query?: string;
  name?: string;
  tags?: string[];
};

export function searchOps(
  catalog: readonly CodeModeOp[],
  filter: SearchOpsQuery,
): Array<{
  name: string;
  title?: string;
  description?: string;
  tags: string[];
  annotations?: CodeModeOp["annotations"];
}> {
  const q = filter.query?.trim().toLowerCase();
  const nameNeedle = filter.name?.trim().toLowerCase();
  const tagNeedles = (filter.tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  return catalog
    .filter((op) => {
      if (nameNeedle && !op.name.toLowerCase().includes(nameNeedle)) {
        return false;
      }
      if (tagNeedles.length > 0) {
        const opTags = op.tags.map((t) => t.toLowerCase());
        if (!tagNeedles.every((t) => opTags.includes(t))) return false;
      }
      if (q) {
        const hay = [op.name, op.title ?? "", op.description ?? "", ...op.tags]
          .join("\n")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map(({ name, title, description, tags, annotations }) => ({
      name,
      title,
      description,
      tags,
      annotations,
    }));
}

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function toolError(message: string) {
  const body = { error: message };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(body) }],
    structuredContent: body,
    isError: true,
  };
}

/**
 * 隐藏原工具目录，仅注册 search + execute。
 * catalog 须已含全部业务 op（含 RegisteredTool 引用）。
 */
export function applyCodeModeSurface(
  server: McpServer,
  catalog: readonly CodeModeOp[],
): void {
  // 快照业务目录：后续 registerTool(search/execute) 若走包装器，不得污染筛选结果。
  const ops = [...catalog];
  for (const op of ops) {
    op.registered.disable();
  }

  const byName = new Map(ops.map((op) => [op.name, op]));

  server.registerTool(
    "search",
    {
      title: "Search GoDesk MCP operations",
      description:
        "渐进披露：按名称/标签/关键词筛选服务端操作目录，返回精简元数据（不含密钥）。完整工具面不进 listTools。",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("子串匹配 name/title/description/tags"),
        name: z.string().optional().describe("按操作名子串筛选"),
        tags: z
          .array(z.string())
          .optional()
          .describe("须同时命中的标签，如 project、job、session"),
      }),
      outputSchema: z.object({
        operations: z.array(
          z.object({
            name: z.string(),
            title: z.string().optional(),
            description: z.string().optional(),
            tags: z.array(z.string()),
            annotations: z
              .object({
                readOnlyHint: z.boolean().optional(),
                destructiveHint: z.boolean().optional(),
                idempotentHint: z.boolean().optional(),
                openWorldHint: z.boolean().optional(),
              })
              .optional(),
          }),
        ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        return toolResult({
          operations: searchOps(ops, {
            query: args.query,
            name: args.name,
            tags: args.tags,
          }),
        });
      } catch (reason) {
        return toolError(
          reason instanceof Error ? reason.message : "search_failed",
        );
      }
    },
  );

  server.registerTool(
    "execute",
    {
      title: "Execute a GoDesk MCP operation",
      description:
        "按 search 返回的 name 调用原有内部实现。参数与对应业务工具的 inputSchema 一致。",
      inputSchema: z.object({
        name: z.string().min(1).describe("操作名，如 list_projects"),
        arguments: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("传给该操作的参数对象"),
      }),
      outputSchema: z.object({}).passthrough(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, arguments: toolArgs }) => {
      const op = byName.get(name);
      if (!op) {
        return toolError(`unknown_operation:${name}`);
      }
      try {
        return (await op.invoke(toolArgs ?? {})) as {
          content: Array<{ type: "text"; text: string }>;
          structuredContent?: Record<string, unknown>;
          isError?: boolean;
        };
      } catch (reason) {
        return toolError(
          reason instanceof Error ? reason.message : "execute_failed",
        );
      }
    },
  );
}

/** 测试辅助：列出当前 enabled 的工具名（依赖 SDK 私有表，仅测用） */
export function listEnabledToolNames(server: McpServer): string[] {
  const tools = (
    server as unknown as {
      _registeredTools: Record<string, { enabled: boolean }>;
    }
  )._registeredTools;
  return Object.entries(tools)
    .filter(([, tool]) => tool.enabled)
    .map(([name]) => name)
    .sort();
}
