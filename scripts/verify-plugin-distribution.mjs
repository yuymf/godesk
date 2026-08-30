import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.argv.includes("--remote");
const publicRepo = "https://raw.githubusercontent.com/yuymf/godesk-plugin/main";
const publicTree = "https://api.github.com/repos/yuymf/godesk-plugin/git/trees/main?recursive=1";

function fail(message) {
  throw new Error(`GoDesk plugin distribution verification failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function localJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function remoteText(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json, text/plain" },
  });
  if (!response.ok) fail(`${url} returned HTTP ${response.status}`);
  return response.text();
}

const localPlugin = await localJson("plugins/godesk/.codex-plugin/plugin.json");
const localMcp = await localJson("plugins/godesk/.mcp.json");
const localReadme = await readFile(path.join(root, "plugins/PUBLIC_README.md"), "utf8");
const localSkillEntries = await readdir(path.join(root, "plugins/godesk/skills"), {
  withFileTypes: true,
});
const localSkills = localSkillEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (!remote) {
  assert(localSkills.length === 12, `expected 12 local Skills, got ${localSkills.length}`);
  assert(localPlugin.version.startsWith("0.2.0+"), "local Plugin is not on the current 0.2.0 contract");
  assert(localMcp.mcpServers?.godesk?.url?.endsWith("/mcp"), "local Plugin MCP URL is invalid");
  assert(localReadme.includes("participant-feedback"), "local public README omits participant-feedback");
  console.log(`Local GoDesk distribution contract verified: ${localPlugin.version}, ${localSkills.length} Skills.`);
  process.exit(0);
}

const remotePlugin = JSON.parse(await remoteText(`${publicRepo}/plugins/godesk/.codex-plugin/plugin.json`));
const remoteMcp = JSON.parse(await remoteText(`${publicRepo}/plugins/godesk/.mcp.json`));
const remoteReadme = await remoteText(`${publicRepo}/README.md`);

for (const [field, value] of [
  ["name", localPlugin.name],
  ["version", localPlugin.version],
  ["description", localPlugin.description],
  ["skills", localPlugin.skills],
  ["mcpServers", localPlugin.mcpServers],
]) {
  assert(JSON.stringify(remotePlugin[field]) === JSON.stringify(value), `public plugin ${field} is stale`);
}
assert(JSON.stringify(remotePlugin.interface) === JSON.stringify(localPlugin.interface), "public Plugin interface metadata is stale");
assert(JSON.stringify(remoteMcp) === JSON.stringify(localMcp), "public MCP declaration is stale");
const remoteTree = JSON.parse(await remoteText(publicTree));
const remoteSkills = remoteTree.tree
  .filter((entry) => entry.path.startsWith("plugins/godesk/skills/") && entry.path.endsWith("/SKILL.md"))
  .map((entry) => entry.path.split("/")[3])
  .sort();
assert(JSON.stringify(remoteSkills) === JSON.stringify(localSkills), "public Skill set is stale");
for (const requiredTerm of ["Rule System", "Shared Session", "participant-feedback", "iterate-from-finding"]) {
  assert(remoteReadme.includes(requiredTerm), `public README is missing ${requiredTerm}`);
}

console.log(`Public GoDesk distribution matches local source: ${localPlugin.version}, ${localSkills.length} Skills.`);
