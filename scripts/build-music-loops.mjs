#!/usr/bin/env node
import { mkdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets/audio");
const VENDOR = "/workspace/g3d-evidence/G3D-27";
mkdirSync(OUT, { recursive: true });

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr}`);
  return r;
}
function ffmpeg(...a) {
  return run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a]);
}

const tracks = [
  {
    id: "music/tide-harbor",
    src: join(VENDOR, "field_of_dreams.mp3"),
    out: "music-tide-harbor.mp3",
    title: "Tide Harbor",
    url: "https://opengameart.org/content/the-field-of-dreams",
    author: "pauliuw",
  },
  {
    id: "music/crystal-shore",
    src: join(VENDOR, "crystal_cave.mp3"),
    out: "music-crystal-shore.mp3",
    title: "Crystal Shore",
    url: "https://opengameart.org/content/crystal-cave-song18",
    author: "cynicmusic / pixelsphere.org",
  },
  {
    id: "music/observing-star",
    src: join(VENDOR, "observing/ObservingTheStar.ogg"),
    out: "music-observing-star.mp3",
    title: "Observing Star",
    url: "https://opengameart.org/content/another-space-background-track",
    author: "yd",
  },
];

const TARGET = 120;
const results = [];
for (const t of tracks) {
  if (!existsSync(t.src)) throw new Error("missing " + t.src);
  const probe = run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", t.src,
  ]);
  const dur = parseFloat(probe.stdout.trim());
  const loops = Math.ceil(TARGET / dur) + 1;
  const list = join(VENDOR, `${t.out}.txt`);
  writeFileSync(list, Array.from({ length: loops }, () => `file '${t.src}'`).join("\n") + "\n");
  const concatWav = join(VENDOR, `${t.out}.concat.wav`);
  ffmpeg("-f", "concat", "-safe", "0", "-i", list, "-t", String(TARGET), "-ac", "2", "-ar", "44100", concatWav);
  const mp3 = join(OUT, t.out);
  ffmpeg(
    "-i", concatWav,
    "-af", "afade=t=in:st=0:d=0.5,afade=t=out:st=118.5:d=1.5,loudnorm=I=-16:TP=-1.5:LRA=11",
    "-codec:a", "libmp3lame", "-b:a", "96k",
    mp3,
  );
  const bytes = statSync(mp3).size;
  console.log(t.id, bytes, "ok=", bytes <= 1.5 * 1024 * 1024);
  results.push({ ...t, bytes, file: `assets/audio/${t.out}` });
}
writeFileSync(join(VENDOR, "music-build.json"), JSON.stringify(results, null, 2));
