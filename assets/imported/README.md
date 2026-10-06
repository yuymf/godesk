# 资产导入目录（Game Project）

「资产搜索 → 加入项目」把 3d-asset-server 的直链文件写到**当前 Game Project** 的 `assets/imported/`，并维护项目内 `assets/LICENSES.md`。

本目录不提交二进制。提升进仓库 Tidewell 套件时：

1. 把文件拷到对应 `assets/` 子目录
2. 登记 `src/render3d/assets/manifest.ts` 与 `manifest.data.mjs`
3. 把许可证行并入仓库根 [`assets/LICENSES.md`](../LICENSES.md)
4. 跑 `pnpm verify:assets`

来源：见 [`docs/asset-server.md`](../docs/asset-server.md)。不要 vendoring 3d-asset-server，不要拷贝 settlecoast。
