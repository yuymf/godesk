# T257 · 油彩面连续性 + 宽帧压印（清 T256 #1–2）

共享层。**PASS** vs tip `H0x-t255` @ `0ee5d23`。

## 改动
- `tokens.ts`：恢复地形 `pbrBaseColor` 油彩 AI 面 + 色度/repeat；水域 shallow/deep 可读
- `number-labels.ts` / `tabletop-objects.ts`：宽帧压印 shadow-highlight 带宽
- `SceneHost.tsx`：`PLAY_SEA_CLEAR` 提亮（cornerCalm）
- `render-spec.ts`：desk/network 共享层 HARD+calm

## 证据
- `…/H0x-t257/` · JPEG 左 T255 / 右 T257 · 守卫全绿
