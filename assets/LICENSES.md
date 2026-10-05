# 资产许可证登记册（assets/LICENSES.md）

本表按 SPEC §5.4：每个资产文件 1 行；sprite 内每条音频片段另占 1 行。
运行时程序化几何不产生文件，不登记。离线脚本生成的文件须登记，来源列填生成脚本路径。

许可证白名单：`CC0-1.0`、`OFL-1.1`、`LicenseRef-GoDesk-Original`、`LicenseRef-Purchased`。

| 资产 id | 文件路径 | 名称 | 来源类型 | 来源 URL | 许可证 SPDX | 作者 | 获取日期 | 是否修改 | 修改说明 | 使用任务 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| font/manrope | src/assets/fonts/manrope-latin-wght-normal.woff2 | Manrope 拉丁可变字体 | OFL | https://fonts.google.com/specimen/Manrope | OFL-1.1 | Mikhail Sharanda / Cyreal | 2026-10-05 | 否 | 无 | G3D-11 |
| ui/godesk-mark | src/assets/godesk-mark.svg | GoDesk 标记 SVG | 自制 | src/assets/godesk-mark.svg | LicenseRef-GoDesk-Original | 俞孟凡 / GoDesk | 2026-10-05 | 否 | 无 | G3D-11 |
| ui/paper-noise | assets/ui/paper-noise.webp | 羊皮纸纹底图 | 程序化 | scripts/gen-paper-noise.py | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | 无 | G3D-23 |
| ui/paper-edge-panel | assets/ui/paper-edge-panel.svg | 面板纸边撕口 mask | 自制 | assets/ui/paper-edge-panel.svg | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | 无 | G3D-23 |
| ui/paper-edge-card | assets/ui/paper-edge-card.svg | 卡片纸边撕口 mask | 自制 | assets/ui/paper-edge-card.svg | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | 无 | G3D-23 |
| ui/ink-icons | assets/ui/ink-icons.svg | 墨线图标 sprite（20） | 自制 | assets/ui/ink-icons.svg | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | 无 | G3D-23 |
| font/fraunces-display | assets/fonts/fraunces-latin-display.woff2 | Fraunces Display 拉丁子集 | OFL | https://github.com/google/fonts/tree/main/ofl/fraunces | OFL-1.1 | Underscore Type / Google Fonts (Fraunces) | 2026-10-06 | 是 | 实例化 Soft=50 opsz=36 wght=600 并 pyftsubset 拉丁子集为 woff2 | G3D-23 |
| audio/sfx-core | assets/audio/sfx-core.mp3 | 核心 SFX sprite（15） | 自制 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 是 | Kenney CC0 + 程序化片段组装 | G3D-26 |
| sfx/hover | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/hover SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/select | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/select SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/illegal | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/illegal SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/place-1 | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/place-1 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/place-2 | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/place-2 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/road-1 | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/road-1 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/road-2 | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/road-2 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/dice-1 | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/dice-1 SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/dice-2 | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/dice-2 SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/dice-3 | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/dice-3 SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/dice-4 | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/dice-4 SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/turn-1 | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/turn-1 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/turn-2 | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/turn-2 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/win | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/win SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/lose | assets/audio/sfx-core.mp3 (sprite fragment) | sfx/lose SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| audio/sfx-extended | assets/audio/sfx-extended.mp3 | 扩展 SFX sprite（15） | 自制 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 是 | Kenney CC0 + 程序化片段组装 | G3D-26 |
| sfx/panel-1 | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/panel-1 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/panel-2 | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/panel-2 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/toggle | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/toggle SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/upgrade | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/upgrade SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/move | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/move SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/steal | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/steal SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/gain-wood | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/gain-wood SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/gain-brick | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/gain-brick SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/gain-sheep | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/gain-sheep SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/gain-wheat | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/gain-wheat SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/gain-ore | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/gain-ore SFX 片段 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg lavfi 合成 | G3D-26 |
| sfx/trade-1 | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/trade-1 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/trade-2 | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/trade-2 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/trade-3 | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/trade-3 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| sfx/trade-4 | assets/audio/sfx-extended.mp3 (sprite fragment) | sfx/trade-4 SFX 片段 | CC0 | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks | CC0-1.0 | Kenney | 2026-10-06 | 是 | 响度归一化并入 sprite | G3D-26 |
| audio/ambience-surf | assets/audio/ambience-surf.mp3 | 海浪环境声 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg pink noise 合成（无 Freesound 登录；STATUS 记 CC0 环境声改程序化） | G3D-26 |
| audio/ambience-harbor-wind | assets/audio/ambience-harbor-wind.mp3 | 港风环境声 | 程序化 | scripts/build-sfx-sprites.mjs | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | ffmpeg brown noise 合成 | G3D-26 |
| music/tide-harbor | assets/audio/music-tide-harbor.mp3 | Tide Harbor | CC0 | https://opengameart.org/content/the-field-of-dreams | CC0-1.0 | pauliuw | 2026-10-06 | 是 | 裁剪/循环至 120s、96kbps mp3、响度归一 | G3D-27 |
| music/crystal-shore | assets/audio/music-crystal-shore.mp3 | Crystal Shore | CC0 | https://opengameart.org/content/crystal-cave-song18 | CC0-1.0 | cynicmusic / pixelsphere.org | 2026-10-06 | 是 | 裁剪/循环至 120s、96kbps mp3、响度归一 | G3D-27 |
| music/observing-star | assets/audio/music-observing-star.mp3 | Observing Star | CC0 | https://opengameart.org/content/another-space-background-track | CC0-1.0 | yd | 2026-10-06 | 是 | 裁剪/循环至 120s、96kbps mp3、响度归一 | G3D-27 |
| illustration/resource-wood | assets/illustrations/cards/resource-wood.webp | 资源卡·松林 | 程序化 | scripts/gen-card-art.py | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | PIL 羊皮纸插画（风格指南调色） | G3D-24 |
| illustration/resource-brick | assets/illustrations/cards/resource-brick.webp | 资源卡·赭土 | 程序化 | scripts/gen-card-art.py | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | PIL 羊皮纸插画（风格指南调色） | G3D-24 |
| illustration/resource-sheep | assets/illustrations/cards/resource-sheep.webp | 资源卡·盐草 | 程序化 | scripts/gen-card-art.py | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | PIL 羊皮纸插画（风格指南调色） | G3D-24 |
| illustration/resource-wheat | assets/illustrations/cards/resource-wheat.webp | 资源卡·麦垄 | 程序化 | scripts/gen-card-art.py | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | PIL 羊皮纸插画（风格指南调色） | G3D-24 |
| illustration/resource-ore | assets/illustrations/cards/resource-ore.webp | 资源卡·礁岩 | 程序化 | scripts/gen-card-art.py | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | PIL 羊皮纸插画（风格指南调色） | G3D-24 |
| illustration/dev-fog-signal | assets/illustrations/cards/dev-fog-signal.webp | 发展卡·雾灯令 | 程序化 | scripts/gen-card-art.py | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | PIL 羊皮纸插画（风格指南调色） | G3D-24 |
| illustration/dev-tide-plenty | assets/illustrations/cards/dev-tide-plenty.webp | 发展卡·潮运 | 程序化 | scripts/gen-card-art.py | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | PIL 羊皮纸插画（风格指南调色） | G3D-24 |
| illustration/dev-harbor-charter | assets/illustrations/cards/dev-harbor-charter.webp | 发展卡·商港特许 | 程序化 | scripts/gen-card-art.py | LicenseRef-GoDesk-Original | GoDesk Track B | 2026-10-06 | 否 | PIL 羊皮纸插画（风格指南调色） | G3D-24 |
