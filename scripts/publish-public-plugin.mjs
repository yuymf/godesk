import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const token = process.env.GODESK_PLUGIN_SYNC_TOKEN?.trim();

if (!token) {
  console.log("GODESK_PLUGIN_SYNC_TOKEN is missing; skip public Plugin publish.");
  process.exit(0);
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${args.join(" ")} failed:\n${output}`));
    });
  });
}

const dest = await mkdtemp(join(tmpdir(), "godesk-plugin-sync-"));
try {
  await run("git", [
    "clone",
    "--depth",
    "1",
    `https://x-access-token:${token}@github.com/yuymf/godesk-plugin.git`,
    dest,
  ]);
  await rm(join(dest, "plugins/godesk"), { recursive: true, force: true });
  await cp(join(root, "plugins/godesk"), join(dest, "plugins/godesk"), { recursive: true });
  await cp(
    join(root, ".agents/plugins/marketplace.json"),
    join(dest, ".agents/plugins/marketplace.json"),
  );
  await cp(join(root, "plugins/PUBLIC_README.md"), join(dest, "README.md"));
  await run("git", ["add", "plugins/godesk", ".agents/plugins/marketplace.json", "README.md"], dest);
  const status = await run("git", ["status", "--porcelain"], dest);
  if (!status.trim()) {
    console.log("Public Plugin already matches the local bundle.");
    process.exit(0);
  }
  await run("git", ["config", "user.name", "godesk-plugin-sync"], dest);
  await run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], dest);
  await run("git", ["commit", "-m", "Sync GoDesk Plugin from yuymf/godesk"], dest);
  await run("git", ["push", "origin", "HEAD:main"], dest);
  console.log("Published the current GoDesk Plugin to yuymf/godesk-plugin.");
} finally {
  await rm(dest, { recursive: true, force: true });
}
