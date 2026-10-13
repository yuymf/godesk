# Tide Arena / 潮阵 — 用户侧 prompt 迭代轨迹（2026-10-13）

目的：模仿真实创作者，**只用 GoDesk 插件 UI + 自然语言**，看能否迭代出一款自走棋。
驱动方式：Playwright 脚本只点击真实页面（`/chatgpt-plugin/new` → Generation Plan → Studio「下一版想改什么？」→ 共享房间 / 我的游戏「和电脑对战」），
另外只读 `GET /api/projects/:id?view=rule-system|generation-plan` 记录插件实际写入了什么。**没有 import 任何内部函数**。
截图在 `/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/trajectory/`（不进仓），脚本 `/workspace/traj/run.mjs`（不进仓）。

> 重要前提（诚实说明）：`auto-battler-v1` 内核本身（12 单位、4 羁绊含治疗、★2 三合一、备战计时、AI 席位）是分支上**此前手写**的潮阵专属代码。
> 所以第 1 轮一句话就“有了”这些能力——这是**平台预置内容**，不是 prompt 生成的；prompt 只是命中了体裁并选中了这个内核。

## 轮次（第一遍：平台改动前，`trajectory/r*.png`）

| 轮 | prompt 原文 | 插件动作 | 截图 / 结论 | 卡点 |
|---|---|---|---|---|
| 1 | 做一款两人自走棋，商店买棋上阵自动打架 | `inferRequestedMechanics` → `["auto-battler"]`；Generation Plan `configure_auto_battler {playerCount:2}`；确认后 `runtimeSupport.executable`，kernel `auto-battler-v1`；自动开共享房间 | `r01-plan.png` `r01-studio.png` `r01-room-shop.png`：3D 棋盘、商店 5 张、4 羁绊面板、45s 计时、双方 20 HP | Plan 的 unsupported 文案写「★2 unsupported」，与内核实际不符（已修，见下） |
| 2 | 三个相同的棋子自动合成二星，属性变强 | `iterate-rule-system` → `iteration_unsupported`（只支持改写单个行动说明） | `r02-studio.png`：失败提示；房间不变 | 内核已有 ★2，但 Studio 无法确认/配置；**做不到（也无需改）** |
| 3 | 加一个电脑对手，我一个人也能玩 | 同上 `iteration_unsupported` | `r03-studio.png` | 「我的游戏」的「和电脑对战」只对 hex-settlement 显示 → 用户找不到人机入口 |
| 4 | 棋子池扩到12种单位 | 同上 | `r04-studio.png` | 名单写死在内核；**不可配置** |
| 5 | 做4组羁绊，其中一组能给队友治疗 | 同上 | `r05-studio.png` | 羁绊写死在内核；**不可配置** |
| 6 | 每回合备战阶段限时30秒，超时自动开打 | 同上 | `r06-studio.png`；房间仍 45s | 计时写死常量；**平台缺口** |

## 平台通用改动（本刀）

1. **内核调参 + NL 迭代**（`worker/kernel-tuning-iteration.ts`，新）：按内核类型注册「可调数值旋钮」（短语、单位、上下限、如何重建该内核的 `configure_*` op）。
   Studio 迭代先尝试旋钮匹配，再回落到原有行动说明改写。目前 `auto-battler-v1` 注册了 `prepShopSeconds/prepPlaceSeconds/startHp/startGold`；
   注册表是通用结构，其它内核按需加条目。越界值返回可读的 `iteration_unsupported`。
2. **`configure_auto_battler.config.tuning`**（contract / MCP zod / project-operations 校验 / runtime bind / adapter 计时与初始 HP·金币 / session blob 往返 / cloneGenre）。这是体裁级规则参数，不是潮阵内容。
3. **人机入口按能力显示**：`BOT_PLAYABLE_KERNELS` + `computerSeatForRuleSystem`（`src/creator/kernel-capabilities.ts`），「我的游戏」对所有 worker `pickBotIntent` 支持的内核显示「和电脑对战」（原先只认 hex）；
   迭代里说「电脑对手/人机/AI」且内核支持 bot 时，提示去「和电脑对战」，而不是泛泛的“不支持”。
4. Plan unsupported 文案改为与内核一致（★2/12 单位/4 羁绊/计时已支持；★3、自定义名单/羁绊、>2 席、暗商店不支持）。
5. HUD 血条上限读 `arena.tuning.startHp`（否则显示 30/20）。

## 同 prompt 重跑（`trajectory/rerun-after-tuning/`）

| 轮 | 结果 |
|---|---|
| 1–5 | 同第一遍（2/4/5 仍 `iteration_unsupported`） |
| 6 每回合备战阶段限时30秒，超时自动开打 | ✅ kernel `tuning:{prepShopSeconds:30,prepPlaceSeconds:30}`，新房间计时 0:29（`r06-room-shop.png`） |
| 7 初始血量改成30 | ✅ `tuning.startHp:30`，房间 30/30（`r07-room-shop.png`；此轮时 HUD 上限仍为 20，已修） |

## 冷启动（主证据，`trajectory/cold-start/`，全新 wrangler 存储 + 新项目）

同 7 句 prompt 依次输入，然后到「我的游戏」点「和电脑对战」：
- r1 生成并开房 ✅；r2/r4/r5 `iteration_unsupported`；r3 返回「已内置电脑玩家…点『和电脑对战』」；r6 计时 30s ✅；r7 30/30 HP ✅。
- 「我的游戏」出现「和电脑对战」✅（`vs-ai-lobby.png`）→ 人机房间，买 2 棋、准备完毕 ✅（`vs-ai-shop.png` `vs-ai-place.png`），锁定后电脑方完成一回合战斗，我方 30→25（`vs-ai-combat.png` `vs-ai-resolve.png`）。
- 观察到的问题：脚本拖拽在滚动后的视口里没落到棋盘（我方空阵输掉一回合，是驱动脚本问题，不是插件问题）；第 2 回合计时显示 0:00，未排查。

## 仍做不到（用户侧）

- 通过 prompt 改单位池、羁绊（含治疗）、★2/★3 规则：内核写死，Studio 无法改（也无“已支持”的确认回复）。
- 换主题/美术、改棋盘尺寸、>2 人。
- 迭代只接受一次一个改动；混合句子只会命中数值部分。
