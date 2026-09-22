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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForWorker(origin, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/`);
      if (response.status > 0) return;
    } catch {
      // Wrangler is still starting.
    }
    await delay(100);
  }
  throw new Error(`local Worker did not start:\n${output()}`);
}

export async function withTempWorker(label, run) {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const persistTo = await mkdtemp(join(tmpdir(), `godesk-${label}-`));
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
      "--inspector-port",
      "0",
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

  try {
    await waitForWorker(origin, () => output);
    return await run(origin);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("close", resolve));
    }
    await rm(persistTo, { recursive: true, force: true });
  }
}
