# prompt-trace · G3D-19 地形装饰 + 海面噪声

## 2026-10-06 ~05:22 Asia/Shanghai

### tool
- Codex 额度耗尽；无 CloudAgent；Kenney Nature Kit CC0 + `gltf-transform` meshopt + 本机解压的 `toktx`（KTX-Software 4.3 deb → `~/.local/ktx`）。
- 叠在 #108；Actions major_outage。

### decisions
1. `decor.glb` 合并松树×3、灌木×2、岩×3、浮木×2、麦束、砖垛、石块；meshopt 后 ~42KB（≤250KB）。
2. 羊（自制）未单独建模：本刀以灌木覆盖 M-04 灌木项；羊体后续补或 G3D-20 一并。
3. T-12/T-13：程序化 PNG → toktx（UASTC / ETC1S），均达标。

### outcomes
- verify-assets 10 行；本地 typecheck/test 绿。
