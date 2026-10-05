#!/usr/bin/env node
// Serve the built app on a local `wrangler dev` Worker, create one fixed-seed
// hex-settlement Room, and publish the two Lighthouse URLs (home + Room with
// ?tier=low, SPEC §4.6.3). Stays up until SIGINT / SIGTERM.
//
//   node scripts/perf-serve.mjs [--port 8790] [--urls-file perf-results/lighthouse-urls.json]
//
// On GitHub Actions the URLs are also exported as LHCI_HOME_URL / LHCI_ROOM_URL.
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createHexRoom, startWorker, withQuery } from "./perf/room.mjs";

const { values: args } = parseArgs({
  options: {
    port: { type: "string", default: "8790" },
    "urls-file": { type: "string", default: "perf-results/lighthouse-urls.json" },
    seed: { type: "string", default: "7" },
  },
});

const log = (line) => console.log(`[perf-serve ${new Date().toISOString()}] ${line}`);
const worker = await startWorker({ port: Number(args.port), log });
const shutdown = async () => {
  await worker.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  const room = await createHexRoom(worker.origin, { seed: Number(args.seed), tag: `lighthouse-${Date.now()}` });
  const urls = { home: `${worker.origin}/`, room: withQuery(room.roomUrl, { tier: "low" }) };
  const file = resolve(args["urls-file"]);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(urls, null, 2)}\n`);
  if (process.env.GITHUB_ENV) {
    await appendFile(process.env.GITHUB_ENV, `LHCI_HOME_URL=${urls.home}\nLHCI_ROOM_URL=${urls.room}\n`);
  }
  log(`home ${urls.home}`);
  log(`room ${urls.room.replace(/share=[^&]+/, "share=<redacted>")}`);
  log(`urls written to ${file}; serving until stopped`);
} catch (error) {
  log(`failed: ${error.stack ?? error}`);
  await worker.stop();
  process.exit(1);
}
