#!/usr/bin/env node
/**
 * Reserve a private port for this Playwright run. Prints exactly one line: the port.
 *
 * WHY THIS EXISTS
 * ---------------
 * `GODESK_E2E_PORT` used to default to a hard 8799 for every Playwright process on
 * the machine, and `webServer.reuseExistingServer` was on locally. Two agents
 * running the suite in one checkout therefore shared a single server: the later
 * run silently adopted the earlier one's wrangler, executed against a `./dist`
 * that the other run's `scripts/e2e-webserver.sh` was concurrently rebuilding,
 * and a page already past `waitHarnessReady()` could lose its runtime state
 * mid-spec. That is the ~1-in-10 false red in e2e/harness-determinism.spec.ts.
 *
 * WHY A RESERVATION FILE AND NOT JUST A FREE-PORT PROBE
 * ----------------------------------------------------
 * "Is this port free?" is a TOCTOU race: two processes starting in the same
 * millisecond both see 8799 free and both take it. That was verified — it
 * produced a real bind collision. So the CHOICE is serialised with `mkdir`,
 * which is atomic on POSIX: exactly one process can create a given directory.
 * The winner records the port, and the reservation then PERSISTS for the life of
 * the run (keyed by the owning Playwright PID) so a later run sees the slot as
 * taken even before wrangler has bound it. Reservations whose owner is dead, or
 * which are older than LOCK_STALE_MS, are reclaimed.
 *
 * CONTRACT
 *   - `GODESK_E2E_PORT` set  -> use it verbatim (explicit pin wins; caller may
 *     then deliberately reuse a warm server).
 *   - unset                  -> reserve the first free port in 8799, 8801, ... 8879.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const BASE = 8799;
const STEP = 2;
const TRIES = 41; // 8799 .. 8879
const LOCK_STALE_MS = 60_000;

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const lockRoot = process.env.GODESK_E2E_LOCK_DIR ?? path.join(repoRoot, ".wrangler", "e2e-port-locks");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen({ port, host: "127.0.0.1", exclusive: true });
  });
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** Drop reservations whose owner died, or which are simply too old. */
function reclaimStale() {
  let entries = [];
  try {
    entries = readdirSync(lockRoot, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith(".lock")) continue;
    const full = path.join(lockRoot, entry.name);
    try {
      const meta = JSON.parse(readFileSync(path.join(full, "owner.json"), "utf8"));
      const expired = Date.now() - statSync(full).mtimeMs > LOCK_STALE_MS;
      if (!pidAlive(meta.pid) || expired) rmSync(full, { recursive: true, force: true });
    } catch {
      // Half-written reservation from a crashed run.
      try {
        if (Date.now() - statSync(full).mtimeMs > 5_000) rmSync(full, { recursive: true, force: true });
      } catch {
        // Already gone.
      }
    }
  }
}

function reservedPorts() {
  const taken = new Set();
  let entries = [];
  try {
    entries = readdirSync(lockRoot, { withFileTypes: true });
  } catch {
    return taken;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith(".lock")) continue;
    try {
      const meta = JSON.parse(readFileSync(path.join(lockRoot, entry.name, "owner.json"), "utf8"));
      if (Number.isInteger(meta.port)) taken.add(meta.port);
    } catch {
      // Ignore half-written reservations.
    }
  }
  return taken;
}

/** Atomic mutex: `mkdir` succeeds for exactly one caller. */
async function withChoiceLock(fn) {
  mkdirSync(lockRoot, { recursive: true });
  const lockPath = path.join(lockRoot, "choosing.lock");
  const deadline = Date.now() + 45_000;
  for (;;) {
    try {
      mkdirSync(lockPath);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      reclaimStale();
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > 10_000) rmSync(lockPath, { recursive: true, force: true });
      } catch {
        // Someone released it.
      }
      if (Date.now() > deadline) throw new Error("[pick-e2e-port] timed out waiting for the port lock");
      await sleep(20 + Math.floor(Math.random() * 40));
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

const pinned = process.env.GODESK_E2E_PORT;
if (pinned !== undefined && pinned !== "") {
  const port = Number(pinned);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`[pick-e2e-port] GODESK_E2E_PORT is not a valid port: ${JSON.stringify(pinned)}`);
    process.exit(1);
  }
  console.log(port);
  process.exit(0);
}

const ownerPid = process.ppid; // the Playwright process that will own the run

/**
 * Same run asking twice must get the SAME port.
 *
 * Playwright evaluates this config in the main process and again in every
 * worker; each evaluation spawns this script. A reservation is therefore keyed
 * by the OWNING pid, and an existing live reservation for that pid is reused
 * instead of allocating a second port. Without this, workers would get 8801 and
 * `baseURL` would point at a port nobody serves (verified failure mode:
 * net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8801).
 */
function existingPortForOwner() {
  let entries = [];
  try {
    entries = readdirSync(lockRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith(".lock")) continue;
    try {
      const meta = JSON.parse(readFileSync(path.join(lockRoot, entry.name, "owner.json"), "utf8"));
      if (meta.pid === ownerPid && Number.isInteger(meta.port)) return meta.port;
    } catch {
      // Ignore half-written reservations.
    }
  }
  return null;
}

const reused = existingPortForOwner();
if (reused !== null) {
  console.log(reused);
  process.exit(0);
}

const chosen = await withChoiceLock(async () => {
  reclaimStale();
  const taken = reservedPorts();
  for (let i = 0; i < TRIES; i += 1) {
    const port = BASE + i * STEP;
    if (taken.has(port)) continue;
    if (await isFree(port)) return port;
  }
  return null;
});

if (chosen === null) {
  console.error(`[pick-e2e-port] no free port in ${BASE}..${BASE + (TRIES - 1) * STEP}; pin GODESK_E2E_PORT.`);
  process.exit(1);
}

// Persist the reservation for the lifetime of the owning run. It is reclaimed by
// the next run once `ownerPid` is gone (or after LOCK_STALE_MS), so a killed run
// cannot wedge the suite.
const reservePath = path.join(lockRoot, `${ownerPid}-${chosen}.lock`);
mkdirSync(reservePath, { recursive: true });
writeFileSync(path.join(reservePath, "owner.json"), JSON.stringify({ pid: ownerPid, port: chosen }));

console.log(chosen);
