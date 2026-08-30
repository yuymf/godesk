import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  throw new Error(`Plugin bundle verification failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    fail(`${relativePath} is missing or invalid JSON: ${error.message}`);
  }
}

function assertFile(relativePath) {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} is missing`);
}

const packageJson = await readJson("package.json");
const plugin = await readJson("plugins/godesk/.codex-plugin/plugin.json");
const mcp = await readJson("plugins/godesk/.mcp.json");
const marketplace = await readJson(".agents/plugins/marketplace.json");

assert(plugin.name === "godesk", "plugin name must be godesk");
assert(
  plugin.version.startsWith(`${packageJson.version}+`),
  `plugin version ${plugin.version} must be based on package version ${packageJson.version}`,
);
assert(plugin.skills === "./skills/", "plugin skills path must be ./skills/");
assert(plugin.mcpServers === "./.mcp.json", "plugin MCP path must be ./.mcp.json");
assertFile("plugins/godesk/assets/godesk-mark.svg");

const hostedMcp = mcp.mcpServers?.godesk;
assert(hostedMcp?.url?.endsWith("/mcp"), "hosted MCP URL must end in /mcp");
assert(
  hostedMcp.oauth_resource === hostedMcp.url,
  "oauth_resource must match the hosted MCP URL",
);
assert(
  hostedMcp.http_headers?.["x-godesk-mcp-surface"] === "codex",
  "MCP surface header must identify Codex",
);

const localPlugin = marketplace.plugins?.find((entry) => entry.name === "godesk");
assert(localPlugin?.source?.source === "local", "Marketplace must expose a local GoDesk source");
assert(localPlugin.source.path === "./plugins/godesk", "Marketplace source path is stale");

const skillRoot = path.join(root, "plugins/godesk/skills");
const skillEntries = await readdir(skillRoot, { withFileTypes: true });
const skillNames = skillEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
assert(skillNames.length > 0, "plugin must contain at least one Skill");
assert(
  skillNames.includes("iterate-from-finding"),
  "plugin must include the same-project Finding iteration Skill",
);
const iterationSkill = await readFile(
  path.join(root, "plugins/godesk/skills/iterate-from-finding/SKILL.md"),
  "utf8",
);
for (const iterationTerm of [
  "nextChange",
  "same project",
  "compile-build",
  "bot-playtest",
  "immutable Build",
]) {
  assert(
    iterationSkill.includes(iterationTerm),
    `Finding iteration Skill is missing: ${iterationTerm}`,
  );
}

const skillText = [];
for (const skillName of skillNames.sort()) {
  const skillPath = `plugins/godesk/skills/${skillName}`;
  assertFile(`${skillPath}/SKILL.md`);
  assertFile(`${skillPath}/agents/openai.yaml`);
  skillText.push(await readFile(path.join(root, `${skillPath}/SKILL.md`), "utf8"));
}

const contractText = `${skillText.join("\n")}\n${await readFile(
  path.join(root, "plugins/PUBLIC_README.md"),
  "utf8",
)}`;
for (const staleTerm of [
  "Game Definition",
  "apply_game_patch",
  "duplicate_definition",
  "activate_definition",
  "get_editor_url",
  "create_room",
  "Table State",
]) {
  assert(!contractText.includes(staleTerm), `stale protocol term remains: ${staleTerm}`);
}
for (const requiredTerm of [
  "Rule System",
  "Shared Session",
  "get_studio_url",
  "apply_project_patch",
  "record_validation_finding",
  "participant-feedback",
  "Experiment Brief",
  "hypothesisId",
  "Feedback Moment",
  "actionSequence",
  "Studio embedded",
  "Session State",
  "restore_build_as_rule_system",
  "publish_shared_session",
  "playtest-link",
]) {
  assert(contractText.includes(requiredTerm), `current protocol term is missing: ${requiredTerm}`);
}

console.log(
  `GoDesk plugin bundle verified: ${skillNames.length} Skills, version ${plugin.version}.`,
);
