#!/usr/bin/env node
/**
 * G3D-26: build howler-ready SFX sprites + ambient from Kenney CC0 + procedural.
 * Usage: node scripts/build-sfx-sprites.mjs
 */
import { mkdirSync, writeFileSync, existsSync, copyFileSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = "/workspace/g3d-evidence/G3D-26/vendor/kenney-ui";
const SRC = join(ROOT, "assets/audio/src");
const OUT = join(ROOT, "assets/audio");
const EVIDENCE = "/workspace/g3d-evidence/G3D-26";

mkdirSync(SRC, { recursive: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(EVIDENCE, { recursive: true });

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(`${cmd} ${args.join(" ")} failed (${r.status})`);
  }
  return r;
}

function ffmpeg(...args) {
  return run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
}

/** Short click from Kenney wav → mono 44.1k wav, peak-normalized softly */
function fromKenney(name, kenneyFile, maxSec = 0.35) {
  const src = join(VENDOR, kenneyFile);
  if (!existsSync(src)) throw new Error(`missing kenney ${kenneyFile}`);
  const dest = join(SRC, `${name}.wav`);
  ffmpeg(
    "-i", src,
    "-ac", "1", "-ar", "44100",
    "-af", `atrim=0:${maxSec},afade=t=out:st=${Math.max(0, maxSec - 0.05)}:d=0.05,loudnorm=I=-16:TP=-1.5:LRA=7`,
    dest,
  );
  return { name, dest, source: "cc0", kenneyFile };
}

/** Procedural beep / thud via ffmpeg lavfi */
function procedural(name, { kind, freq = 440, dur = 0.25, noise = 0 } = {}) {
  const dest = join(SRC, `${name}.wav`);
  let filter;
  if (kind === "thud") {
    filter = `sine=f=${freq}:d=${dur},afade=t=in:st=0:d=0.01,afade=t=out:st=${dur * 0.3}:d=${dur * 0.7},volume=0.7`;
  } else if (kind === "rattle") {
    // noise burst + bandpass
    filter = `anoisesrc=d=${dur}:c=pink:a=0.4,afade=t=out:st=${dur * 0.2}:d=${dur * 0.8},highpass=f=200,lowpass=f=4000,volume=0.55`;
  } else if (kind === "chime") {
    filter = `sine=f=${freq}:d=${dur},afade=t=out:st=0.05:d=${dur - 0.05},volume=0.45`;
  } else if (kind === "blip") {
    filter = `sine=f=${freq}:d=${dur},afade=t=out:st=${dur * 0.2}:d=${dur * 0.8},volume=0.5`;
  } else if (kind === "surf") {
    filter = `anoisesrc=d=${dur}:c=pink:a=0.25,lowpass=f=800,highpass=f=80,afade=t=in:st=0:d=1,afade=t=out:st=${dur - 2}:d=2,volume=0.35`;
  } else if (kind === "wind") {
    filter = `anoisesrc=d=${dur}:c=brown:a=0.3,lowpass=f=500,afade=t=in:st=0:d=1.5,afade=t=out:st=${dur - 2}:d=2,volume=0.3`;
  } else {
    filter = `sine=f=${freq}:d=${dur},afade=t=out:st=${dur * 0.4}:d=${dur * 0.6},volume=0.5`;
  }
  ffmpeg("-f", "lavfi", "-i", filter, "-ac", "1", "-ar", "44100", dest);
  return { name, dest, source: "procedural", kind };
}

// --- Clip plan (30 SFX) ---
const corePlan = [
  fromKenney("sfx-hover", "click1.wav", 0.2),
  fromKenney("sfx-select", "click3.wav", 0.25),
  fromKenney("sfx-illegal", "switch1.wav", 0.3),
  fromKenney("sfx-place-1", "click2.wav", 0.28),
  fromKenney("sfx-place-2", "click4.wav", 0.28),
  fromKenney("sfx-road-1", "switch5.wav", 0.3),
  fromKenney("sfx-road-2", "switch8.wav", 0.3),
  procedural("sfx-dice-1", { kind: "rattle", dur: 0.35 }),
  procedural("sfx-dice-2", { kind: "rattle", dur: 0.4 }),
  procedural("sfx-dice-3", { kind: "rattle", dur: 0.32 }),
  procedural("sfx-dice-4", { kind: "rattle", dur: 0.38 }),
  fromKenney("sfx-turn-1", "switch10.wav", 0.25),
  fromKenney("sfx-turn-2", "switch12.wav", 0.25),
  procedural("sfx-win", { kind: "chime", freq: 880, dur: 0.55 }),
  procedural("sfx-lose", { kind: "thud", freq: 110, dur: 0.5 }),
];

const extPlan = [
  fromKenney("sfx-panel-1", "switch20.wav", 0.3),
  fromKenney("sfx-panel-2", "switch22.wav", 0.3),
  fromKenney("sfx-toggle", "switch30.wav", 0.25),
  fromKenney("sfx-upgrade", "click5.wav", 0.3),
  procedural("sfx-move", { kind: "blip", freq: 520, dur: 0.22 }),
  procedural("sfx-steal", { kind: "blip", freq: 260, dur: 0.28 }),
  procedural("sfx-gain-wood", { kind: "blip", freq: 349, dur: 0.2 }),
  procedural("sfx-gain-brick", { kind: "blip", freq: 392, dur: 0.2 }),
  procedural("sfx-gain-sheep", { kind: "blip", freq: 440, dur: 0.2 }),
  procedural("sfx-gain-wheat", { kind: "blip", freq: 494, dur: 0.2 }),
  procedural("sfx-gain-ore", { kind: "blip", freq: 523, dur: 0.2 }),
  fromKenney("sfx-trade-1", "switch33.wav", 0.28),
  fromKenney("sfx-trade-2", "switch34.wav", 0.28),
  fromKenney("sfx-trade-3", "switch35.wav", 0.28),
  fromKenney("sfx-trade-4", "switch36.wav", 0.28),
];

const ambientPlan = [
  procedural("ambience-surf", { kind: "surf", dur: 12 }),
  procedural("ambience-harbor-wind", { kind: "wind", dur: 12 }),
];

function buildSprite(label, plan, bitrate = "128k") {
  const listFile = join(SRC, `${label}.txt`);
  const wavOut = join(SRC, `${label}-concat.wav`);
  const mp3Out = join(OUT, `${label}.mp3`);
  const jsonOut = join(OUT, `${label}.json`);
  const gapSec = 0.05;
  const lines = [];
  const sprite = {};
  let cursorMs = 0;

  for (const clip of plan) {
    // measure duration
    const probe = run("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", clip.dest,
    ]);
    const durSec = Math.max(0.05, parseFloat(probe.stdout.trim()));
    const durMs = Math.round(durSec * 1000);
    const id = clip.name.replace(/^sfx-/, "sfx/").replace(/^ambience-/, "ambience/");
    // howler uses fragment key without path sometimes; keep slash ids as SPEC
    sprite[id] = [cursorMs, durMs];
    lines.push(`file '${clip.dest}'`);
    // gap as anullsrc
    const gapPath = join(SRC, `_gap_${label}_${cursorMs}.wav`);
    ffmpeg("-f", "lavfi", "-i", `anullsrc=r=44100:cl=mono`, "-t", String(gapSec), gapPath);
    lines.push(`file '${gapPath}'`);
    cursorMs += durMs + Math.round(gapSec * 1000);
  }
  writeFileSync(listFile, lines.join("\n") + "\n");
  ffmpeg("-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", wavOut);
  ffmpeg("-i", wavOut, "-codec:a", "libmp3lame", "-b:a", bitrate, "-ac", "1", "-ar", "44100", mp3Out);
  const meta = {
    src: [`${label}.mp3`],
    sprite,
    meta: { task: "G3D-26", clips: plan.length, bitrate },
  };
  writeFileSync(jsonOut, JSON.stringify(meta, null, 2) + "\n");
  const bytes = statSync(mp3Out).size;
  console.log(`${label}: ${bytes} bytes, ${plan.length} clips`);
  return { mp3Out, jsonOut, bytes, sprite, plan };
}

const core = buildSprite("sfx-core", corePlan, "128k");
const ext = buildSprite("sfx-extended", extPlan, "128k");

// Ambient as separate mp3s (not sprites)
for (const a of ambientPlan) {
  const mp3 = join(OUT, `${a.name}.mp3`);
  ffmpeg("-i", a.dest, "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1", "-ar", "22050", mp3);
  console.log(`${a.name}: ${statSync(mp3).size} bytes`);
}

writeFileSync(
  join(EVIDENCE, "build-summary.json"),
  JSON.stringify(
    {
      coreBytes: core.bytes,
      extendedBytes: ext.bytes,
      coreLimit: 300 * 1024,
      extendedLimit: 250 * 1024,
      coreOk: core.bytes <= 300 * 1024,
      extendedOk: ext.bytes <= 250 * 1024,
      coreIds: Object.keys(core.sprite),
      extendedIds: Object.keys(ext.sprite),
    },
    null,
    2,
  ),
);
console.log("done");
