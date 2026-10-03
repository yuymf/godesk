import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const workflow = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
function stepScript(name) {
  const lines = workflow.split("\n");
  const step = lines.findIndex((line) => line === `      - name: ${name}`);
  assert(step >= 0, `Missing workflow step: ${name}`);
  const start = lines.findIndex((line, index) => index > step && line === "        run: |");
  assert(start > step, `Missing workflow script: ${name}`);
  const script = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !line.startsWith("          ")) break;
    script.push(line.slice(10));
  }
  return script.join("\n");
}

const temporary = mkdtempSync(path.join(tmpdir(), "godesk-release-check-"));
const database = path.join(temporary, "releases.json");
const output = path.join(temporary, "output");
const sha = "a".repeat(40);
try {
  writeFileSync(database, JSON.stringify({ tags: {}, releases: {} }));
  // Execute the actual workflow shell without calling GitHub or deploying.
  writeFileSync(path.join(temporary, "gh"), `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const file = process.env.RELEASE_CHECK_DATABASE;
const records = JSON.parse(fs.readFileSync(file, "utf8"));
if (args[0] === "release" && args[1] === "view") process.exit(records.releases[args[2]] ? 0 : 1);
if (args[0] === "api") {
  if (process.env.RELEASE_CHECK_API_FAILURE) process.exit(1);
  const tag = args[1].split("/tags/")[1];
  process.stdout.write(records.tags[tag] || "");
} else if (args[0] === "release" && args[1] === "create") {
  const tag = args[2];
  if (records.releases[tag]) process.exit(1);
  records.tags[tag] ||= args[args.indexOf("--target") + 1];
  records.releases[tag] = true;
  fs.writeFileSync(file, JSON.stringify(records));
} else process.exit(1);
`, { mode: 0o755 });

  const environment = {
    PATH: `${temporary}${path.delimiter}${process.env.PATH}`,
    GITHUB_SHA: sha,
    GITHUB_REPOSITORY: "example/godesk",
    GITHUB_OUTPUT: output,
    RELEASE_CHECK_DATABASE: database,
  };
  function run(script, attempt, tag = "", apiFailure = "") {
    const values = {
      "github.run_number": "17", "github.run_attempt": String(attempt),
      "github.sha": sha, "github.repository": "example/godesk", "github.run_id": "42",
    };
    const rendered = script.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_, expression) => {
      assert(expression in values, `Unexpected expression: ${expression}`);
      return values[expression];
    });
    const result = spawnSync("bash", ["-c", rendered], {
      env: { ...environment, RELEASE_TAG: tag, RELEASE_CHECK_API_FAILURE: apiFailure }, encoding: "utf8",
    });
    assert.ifError(result.error);
    return result;
  }
  const identity = stepScript("Record deploy identity");
  const release = stepScript("Create GitHub Release");
  function deploy(attempt) {
    writeFileSync(output, "");
    const result = run(identity, attempt);
    assert.equal(result.status, 0, result.stderr);
    const tag = readFileSync(output, "utf8").trim().replace(/^tag=/, "");
    assert.match(tag, new RegExp(`^deploy-\\d{4}\\.\\d{2}\\.\\d{2}-17-${attempt}$`));
    return tag;
  }
  const first = deploy(1);
  assert.equal(run(release, 1, first).status, 0);
  // A release-only rerun gets a new workflow attempt, but the original deploy output.
  assert.equal(run(release, 2, first).status, 0);
  assert.equal(Object.keys(JSON.parse(readFileSync(database, "utf8")).releases).length, 1);
  const second = deploy(3);
  assert.notEqual(first, second);
  assert.equal(run(release, 3, second).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(database, "utf8")), {
    tags: { [first]: sha, [second]: sha }, releases: { [first]: true, [second]: true },
  });
  writeFileSync(database, JSON.stringify({ tags: { [first]: "b".repeat(40) }, releases: { [first]: true } }));
  assert.notEqual(run(release, 4, first).status, 0, "Mismatched tag must fail");
  writeFileSync(database, JSON.stringify({ tags: { [first]: "b".repeat(40) }, releases: {} }));
  assert.notEqual(run(release, 4, first).status, 0, "Mismatched orphan tag must fail");
  assert.deepEqual(JSON.parse(readFileSync(database, "utf8")).releases, {});
  writeFileSync(database, JSON.stringify({ tags: { [first]: sha }, releases: {} }));
  assert.equal(run(release, 4, first).status, 0, "Matching orphan tag may finish release creation");
  assert.notEqual(run(release, 4, first, "yes").status, 0, "API failure must not be treated as a missing tag");
  assert.notEqual(run(release, 4).status, 0, "Missing deploy identity must fail");
  console.log("Release records verified: full rerun, release-only retry, orphan tags, mismatched SHA, API failure, missing deploy identity.");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
