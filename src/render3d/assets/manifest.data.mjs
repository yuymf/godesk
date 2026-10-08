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
    "bytes": 28679,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/forest-floor.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 forest-floor）；源图 assets/ai-textures/r19/forest-floor.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R20 绘本化（scripts/bake-ai-r20.py：苔绿重着色（HSV 色相映射到 0.20–0.34、饱和 ×0.55、明度 ×0.85，林地不再读成褐色落叶）→中位切分调色板色块化 K=10 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
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
    "bytes": 9264,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/forest-floor.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 forest-floor）；源图 assets/ai-textures/r19/forest-floor.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R20 绘本化（scripts/bake-ai-r20.py：苔绿重着色（HSV 色相映射到 0.20–0.34、饱和 ×0.55、明度 ×0.85，林地不再读成褐色落叶）→中位切分调色板色块化 K=10 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→回卷填充 Lanczos 缩至 256²→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
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
    "bytes": 13407,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/clay.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 clay）；源图 assets/ai-textures/r19/clay.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=9 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
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
    "bytes": 6080,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/clay.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 clay）；源图 assets/ai-textures/r19/clay.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=9 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→回卷填充 Lanczos 缩至 256²→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
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
    "bytes": 18319,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/grass.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 grass）；源图 assets/ai-textures/r19/grass.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=10 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
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
    "bytes": 7318,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/grass.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 grass）；源图 assets/ai-textures/r19/grass.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=10 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→回卷填充 Lanczos 缩至 256²→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
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
    "bytes": 23538,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/wheat-field.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 wheat-field）；源图 assets/ai-textures/r19/wheat-field.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=9 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/512/normal",
    "file": "assets/textures/pbr/t04-wheat/512/normal.ktx2",
    "kind": "texture",
    "bytes": 84163,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T3b）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→512²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/512/orm",
    "file": "assets/textures/pbr/t04-wheat/512/orm.ktx2",
    "kind": "texture",
    "bytes": 23760,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T3b）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/256/baseColor",
    "file": "assets/textures/pbr/t04-wheat/256/baseColor.ktx2",
    "kind": "texture",
    "bytes": 7927,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/wheat-field.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 wheat-field）；源图 assets/ai-textures/r19/wheat-field.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=9 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→回卷填充 Lanczos 缩至 256²→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/256/normal",
    "file": "assets/textures/pbr/t04-wheat/256/normal.ktx2",
    "kind": "texture",
    "bytes": 24380,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T3b）；由无缝 AI albedo 亮度高度场推导 normal（自有算法，非 AI）→256²→toktx UASTC+zstd",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t04-wheat/256/orm",
    "file": "assets/textures/pbr/t04-wheat/256/orm.ktx2",
    "kind": "texture",
    "bytes": 9682,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T3b）；由无缝 AI albedo 亮度高度场推导 orm（自有算法，非 AI）→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t05-reef/512/baseColor",
    "file": "assets/textures/pbr/t05-reef/512/baseColor.ktx2",
    "kind": "texture",
    "bytes": 27847,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/scree.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 scree）；源图 assets/ai-textures/r19/scree.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R21 浅灰岩化（scripts/bake-ai-r20.py light_rock：去饱和 80%、略冷调、gamma 0.62 提亮，灰褐→浅灰岩）→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=9 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
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
    "bytes": 8975,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/scree.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 scree）；源图 assets/ai-textures/r19/scree.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R21 浅灰岩化（scripts/bake-ai-r20.py light_rock：去饱和 80%、略冷调、gamma 0.62 提亮，灰褐→浅灰岩）→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=9 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→回卷填充 Lanczos 缩至 256²→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
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
    "bytes": 15281,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/sand.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 sand）；源图 assets/ai-textures/r19/sand.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=8 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
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
    "bytes": 6555,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/sand.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏 sand）；源图 assets/ai-textures/r19/sand.webp（1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝））→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=8 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，回卷填充保持双向无缝）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→回卷填充 Lanczos 缩至 256²→toktx --encode etc1s --clevel 2 --qlevel 128（scripts/bake-ai-r20.py；R19 版为 scripts/bake-ai-r19.py 直出）；normal / ORM 未重烘焙（沿用 R6 CC0 版）；取代 R7 程序化绘本 albedo",
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
    "bytes": 49898,
    "tier": "high-medium",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T8）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→去饱和 0.25、提亮 1.55（漂流木灰，木色由 token 决定）→512²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t08-wood/512/normal",
    "file": "assets/textures/pbr/t08-wood/512/normal.ktx2",
    "kind": "texture",
    "bytes": 58464,
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
    "bytes": 17968,
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
    "bytes": 12894,
    "tier": "low",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "docs/art/ai-provenance.md",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "AI 生图（T8）；中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化→去饱和 0.25、提亮 1.55（漂流木灰，木色由 token 决定）→256²→toktx ETC1S",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/t08-wood/256/normal",
    "file": "assets/textures/pbr/t08-wood/256/normal.ktx2",
    "kind": "texture",
    "bytes": 16826,
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
    "bytes": 6676,
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
  },
{
    "id": "ui/ai/icons/build-road",
    "file": "assets/ui/ai/icons/build-road-96.webp",
    "kind": "ui",
    "bytes": 1018,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ai/icons/build-road-96.webp",
      "author": "GoDesk Track B（程序化 PIL）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "2h3 几何图标；R8/R9 由 scripts/gen-r8-hud-art.py / gen-r9-hud-art.py 重绘为木砖插画预览（64/96 两档）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-settlement",
    "file": "assets/ui/ai/icons/build-settlement-96.webp",
    "kind": "ui",
    "bytes": 1132,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ai/icons/build-settlement-96.webp",
      "author": "GoDesk Track B（程序化 PIL）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "2h3 几何图标；R8/R9 由 scripts/gen-r8-hud-art.py / gen-r9-hud-art.py 重绘为木砖插画预览（64/96 两档）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-city",
    "file": "assets/ui/ai/icons/build-city-96.webp",
    "kind": "ui",
    "bytes": 1214,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ai/icons/build-city-96.webp",
      "author": "GoDesk Track B（程序化 PIL）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "2h3 几何图标；R8/R9 由 scripts/gen-r8-hud-art.py / gen-r9-hud-art.py 重绘为木砖插画预览（64/96 两档）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-card",
    "file": "assets/ui/ai/icons/build-card-96.webp",
    "kind": "ui",
    "bytes": 1060,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ai/icons/build-card-96.webp",
      "author": "GoDesk Track B（程序化 PIL）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "2h3 几何图标；R8/R9 由 scripts/gen-r8-hud-art.py / gen-r9-hud-art.py 重绘为木砖插画预览（64/96 两档）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-road-128",
    "file": "assets/ui/ai/icons/build-road-128.webp",
    "kind": "ui",
    "bytes": 1306,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ai/icons/build-road-128.webp",
      "author": "GoDesk Track B（程序化 PIL）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "2h4 木框插画；R8/R9 重绘为木砖浮雕（scripts/gen-r9-hud-art.py）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-settlement-128",
    "file": "assets/ui/ai/icons/build-settlement-128.webp",
    "kind": "ui",
    "bytes": 1492,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ai/icons/build-settlement-128.webp",
      "author": "GoDesk Track B（程序化 PIL）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "2h4 木框插画；R8/R9 重绘为木砖浮雕（scripts/gen-r9-hud-art.py）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-city-128",
    "file": "assets/ui/ai/icons/build-city-128.webp",
    "kind": "ui",
    "bytes": 1572,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ai/icons/build-city-128.webp",
      "author": "GoDesk Track B（程序化 PIL）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "2h4 木框插画；R8/R9 重绘为木砖浮雕（scripts/gen-r9-hud-art.py）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-card-128",
    "file": "assets/ui/ai/icons/build-card-128.webp",
    "kind": "ui",
    "bytes": 1326,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ai/icons/build-card-128.webp",
      "author": "GoDesk Track B（程序化 PIL）",
      "obtainedAt": "2026-10-06",
      "modified": true,
      "modificationNote": "2h4 木框插画；R8/R9 重绘为木砖浮雕（scripts/gen-r9-hud-art.py）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-road-wide",
    "file": "assets/ui/ai/icons/build-road-wide.webp",
    "kind": "ui",
    "bytes": 4666,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-r9-hud-art.py",
      "author": "GoDesk Track R9（程序化 PIL）",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "R9 横向木砖建造牌 280×96（栈道 字 + 浮雕图标 + 费用浮雕）；非 settlecoast 复制",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-settlement-wide",
    "file": "assets/ui/ai/icons/build-settlement-wide.webp",
    "kind": "ui",
    "bytes": 4982,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-r9-hud-art.py",
      "author": "GoDesk Track R9（程序化 PIL）",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "R9 横向木砖建造牌 280×96（渔村 字 + 浮雕图标 + 费用浮雕）；非 settlecoast 复制",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-city-wide",
    "file": "assets/ui/ai/icons/build-city-wide.webp",
    "kind": "ui",
    "bytes": 5588,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-r9-hud-art.py",
      "author": "GoDesk Track R9（程序化 PIL）",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "R9 横向木砖建造牌 280×96（港镇 字 + 浮雕图标 + 费用浮雕）；非 settlecoast 复制",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/icons/build-card-wide",
    "file": "assets/ui/ai/icons/build-card-wide.webp",
    "kind": "ui",
    "bytes": 4432,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-r9-hud-art.py",
      "author": "GoDesk Track R9（程序化 PIL）",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "R9 横向木砖建造牌 280×96（买卡 字 + 浮雕图标 + 费用浮雕）；非 settlecoast 复制",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/portrait-0",
    "file": "assets/illustrations/brand/portrait-0.webp",
    "kind": "illustration",
    "bytes": 4500,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/illustrations/brand/portrait-0.webp",
      "author": "GoDesk Track HUD（PIL）",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "round-6 ③ 圆形羊皮纸底 + 席位色兜帽半身像；R8 由 scripts/gen-r8-hud-art.py 重绘为 256×320 半身开拓者（另有 -128 档）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/portrait-1",
    "file": "assets/illustrations/brand/portrait-1.webp",
    "kind": "illustration",
    "bytes": 5414,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/illustrations/brand/portrait-1.webp",
      "author": "GoDesk Track HUD（PIL）",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "round-6 ③ 圆形羊皮纸底 + 席位色兜帽半身像；R8 由 scripts/gen-r8-hud-art.py 重绘为 256×320 半身开拓者（另有 -128 档）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/portrait-2",
    "file": "assets/illustrations/brand/portrait-2.webp",
    "kind": "illustration",
    "bytes": 3616,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/illustrations/brand/portrait-2.webp",
      "author": "GoDesk Track HUD（PIL）",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "round-6 ③ 圆形羊皮纸底 + 席位色兜帽半身像；R8 由 scripts/gen-r8-hud-art.py 重绘为 256×320 半身开拓者（另有 -128 档）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "illustration/portrait-3",
    "file": "assets/illustrations/brand/portrait-3.webp",
    "kind": "illustration",
    "bytes": 4332,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/illustrations/brand/portrait-3.webp",
      "author": "GoDesk Track HUD（PIL）",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "round-6 ③ 圆形羊皮纸底 + 席位色兜帽半身像；R8 由 scripts/gen-r8-hud-art.py 重绘为 256×320 半身开拓者（另有 -128 档）",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/wood-grain",
    "file": "assets/ui/ai/wood-grain.webp",
    "kind": "ui",
    "bytes": 19414,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ai/wood-grain.webp",
      "author": "GoDesk Track B（程序化 PIL）",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "round-3/4 刀序④ 无缝平铺（另有 -256 档）；非 settlecoast 复制",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/ai/parchment-grain",
    "file": "assets/ui/ai/parchment-grain.webp",
    "kind": "ui",
    "bytes": 6170,
    "tier": "all",
    "source": "self-made",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "assets/ui/ai/parchment-grain.webp",
      "author": "GoDesk Track B（程序化 PIL）",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "round-3/4 刀序④ 无缝平铺（另有 -256 档）；非 settlecoast 复制",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/resource-wood-hand",
    "file": "assets/ui/ai/icons/resource-wood-hand.webp",
    "kind": "ui",
    "bytes": 2696,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-r11-resource-hand.py",
      "author": "GoDesk Track R11",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "R11：羊皮底+金框+角饰，复合既有 assets/ui/ai/icons/wood-128.webp（已登记 AI）；无新 AI 生图",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/resource-brick-hand",
    "file": "assets/ui/ai/icons/resource-brick-hand.webp",
    "kind": "ui",
    "bytes": 2420,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-r11-resource-hand.py",
      "author": "GoDesk Track R11",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "R11：羊皮底+金框+角饰，复合既有 assets/ui/ai/icons/brick-128.webp（已登记 AI）；无新 AI 生图",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/resource-sheep-hand",
    "file": "assets/ui/ai/icons/resource-sheep-hand.webp",
    "kind": "ui",
    "bytes": 2680,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-r11-resource-hand.py",
      "author": "GoDesk Track R11",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "R11：羊皮底+金框+角饰，复合既有 assets/ui/ai/icons/sheep-128.webp（已登记 AI）；无新 AI 生图",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/resource-wheat-hand",
    "file": "assets/ui/ai/icons/resource-wheat-hand.webp",
    "kind": "ui",
    "bytes": 2392,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-r11-resource-hand.py",
      "author": "GoDesk Track R11",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "R11：羊皮底+金框+角饰，复合既有 assets/ui/ai/icons/wheat-128.webp（已登记 AI）；无新 AI 生图",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "ui/resource-ore-hand",
    "file": "assets/ui/ai/icons/resource-ore-hand.webp",
    "kind": "ui",
    "bytes": 2420,
    "tier": "all",
    "source": "procedural",
    "license": {
      "spdx": "LicenseRef-GoDesk-Original",
      "sourceUrl": "scripts/gen-r11-resource-hand.py",
      "author": "GoDesk Track R11",
      "obtainedAt": "2026-10-07",
      "modified": true,
      "modificationNote": "R11：羊皮底+金框+角饰，复合既有 assets/ui/ai/icons/ore-128.webp（已登记 AI）；无新 AI 生图",
      "orderRef": "n/a",
      "status": "cleared"
    }
  },
{
    "id": "texture/ai-r19-src/grass",
    "file": "assets/ai-textures/r19/grass.webp",
    "kind": "texture",
    "bytes": 309902,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/grass.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏）；1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝）；仓库源图，不直接进 dist（派生见 scripts/bake-ai-r19.py）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/ai-r19-src/forest-floor",
    "file": "assets/ai-textures/r19/forest-floor.webp",
    "kind": "texture",
    "bytes": 427966,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/forest-floor.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏）；1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝）；仓库源图，不直接进 dist（派生见 scripts/bake-ai-r19.py）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/ai-r19-src/wheat-field",
    "file": "assets/ai-textures/r19/wheat-field.webp",
    "kind": "texture",
    "bytes": 396686,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/wheat-field.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏）；1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝）；仓库源图，不直接进 dist（派生见 scripts/bake-ai-r19.py）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/ai-r19-src/clay",
    "file": "assets/ai-textures/r19/clay.webp",
    "kind": "texture",
    "bytes": 311658,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/clay.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏）；1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝）；仓库源图，不直接进 dist（派生见 scripts/bake-ai-r19.py）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/ai-r19-src/scree",
    "file": "assets/ai-textures/r19/scree.webp",
    "kind": "texture",
    "bytes": 385672,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/scree.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏）；1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝）；仓库源图，不直接进 dist（派生见 scripts/bake-ai-r19.py）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/ai-r19-src/sand",
    "file": "assets/ai-textures/r19/sand.webp",
    "kind": "texture",
    "bytes": 320012,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/sand.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏）；1280×720 生成→中心裁 720²→水平 + 竖直重叠回卷接缝合并（overlap 160px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 512²→无损 WebP（双向无缝）；仓库源图，不直接进 dist（派生见 scripts/bake-ai-r19.py）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/ai-r19-src/cliff-rock",
    "file": "assets/ai-textures/r19/cliff-rock.webp",
    "kind": "texture",
    "bytes": 607932,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/cliff-rock.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏）；1280×720 生成→中心裁 1280×540→水平重叠回卷接缝合并（overlap 200px，低频余弦交叉淡化 + 高频最小误差切缝）→低频亮度拉平→回卷 Lanczos 1024×512→无损 WebP（仅水平平铺）；仓库源图，不直接进 dist（派生见 scripts/bake-ai-r19.py）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/ai-r19-src/harbor-sign",
    "file": "assets/ai-textures/r19/harbor-sign.webp",
    "kind": "texture",
    "bytes": 226118,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "assets/ai-textures/r19/harbor-sign.webp",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏）；1280×720 生成→白底前景阈值取最大连通域→圆拟合重定心裁切→Lanczos 512²（圆盘直径 94%）→1.5px 抗锯齿圆形 alpha→无损 WebP（RGBA）；仓库源图，不直接进 dist（派生见 scripts/bake-ai-r19.py）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/ai-r19/cliff-rock",
    "file": "assets/textures/ai-r19/cliff-rock-512x256.webp",
    "kind": "texture",
    "bytes": 4132,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "scripts/bake-ai-r20.py",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏）派生；源图 assets/ai-textures/r19/cliff-rock.webp→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=10 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，竖直方向镜像、水平回卷）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→Lanczos 512×256→WebP q82；运行时 island.ts 叠回 35% 程序岩层/竖缝（canvas）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  },
{
    "id": "texture/ai-r19/harbor-sign",
    "file": "assets/textures/ai-r19/harbor-sign-256.webp",
    "kind": "texture",
    "bytes": 9174,
    "tier": "all",
    "source": "ai-generated",
    "license": {
      "spdx": "LicenseRef-AI-Generated",
      "sourceUrl": "scripts/bake-ai-r20.py",
      "author": "Grok Bot GenerateImage（AI 生成，俞孟凡 / GoDesk 委托）",
      "obtainedAt": "2026-10-08",
      "modified": true,
      "modificationNote": "AI 生图（R19 虹夏）派生；源图 assets/ai-textures/r19/harbor-sign.webp→R20 绘本化（scripts/bake-ai-r20.py：中位切分调色板色块化 K=12 无抖动→软 Kuwahara r=9 + r=5（逆方差加权，仅 RGB，alpha 原样保留）→35% 拉回色块调色板，与油彩 dab 同一低频画风）→R21 复原外圈木框（源图外圈 ~34 px 按 0.8× 明度回贴 + 5 px 深色描边，Kuwahara 后保留深色外框）→Lanczos 256²→WebP q85 RGBA；运行时 island.ts 在其上绘「2:1/3:1 + 资源字」（canvas）",
      "orderRef": "n/a",
      "status": "cleared",
      "legalReview": "pending-G3D-17"
    }
  }
]);
