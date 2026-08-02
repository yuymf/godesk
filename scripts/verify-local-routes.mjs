import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("could not reserve a local port"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const persistTo = await mkdtemp(join(tmpdir(), "godesk-route-check-"));
const child = spawn(
  "pnpm",
  [
    "exec",
    "wrangler",
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--persist-to",
    persistTo,
  ],
  { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
);

let output = "";
const collect = (chunk) => {
  output += chunk.toString();
};
child.stdout.on("data", collect);
child.stderr.on("data", collect);

async function waitForWorker() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/`);
      if (response.status > 0) return;
    } catch {
      // Wrangler is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`local Worker did not start:\n${output}`);
}

try {
  await waitForWorker();

  for (const path of [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
  ]) {
    const response = await fetch(`${origin}${path}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("application/json")) {
      throw new Error(`${path}: expected JSON 200, got ${response.status} ${contentType}`);
    }
    const body = await response.json();
    if (body.resource !== `${origin}/mcp`) {
      throw new Error(`${path}: unexpected resource ${body.resource}`);
    }
  }

  const mcp = await fetch(`${origin}/mcp`);
  const mcpType = mcp.headers.get("content-type") ?? "";
  if (mcp.status !== 405 || mcpType.includes("text/html")) {
    throw new Error(`/mcp expected JSON 405, got ${mcp.status} ${mcpType}`);
  }

  const login = await fetch(`${origin}/login`);
  if (login.status !== 503 || (login.headers.get("content-type") ?? "").includes("text/html")) {
    throw new Error(`/login expected local 503 plaintext, got ${login.status}`);
  }

  const callback = await fetch(`${origin}/oauth/callback`);
  if (callback.status !== 400 || (callback.headers.get("content-type") ?? "").includes("text/html")) {
    throw new Error(`/oauth/callback expected 400 plaintext, got ${callback.status}`);
  }

  console.log("Local Worker route verification passed.");
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("close", resolve));
  }
  await rm(persistTo, { recursive: true, force: true });
}
