/**
 * 与 manifest.ts 同步的运行时数据（供 Node CI 脚本 import，无需 TS 转译）。
 */
export const ASSET_MANIFEST = Object.freeze([
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
    "id": "lobby/hex-settlement-thumb",
    "file": "public/lobby/hex-settlement-thumb.webp",
    "kind": "ui",
    "bytes": 4022,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/render-poster.mjs",
      "author": "GoDesk Track A",
      "obtainedAt": "2026-10-06",
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
    "bytes": 58228,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（C1）；1280x720 中心裁切到 3:4→384x512→WebP q82（原位替换）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "illustration/resource-brick",
    "file": "assets/illustrations/cards/resource-brick.webp",
    "kind": "illustration",
    "bytes": 47656,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（C2）；1280x720 中心裁切到 3:4→384x512→WebP q82（原位替换）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "illustration/resource-sheep",
    "file": "assets/illustrations/cards/resource-sheep.webp",
    "kind": "illustration",
    "bytes": 44588,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（C3）；1280x720 中心裁切到 3:4→384x512→WebP q82（原位替换）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "illustration/resource-wheat",
    "file": "assets/illustrations/cards/resource-wheat.webp",
    "kind": "illustration",
    "bytes": 55572,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（C4）；1280x720 中心裁切到 3:4→384x512→WebP q82（原位替换）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "illustration/resource-ore",
    "file": "assets/illustrations/cards/resource-ore.webp",
    "kind": "illustration",
    "bytes": 48168,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（C5）；1280x720 中心裁切到 3:4→384x512→WebP q82（原位替换）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "illustration/dev-fog-signal",
    "file": "assets/illustrations/cards/dev-fog-signal.webp",
    "kind": "illustration",
    "bytes": 52512,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（C6）；1280x720 中心裁切到 2:3→512x768→WebP q82（原位替换）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "illustration/dev-tide-plenty",
    "file": "assets/illustrations/cards/dev-tide-plenty.webp",
    "kind": "illustration",
    "bytes": 50220,
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
    "bytes": 17234,
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
    "bytes": 17438,
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
    "bytes": 17048,
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
    "bytes": 16612,
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
    "bytes": 26494,
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
    "bytes": 103888,
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
    "bytes": 43147,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T1）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t01-pine/512/normal",
    "file": "assets/textures/pbr/t01-pine/512/normal.ktx2",
    "kind": "texture",
    "bytes": 85610,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T1）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→512²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t01-pine/512/orm",
    "file": "assets/textures/pbr/t01-pine/512/orm.ktx2",
    "kind": "texture",
    "bytes": 23463,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T1）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t01-pine/256/baseColor",
    "file": "assets/textures/pbr/t01-pine/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 15540,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T1）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t01-pine/256/normal",
    "file": "assets/textures/pbr/t01-pine/256/normal.ktx2",
    "kind": "texture",
    "bytes": 25081,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T1）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→256²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t01-pine/256/orm",
    "file": "assets/textures/pbr/t01-pine/256/orm.ktx2",
    "kind": "texture",
    "bytes": 9929,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T1）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t02-clay/512/baseColor",
    "file": "assets/textures/pbr/t02-clay/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 47723,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T4）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t02-clay/512/normal",
    "file": "assets/textures/pbr/t02-clay/512/normal.ktx2",
    "kind": "texture",
    "bytes": 47461,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T4）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→512²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t02-clay/512/orm",
    "file": "assets/textures/pbr/t02-clay/512/orm.ktx2",
    "kind": "texture",
    "bytes": 18941,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T4）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t02-clay/256/baseColor",
    "file": "assets/textures/pbr/t02-clay/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 12417,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T4）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t02-clay/256/normal",
    "file": "assets/textures/pbr/t02-clay/256/normal.ktx2",
    "kind": "texture",
    "bytes": 12242,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T4）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→256²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t02-clay/256/orm",
    "file": "assets/textures/pbr/t02-clay/256/orm.ktx2",
    "kind": "texture",
    "bytes": 7768,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T4）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t03-meadow/512/baseColor",
    "file": "assets/textures/pbr/t03-meadow/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 49359,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T2）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t03-meadow/512/normal",
    "file": "assets/textures/pbr/t03-meadow/512/normal.ktx2",
    "kind": "texture",
    "bytes": 53982,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T2）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→512²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t03-meadow/512/orm",
    "file": "assets/textures/pbr/t03-meadow/512/orm.ktx2",
    "kind": "texture",
    "bytes": 21042,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T2）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t03-meadow/256/baseColor",
    "file": "assets/textures/pbr/t03-meadow/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 13441,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T2）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t03-meadow/256/normal",
    "file": "assets/textures/pbr/t03-meadow/256/normal.ktx2",
    "kind": "texture",
    "bytes": 14495,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T2）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→256²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t03-meadow/256/orm",
    "file": "assets/textures/pbr/t03-meadow/256/orm.ktx2",
    "kind": "texture",
    "bytes": 8439,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T2）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/512/baseColor",
    "file": "assets/textures/pbr/t04-wheat/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 45879,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T3）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/512/normal",
    "file": "assets/textures/pbr/t04-wheat/512/normal.ktx2",
    "kind": "texture",
    "bytes": 78485,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T3）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→512²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/512/orm",
    "file": "assets/textures/pbr/t04-wheat/512/orm.ktx2",
    "kind": "texture",
    "bytes": 27004,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T3）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/256/baseColor",
    "file": "assets/textures/pbr/t04-wheat/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 13510,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T3）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/256/normal",
    "file": "assets/textures/pbr/t04-wheat/256/normal.ktx2",
    "kind": "texture",
    "bytes": 22300,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T3）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→256²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/256/orm",
    "file": "assets/textures/pbr/t04-wheat/256/orm.ktx2",
    "kind": "texture",
    "bytes": 9434,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T3）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t05-reef/512/baseColor",
    "file": "assets/textures/pbr/t05-reef/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 34765,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T5）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t05-reef/512/normal",
    "file": "assets/textures/pbr/t05-reef/512/normal.ktx2",
    "kind": "texture",
    "bytes": 92234,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T5）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→512²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t05-reef/512/orm",
    "file": "assets/textures/pbr/t05-reef/512/orm.ktx2",
    "kind": "texture",
    "bytes": 21012,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T5）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t05-reef/256/baseColor",
    "file": "assets/textures/pbr/t05-reef/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 12000,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T5）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t05-reef/256/normal",
    "file": "assets/textures/pbr/t05-reef/256/normal.ktx2",
    "kind": "texture",
    "bytes": 26546,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T5）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→256²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t05-reef/256/orm",
    "file": "assets/textures/pbr/t05-reef/256/orm.ktx2",
    "kind": "texture",
    "bytes": 8211,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T5）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t06-sand/512/baseColor",
    "file": "assets/textures/pbr/t06-sand/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 44783,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T6）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t06-sand/512/normal",
    "file": "assets/textures/pbr/t06-sand/512/normal.ktx2",
    "kind": "texture",
    "bytes": 36561,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T6）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→512²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t06-sand/512/orm",
    "file": "assets/textures/pbr/t06-sand/512/orm.ktx2",
    "kind": "texture",
    "bytes": 11186,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T6）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t06-sand/256/baseColor",
    "file": "assets/textures/pbr/t06-sand/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 11709,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T6）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t06-sand/256/normal",
    "file": "assets/textures/pbr/t06-sand/256/normal.ktx2",
    "kind": "texture",
    "bytes": 9333,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T6）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→256²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t06-sand/256/orm",
    "file": "assets/textures/pbr/t06-sand/256/orm.ktx2",
    "kind": "texture",
    "bytes": 6827,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T6）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
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
    "bytes": 48202,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T8）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t08-wood/512/normal",
    "file": "assets/textures/pbr/t08-wood/512/normal.ktx2",
    "kind": "texture",
    "bytes": 45894,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T8）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→512²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t08-wood/512/orm",
    "file": "assets/textures/pbr/t08-wood/512/orm.ktx2",
    "kind": "texture",
    "bytes": 10941,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T8）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t08-wood/256/baseColor",
    "file": "assets/textures/pbr/t08-wood/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 12378,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T8）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t08-wood/256/normal",
    "file": "assets/textures/pbr/t08-wood/256/normal.ktx2",
    "kind": "texture",
    "bytes": 12822,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T8）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→256²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t08-wood/256/orm",
    "file": "assets/textures/pbr/t08-wood/256/orm.ktx2",
    "kind": "texture",
    "bytes": 5464,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T8）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
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
    "bytes": 40540,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（N1）；圆盘裁切→圆外以边缘色填充→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t11-parchment/512/normal",
    "file": "assets/textures/pbr/t11-parchment/512/normal.ktx2",
    "kind": "texture",
    "bytes": 53377,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（N1）；由 AI albedo 亮度推导 normal（自有算法）→512²→toktx",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t11-parchment/512/orm",
    "file": "assets/textures/pbr/t11-parchment/512/orm.ktx2",
    "kind": "texture",
    "bytes": 20081,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（N1）；由 AI albedo 亮度推导 orm（自有算法）→512²→toktx",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t11-parchment/256/baseColor",
    "file": "assets/textures/pbr/t11-parchment/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 12040,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（N1）；圆盘裁切→圆外以边缘色填充→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t11-parchment/256/normal",
    "file": "assets/textures/pbr/t11-parchment/256/normal.ktx2",
    "kind": "texture",
    "bytes": 18379,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（N1）；由 AI albedo 亮度推导 normal（自有算法）→256²→toktx",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t11-parchment/256/orm",
    "file": "assets/textures/pbr/t11-parchment/256/orm.ktx2",
    "kind": "texture",
    "bytes": 7661,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（N1）；由 AI albedo 亮度推导 orm（自有算法）→256²→toktx",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
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
  },
{
    "id": "ui/ai-icon-wood-128",
    "file": "assets/ui/ai/icons/wood-128.webp",
    "kind": "ui",
    "bytes": 8966,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S4）；S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→128²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-icon-wood-64",
    "file": "assets/ui/ai/icons/wood-64.webp",
    "kind": "ui",
    "bytes": 3306,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S4）；S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→64²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-icon-brick-128",
    "file": "assets/ui/ai/icons/brick-128.webp",
    "kind": "ui",
    "bytes": 7008,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S4）；S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→128²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-icon-brick-64",
    "file": "assets/ui/ai/icons/brick-64.webp",
    "kind": "ui",
    "bytes": 2764,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S4）；S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→64²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-icon-sheep-128",
    "file": "assets/ui/ai/icons/sheep-128.webp",
    "kind": "ui",
    "bytes": 7966,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S4）；S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→128²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-icon-sheep-64",
    "file": "assets/ui/ai/icons/sheep-64.webp",
    "kind": "ui",
    "bytes": 3216,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S4）；S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→64²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-icon-wheat-128",
    "file": "assets/ui/ai/icons/wheat-128.webp",
    "kind": "ui",
    "bytes": 7760,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S4）；S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→128²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-icon-wheat-64",
    "file": "assets/ui/ai/icons/wheat-64.webp",
    "kind": "ui",
    "bytes": 2944,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S4）；S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→64²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-icon-ore-128",
    "file": "assets/ui/ai/icons/ore-128.webp",
    "kind": "ui",
    "bytes": 7500,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S4）；S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→128²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-icon-ore-64",
    "file": "assets/ui/ai/icons/ore-64.webp",
    "kind": "ui",
    "bytes": 2930,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S4）；S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→64²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-panel-frame",
    "file": "assets/ui/ai/panel-frame.webp",
    "kind": "ui",
    "bytes": 21388,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S3）；S3 左块裁切→重建 9-slice（四角取原角花、四边取素边条、中心纸色；去掉中饰与内部残影）→WebP；切片见 assets/ui/ai/nine-slice.json",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-card-frame",
    "file": "assets/ui/ai/card-frame.webp",
    "kind": "ui",
    "bytes": 58870,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（S3）；S3 右块裁切→羊皮纸底键出 alpha→插画窗不透明→WebP；切片见 assets/ui/ai/nine-slice.json",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-number-token-face-256",
    "file": "assets/ui/ai/number-token-face-256.webp",
    "kind": "ui",
    "bytes": 16800,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（N1）；N1 圆盘检测裁切→圆形 alpha→256²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "ui/ai-number-token-face-128",
    "file": "assets/ui/ai/number-token-face-128.webp",
    "kind": "ui",
    "bytes": 6166,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（N1）；N1 圆盘检测裁切→圆形 alpha→128²→WebP",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  }
]);
