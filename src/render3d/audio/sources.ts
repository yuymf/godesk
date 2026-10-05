/**
 * G3D-10：音频素材来源。
 *
 * 素材文件由 G3D-26（SFX sprite + 环境声）与 G3D-27（音乐）放进 `assets/audio/`，
 * 并登记在资产清单与 `assets/LICENSES.md`。这里用 Vite 的 `import.meta.glob`
 * 发现这些文件：文件存在时打包为带 hash 的 URL；还没合入时 glob 为空，
 * 音频引擎退化为「只记 cue 日志、不出声」，不会让构建失败。
 */

export type SpriteMap = Record<string, [number, number]>;

export type SpriteSource = {
  id: "audio/sfx-core" | "audio/sfx-extended";
  url: string;
  sprite: SpriteMap;
};

export type LoopSource = { id: string; url: string };

export type AudioSources = {
  core: SpriteSource | null;
  extended: SpriteSource | null;
  /** 海浪在前；low 档只加载第一条（§4.8） */
  ambience: LoopSource[];
  /** 下标与 `MUSIC_TRACKS`（主题 / 平稳 / 终局）一致 */
  music: (LoopSource | null)[];
};

const audioUrls = import.meta.glob("../../../assets/audio/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const spriteJson = import.meta.glob("../../../assets/audio/sfx-*.json", {
  eager: true,
  import: "default",
}) as Record<string, { src?: string[]; sprite?: SpriteMap }>;

function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

export function buildAudioSources(
  urls: Record<string, string>,
  sprites: Record<string, { src?: string[]; sprite?: SpriteMap }>,
): AudioSources {
  const urlByFile = new Map(Object.entries(urls).map(([path, url]) => [fileName(path), url]));
  const sprite = (name: "sfx-core" | "sfx-extended"): SpriteSource | null => {
    const entry = Object.entries(sprites).find(([path]) => fileName(path) === `${name}.json`)?.[1];
    const src = entry?.src?.[0] ?? `${name}.mp3`;
    const url = urlByFile.get(src);
    if (!entry?.sprite || !url) return null;
    return { id: `audio/${name}`, url, sprite: entry.sprite };
  };
  const loop = (id: string, file: string): LoopSource | null => {
    const url = urlByFile.get(file);
    return url ? { id, url } : null;
  };
  return {
    core: sprite("sfx-core"),
    extended: sprite("sfx-extended"),
    ambience: [
      loop("audio/ambience-surf", "ambience-surf.mp3"),
      loop("audio/ambience-harbor-wind", "ambience-harbor-wind.mp3"),
    ].filter((entry): entry is LoopSource => entry !== null),
    // 曲目顺序按 G3D-27 清单顺序：tide-harbor = 主题，crystal-shore = 平稳，observing-star = 终局。
    music: [
      loop("music/tide-harbor", "music-tide-harbor.mp3"),
      loop("music/crystal-shore", "music-crystal-shore.mp3"),
      loop("music/observing-star", "music-observing-star.mp3"),
    ],
  };
}

export const AUDIO_SOURCES: AudioSources = buildAudioSources(audioUrls, spriteJson);
