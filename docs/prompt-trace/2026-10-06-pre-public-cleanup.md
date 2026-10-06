# 仓库公开前清理（Track A）

## 目标
为 yuymf/godesk 转为 public 做准备：
- 去掉第三方桌游品牌（六角岛桌游品牌名、第三方参考站点、Ticket to Ride、Othello 等用户可见文案）；
- 补 source-available 的 LICENSE；
- 复扫密钥；
- 未来的 commit 身份改为 noreply；
- 设置 fork PR 审批。

不改可见性，不改账单，不合入。

## 工具
手写实现：box 上 Codex 用量已到上限，约 2026-11-05 恢复。另用 Python 脚本批量改名（`/workspace/g3d-evidence/prepublic/rename.py`、`settle.py`），以及 git grep、gitleaks、trufflehog、gh。

## 使用的提示词（来自调度方，2026-10-06 19:29 经大主管批准）
> prepare yuymf/godesk for going PUBLIC … Replace every ‹hex-island brand name› occurrence (English and Chinese) … in user-visible copy, README, docs, ADRs, comments AND code identifiers/file names/test names with neutral names: user-facing → 汐屿 / Tidewell Isles (or "hex-island" where generic), identifiers → `hexIsland`/`hex-island`. Keep persisted data compatible only where a stored id would break live rooms … Add `LICENSE` with an "All rights reserved" source-available notice … Reword ADRs/docs that call ‹third-party reference site› the "presentation bar" … Search for other third-party trademarks in user-visible copy … Do NOT change repo visibility yourself and do NOT change billing … Do NOT merge anything.

## 决定
- **改名规则**（按上下文区分）：
  - kebab 形式 → `hex-island-*`（测试 ID、CSS 类、截图名）；
  - 大写常量前缀 → `HEX_ISLAND_`；
  - PascalCase / camelCase 标识符 → `HexIsland` / `hexIsland`；
  - 错误码 → `hex_island_*`；
  - 英文散文 → hex-island；
  - 中文品牌名 → 汐屿；
  - 文件 `src/runtime/adapters/hex-island{,.test}.ts`、`e2e/nl-hex-island-share.spec.ts` 均由旧品牌名文件改名而来。
- **只保留一个存储 id**：`SessionState` 的棋盘字段改名为 `hexIsland`，但改名前已持久化的 DO 状态（session、replay finalState、项目记录）里仍是旧品牌名键。Kernel 重放总会重建 `hexIsland`。对于不重放、直接返回已存状态的路径（例如入座响应），由 `withHexIslandStateKey`（`LEGACY_HEX_ISLAND_STATE_KEY`）在 `visibleSession` 里映射，并有 `worker/legacy-state-key.test.ts` 覆盖。Kernel 类型 id `hex-settlement-v1` 本来就是中性的，无需改动。D1 没有使用。
- **意图识别**：`inferRequestedMechanics` 不再匹配第三方品牌词（含第三方参考站点名），改为匹配 `汐屿` / `tidewell` / `hex-island` 和原有的「六角 + 资源 / 建造」描述。基线提示词改为「做一款可以与电脑对战的汐屿六角岛资源建造游戏」。
- **第三方参考站点**引用全部移除；ADR 0012 / 0014、风格指南、Skill、PR 模板、THIRD_PARTY_NOTICES 改为「业界 3D 桌游品质对标」或「任何第三方产品」。`HARBOR_PRESENTATION_BAR.visualReference` 改为 `industry-3d-tabletop-quality`。
- **其他商标**：
  - Ticket to Ride（network-route 的 Kernel 说明与注释）改为「最小原创铺线规则」；
  - Othello 的用户可见文案改为 Reversi-style / Disc-flipping，内部标识符 `OthelloBoard` 等保留，作为后续一刀；
  - hidden-role 的角色词正则（werewolf / mafia / 狼人）是通用词，保留。
- **LICENSE**：source-available、保留所有权利（© 2026 俞孟凡 / yuymf），只允许在 GitHub 上查看（以及 GitHub ToS 要求的 fork）；第三方组件保留各自许可。`package.json` 的 `"license"` 设为 `"SEE LICENSE IN LICENSE"`，README 有链接。
- **commit 身份**：在每个 yuymf/godesk 本地克隆的仓库级 config 里设置 `user.email = 60524184+yuymf@users.noreply.github.com`（`/workspace/godesk/.git/config` 覆盖它的全部 worktree）；global 不动；不改写历史。

## 结果
见 PR 描述与证据评论（本地门禁、品牌扫描、密钥扫描计数）。

## 链接
- 分支 `chore/pre-public-cleanup`；证据：`/workspace/g3d-evidence/prepublic/`
