# 3d-asset-server sidecar（Tidewell 资产搜索）

GoDesk **不**把 [arielshad/3d-asset-server](https://github.com/arielshad/3d-asset-server) vendoring 进本仓库。Creator Studio 的「资产搜索」面板通过可配置的 HTTP 基址调用它。

## 默认地址

本机 sidecar 绑在 localhost：

```text
http://127.0.0.1:8787
```

GoDesk Worker 读取 `ASSET_SERVER_URL`（`wrangler.jsonc` vars / `.dev.vars`），缺省即该 URL。工程箱上 HOST 只绑 localhost；不要改成付费云 API，也不要配置 BlenderKit / Fab 等付费 key。

## 启动 sidecar

```bash
git clone https://github.com/arielshad/3d-asset-server.git
cd 3d-asset-server
npm install
npm run build
npm start                    # http://127.0.0.1:8787
```

或 Docker：`docker run -p 8787:8787 3d-asset-server`。

GoDesk 本地：

```bash
pnpm dev:worker              # http://127.0.0.1:8799
# 可选覆盖：
# echo 'ASSET_SERVER_URL=http://127.0.0.1:8787' >> .dev.vars
```

打开任意 Game Project 的 Studio，导航「资产搜索」。默认筛选：仅免费 + 可直接下载 + 优先源（Poly Haven、ambientCG、Kenney、TextureCan、BlenderKit 免费、HDRMaps 免费）。Fab / Poliigon / TurboSquid 显示「仅外链」，不能「加入项目」。

## 「加入项目」写什么

可直链且 SPDX 能映射到 `verify:assets` 白名单（当前主要是 `CC0-1.0`）的条目：

1. 文件写入当前 Game Project 的 `assets/imported/<provider>-<id>/`
2. 追加/更新项目内 `assets/LICENSES.md`（11 列，与仓库根 `assets/LICENSES.md` 同形）
3. 来源库多一条 brief，名为 `assets/LICENSES.md`

这些文件活在 Durable Object 里，**不会**自动进 git。提升进 Tidewell 套件时再拷到仓库 `assets/` 并登记 `src/render3d/assets/manifest.ts`，否则 `pnpm verify:assets` 会失败。

禁止拷贝 settlecoast 的任何代码、模型、音频、插画、文案。

## 工程箱 live 状态（2026-10-07）

- Sidecar：`http://127.0.0.1:8787`（`GET /health` → `{"ok":true}`）
- Worker：`ASSET_SERVER_URL=http://127.0.0.1:8787`，本机 `pnpm`/`wrangler` 在 **8799**
- 实测：`GET /api/asset-search?q=trees` → 24 条；「加入项目」写入 Durable Object `assets/imported/` + 项目内 `assets/LICENSES.md`
- 证据目录（仓外）：`/workspace/g3d-evidence/asset-server/panel-live/`
