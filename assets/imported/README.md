# 资产导入目录（Game Project）

「资产搜索 → 加入项目」把 3d-asset-server 的直链文件写到**当前 Game Project** 的 `assets/imported/`，并维护项目内 `assets/LICENSES.md`。

本目录不提交二进制。提升进仓库 Tidewell 套件时：

1. 把文件拷到对应 `assets/` 子目录
2. 登记 `src/render3d/assets/manifest.ts` 与 `manifest.data.mjs`
3. 把许可证行并入仓库根 [`assets/LICENSES.md`](../LICENSES.md)
4. 跑 `pnpm verify:assets`

来源：见 [`docs/asset-server.md`](../docs/asset-server.md)。不要 vendoring 3d-asset-server，不要拷贝 settlecoast。

## Judge branch: round-6tex CC0 PBR sources (#148)

Round-6tex downloads via `http://127.0.0.1:8787` (3d-asset-server):

| id | source | license | used as |
|----|--------|---------|---------|
| polyhaven:forrest_ground_01 | https://polyhaven.com/a/forrest_ground_01 | CC0-1.0 | t01-pine |
| polyhaven:wood_planks | https://polyhaven.com/a/wood_planks | CC0-1.0 | t08-wood |
| ambientcg:Ground024 | https://ambientcg.com/a/Ground024 | CC0-1.0 | t03-meadow |
| ambientcg:Rock056 | https://ambientcg.com/a/Rock056 | CC0-1.0 | t05-reef |
| ambientcg:WoodFloor043 | https://ambientcg.com/a/WoodFloor043 | CC0-1.0 | t09-paintwood |
| ambientcg:Ground037 / Ground033 / Ground054 / Rock023 / Fabric045 / Paper001 | ambientcg.com | CC0-1.0 | t02/t04/t06/t07/t10/t11 |

Raw 1K caches live under `/workspace/g3d-evidence/` (not committed). Runtime ships only `assets/textures/pbr/**/*.ktx2`.
Bake: `TOKTX=... python3 scripts/bake-pbr-r6-tex.py`
