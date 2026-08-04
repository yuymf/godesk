# Shareable Prototype 陌生人验收台账

日期：2026-08-04  
范围：Ticket 06；基线 `d38e68f`

## 证据边界

本台账将 HTTP/MCP 自动化契约、实际浏览器观察和真人多人会话分开
记录。自动化中的 `creator-browser` 与 `friend-browser` 是两个独立客户端
标识，不是两名真人，也不构成浏览器 UI 或真人试玩证据。

## 已通过的自动化契约

- **规则书 → 生成 → 可玩 Room（官网后端路径）**：`worker/projects.test.ts`
  的 `turns a rulebook without experience text into a build and authoritative
  room` 从仅有规则书的 `generate-definition` 作业开始，验证 Source Library
  中的 `creator-upload` 规则书、不可变 Build、可见的
  `unsupportedBehavior`，以及返回 `/room/:roomId` 的 `roomUrl`。此路径不
  需要 Web Editor。
- **Visual Floor 与可分享性**：同文件的
  `blocks invitations for a naked build, then admits typographic and kit-backed
  visual floors` 验证纯文本/占位 Build 被拒绝（`422
  visual_floor_unmet`），而排版渲染与 fallback kit 都能通过门闩并创建
  Room。
- **邀请与双客户端可执行子集**：同文件的
  `uses the invitation URL for two clients to claim seats and take authoritative
  turns` 验证单一 `roomUrl`、两个客户端各自入座、禁止冒充他人座位、双方
  轮流提交 intent、Table State 前进，以及 Replay 从 Action Log 重建。
- **资产来源与可见性**：同文件的
  `harvests rulebook art into Source Library and binds it into the playable
  definition` 验证规则书图片以 `creator-upload` 来源进入 Source Library 并
  绑定到桌面；上述 Visual Floor 测试同时验证 `generated` 与 `kit` 来源
  标签。Build 上的 `unsupportedBehavior` 在规则书→Room 测试中保持非空。
- **Plugin/MCP 同项目邀请 URL smoke**：同文件的
  `drives harvested and host-generated assets through MCP to a shareable room`
  通过 MCP 完成规则书图像采集、宿主额度生成资产（`generative-api` /
  `Codex host-user quota`）、绑定、编译与 `create_room`，并验证返回同一
  项目的 `/room/:roomId`。它是独立 smoke，不阻断官网路径。
- **公开默认示例的权利安全**：`worker/projects.test.ts` 的默认示例测试仅
  接受 `harbor-13` 与 `mistpeak-lodge`，拒绝未知模板。两个示例的公开文案
  都标注为 GoDesk 原创，且不含第三方规则、美术、照片或角色；Manila 仅保留
  为内部工程证据，不能作为公开默认内容。

本次本地验证结果：`pnpm test` 通过（7 files / 31 tests），
`pnpm test:worker` 通过（4 files / 47 tests），`pnpm typecheck` 通过。

## 尚未通过或必须由真人补充的证据

- **真人双人试玩门槛：未通过 / 未执行。** 尚无两名真人在两个真实浏览器中
  打开同一邀请 URL、各自认领座位并完成可执行子集回合的会话记录。因此不得
  宣称整体人类试玩验收已通过。
- **官网浏览器观察：未执行。** 自动化证明了官网所调用的后端契约和
  Room-first 目标，但未在本 ticket 中实际操作网页上传/粘贴、复制邀请或观察
  Visual Floor 与来源/不支持行为在 UI 中的呈现。
- **Plugin 安装后真人 smoke：未执行。** MCP 合同测试已覆盖同一 Game
  Project 的邀请 URL；真实 Plugin 安装和宿主额度可用性仍需单独人工验证，
  且不影响官网自动化验收。

## 结论

自动化已证明 Shareable Prototype 的规则书、Visual Floor、邀请、双客户端
可执行子集与 MCP 路径的契约闭环。整体陌生人验收仍保持未完成，直到补齐真实
两人、双浏览器的会话记录；Manila 仍不得作为公开默认示例。
