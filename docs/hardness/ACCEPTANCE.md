# GoDesk 硬度验收规格（hardness acceptance）

> 验收对象是 **GoDesk 插件管线**（自然语言 → 内核配置 → 呈现 → 迭代），不是潮阵/汐屿样例本身。
> 样例游戏只作输入载体；样例不稳定时改引擎/管线层，禁止给样例打补丁。

## 1. 目的

硬度（hardness）证明：给定一份**完整规则书**或**多轮真实创作者对话**，管线能稳定产出**高质量可玩对局**，且结果可冷启动复现。

证明的能力边界：

| 证明 | 不证明 |
| --- | --- |
| NL 解析能选对内核并写出可执行配置 | 某一题材皮肤「好看」 |
| 规则书中的单位/羁绊/计时/胜负进入 `rule-system` / content | 手写样例内容包本身的完整度 |
| presentationFloor / theme 路径给出可读棋盘与 HUD | 潮阵美术抛光 |
| 同输入在全新 wrangler persist-to 上得到同层结果 | Collecta / 主仓合并 |

大主管判断「通过」时，看的是管线层结果，不是某一个样例项目的观感。

## 2. 输入形态

两种输入等价；优先能一次喂入的 **A**。任一形态跑通且满足第 3 节全部条款即可记「通过」。

### A · 完整规则书

结构化章节，建议文件落在证据目录（仓外），例如  
`/workspace/g3d-evidence/godesk-YYYY-MM-DD/hardness/baseline/RULEBOOK.md`。

必含章节（缺一不可）：

1. **概述**：题材、人数、核心循环一句话。
2. **开局设置**：初始 HP、金币、棋盘规模、备战席。
3. **回合循环**：商店 → 备战/布阵 → 锁定 → 自动战斗 → 结算；各阶段时限。
4. **胜负**：淘汰条件、终局判定。
5. **内容清单**：8–12 个单位（名、费、攻、血、羁绊）；3–4 个羁绊（档位与效果）。
6. **升星规则**：合成条件与属性倍率（若有）。
7. **呈现意图**：主题 cue（如 ember/frost/night）、HUD/品牌称呼期望；规则不得依赖某一已登记 pack 才能成立。

规则书长度约 80–200 行；禁止一句话冒充规则书。题材必须与潮阵默认包、赛博机甲包明显不同（单位名与羁绊名均不得复用潮汐/机甲默认表）。

### B · 8–15 轮 Studio 对话

真实用户口吻。第 1 条 = 从零生成（`/chatgpt-plugin/new`）；后续 = Studio「改下一版并试玩」迭代。须覆盖 A 中全部规则要点（可拆到多轮）。**禁止**复用旧潮阵/赛博项目 id；必须新项目。

## 3. 成功标准（全部成立才算「通过」）

### 3.1 可玩闭环

路径：生成 → Generation Plan 确认 → 共享房间或「和电脑对战」→ **至少完整打完一回合核心机制**（商店购买或电脑买入、布阵、锁定、战斗结算）且进程不崩溃、房间不报 `action_log_invalid`。

### 3.2 规则保真

对规则书（或对话中已确认的规则）做 **claim vs observed** 对照表，写入证据 `THREE_COLUMN.md` 或同目录表格。观察源：

- 只读 API：`GET /api/projects/:id?view=rule-system|generation-plan|jobs`
- 房间 HUD / 商店卡面文案 / 羁绊面板

至少核对：人数、计时、初始 HP/金币、单位名与关键数值、羁绊名与档位、升星开关。声称进入配置却观察为潮汐/赛博默认表 → 本条失败。

### 3.3 美术底线

走现有 `presentationFloor` / theme 路径。棋盘非空白、卡面可读、主题预设或 overrides 生效（或不达标时保持草稿并写明条款）。禁止「无棋盘/无字白屏却标可玩」。

### 3.4 冷启动可复现

同一输入（同一规则书全文或同一组对话原文），在**全新** `wrangler dev --persist-to /tmp/wr-hardness-*` 上再跑一次，下列层结果一致：

- 解析：`requestedMechanics` / proposed kernel type
- 内核配置：`configure_*` 与 `runtimeSupport.executable`
- 内容：content 中单位/羁绊 id 集合（或明确的「回落到某 pack」记录）
- 呈现：theme preset / presentationFloor 结论
- 迭代：同一跟进句的 jobs summary 类别（成功 / guidance / unsupported）

## 4. 失败 → 引擎层对照（禁止样例特例）

层名固定为下列五档。失败时只允许改对应层的**通用**能力；禁止为某一个样例写 if/名字硬编码。

| 失败模式 | 层 | 允许的通用修法种类 |
| --- | --- | --- |
| 未识别为自走棋/错选内核；规则书长文被当成闲聊 | **解析（NL / mechanics infer）** | 扩展 mechanics cue；改进长文分段/条款抽取；Generation Plan 对「未认领条款」如实列出 |
| `configure_*` 未写出；`runtimeSupport.executable=false`；调参越界无回执 | **内核配置（configure_* / kernel bind）** | 契约与 bind；tuning 旋钮登记；可执行闸与可读 unsupported |
| 规则书单位/羁绊未进 content，房间仍是 tide/cyber 默认表；整表无法从 NL 落地 | **内容生成（content / packs / units）** | 通用 content 数据层增删改；pack 登记机制（cue→整表）；长文→content 的通用解析；禁止「只对灰烬/潮阵特判」 |
| 空白棋盘、对比不足、theme cue 无效、presentationFloor 误放行 | **呈现（presentation / theme / assets / VFX）** | theme 预设与 overrides；presentationFloor 条款；资产挂接与兜底；VFX 预设扩展 |
| 跟进句改规则不生效；已是默认却报失败；多条款只吃一部分且不声明 | **迭代（iterate-rule-system / tuning）** | 子句切分与认领；notes/已支持；guidance 通道；未执行条款写入 unsupported |

「无 pack 自动整表」只有在基线明确把**内容生成**标为最卡一层时，才可作为**下一刀候选**写进三栏；本规格不把它默认成必做功能，本刀也不实现它。

## 5. 明确不在范围内

- 抛光潮阵/汐屿/赛博样例皮肤、改样例专用组件文件名「好看」
- 手写只对某一个样例生效的游戏内容或 if 特例
- 触碰 Collecta
- 合并到 `main`
- 使用 Cloud Agent / 付费通道

## 6. 证据布局

| 位置 | 内容 |
| --- | --- |
| `/workspace/g3d-evidence/godesk-YYYY-MM-DD/hardness/...`（**仓外**） | 截图 PNG、`log.jsonl`、`THREE_COLUMN.md`、规则书副本、kernel/rule-system JSON 快照 |
| 仓内 `docs/hardness-acceptance.md` | 本规格（唯一权威） |
| 仓内 `docs/tide-arena-trajectory.md` 指针段 | 一行指向本规格与基线证据路径 |
| 仓内 `docs/prompt-trace/YYYY-MM-DD-hardness-baseline.md` | 基线三栏摘要与证据路径（无二进制） |
| PR `#179` 评论 | 规格 commit、项目 id、最卡一层、证据目录名；**不贴**大图二进制进 git |

驱动方式与潮阵轨迹相同：Playwright 只点真实插件 UI；只读 API 记日志；**禁止** import worker 内部函数。
