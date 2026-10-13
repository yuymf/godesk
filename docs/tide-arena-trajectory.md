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

---

# 第二刀（2026-10-13 12:14 起，先 B 后 A）

## B1 · 第 2 回合计时显示 0:00 —— 根因与修法
- **根因**：`auto-battler-v1` 的备战截止时间 `prepEndsAt` 用墙钟（`autoBattlerNow()`）计算；而共享房间（非 snapshot 内核）每次加载都会用动作日志**重放** `acceptIntent`。重放时墙钟是“现在”，于是截止时间被改写成「加载时刻 + 45s」（探针：`GET /api/sessions/:id` 连续 70 秒返回剩余时间恒为 45.0），状态不确定；推送给客户端的版本和存档重建版本不一致，计时显示会出现 0:00/跳变，超时也永远不会到。
- **修法（通用，适用于任何读墙钟的内核）**：`AcceptedAction.at`（权威接收时间）入日志（slim 存储保留）；`runAtSessionTime(ms, fn)` 把读墙钟的内核钉在指定时间；房间创建时初始状态钉在 `createdAt`；`reconstructActions/replayTail/reconstructReplay` 按每条动作的 `at` 重放。旧日志没有 `at` 时用上一条动作的时间（最早是房间开始时间），不会用“现在”，避免老房间重放时误触超时（这个回退是在冷启动里发现 `action_log_invalid` 后补的）。
- 测试：`worker/session-clock-replay.test.ts`（10 分钟后重放，截止时间不变；旧日志重放不触发超时）。
- 证据：`cold-start-b/` 日志里第 2–4 回合开局计时为 0:21–0:23（30 秒设定），不再是 0:00。

## B2 · 驱动脚本拖拽
- 原因：页面滚动后用旧坐标拖动。修法：每次拖动前把「潮阵对局」区域 `scrollIntoView({block:"start"})`，然后用页面暴露的 `window.__tideArena.screenOf()` 重新取坐标；按 DOM 锚点找到真正有棋子的备战席格子；拖完核对 `data-on-bench` 计数。视口 1440×1100。
- 证据：`cold-start-b` 第 1 回合 3 次拖动全部成功（场上 0→1→2→3），之后被等级 3 的上场人数上限挡住（预期行为）。

## B3 · 人机局打满 3 回合（`cold-start-b/vs-ai-r{1,2,3}-{shop,place,combat,resolve}.png`）
| 回合 | 开局计时 | 我方/电脑 HP（战后） |
|---|---|---|
| 1 | 0:27 | 30 / 26 |
| 2 | 0:21 | 30 / 22 |
| 3 | 0:22 | 30 / 18（进入第 4 回合） |
（买前 3 张能买的卡，布阵，锁定，跳过回放；电脑会自己买、上阵、准备。）

## A · auto-battler 内容数据层（通用）
- `src/runtime/adapters/auto-battler-content.ts`：
  - `UnitDef {id,name,cost,atk,hp,traits[],shape?}`，`shape` 取自 12 个外形预设 `UNIT_SHAPE_PRESETS`；
  - `TraitDef {id,label,glyph,tiers[],atkBonus,hpBonus,effect?:{kind,label,values[]}}`，效果预设有 `shield_start | heal_first_strike | extra_hit | reflect`，数值按档位一一对应；
  - `StarRules {star2,star3,mult2,mult3}`；
  - `resolveAutoBattlerContent(patch)` 做校验，并把 patch 合并到默认值上（每个字段整体替换）。
- 潮阵现有 12 单位、4 羁绊、★2 规则现在是 `DEFAULT_AUTO_BATTLER_CONTENT` 这份**数据**。adapter 不再引用具体的单位或羁绊 id：商店、合成（★2/★3 按开关）、羁绊激活（按档位）、战斗效果（按预设类型）都从当前 content 读取。
- 数据从 `configure_auto_battler.config.content` 读入（契约、MCP zod、project-operations 校验、runtime bind、bot、客户端 HUD 和 3D 外形都接上了）。
- 顺手修的已有缺陷：商店刷新的随机数窗口每次只滑动 1 格，连续两次刷新会重复 4/5 张卡。改成按商店大小步进，并加了单测。

### NL 映射（`worker/kernel-tuning-iteration.ts`，按内核登记）
- 把句子按逗号、分号、「并且」「同时」等切成子句。每个子句依次交给内容解析器（加单位、改羁绊档位、升星开关/倍率）或数值旋钮（计时、初始 HP/金币）认领。加单位会把后面跟着的属性子句（费用、攻击、生命、羁绊、外形）一起吞掉。
- **一句里的多项改动全部合成一个 `configure_auto_battler`**；没被认领的子句不会悄悄丢掉，会写进 `runtimeSupport.unsupported`（「未执行的创作者要求：「…」」）。首次生成时，`generate-rule-system` 也用同一个解析器把可识别的改动折进 Generation Plan，像请求但识别不了的子句也列出来。

## 10 句冷启动逐句结果（`trajectory/cold-start-b/`，新项目；规则读数见 `rule-system-final.json`）
| # | prompt | 结果 |
|---|---|---|
| 1 | 做一款两人自走棋，商店买棋上阵自动打架 | ✅ 生成 + 开房（`r01-*`） |
| 2 | 三个相同的棋子自动合成二星，属性变强 | ✅（确认式）`stars.star2=true` 写入配置；「属性变强」被列为未执行 |
| 3 | 加一个电脑对手，我一个人也能玩 | ↪ 提示去「我的游戏 → 和电脑对战」（入口存在，`vs-ai-lobby.png`） |
| 4 | 棋子池扩到12种单位 | ❌ `iteration_unsupported`（默认已经是 12 个，但这句不会被理解为“确认”） |
| 5 | 做4组羁绊，其中一组能给队友治疗 | ❌ `iteration_unsupported`（同上，默认已有） |
| 6 | 每回合备战阶段限时30秒，超时自动开打 | ✅ tuning 两段各 30s；「超时自动开打」列为未执行 |
| 7 | 初始血量改成30 | ✅ 30/30 |
| 8 | 加一个新单位「雷鳗」，费用3，攻击80，生命600，羁绊远航和潮汐，外形像精灵 | ✅ `units[12]={id:u13,name:雷鳗,cost:3,atk:80,hp:600,traits:[tide,voyager],shape:spirit}`；商店出现雷鳗（`r10-room-new-unit.png`） |
| 9 | 把珊瑚咒羁绊的档位改成2/4，并且初始金币改成12 | ✅ 两项都命中：coral `tiers [2,4]`，HUD「珊瑚咒 2/4」；startGold 12（`vs-ai-r1-shop.png` 金币 12） |
| 10 | 开启三星，三星倍率改成3.5，棋盘改成8列 | ✅ `stars {star3:true, mult3:3.5}`；「棋盘改成8列」列入 unsupported |

## 三栏（截至第二刀）
**用户靠 prompt 做到的**：第 1 句生成可玩游戏；第 2、6–10 句改配置生效；第 3 句会被引导到人机入口。
**靠平台通用改动做到的**：计时确定性重放（B1）、内容数据层 + 多改动 NL 映射 + 如实列出未执行项（A）、内核调参、按能力显示人机入口、商店刷新随机性。
**仍做不到**：
- 第 4、5 句（想要的就是默认内容，但不会被识别为确认）；
- 新的效果类型（只能用 4 种预设）、删改已有单位、自定义外形或美术、棋盘尺寸、>2 人；
- 「超时自动开打」：截止时间只在下一次有人操作或 AI 行动时才强制执行，房间里没人操作时不会自己开打（r05 截图停在 0:00）；
- 「属性变强」这类不带数值的描述。
- 本次冷启动用的 wrangler 本地存储是新的，但第一次尝试时发现旧的 `wrangler.js dev` 进程没被 `pkill "wrangler dev"` 杀掉（进程名不匹配），已改为按进程名杀掉后重跑；现在的 `cold-start-b` 是在单实例、新存储下跑的。

---

## 第三刀（cold-start-c，2026-10-13 12:55–13:03 CST）：服务端定时器 / 已是默认 / 改删单位 / 模糊描述

全新存储（`wrangler dev --persist-to /tmp/wr-coldc-*`），新项目 `project_1a599a28…`，只走插件 UI（Playwright 驱动 `/chatgpt-plugin/new` → Studio「改下一版并试玩」→「我的游戏 · 和电脑对战」）。证据：`/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/trajectory/cold-start-c/`（不进仓）。迭代回执原文取自 `GET /api/projects/:id?view=jobs` 的 `result.iteration.summary`。

### 平台通用改动（本刀）

| 项 | 改了什么 | 为何通用 |
| --- | --- | --- |
| 1 服务端超时定时器 | `worker/runtime.ts` 新增 `sessionDeadline(state, runtime)`（内核声明自己的服务端截止时间，auto-battler 为 shop/place 的 `prepEndsAt`）与 `PREP_TIMEOUT_ACTION`；`acceptIntent` 认 `prep_timeout` 意图——未到期返回 null，到期推进。`worker/creator-projects-do.ts` 每次落动作/建房后把 `room-deadline:<id> {expectedActions, dueAt}` 写入存储并并入 DO alarm；`alarm()` 到点在事务里用 `runAtSessionTime(dueAt)` 提交 `timer_<seq>` 动作（`at = dueAt`），过期/有人动过则重算 | 截止时间由内核钩子给出，DO 只认「deadline」不认潮阵；超时本身是一条带时间戳的普通动作，重放逐条按 `at` 钉钟，结果一致（单测 `session-clock-replay.test.ts`） |
| 2 已是默认 → 「已支持」 | `kernel-tuning-iteration.ts` 新增 `notes`（认领但无改动的子句）与 `defaultsParser`：单位池数量、羁绊组数（含「治疗」查效果预设 `heal_first_strike`）、「超时自动开打」、★2 已开启、「属性变强」（= 当前倍率并举例数值）。回执写「无需改动。已支持：…」 | 判断依据是当前内容数据（数量/效果种类/开关），不是名字 |
| 3 改/删已有单位 | `editUnitParser`：按现有单位名定位，支持改名、费用/攻击/生命（绝对值、±N、±N%）、羁绊、外形，连续属性子句合并；`deleteUnitParser`：可一次删多个；越界（费用 1–5、攻 1–500、血 1–5000、至少 2 个单位、重名）抛可读错误，最终再经 `resolveAutoBattlerContent` 校验 | 面向 content 数据层的增删改，与单位是谁无关 |
| 4 模糊描述换算 | `vagueParser` + `magnitude()`（稍微 10% / 默认 20% / 大幅 40%）：「坦克更肉」= 血/攻比最高的 1/4 单位生命 +20%；「输出更痛」= 攻/血比最高 1/4 攻击 +20%；「节奏快/慢」= 两段计时 ×0.67/×1.5（5 秒取整，夹在上下限），「前期」再加初始金币 ×1.3；「金币多点」；「所有单位更强」。换算出的每个数字写进回执 | 「坦克/输出」按数据比值分组，不依赖具体单位名 |

### 13 句冷启动逐句结果

| # | prompt 原文 | 结果 | 迭代回执 / rule-system 读出 | 截图 |
| --- | --- | --- | --- | --- |
| 1 | 做一款两人自走棋，商店买棋上阵自动打架 | ✅ 生成 | `configure_auto_battler {playerCount:2}` → executable | `r01-plan.png` `r01-studio.png` `r01-room-shop.png` |
| 2 | 三个相同的棋子自动合成二星，属性变强 | ✅ 已支持 | 「无需改动。已支持：三个相同棋子自动合成 ★2（当前已开启，倍率 ×1.8）；已支持：「属性变强」= ★2 属性 ×1.8（例：海风灵 攻 85→153，血 800→1440）」 | `r02-*` |
| 3 | 加一个电脑对手，我一个人也能玩 | ↪ 引导 | 「这款游戏已内置电脑玩家…到「我的游戏」点「和电脑对战」」（界面以「处理失败」样式显示，见仍做不到） | `r03-studio.png` `vs-ai-lobby.png` |
| 4 | 棋子池扩到12种单位 | ✅ 已支持 | 「已支持：当前单位池就是 12 种（礁蟹1费…海风灵5费）」 | `r04-*` |
| 5 | 做4组羁绊，其中一组能给队友治疗 | ✅ 已支持 | 「已支持：当前已有 4 组羁绊（…），其中「珊瑚咒」带治疗效果（珊瑚愈伤：20%/40%）」 | `r05-*` |
| 6 | 每回合备战阶段限时30秒，超时自动开打 | ✅ | tuning `prepShop/Place=30`；「超时自动开打」→ 已支持（服务端定时器） | `r06-room-shop.png` |
| 7 | 初始血量改成30 | ✅ | `startHp 30`，HUD 30/30 | `r07-room-shop.png` |
| 8 | 加一个新单位「雷鳗」，费用3，攻击80，生命600，羁绊远航和潮汐，外形像精灵 | ✅ | `units[]` 新增 雷鳗（3费 攻80 血600 潮汐/远航 spirit），商店可见 | `r08-*` `r12-room-shop.png`（商店出现雷鳗） |
| 9 | 把珊瑚咒羁绊的档位改成2/4，并且初始金币改成12 | ✅ 两项 | coral tiers 2/4（HUD「珊瑚咒 2/4」），金币 12 | `r09-room-shop.png` |
| 10 | 开启三星，三星倍率改成3.5，棋盘改成8列 | ✅ + 如实列出 | `stars {star3:true, mult3:3.5}`；「棋盘改成8列」记入 unsupported | `r10-*` |
| 11 | 把鲸盾改名为巨鲸，费用改成5，攻击提高20，外形改成龟 | ✅ | 「改名 鲸盾→巨鲸，费用 4→5，攻击 55→75，外形 → turtle」；商店卡显示「巨鲸 5」 | `r11-room-shop.png` |
| 12 | 删掉礁蟹 | ✅ | `units` 不再含 crab；回执「删除单位 → 礁蟹（剩 12 种）」（此前 +雷鳗 共 13） | `r12-room-shop.png` |
| 13 | 坦克更肉，前期节奏快点 | ✅ 换算 | 「坦克（血/攻比最高的 1/4）生命 +20%：螺号卫 700→840，珍珠龟 900→1080，巨鲸 1100→1320；节奏加快：商店 30→20 秒，布阵 30→20 秒，初始金币 12→16」 | `r13-room-shop.png`（计时 0:20 起、金币 16） |

### 人机房「我方不碰」5 回合（服务端超时）

`idle-*` 截图 + `idle-log.json` + `idle-session.json`（房间完整动作日志）。脚本打开「和电脑对战」后**只读 HUD、不点任何东西**。动作日志里 10 条全部是服务端 `timer_N / prep_timeout`，`at` 精确间隔 20.000 s（12:59:57.960 → 13:02:57.960 CST），与第 13 句换算出的 20 秒一致；读房间时重放得到相同状态（shop，turn 20）。

| 回合 | 商店 | 布阵 | 战斗 → 下一回合 |
| --- | --- | --- | --- |
| 1 | `idle-r1-商店.png` 0:20 | `idle-r1-布阵.png` 0:20（+20 s） | `idle-r2-战斗.png`（+41 s） |
| 2 | `idle-r2-商店.png` | `idle-r2-布阵.png` | `idle-r3-战斗.png` |
| 3 | `idle-r3-商店.png` | `idle-r3-布阵.png` | `idle-r4-战斗.png` |
| 4 | `idle-r4-商店.png` | `idle-r4-布阵.png` | `idle-r5-战斗.png` |
| 5 | `idle-r5-商店.png` | `idle-r5-布阵.png` | `idle-r6-战斗.png`（第 6 回合开始，停止观察） |

战斗中途截图（另开人机房、我方操作上阵 3 子）：1440 `combat-r1-combat.png`；手机 390 `combat-mobile-390.png`（同一时刻、战斗 0:01，可见伤害/治疗飘字）。

### 三栏（本刀增量）

**用户靠 prompt 就做到的**：第 2/4/5 句现在得到「已支持」+ 现状说明；第 11 句一句改 4 个属性；第 12 句删单位；第 13 句模糊描述换算出具体数字并生效（20 秒计时、金币 16、坦克血量）。

**靠平台通用改动才做到的**：服务端截止定时器（`sessionDeadline` 钩子 + DO `room-deadline:` alarm + 带时间戳的 `prep_timeout` 动作）；`notes`/已支持认领；单位改/删解析与校验；模糊描述幅度换算。均在 `worker/kernel-tuning-iteration.ts` 的通用登记/解析器和 `worker/runtime.ts`、`worker/creator-projects-do.ts` 的通用 deadline 机制里，无潮阵名字特判。新单测：`worker/kernel-content-edits.test.ts`、`session-clock-replay.test.ts`（deadline 一条）。

**仍做不到 / 有缺陷**：
- 人机房我方完全不操作时，电脑也**不会买子**：内核是「座位 0 先行动，再轮到电脑」，超时一次把双方都强制准备完毕，电脑没有轮到行动的窗口 → 5 回合双方空场、血量 30/30 不变。定时器验证了「到点自动开打」，但这不是一局有意义的对局。要修需改为按座位分别计时或超时时先让 AI 座位行动（内核轮次结构的通用改动，本刀未做）。
- 第 3 句的引导文案仍以「处理失败」样式出现（走 `iteration_unsupported` 通道），不是正向回执。
- 模糊描述只覆盖登记过的几类（坦克/输出/全体/节奏/金币）；「更好玩」「平衡一点」这类仍会进不支持清单。「坦克」按血/攻比取前 1/4，不读羁绊语义。
- 单位池数量不能一句话改成任意 N（需逐个加/删）；不能增删羁绊组或新效果种类；棋盘尺寸、主题美术、>2 人仍不支持。
- 历史潮阵特例手写清单同前（`src/render3d/tide-arena/`、`TideArenaBoard.tsx`、默认 12 单位/4 羁绊名字与 shape 预设等），本刀未新增。

---

## 第四刀 + Step7 终评（2026-10-13 14:10–14:20 CST，全新存储 `/tmp/wr-step7e-*`，项目 `project_6a8c4182…`）

### 平台通用改动
| 项 | 改法 | 为何通用 |
| --- | --- | --- |
| 电脑备战钩子 | `worker/runtime.ts` 新增 `sessionBotPhaseStartIntent(state, runtime, aiSeats, loggedIds)`（内核登记：auto-battler 在 shop 阶段每个电脑座位每回合一次，id `botphase_r<回合>_s<座位>`）和 `BOT_PHASE_START_ACTION`；adapter `autoBattlerBotPhaseStart` 让电脑座位**不占回合**用现有 bot 策略买棋 + 上阵（不点准备）。DO 的 `room-deadline` 记录多了 `kind: "bot"`，时间锚定在开启本阶段那条动作的 `at` + 思考时间（不看墙钟），用 `runAtSessionTime(dueAt)` 提交，所以可确定重放；没东西可买时也记一条空动作，保证每回合只触发一次。超时 `prep_timeout` 只负责开打 | 钩子由内核声明，DO 只认“钩子意图 + 截止时间” |
| 定时器可靠性 | ① 任务恢复（job recovery）从 alarm 主路径挪进 `waitUntil` 后台跑，加防重入标记，房间时钟不再被长任务卡住（中断前那次运行里 alarm 晚了约 200 s：bot 钩子落到截止时间之后被丢弃，界面也冻住）；② 没有电脑座位的房间，连续 4 条纯服务端动作后停止计时，有人再操作就重新计时（避免没人的房间一直空转）；③ 晚于 2 s 打 `room_deadline_late` 日志、alarm 里单次处理超过 1 s 打 `*_slow` 日志 | 都是 DO/alarm 的通用机制 |
| 第 3 句中性引导 | 新增 `iteration_guidance` 码；job-runner 把它变成**成功**的 job，`result.guidance` 带提示且不改项目；Studio 显示 `creator-notice`「提示：…」，不报失败；MCP 描述已同步 | 任何“这个功能已经在别处有了”的回答都走这条 |

### Step7：13 句冷启动（回执原文取自 jobs）
1 生成 ✅｜2 已支持（★2 ×1.8，例：海风灵 攻 85→153）｜3 **job 成功**，提示「已内置电脑玩家…和电脑对战」（`r03-studio.png`：顶部条为「应用自然语言迭代 · 已完成」绿色，不再是「失败」）｜4 已支持（12 种）｜5 已支持（4 组，珊瑚咒带治疗）｜6 两段 30 秒 + 已支持自动开打｜7 血量 30｜8 雷鳗 ✅｜9 珊瑚咒 2/4 + 金币 12 ✅｜10 ★3 倍率 3.5 ✅，「棋盘 8 列」列为不支持｜11 巨鲸 5 费 攻 75 外形龟 ✅｜12 删礁蟹 ✅｜13 坦克生命 +20%（巨鲸 1100→1320…）、计时 30→20 秒、金币 12→16 ✅。截图 `step7/r01…r13-*`。

### 不碰操作的人机房（服务端钩子 + 超时）
`step7/idle-*.png`、`idle-log.json`、`idle-session.json`（重载时服务端按动作日志重放出来的状态）。动作日志 = 每回合 `botphase_rN_s1`（回合开始后 0.9 s）+ 两条 `timer_*`（间隔 20.000 s）。我方血量：**30 → 26 → 21 → 15 → 9 → 1 → −7**，第 6 回合终局；重载得到的状态（`hp -7 / 30, ended, round 6`）与页面 HUD 一致。日志里没有出现 `late`/`slow` 告警。

### 整局（Playwright 点真实页面：买卡、拖到棋盘、准备、锁定）
共 6 回合，**电脑胜**：我方 25→20→15→9→2→−5，电脑一直 30/30。第 1 回合合出 ★2，结束时我方有 4 个 ★2。
- 布阵 `compare-place.png`（`vs-ai-r1-place.png`）
- 战斗中途 `compare-combat-mid.png`（`vs-ai-r2-combat.png`）
- ★2 `compare-star2.png`（`star2.png`，参照用 ref-combat）
- 结算 `compare-result.png`（`final-result.png`「对局结束 · 对手获胜」，参照用 ref-place，因为参照稿里没有结算图）
- 手机 390 `compare-mobile-390.png`（`combat-mobile-390.png`，战斗 0:01）
左边参照图取自 `tide-arena/ref/`。

### 三栏结论（终评）
**仅靠 prompt 做到**：从一句话生成可玩的两人自走棋；★2/★3 开关与倍率、计时、血量、金币；加、改、删单位；改羁绊档位；模糊描述换算成具体数字；“已经是默认”的请求得到「已支持」说明；问电脑对手时被中性地指到人机入口。13 句全部生效或被正确引导。

**需改平台（本分支的通用改动）**：内核配置/内容数据层、NL 多项映射与 notes、确定性重放时钟、服务端截止定时器、电脑备战钩子、alarm 可靠性、guidance 通道。

**仍需手写 / 做不到**：
- 对局质量：脚本玩家（只会每回合买 3 张、拖满到 3 个，不升级）6 回合全输，电脑没掉过血。既有 bot 策略 + 不占回合的备战，强度明显压过新手式操作，平衡没调过，也没有难度选项。
- HUD 血量会显示负数（−5/30、−7/30）。
- 回合开始时计时只显示剩 0:04–0:14，因为截止时间从战斗结算那一刻算起，客户端播战斗动画吃掉了几秒。
- 棋盘尺寸、主题美术、>2 人、新效果种类、增删羁绊组仍不支持。
- 第 3 句的提示写在 Studio 的 `creator-notice` 区，截图视口里没拍到提示文本本身（只拍到绿色「已完成」条）。
- 历史潮阵特例手写清单同前，未新增。
