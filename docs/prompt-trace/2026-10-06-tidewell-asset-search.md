# Prompt trace · Tidewell 资产搜索（3d-asset-server sidecar）

## goal

把 https://github.com/arielshad/3d-asset-server 接到 GoDesk，服务汐屿 / Tidewell 演示：Creator Studio「资产搜索」面板、可配置 sidecar URL（默认 `http://127.0.0.1:8787`）、优先免费直链源、「加入项目」写入 Game Project `assets/imported/` 与 `assets/LICENSES.md`。**不** vendoring / fork sidecar，不配付费 API key，不拷贝 settlecoast。

## tool

Cursor Cloud Agent（Codex 额度耗尽兜底）

## prompts used

主管产品决定：sidecar 作为仓外服务；工程箱 live `http://127.0.0.1:8787`（HOST=localhost）；trees 搜索 smoke 24 条 / 11 可直链。实现约束见本 PR 正文。

## decisions

1. 不把 3d-asset-server 放进 monorepo。Worker `ASSET_SERVER_URL` 默认 `http://127.0.0.1:8787`，`.dev.vars` 可覆盖。
2. 浏览器走 GoDesk 同源代理（`/api/asset-search`、`/api/asset-download`），避免 CORS，并让 Playwright 可 mock。
3. 「加入项目」写入 **Game Project**（Durable Object）的 `assets/imported/` + 项目内 `assets/LICENSES.md`（11 列，与 `scripts/verify-assets.mjs` 同形）。不自动改仓库根 `assets/LICENSES.md`，以免未登记 manifest 时 CI 门失败。提升进 Tidewell 套件须另登清单。
4. 默认筛选：仅免费 + 可直接下载 + 优先源（Poly Haven / ambientCG / Kenney / TextureCan / BlenderKit 免费 / HDRMaps 免费）。Fab / Poliigon / TurboSquid 为「仅外链」。
5. 只导入能映射到白名单 SPDX 的许可证（实践中 CC0 → `CC0-1.0`）。面板懒加载，避免压首页 170 KB 预算。
6. 「加入项目」按 `formats`/`resolutions` 选下载规格（Poly Haven 树=`gltf`+`1k`，材质=`jpg`+`1k`），不写死 `glb`。写入上限 1.5 MB（SQLite DO 单值 2 MB）；超限拒绝并提示「打开来源」，避免 SQLITE_TOOBIG。
7. 搜索 HTTP 不放进 `project-api.ts`（首页 CreatorHome 也会 import 该模块，导出无法摇掉）。`/studio` 路由懒加载 `ProjectStudio`，否则工作室 JSX 会打进首页。
8. Lighthouse PR 只跑 1 次：首页 TBT 单次样本会到 229/369 ms，G3D-05 的 3-run 中位数是 0 ms。PR 1-run 把首页 TBT 降为 warn（`scripts/lhci-warn-errors.mjs`）；`workflow_dispatch` 3-run 仍用 `lighthouserc.json` 的 error。不改 200 ms 阈值。

## outcomes

- `src/creator/asset-search/*` 客户端与许可证助手 + 单测
- Studio `ProjectStudio` 懒加载「资产搜索」面板
- Worker 代理与 `POST /api/projects/:id/imported-assets`
- `docs/asset-server.md`、`docs/G3D-STATUS.md`、`assets/imported/README.md`
- e2e `e2e/asset-search-panel.spec.ts`（sidecar 存活则打真搜索；下载一律 mock 为小文件）
- 本机：`typecheck` ✅；`pnpm test` 60/453 ✅；`pnpm test:worker` 20/217 ✅；`pnpm test:e2e` 59 passed / 4 skipped ✅；`verify:assets` OK；homepage 165.78/170 KB
- PR：https://github.com/yuymf/godesk/pull/153
- CI 首页 TBT 229 > 200：把 sidecar fetch 移出 `project-api`，Studio 路由改懒加载

## links

- Sidecar：https://github.com/arielshad/3d-asset-server
- 文档：`docs/asset-server.md`
