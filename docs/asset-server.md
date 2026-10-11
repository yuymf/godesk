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

Studio 路由与搜索 fetch 都是懒加载，不打进首页 `index-*.js`（Lighthouse 首页 TBT ≤ 200 ms）。

## 「加入项目」写什么

可直链且 SPDX 能映射到 `verify:assets` 白名单（当前主要是 `CC0-1.0`）的条目：

1. 文件写入当前 Game Project 的 `assets/imported/<provider>-<id>/`
2. 追加/更新项目内 `assets/LICENSES.md`（11 列，与仓库根 `assets/LICENSES.md` 同形）
3. 来源库多一条 brief，名为 `assets/LICENSES.md`

这些文件活在 Durable Object 里，**不会**自动进 git。提升进 Tidewell 套件时再拷到仓库 `assets/` 并登记 `src/render3d/assets/manifest.ts`，否则 `pnpm verify:assets` 会失败。

「加入项目」按搜索元数据选格式（`gltf` / `glb` / `zip` / `jpg` 等），**不**写死 `format=glb`。材质 / HDRI 优先 `1k`。单文件写入上限 **1.5 MB**（SQLite DO `storage.put` 键+值合计 2 MB）。超过则 413，文案说明改用 1k 或「打开来源」，避免 `SQLITE_TOOBIG`。Worker 代理按 `Content-Length` / 流式读取截断，不把大 zip 缓冲进 DO。

禁止拷贝 settlecoast 的任何代码、模型、音频、插画、文案。

## 工程箱 live 状态（2026-10-07）

- Sidecar：`http://127.0.0.1:8787`（`GET /health` → `{"ok":true}`）
- Worker：`ASSET_SERVER_URL=http://127.0.0.1:8787`，本机 `pnpm`/`wrangler` 在 **8799**
- 实测：`GET /api/asset-search?q=trees` → 24 条；「加入项目」写入 Durable Object `assets/imported/` + 项目内 `assets/LICENSES.md`
- 证据目录（仓外）：`/workspace/g3d-evidence/asset-server/panel-live/`

## 插件一句话拉 CC0 GLB（GoDesk ②，MCP `pull_project_asset`）

插件（MCP）工具 `pull_project_asset { projectId, prompt, idempotencyKey }`：

1. 从一句话里抽搜索词（中文关键词表：桶→barrel、箱→crate、树→tree…；英文取名词）。
2. 调 sidecar `/v1/search?type=model&free=true&downloadable=true`，只取 **CC0-1.0**、可直链、带 `glb`/`gltf` 的模型。
3. 下载（优先 `glb`，否则 `gltf` 1k；Poly Haven 回的是 gltf+bin+贴图 zip），在 Worker 里打包成单个 GLB（`worker/gltf-zip-to-glb.ts`），仍受 1.5 MB 上限。
4. 走 #153 同一条导入路径：写 `assets/imported/<provider>-<id>/<id>.glb` + 项目内 `assets/LICENSES.md` 行。
5. Room（`/room/<id>`）读 `?view=imported-assets`，经 `?view=imported-blob&assetId=` 拉 GLB，在岛边缘摆放渲染（`data-imported-models`）。

限制：分享访客若没有项目读权限，Room 静默不显示导入模型；`/play/<build>` 预览暂不显示；生产环境没有 sidecar 时工具返回「3D 资产服务不可用」。

e2e：`e2e/asset-pull-glb.spec.ts`。工程箱上用真 sidecar（Poly Haven `Barrel_01`）；CI 无 sidecar 时测试自起 mock（:8787，gltf zip）。
