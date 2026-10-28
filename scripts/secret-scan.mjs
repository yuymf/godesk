#!/usr/bin/env node
// Secret-scan gate for a repository that is public and that Cloudflare
// Zero Trust identifiers have already leaked into once (2026-10-28).
//
// Why not just GitHub push protection? It is off for non-provider patterns on
// a free account, it cannot see this repo's own shapes (Account ID / Access AUD
// / team domain), and it does nothing for a local commit. This gate is the
// repo's own, works with no network, and needs no extra runtime dependency:
// the pinned gitleaks binary (scripts/gitleaks.lock.json) is downloaded once
// into the user cache, checksum-verified, and reused forever.
//
//   node scripts/secret-scan.mjs staged        staged diff (pre-commit hook)
//   node scripts/secret-scan.mjs all           every file git would commit (CI + local)
//   node scripts/secret-scan.mjs history       whole git history (audits)
//   node scripts/secret-scan.mjs canary        policy self-test: rules fire, allowlist holds
//   node scripts/secret-scan.mjs install-hook  opt-in .git/hooks/pre-commit
//   node scripts/secret-scan.mjs path <dir>    scan one directory
//
// Output is always redacted: CI logs of a public repo are public, so a value
// must never reach stdout. Findings print rule + file + line only.

import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = path.join(REPO, ".gitleaks.toml");
const LOCK = JSON.parse(fs.readFileSync(path.join(REPO, "scripts/gitleaks.lock.json"), "utf8"));
const mode = process.argv[2] || "all";
const argPath = process.argv[3];

// ---------------------------------------------------------------------------
// binary resolution — pinned, checksum-verified, cached, offline after first run
// ---------------------------------------------------------------------------

function assetName() {
  const osName = { darwin: "darwin", linux: "linux", win32: "windows" }[process.platform];
  const arch = { x64: "x64", arm64: "arm64" }[process.arch];
  if (!osName || !arch) fail(`unsupported platform ${process.platform}/${process.arch}`);
  const key = `${osName}_${arch}`;
  if (osName === "windows") {
    fail(
      `no pinned Windows asset. Install gitleaks yourself (scoop/gitea release) and point the scan at it:\n` +
      `  export GODESK_GITLEAKS_BIN=/path/to/gitleaks.exe`,
    );
  }
  if (!LOCK.assets[key]) fail(`scripts/gitleaks.lock.json has no asset for ${key}`);
  return { key, file: `gitleaks_${LOCK.version}_${key}.tar.gz`, sha256: LOCK.assets[key] };
}

function cacheDir(key) {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(base, "godesk-secretscan", `v${LOCK.version}`, key);
}

function whichGitleaks() {
  try {
    return execFileSync(process.platform === "win32" ? "where" : "which", ["gitleaks"],
      { encoding: "utf8" }).split("\n")[0].trim() || null;
  } catch {
    return null;
  }
}

async function ensureBinary() {
  if (process.env.GODESK_GITLEAKS_BIN) {
    const p = process.env.GODESK_GITLEAKS_BIN;
    if (!fs.existsSync(p)) fail(`GODESK_GITLEAKS_BIN does not exist: ${p}`);
    return { bin: p, source: "env" };
  }
  const { key, file, sha256 } = assetName();
  const dir = cacheDir(key);
  const bin = path.join(dir, "gitleaks");
  if (fs.existsSync(bin)) return { bin, source: `cache v${LOCK.version}` };

  // Only this branch touches the network, and only once per pinned version.
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${LOCK.version}/${file}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gitleaks-bootstrap-"));
  const tarball = path.join(tmp, file);
  process.stderr.write(`secret-scan: bootstrapping pinned gitleaks v${LOCK.version} (first run only)\n`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(tarball, Buffer.from(await res.arrayBuffer()), { mode: 0o600 });
    const got = crypto.createHash("sha256").update(fs.readFileSync(tarball)).digest("hex");
    if (got !== sha256) throw new Error(`checksum mismatch (got ${got.slice(0, 12)}, want ${sha256.slice(0, 12)})`);
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    execFileSync("tar", ["xzf", tarball, "-C", dir, "gitleaks"], { stdio: "inherit" });
    fs.chmodSync(bin, 0o755);
    return { bin, source: `downloaded v${LOCK.version} (sha256 verified)` };
  } catch (error) {
    const onPath = whichGitleaks();
    if (onPath) {
      process.stderr.write(`secret-scan: bootstrap failed (${error.message}); falling back to ${onPath}\n`);
      return { bin: onPath, source: "PATH (unpinned)" };
    }
    fail(
      `cannot bootstrap gitleaks and none is on PATH: ${error.message}\n` +
      `  offline? place the pinned binary here and re-run:\n` +
      `  ${path.join(dir, "gitleaks")}\n` +
      `  or: export GODESK_GITLEAKS_BIN=/path/to/gitleaks (v${LOCK.version} recommended)`,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// scan helpers
// ---------------------------------------------------------------------------

function fail(message) {
  process.stderr.write(`\nsecret-scan: ${message}\n`);
  process.exit(2);
}

function runGitleaks(bin, args, label) {
  const report = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "godesk-secretscan-")), "findings.json");
  const res = spawnSync(bin, [...args, "--redact", "--no-banner", "--exit-code", "0",
    "-f", "json", "-r", report], { cwd: REPO, encoding: "utf8" });
  if (res.status !== 0 && res.status !== 1) {
    process.stderr.write(res.stderr || "");
    fail(`${label} failed to run (exit ${res.status})`);
  }
  let findings = [];
  if (fs.existsSync(report)) {
    const raw = fs.readFileSync(report, "utf8").trim();
    findings = raw ? JSON.parse(raw) : [];
    fs.rmSync(path.dirname(report), { recursive: true, force: true });
  }
  return findings;
}

function report(findings, label) {
  if (!findings.length) {
    console.log(`secret-scan: OK — ${label}, 0 findings`);
    return 0;
  }
  console.error(`\nsecret-scan: BLOCKED — ${label}, ${findings.length} finding(s)`);
  for (const f of findings.slice(0, 40)) {
    console.error(`  [${f.RuleID}] ${f.File}:${f.StartLine}  ${String(f.Match || "").replace(/\s+/g, " ").slice(0, 90)}`);
  }
  if (findings.length > 40) console.error(`  … ${findings.length - 40} more`);
  console.error(
    "\n  A secret/identifier landed in content that git would publish.\n" +
    "  Move the value to .dev.vars (gitignored) or a GitHub Actions secret and\n" +
    "  keep a placeholder in the repo. Never paste the value into logs or chat.\n" +
    "  Policy: .gitleaks.toml  ·  self-test: pnpm secrets:check:canary\n",
  );
  return 1;
}

/** every file git would consider committable — tracked + untracked-but-not-ignored */
function committableFiles() {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: REPO, encoding: "utf8" });
  return out.split("\0").filter(Boolean);
}

function mirrorCommittable() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "godesk-committable-"));
  let bytes = 0;
  for (const rel of committableFiles()) {
    const src = path.join(REPO, rel);
    let st;
    try {
      st = fs.statSync(src);
    } catch {
      continue; // deleted from disk but still in the index: nothing to scan
    }
    if (!st.isFile()) continue;
    const dst = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    bytes += st.size;
  }
  fs.copyFileSync(CONFIG, path.join(dir, ".gitleaks.toml"));
  return { dir, bytes };
}

// ---------------------------------------------------------------------------
// canary: the policy must stay both sharp and narrow
// ---------------------------------------------------------------------------

async function canary(bin) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "godesk-canary-"));
  const acct = "0123456789abcdef".repeat(2); // 32 hex, deterministic dummy
  const aud = "0123456789abcdef".repeat(4); // 64 hex, deterministic dummy
  const uuid = "00000000-0000-4000-8000-000000000000";
  // The Access host is assembled at runtime on purpose: this file must not
  // contain a real-looking `https://<team>.cloudflareaccess.com` literal, or the
  // gate would flag its own canary. The detector still sees the rendered fixture.
  const accessHost = (label) => ["https://", label, ".cloudflare", "access.com"].join("");
  const write = (name, body) => fs.writeFileSync(path.join(dir, name), body);
  // must be detected
  write("bad-wrangler.jsonc", `{ "account_id": "${acct}" }`);
  write("bad-issuer.env", `GODESK_AUTH_ISSUER=${accessHost("canary-team")}/cdn-cgi/access/sso/oidc/${uuid}\n`);
  write("bad-aud.env", `GODESK_ACCESS_AUD="${aud}"\n`);
  write("bad-team.txt", `login ${accessHost("canary-team")}/cdn-cgi/access/login/godesk\n`);
  write("bad-ci.yml", `run: wrangler deploy --var GODESK_AUTH_AUDIENCE:"${aud}"\n`);
  // must NOT be detected (documented placeholder / generated / test shapes)
  write("ok-placeholder.jsonc", `{ "GODESK_AUTH_AUDIENCE": "REPLACE_ME-VIA-DEPLOY",\n  "GODESK_AUTH_ISSUER": "https://godesk-placeholder.invalid/cdn-cgi/access/sso/oidc/REPLACE_ME" }`);
  write("ok-example.d.ts", `// Generated by Wrangler by running \`wrangler types\` (hash: ${acct})\n/**\n * @example "${aud}"\n */\ntype A = string;\n`);
  fs.mkdirSync(path.join(dir, "worker"), { recursive: true });
  write(path.join("worker", "a.test.ts"), `const p = { idempotencyKey: "${aud}" };\nconst i = "${accessHost("test-team")}";\n`);
  fs.copyFileSync(CONFIG, path.join(dir, ".gitleaks.toml"));

  const findings = runGitleaks(bin, ["dir", dir, "--config", path.join(dir, ".gitleaks.toml")], "canary");
  const hit = new Set(findings.map((f) => `${f.RuleID}@${path.basename(f.File)}`));
  const files = Object.fromEntries([...findings.reduce((m, f) => m.set(path.basename(f.File), (m.get(path.basename(f.File)) || 0) + 1), new Map())]);

  const mustFire = ["bad-wrangler.jsonc", "bad-issuer.env", "bad-aud.env", "bad-team.txt", "bad-ci.yml"];
  const mustStayClean = ["ok-placeholder.jsonc", "ok-example.d.ts", "a.test.ts"];
  const failures = [];
  for (const f of mustFire) if (!hitHas(findings, f)) failures.push(`rule missed ${f}`);
  for (const f of mustStayClean) if (hitHas(findings, f)) failures.push(`allowlist leaked ${f}`);

  fs.rmSync(dir, { recursive: true, force: true });
  const rules = [...new Set(findings.map((f) => f.RuleID))].sort();
  if (failures.length) {
    console.error(`secret-scan: canary FAILED — ${failures.join("; ")}`);
    console.error(`  findings: ${JSON.stringify(files)}`);
    return 1;
  }
  console.log(`secret-scan: canary OK — ${findings.length} canary finding(s) caught by [${rules.join(", ")}]; placeholder/generated/test shapes stayed quiet`);
  return 0;
}

function hitHas(findings, basename) {
  return findings.some((f) => path.basename(f.File) === basename);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const HOOK = `#!/bin/sh
# installed by: pnpm secrets:install-hook  (godesk secret gate, offline)
exec node "$(git rev-parse --show-toplevel)/scripts/secret-scan.mjs" staged
`;

async function main() {
  if (mode === "install-hook") {
    const gitDir = execFileSync("git", ["rev-parse", "--git-dir"], { cwd: REPO, encoding: "utf8" }).trim();
    const target = path.resolve(REPO, gitDir, "hooks", "pre-commit");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target) && !fs.readFileSync(target, "utf8").includes("secret-scan.mjs")) {
      fail(`${target} exists and is not ours — not overwriting. Chain it manually if you want both.`);
    }
    fs.writeFileSync(target, HOOK, { mode: 0o755 });
    console.log(`secret-scan: pre-commit hook installed -> ${target}`);
    return 0;
  }

  const { bin, source } = await ensureBinary();
  const version = spawnSync(bin, ["version"], { encoding: "utf8" }).stdout.trim().split("\n")[0];
  process.stderr.write(`secret-scan: ${version} via ${source}\n`);

  switch (mode) {
    case "staged": {
      const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: REPO, encoding: "utf8" }).trim();
      if (!staged) {
        console.log("secret-scan: OK — nothing staged");
        return 0;
      }
      return report(runGitleaks(bin, ["git", REPO, "--staged", "--config", CONFIG], "staged diff"),
        `staged diff (${staged.split("\n").length} file(s))`);
    }
    case "all": {
      const { dir, bytes } = mirrorCommittable();
      try {
        return report(runGitleaks(bin, ["dir", dir, "--config", path.join(dir, ".gitleaks.toml")], "committable tree"),
          `committable tree (${(bytes / 1e6).toFixed(1)} MB)`);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    case "history":
      return report(runGitleaks(bin, ["git", REPO, "--config", CONFIG], "full git history"), "git history");
    case "path": {
      if (!argPath) fail("usage: secret-scan.mjs path <dir>");
      return report(runGitleaks(bin, ["dir", argPath, "--config", CONFIG], argPath), argPath);
    }
    case "canary":
      return await canary(bin);
    default:
      fail(`unknown mode '${mode}' (staged | all | history | canary | path | install-hook)`);
    }
}

process.exit(await main());
