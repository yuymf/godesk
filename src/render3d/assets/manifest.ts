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
    "bytes": 6369,
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
    "bytes": 27568,
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
    "bytes": 26734,
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
    "bytes": 26346,
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
    "bytes": 27000,
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
    "bytes": 26190,
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
    "bytes": 51912,
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
    "bytes": 50096,
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
    "bytes": 50112,
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
  }
]
);

export const LICENSE_SPDX_WHITELIST: readonly LicenseSpdx[] = Object.freeze(["CC0-1.0","OFL-1.1","LicenseRef-GoDesk-Original","LicenseRef-Purchased"]);
export function listManifestIds(): string[] { const ids: string[]=[]; for (const e of ASSET_MANIFEST){ ids.push(e.id); if(e.spriteFragments) for (const f of e.spriteFragments) ids.push(f);} return ids; }
export function expectedLicenseRowCount(): number { return listManifestIds().length; }
