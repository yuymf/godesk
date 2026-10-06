// Shared helpers for the G3D-05 performance harness (scripts/perf-emulate.mjs)
// and the Lighthouse CI room URL (scripts/perf-room-url.mjs).
//
// A local `wrangler dev` Worker serves the built app; a hex-settlement room is
// created through the same MCP plugin path creators use (generate → approve →
// compile → create_shared_session), so the harness measures the real Room.
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const HEX_PROMPT = "做一款可以与电脑对战的汐屿基础版";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Start `wrangler dev --local` on the already-built `dist/`. */
export async function startWorker({ cwd = process.cwd(), port, persistTo, log = () => {} } = {}) {
  const listenPort = port ?? (await freePort());
  const persist = persistTo ?? (await mkdtemp(join(tmpdir(), "godesk-perf-")));
  const origin = `http://127.0.0.1:${listenPort}`;
  const child = spawn(
    "pnpm",
    ["exec", "wrangler", "dev", "--local", "--ip", "127.0.0.1", "--port", String(listenPort),
      "--inspector-port", "0", "--persist-to", persist],
    { cwd, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" },
  );
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const stop = async () => {
    if (child.exitCode !== null) return;
    try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
    await Promise.race([new Promise((resolve) => child.once("close", resolve)), delay(5_000)]);
  };
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`wrangler dev exited early:\n${output.slice(-2000)}`);
    try {
      const response = await fetch(`${origin}/`);
      if (response.status < 500) break;
    } catch { /* not up yet */ }
    await delay(250);
  }
  log(`worker up at ${origin} (persist ${persist})`);
  return { origin, stop, output: () => output };
}

/** Minimal MCP client against the local Worker (local-development identity). */
function mcpClient(origin, creator = "local-creator") {
  let nextId = 1;
  let sessionId;
  const headers = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "x-godesk-dev-creator": creator,
    "x-godesk-mcp-surface": "codex",
  };
  async function rpc(message, expectBody = true) {
    const response = await fetch(`${origin}/mcp`, {
      method: "POST",
      headers: sessionId ? { ...headers, "mcp-session-id": sessionId } : headers,
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error(`MCP ${message.method} HTTP ${response.status}: ${await response.text()}`);
    const sid = response.headers.get("mcp-session-id");
    if (sid) sessionId = sid;
    if (!expectBody) return undefined;
    const text = await response.text();
    if (!text.trim()) return undefined;
    if ((response.headers.get("content-type") ?? "").includes("application/json")) return JSON.parse(text);
    return text.split("\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6))).at(-1);
  }
  async function tool(name, args) {
    const payload = await rpc({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } });
    const result = payload?.result;
    if (!result || result.isError) throw new Error(`${name}: ${JSON.stringify(result?.content ?? payload).slice(0, 800)}`);
    return result.structuredContent;
  }
  return {
    async init() {
      await rpc({ jsonrpc: "2.0", id: nextId++, method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "godesk-perf", version: "1" } } });
      await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, false);
    },
    tool,
  };
}

/**
 * Create a hex-settlement project, build it and open a 2-seat Shared Session.
 * The fixed `seed` makes the board layout identical on every run.
 */
export async function createHexRoom(origin, { seed = 7, tag = String(Date.now()) } = {}) {
  const mcp = mcpClient(origin);
  await mcp.init();
  const read = async (projectId, view = "overview") => (await mcp.tool("read_project", { projectId, view })).data;
  const waitJob = async (jobId) => {
    for (let i = 0; i < 480; i += 1) {
      const job = await mcp.tool("track_job", { jobId });
      if (job.status === "succeeded") return job;
      if (job.status === "failed") throw new Error(`job ${jobId} failed: ${JSON.stringify(job).slice(0, 800)}`);
      await delay(250);
    }
    throw new Error(`job ${jobId} timed out`);
  };
  const created = await mcp.tool("create_project", { name: `G3D-05 perf hex ${tag}` });
  const projectId = created.project.id;
  const job = await mcp.tool("submit_job", {
    kind: "generate-rule-system", projectId, expectedVersion: created.project.version,
    idea: HEX_PROMPT, sourceContent: HEX_PROMPT, sourceName: "perf-hex.txt", sourceKind: "brief",
    name: "G3D-05 perf hex", idempotencyKey: `perf-${tag}-gen`,
  });
  await waitJob(job.id);
  const plan = (await read(projectId, "generation-plan")).generationPlan;
  if (plan?.status === "pending") {
    await mcp.tool("apply_project_patch", {
      projectId, expectedVersion: (await read(projectId)).version, idempotencyKey: `perf-${tag}-approve`,
      operations: [{ op: "approve_generation_plan", planId: plan.id }],
    });
  }
  const compile = await mcp.tool("submit_job", {
    kind: "compile-build", projectId, expectedVersion: (await read(projectId)).version,
    idempotencyKey: `perf-${tag}-compile`,
  });
  const buildId = (await waitJob(compile.id)).result.build.id;
  const session = await mcp.tool("create_shared_session", { buildId, seed, idempotencyKey: `perf-${tag}-share` });
  const sessionUrl = session.sessionUrl ?? session.session?.sessionUrl;
  if (!sessionUrl) throw new Error(`create_shared_session returned no sessionUrl: ${JSON.stringify(session).slice(0, 400)}`);
  // sessionUrl carries the request origin of the MCP call; normalise to `origin`.
  const url = new URL(sessionUrl);
  const roomUrl = new URL(`${url.pathname}${url.search}`, origin).toString();
  return { projectId, buildId, sessionId: session.id, roomUrl };
}

/** Append query parameters (e.g. perf=1, tier=low) to a URL. */
export function withQuery(href, params) {
  const url = new URL(href);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}
