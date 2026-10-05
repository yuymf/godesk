import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CORE_SPRITE_CUES, CUE_IDS, DEFAULT_CUE_FRAGMENTS } from "../src/render3d/audio/cues.ts";

/** G3D-10 成功标准：核心 sprite ≤ 300 KB、扩展 sprite ≤ 250 KB；片段与 cue 表一致（§4.8）。 */
const AUDIO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/audio");
const KB = 1024;

function sprite(name) {
  const json = JSON.parse(readFileSync(resolve(AUDIO_DIR, `${name}.json`), "utf8"));
  return { json, bytes: statSync(resolve(AUDIO_DIR, json.src[0])).size };
}

describe("SFX sprites on disk (G3D-26 assets)", () => {
  const core = sprite("sfx-core");
  const extended = sprite("sfx-extended");

  it("core sprite ≤ 300 KB, extended sprite ≤ 250 KB", () => {
    expect(core.bytes).toBeGreaterThan(0);
    expect(core.bytes).toBeLessThanOrEqual(300 * KB);
    expect(extended.bytes).toBeGreaterThan(0);
    expect(extended.bytes).toBeLessThanOrEqual(250 * KB);
  });

  it("fragments match the cue table split 15 core / 15 extended", () => {
    const expectedCore = CUE_IDS.filter((cue) => CORE_SPRITE_CUES.has(cue)).flatMap((cue) => DEFAULT_CUE_FRAGMENTS[cue]);
    const expectedExtended = CUE_IDS.filter((cue) => !CORE_SPRITE_CUES.has(cue)).flatMap((cue) => DEFAULT_CUE_FRAGMENTS[cue]);
    expect(Object.keys(core.json.sprite).sort()).toEqual([...expectedCore].sort());
    expect(Object.keys(extended.json.sprite).sort()).toEqual([...expectedExtended].sort());
  });

  it("every fragment has a positive duration", () => {
    for (const [name, [start, duration]] of [...Object.entries(core.json.sprite), ...Object.entries(extended.json.sprite)]) {
      expect(start, name).toBeGreaterThanOrEqual(0);
      expect(duration, name).toBeGreaterThan(0);
    }
  });
});
