# 第一性需求

GoDesk 的产品宪法。实现、文案、Skills、ADR 不得与此冲突。
体裁细则见 `CONTEXT.md`。分享门槛见 ADR 0012。

1. **成功线**
   `source in → 可玩成品 out → 他人能一起玩`。
   编辑器完整度、Finding 数量、主题 kit 都不是终点。

2. **可玩成品，不是 Demo**
   参与者玩到的必须是来源所要求的那款游戏的核心决策循环，而不是换皮计分器。
   剧本杀要有身份与指控，卡牌要有手牌与出牌，对话游戏要有可记录的发言。
   若做不到，不得把 `score-race-v1` 换皮后当作该游戏分享出去。

3. **权威运行时**
   Accepted Action 只由 Executable Kernel 裁定。
   LLM 可以帮写规则、素材、文案，不能当裁判。

4. **诚实能力**
   不能执行的行为必须可见。
   诚实不等于用另一种更简单的游戏顶替。

5. **分享即产品**
   朋友只拿邀请 URL。
   分享门闩是 Playability Floor，不只是 Presentation Floor。

6. **Play Surface 必须改变交互**
   `cards` / `conversation` / `table` 不能只改 CSS 与文案。

7. **同一 Game Project**
   Web Studio 与 Codex 操作同一 Game Project。

8. **验证看实玩**
   Playwright 必须走完「来源 → 对局中的体裁动作 → 可分享状态」。
   编译成功、bot 空跑、静态截图都不算。
