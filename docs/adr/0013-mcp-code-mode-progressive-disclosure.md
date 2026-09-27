# ADR 0013: MCP Code Mode 弱化版（渐进披露）

Status: accepted（可选开关；默认关闭）

Date: 2026-09-28

## Context

GoDesk MCP（`worker/mcp.ts`）通过 `registerTool` 暴露十余个业务工具。
工具面随能力增长时，`tools/list` 会线性消耗模型上下文（Cloudflare 称原生全量可达数十万 tokens）。

Cloudflare Agents 文档描述了 Code Mode 两种模式：`code` 单工具，或 **`search` + `execute`**（目录留在服务端沙箱）。见：

- https://developers.cloudflare.com/agents/model-context-protocol/codemode/
- 试验笔记：仓库外 morning-trials `03-mcp-code-mode/PROGRESSIVE-DISCLOSURE.md`

本切片做**弱化版**：无 Dynamic Worker 沙箱、不执行模型写的 JS；仅把目录收到服务端，用查询筛选 + 具名执行。

## Decision

1. **默认行为不变**：未开开关时，`listTools` 仍返回全部业务工具。
2. **开关**：环境变量 `GODESK_MCP_CODE_MODE=1`（或 `true`/`yes`），或 `createGodeskMcpServer(..., { codeMode: true })`。
3. **开启后**：业务工具 `disable()`（不出现在 list、不可直接 call）；仅暴露：
   - `search`：按 `query` / `name` / `tags` 筛选操作元数据
   - `execute`：按 `name` + `arguments` 调用原有内部回调
4. 实现落在 `worker/mcp-code-mode.ts`，由 `mcp.ts` 在注册完业务工具后按需调用。
5. **不改 Collecta 生产代码**；Collecta 若抄同一模式，见下方指针，需单独功能 PR + 大主管 QA。

## Consequences

- 客户端若依赖全量工具名，开启后需改走 search → execute。
- 弱化版不做沙箱组合调用；真 Code Mode（模型写 JS）需另议。
- 勿在 search/execute 结果中回传密钥或配对码。

## Collecta 同样可抄（仅指针）

Collecta 自建 MCP 可同样：L0 暴露 `search`/`execute`，L1 目录留服务端，用 env 开关渐进切换；**不要在本 ADR 对应 PR 里改 Collecta 生产代码**。

## Verification

```bash
pnpm test:worker -- worker/mcp-code-mode.test.ts
```
