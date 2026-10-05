/**
 * G3D 资产清单（SPEC §5.1 / §5.4）。
 * 每个会进入 dist 的模型 / 贴图 / 音频 / 插画 / 字体文件必须有一条记录，
 * 并在 assets/LICENSES.md 有对应行（sprite 片段另占一行）。
 */

export type AssetKind =
  | "model"
  | "texture"
  | "audio"
  | "audio-sprite"
  | "illustration"
  | "font"
  | "ui"
  | "other";

export type AssetTier = "all" | "high-medium" | "low";

export type AssetSource =
  | "procedural"
  | "self-made"
  | "cc0"
  | "ofl"
  | "purchased";

export type LicenseSpdx =
  | "CC0-1.0"
  | "OFL-1.1"
  | "LicenseRef-GoDesk-Original"
  | "LicenseRef-Purchased";

export type LicenseStatus = "cleared" | "pending";

export type AssetLicense = {
  spdx: LicenseSpdx;
  sourceUrl: string;
  author: string;
  obtainedAt: string; // YYYY-MM-DD
  modified: boolean;
  modificationNote: string;
  orderRef: string;
  status: LicenseStatus;
};

export type AssetManifestEntry = {
  id: string;
  file: string;
  kind: AssetKind;
  bytes: number;
  tier: AssetTier;
  source: AssetSource;
  license: AssetLicense;
  /** sprite 内片段 id；仅 audio-sprite 使用 */
  spriteFragments?: string[];
};

/**
 * 当前已登记资产。G3D-11 仅落地管线；素材文件由 G3D-19–G3D-27 追加。
 * 管线自检用的占位资产（若有）必须同时写入 LICENSES.md。
 */
export const ASSET_MANIFEST: readonly AssetManifestEntry[] = Object.freeze(
[
{
    "id": "font/manrope",
    "file": "src/assets/fonts/manrope-latin-wght-normal.woff2",
    "kind": "font",
    "bytes": 24836,
    "tier": "all",
    "source": "ofl",
    "license": {
      "spdx": "OFL-1.1",
      "sourceUrl": "https://fonts.google.com/specimen/Manrope",
      "author": "Mikhail Sharanda / Cyreal",
      "obtainedAt": "2026-10-05",
      "modified": false,
      "modificationNote": "无",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/godesk-mark",
    "file": "src/assets/godesk-mark.svg",
    "kind": "ui",
    "bytes": 533,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "src/assets/godesk-mark.svg",
      "author": "俞孟凡 / GoDesk",
      "obtainedAt": "2026-10-05",
      "modified": false,
      "modificationNote": "无",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/paper-noise",
    "file": "assets/ui/paper-noise.webp",
    "kind": "ui",
    "bytes": 13676,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-paper-noise.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "无",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/paper-edge-panel",
    "file": "assets/ui/paper-edge-panel.svg",
    "kind": "ui",
    "bytes": 533,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/paper-edge-panel.svg",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "无",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/paper-edge-card",
    "file": "assets/ui/paper-edge-card.svg",
    "kind": "ui",
    "bytes": 437,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/paper-edge-card.svg",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "无",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ink-icons",
    "file": "assets/ui/ink-icons.svg",
    "kind": "ui",
    "bytes": 9585,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ink-icons.svg",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "无",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "font/fraunces-display",
    "file": "assets/fonts/fraunces-latin-display.woff2",
    "kind": "font",
    "bytes": 16428,
    "tier": "all",
    "source": "ofl",
    "license": {
      "spdx": "OFL-1.1",
      "sourceUrl": "https://github.com/google/fonts/tree/main/ofl/fraunces",
      "author": "Underscore Type / Google Fonts (Fraunces)",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "实例化 Soft=50 opsz=36 wght=600 并 pyftsubset 拉丁子集为 woff2",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "audio/sfx-core",
    "file": "assets/audio/sfx-core.mp3",
    "kind": "audio-sprite",
    "bytes": 76529,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/build-sfx-sprites.mjs",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "Kenney CC0 + 程序化组装",
      "orderRef": "n/a",
      "status": "cleared"
    },
    "spriteFragments": [
      "sfx/hover",
      "sfx/select",
      "sfx/illegal",
      "sfx/place-1",
      "sfx/place-2",
      "sfx/road-1",
      "sfx/road-2",
      "sfx/dice-1",
      "sfx/dice-2",
      "sfx/dice-3",
      "sfx/dice-4",
      "sfx/turn-1",
      "sfx/turn-2",
      "sfx/win",
      "sfx/lose"
    ]
  },
{
    "id": "audio/sfx-extended",
    "file": "assets/audio/sfx-extended.mp3",
    "kind": "audio-sprite",
    "bytes": 69006,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/build-sfx-sprites.mjs",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "Kenney CC0 + 程序化组装",
      "orderRef": "n/a",
      "status": "cleared"
    },
    "spriteFragments": [
      "sfx/panel-1",
      "sfx/panel-2",
      "sfx/toggle",
      "sfx/upgrade",
      "sfx/move",
      "sfx/steal",
      "sfx/gain-wood",
      "sfx/gain-brick",
      "sfx/gain-sheep",
      "sfx/gain-wheat",
      "sfx/gain-ore",
      "sfx/trade-1",
      "sfx/trade-2",
      "sfx/trade-3",
      "sfx/trade-4"
    ]
  },
{
    "id": "audio/ambience-surf",
    "file": "assets/audio/ambience-surf.mp3",
    "kind": "audio",
    "bytes": 96800,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/build-sfx-sprites.mjs",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "ffmpeg pink noise",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "audio/ambience-harbor-wind",
    "file": "assets/audio/ambience-harbor-wind.mp3",
    "kind": "audio",
    "bytes": 96800,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/build-sfx-sprites.mjs",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "ffmpeg brown noise",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "music/tide-harbor",
    "file": "assets/audio/music-tide-harbor.mp3",
    "kind": "audio",
    "bytes": 1440620,
    "tier": "all",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://opengameart.org/content/the-field-of-dreams",
      "author": "pauliuw",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "循环至 120s、96kbps、loudnorm",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "music/crystal-shore",
    "file": "assets/audio/music-crystal-shore.mp3",
    "kind": "audio",
    "bytes": 1439468,
    "tier": "all",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://opengameart.org/content/crystal-cave-song18",
      "author": "cynicmusic / pixelsphere.org",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "循环至 120s、96kbps、loudnorm",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "music/observing-star",
    "file": "assets/audio/music-observing-star.mp3",
    "kind": "audio",
    "bytes": 1440620,
    "tier": "all",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://opengameart.org/content/another-space-background-track",
      "author": "yd",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "循环至 120s、96kbps、loudnorm",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/resource-wood",
    "file": "assets/illustrations/cards/resource-wood.webp",
    "kind": "illustration",
    "bytes": 34938,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-card-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 羊皮纸插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/resource-brick",
    "file": "assets/illustrations/cards/resource-brick.webp",
    "kind": "illustration",
    "bytes": 38494,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-card-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 羊皮纸插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/resource-sheep",
    "file": "assets/illustrations/cards/resource-sheep.webp",
    "kind": "illustration",
    "bytes": 35784,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-card-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 羊皮纸插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/resource-wheat",
    "file": "assets/illustrations/cards/resource-wheat.webp",
    "kind": "illustration",
    "bytes": 24224,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-card-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 羊皮纸插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/resource-ore",
    "file": "assets/illustrations/cards/resource-ore.webp",
    "kind": "illustration",
    "bytes": 33382,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-card-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 羊皮纸插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/dev-fog-signal",
    "file": "assets/illustrations/cards/dev-fog-signal.webp",
    "kind": "illustration",
    "bytes": 45314,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-card-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 羊皮纸插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/dev-tide-plenty",
    "file": "assets/illustrations/cards/dev-tide-plenty.webp",
    "kind": "illustration",
    "bytes": 48406,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-card-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 羊皮纸插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/dev-harbor-charter",
    "file": "assets/illustrations/cards/dev-harbor-charter.webp",
    "kind": "illustration",
    "bytes": 46832,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-card-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 羊皮纸插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/seat-0",
    "file": "assets/illustrations/brand/seat-0.webp",
    "kind": "illustration",
    "bytes": 19444,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-brand-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 品牌插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/seat-1",
    "file": "assets/illustrations/brand/seat-1.webp",
    "kind": "illustration",
    "bytes": 19862,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-brand-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 品牌插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/seat-2",
    "file": "assets/illustrations/brand/seat-2.webp",
    "kind": "illustration",
    "bytes": 17882,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-brand-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 品牌插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/seat-3",
    "file": "assets/illustrations/brand/seat-3.webp",
    "kind": "illustration",
    "bytes": 18176,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-brand-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 品牌插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/island-flourish",
    "file": "assets/illustrations/brand/island-flourish.webp",
    "kind": "illustration",
    "bytes": 29426,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-brand-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 品牌插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/loading-tidewell",
    "file": "assets/illustrations/brand/loading-tidewell.webp",
    "kind": "illustration",
    "bytes": 108536,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-brand-art.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "PIL 品牌插画",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "model/decor",
    "file": "assets/models/decor.glb",
    "kind": "model",
    "bytes": 41924,
    "tier": "all",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://kenney.nl/assets/nature-kit",
      "author": "Kenney",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "选型合并 + meshopt；按风格指南使用（松/灌/岩/麦/砖垛/浮木）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/sea-normal",
    "file": "assets/textures/ktx2/sea-normal.ktx2",
    "kind": "texture",
    "bytes": 70515,
    "tier": "high-medium",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-noise-textures.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "程序化噪声 + toktx UASTC",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/foam-noise",
    "file": "assets/textures/ktx2/foam-noise.ktx2",
    "kind": "texture",
    "bytes": 9971,
    "tier": "high-medium",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-noise-textures.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "程序化噪声 + toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t01-pine/512/baseColor",
    "file": "assets/textures/pbr/t01-pine/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 22111,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t01-pine/512/normal",
    "file": "assets/textures/pbr/t01-pine/512/normal.ktx2",
    "kind": "texture",
    "bytes": 20156,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t01-pine/512/orm",
    "file": "assets/textures/pbr/t01-pine/512/orm.ktx2",
    "kind": "texture",
    "bytes": 19160,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t01-pine/256/baseColor",
    "file": "assets/textures/pbr/t01-pine/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 7090,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t01-pine/256/normal",
    "file": "assets/textures/pbr/t01-pine/256/normal.ktx2",
    "kind": "texture",
    "bytes": 54180,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t01-pine/256/orm",
    "file": "assets/textures/pbr/t01-pine/256/orm.ktx2",
    "kind": "texture",
    "bytes": 6536,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t02-clay/512/baseColor",
    "file": "assets/textures/pbr/t02-clay/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 19727,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground037",
      "author": "ambientCG / Ground037",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t02-clay/512/normal",
    "file": "assets/textures/pbr/t02-clay/512/normal.ktx2",
    "kind": "texture",
    "bytes": 18404,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground037",
      "author": "ambientCG / Ground037",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t02-clay/512/orm",
    "file": "assets/textures/pbr/t02-clay/512/orm.ktx2",
    "kind": "texture",
    "bytes": 21528,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground037",
      "author": "ambientCG / Ground037",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t02-clay/256/baseColor",
    "file": "assets/textures/pbr/t02-clay/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 7142,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground037",
      "author": "ambientCG / Ground037",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t02-clay/256/normal",
    "file": "assets/textures/pbr/t02-clay/256/normal.ktx2",
    "kind": "texture",
    "bytes": 45495,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground037",
      "author": "ambientCG / Ground037",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t02-clay/256/orm",
    "file": "assets/textures/pbr/t02-clay/256/orm.ktx2",
    "kind": "texture",
    "bytes": 6948,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground037",
      "author": "ambientCG / Ground037",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t03-meadow/512/baseColor",
    "file": "assets/textures/pbr/t03-meadow/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 21974,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t03-meadow/512/normal",
    "file": "assets/textures/pbr/t03-meadow/512/normal.ktx2",
    "kind": "texture",
    "bytes": 20156,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t03-meadow/512/orm",
    "file": "assets/textures/pbr/t03-meadow/512/orm.ktx2",
    "kind": "texture",
    "bytes": 19160,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t03-meadow/256/baseColor",
    "file": "assets/textures/pbr/t03-meadow/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 7055,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t03-meadow/256/normal",
    "file": "assets/textures/pbr/t03-meadow/256/normal.ktx2",
    "kind": "texture",
    "bytes": 54180,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t03-meadow/256/orm",
    "file": "assets/textures/pbr/t03-meadow/256/orm.ktx2",
    "kind": "texture",
    "bytes": 6536,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Grass001",
      "author": "ambientCG / Grass001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t04-wheat/512/baseColor",
    "file": "assets/textures/pbr/t04-wheat/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 39646,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground033",
      "author": "ambientCG / Ground033",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t04-wheat/512/normal",
    "file": "assets/textures/pbr/t04-wheat/512/normal.ktx2",
    "kind": "texture",
    "bytes": 109357,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground033",
      "author": "ambientCG / Ground033",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t04-wheat/512/orm",
    "file": "assets/textures/pbr/t04-wheat/512/orm.ktx2",
    "kind": "texture",
    "bytes": 34459,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground033",
      "author": "ambientCG / Ground033",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t04-wheat/256/baseColor",
    "file": "assets/textures/pbr/t04-wheat/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 9943,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground033",
      "author": "ambientCG / Ground033",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t04-wheat/256/normal",
    "file": "assets/textures/pbr/t04-wheat/256/normal.ktx2",
    "kind": "texture",
    "bytes": 32711,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground033",
      "author": "ambientCG / Ground033",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t04-wheat/256/orm",
    "file": "assets/textures/pbr/t04-wheat/256/orm.ktx2",
    "kind": "texture",
    "bytes": 9169,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground033",
      "author": "ambientCG / Ground033",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t05-reef/512/baseColor",
    "file": "assets/textures/pbr/t05-reef/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 23906,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock020",
      "author": "ambientCG / Rock020",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t05-reef/512/normal",
    "file": "assets/textures/pbr/t05-reef/512/normal.ktx2",
    "kind": "texture",
    "bytes": 174455,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock020",
      "author": "ambientCG / Rock020",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t05-reef/512/orm",
    "file": "assets/textures/pbr/t05-reef/512/orm.ktx2",
    "kind": "texture",
    "bytes": 18991,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock020",
      "author": "ambientCG / Rock020",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t05-reef/256/baseColor",
    "file": "assets/textures/pbr/t05-reef/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 10240,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock020",
      "author": "ambientCG / Rock020",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t05-reef/256/normal",
    "file": "assets/textures/pbr/t05-reef/256/normal.ktx2",
    "kind": "texture",
    "bytes": 52583,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock020",
      "author": "ambientCG / Rock020",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t05-reef/256/orm",
    "file": "assets/textures/pbr/t05-reef/256/orm.ktx2",
    "kind": "texture",
    "bytes": 6897,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock020",
      "author": "ambientCG / Rock020",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t06-sand/512/baseColor",
    "file": "assets/textures/pbr/t06-sand/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 27664,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground054",
      "author": "ambientCG / Ground054",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t06-sand/512/normal",
    "file": "assets/textures/pbr/t06-sand/512/normal.ktx2",
    "kind": "texture",
    "bytes": 142093,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground054",
      "author": "ambientCG / Ground054",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t06-sand/512/orm",
    "file": "assets/textures/pbr/t06-sand/512/orm.ktx2",
    "kind": "texture",
    "bytes": 27112,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground054",
      "author": "ambientCG / Ground054",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t06-sand/256/baseColor",
    "file": "assets/textures/pbr/t06-sand/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 9223,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground054",
      "author": "ambientCG / Ground054",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t06-sand/256/normal",
    "file": "assets/textures/pbr/t06-sand/256/normal.ktx2",
    "kind": "texture",
    "bytes": 47786,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground054",
      "author": "ambientCG / Ground054",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t06-sand/256/orm",
    "file": "assets/textures/pbr/t06-sand/256/orm.ktx2",
    "kind": "texture",
    "bytes": 8785,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Ground054",
      "author": "ambientCG / Ground054",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t07-cliff/512/baseColor",
    "file": "assets/textures/pbr/t07-cliff/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 30779,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock023",
      "author": "ambientCG / Rock023",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t07-cliff/512/normal",
    "file": "assets/textures/pbr/t07-cliff/512/normal.ktx2",
    "kind": "texture",
    "bytes": 174407,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock023",
      "author": "ambientCG / Rock023",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t07-cliff/512/orm",
    "file": "assets/textures/pbr/t07-cliff/512/orm.ktx2",
    "kind": "texture",
    "bytes": 19327,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock023",
      "author": "ambientCG / Rock023",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t07-cliff/256/baseColor",
    "file": "assets/textures/pbr/t07-cliff/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 9985,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock023",
      "author": "ambientCG / Rock023",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t07-cliff/256/normal",
    "file": "assets/textures/pbr/t07-cliff/256/normal.ktx2",
    "kind": "texture",
    "bytes": 53258,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock023",
      "author": "ambientCG / Rock023",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t07-cliff/256/orm",
    "file": "assets/textures/pbr/t07-cliff/256/orm.ktx2",
    "kind": "texture",
    "bytes": 7076,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Rock023",
      "author": "ambientCG / Rock023",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t08-wood/512/baseColor",
    "file": "assets/textures/pbr/t08-wood/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 38432,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t08-wood/512/normal",
    "file": "assets/textures/pbr/t08-wood/512/normal.ktx2",
    "kind": "texture",
    "bytes": 94030,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t08-wood/512/orm",
    "file": "assets/textures/pbr/t08-wood/512/orm.ktx2",
    "kind": "texture",
    "bytes": 32463,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t08-wood/256/baseColor",
    "file": "assets/textures/pbr/t08-wood/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 9434,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t08-wood/256/normal",
    "file": "assets/textures/pbr/t08-wood/256/normal.ktx2",
    "kind": "texture",
    "bytes": 21814,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t08-wood/256/orm",
    "file": "assets/textures/pbr/t08-wood/256/orm.ktx2",
    "kind": "texture",
    "bytes": 7733,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t09-paintwood/512/baseColor",
    "file": "assets/textures/pbr/t09-paintwood/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 37766,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t09-paintwood/512/normal",
    "file": "assets/textures/pbr/t09-paintwood/512/normal.ktx2",
    "kind": "texture",
    "bytes": 94030,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t09-paintwood/512/orm",
    "file": "assets/textures/pbr/t09-paintwood/512/orm.ktx2",
    "kind": "texture",
    "bytes": 32463,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t09-paintwood/256/baseColor",
    "file": "assets/textures/pbr/t09-paintwood/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 9453,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t09-paintwood/256/normal",
    "file": "assets/textures/pbr/t09-paintwood/256/normal.ktx2",
    "kind": "texture",
    "bytes": 21814,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t09-paintwood/256/orm",
    "file": "assets/textures/pbr/t09-paintwood/256/orm.ktx2",
    "kind": "texture",
    "bytes": 7733,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Wood049",
      "author": "ambientCG / Wood049",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t10-canvas/512/baseColor",
    "file": "assets/textures/pbr/t10-canvas/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 22267,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Fabric045",
      "author": "ambientCG / Fabric045",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t10-canvas/512/normal",
    "file": "assets/textures/pbr/t10-canvas/512/normal.ktx2",
    "kind": "texture",
    "bytes": 22211,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Fabric045",
      "author": "ambientCG / Fabric045",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t10-canvas/512/orm",
    "file": "assets/textures/pbr/t10-canvas/512/orm.ktx2",
    "kind": "texture",
    "bytes": 21207,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Fabric045",
      "author": "ambientCG / Fabric045",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t10-canvas/256/baseColor",
    "file": "assets/textures/pbr/t10-canvas/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 9686,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Fabric045",
      "author": "ambientCG / Fabric045",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t10-canvas/256/normal",
    "file": "assets/textures/pbr/t10-canvas/256/normal.ktx2",
    "kind": "texture",
    "bytes": 43912,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Fabric045",
      "author": "ambientCG / Fabric045",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t10-canvas/256/orm",
    "file": "assets/textures/pbr/t10-canvas/256/orm.ktx2",
    "kind": "texture",
    "bytes": 8222,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Fabric045",
      "author": "ambientCG / Fabric045",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t11-parchment/512/baseColor",
    "file": "assets/textures/pbr/t11-parchment/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 28424,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Paper001",
      "author": "ambientCG / Paper001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t11-parchment/512/normal",
    "file": "assets/textures/pbr/t11-parchment/512/normal.ktx2",
    "kind": "texture",
    "bytes": 165150,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Paper001",
      "author": "ambientCG / Paper001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t11-parchment/512/orm",
    "file": "assets/textures/pbr/t11-parchment/512/orm.ktx2",
    "kind": "texture",
    "bytes": 26202,
    "tier": "high-medium",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Paper001",
      "author": "ambientCG / Paper001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t11-parchment/256/baseColor",
    "file": "assets/textures/pbr/t11-parchment/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 9284,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Paper001",
      "author": "ambientCG / Paper001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t11-parchment/256/normal",
    "file": "assets/textures/pbr/t11-parchment/256/normal.ktx2",
    "kind": "texture",
    "bytes": 25823,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Paper001",
      "author": "ambientCG / Paper001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/t11-parchment/256/orm",
    "file": "assets/textures/pbr/t11-parchment/256/orm.ktx2",
    "kind": "texture",
    "bytes": 8634,
    "tier": "low",
    "source": "cc0",
    "license": {
      "spdx": "CC0-1.0",
      "sourceUrl": "https://ambientcg.com/a/Paper001",
      "author": "ambientCG / Paper001",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "风格指南调色 + toktx",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "model/pieces",
    "file": "assets/models/pieces.glb",
    "kind": "model",
    "bytes": 10392,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/blender/",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "渔村/港镇/雾灯/栈道/羊 bpy 自制 meshopt",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "model/sheep",
    "file": "assets/models/sheep.glb",
    "kind": "model",
    "bytes": 7760,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/blender/",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "bpy 低模羊",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "model/props",
    "file": "assets/models/props.glb",
    "kind": "model",
    "bytes": 16304,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/blender/gen_props.py",
      "author": "GoDesk Track B",
      "obtainedAt": "2026-10-06",
      "modified": false,
      "modificationNote": "码头/船×2/骰子/托盘/边框 bpy meshopt",
      "orderRef": "n/a",
      "status": "cleared"
    }
  }
]
);

export const LICENSE_SPDX_WHITELIST: readonly LicenseSpdx[] = Object.freeze(["CC0-1.0","OFL-1.1","LicenseRef-GoDesk-Original","LicenseRef-Purchased"]);
export function listManifestIds(): string[] { const ids: string[]=[]; for (const e of ASSET_MANIFEST){ ids.push(e.id); if(e.spriteFragments) for (const f of e.spriteFragments) ids.push(f);} return ids; }
export function expectedLicenseRowCount(): number { return listManifestIds().length; }
