import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createVerifyHelpers } from "./verify-helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { fail, assert } = createVerifyHelpers("Plugin bundle verification failed");

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

const createSkillNames = ["create-game-project", "create-shareable-prototype"];
for (const skillName of createSkillNames) {
  assert(skillNames.includes(skillName), `plugin must keep ${skillName} as a Skill directory`);
}
const basicsSkill = await readFile(
  path.join(root, "plugins/godesk/skills/godesk-plugin-basics/SKILL.md"),
  "utf8",
);
assert(
  basicsSkill.includes("## Executable Kernel choice"),
  "godesk-plugin-basics must own the Executable Kernel choice table",
);
for (const kernel of ["hidden-role-v1", "hand-play-v1", "conversation-relay-v1", "harbor-voyage-v1", "worker-placement-v1"]) {
  assert(
    basicsSkill.includes(kernel),
    `godesk-plugin-basics is missing ADR 0012 kernel: ${kernel}`,
  );
}
const kernelHeadingHits = skillText.filter((body) =>
  body.includes("## Executable Kernel choice"),
).length;
assert(
  kernelHeadingHits === 1,
  `Executable Kernel choice table must appear once across Skills (found ${kernelHeadingHits})`,
);
const createShareable = await readFile(
  path.join(root, "plugins/godesk/skills/create-shareable-prototype/SKILL.md"),
  "utf8",
);
assert(
  createShareable.includes("godesk-plugin-basics"),
  "create-shareable-prototype must cross-reference godesk-plugin-basics for the Kernel table",
);
for (const kernel of ["hidden-role-v1", "hand-play-v1", "conversation-relay-v1"]) {
  assert(
    createShareable.includes(kernel),
    `create-shareable-prototype must still name ADR 0012 kernel: ${kernel}`,
  );
}
const createDelegate = await readFile(
  path.join(root, "plugins/godesk/skills/create-game-project/SKILL.md"),
  "utf8",
);
assert(
  createDelegate.includes("create-shareable-prototype"),
  "create-game-project must delegate to create-shareable-prototype",
);
assert(
  createDelegate.includes("godesk-plugin-basics"),
  "create-game-project must point Kernel gate at godesk-plugin-basics",
);

console.log(
  `GoDesk plugin bundle verified: ${skillNames.length} Skills, version ${plugin.version}.`,
);
