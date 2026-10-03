# Design

<!-- impeccable:design-schema 1 -->

## Reference and subject

[Bookmark.gallery](https://bookmark.gallery/) is the visual reference: a quiet
monochrome frame, compact sans-serif headlines, generous breathing room, pill
actions, and a gallery whose content supplies the color. GoDesk is a place to
make a finished game and invite friends to play. Its game surfaces, rather than
stock imagery or feature tiles, are the expressive part of the interface.

Use a light monochrome frame throughout Web Studio, the game gallery, install
guide, and Shared Session chrome. Game colors retain their meaning: resources,
players, legal moves, and original game artwork may use color.

## Tokens

| Role | Value | Use |
| --- | --- | --- |
| Canvas / paper | `#ffffff` | Page and primary working surface |
| Ink / action | `#171717` | Text and primary buttons |
| Muted | `#666666` | Supporting prose |
| Raised surface | `#f5f5f5` | Inputs, secondary surfaces, selected chips |
| Line | `#e5e5e5` | Boundaries that explain grouping |
| Board surround | `#ededed` | Quiet frame around game content |

Use the accent tokens for interface actions; use game-specific colors for game
objects. No green brand tint, gradients, accent rails, or floating card shadows.
Corners: 8px controls, 16px game artwork, 24px composer, full-round primary
actions. Space: 4 / 8 / 12 / 16 / 24 / 40 / 64 / 96px.

## Brand mark

The GoDesk mark is two tilted black game cards with white pips on a white badge.
Keep its geometry and colors identical in Web Studio, Shared Sessions, Replays,
loading states, the install guide, browser favicon, README, and Codex Plugin.
The white badge preserves its contrast in dark browser and Plugin chrome.

`src/assets/godesk-mark.svg` is the source artwork. Web components and the
favicon load that asset directly; the repository README references it too.
The distributable Plugin contains an identical copy at
`plugins/godesk/assets/godesk-mark.svg`. After editing the source, copy it there
with `cp src/assets/godesk-mark.svg plugins/godesk/assets/godesk-mark.svg`.
`pnpm verify:plugin` rejects a mismatched copy. Do not restore the old G glyph
or GD text placeholders.

## Type

Manrope is self-hosted for the Latin wordmark, numbers, and Latin UI. PingFang SC,
Hiragino Sans GB, and Noto Sans SC provide CJK text. One sans-serif voice with
weights 400 / 500 / 600 / 700; no serif display, uppercase eyebrows, or monospace
metadata on the primary path. Titles use compact tracking; body copy has 1.65
line height. Supporting copy stays below 65 characters per line.

## Layout

Home centers a two-line outcome headline and a compact composer below a bounded
pill navigation bar. Everything inside the composer is left aligned. The native
textarea starts at three rows and can be resized vertically. Upload controls sit
side by side, including on mobile, and their help and selected-file details can
grow naturally. Three original playable examples sit in an open gallery below
it. Recent Game Projects follow as simple links. Navigation stays visible in two
rows on mobile; no collapsed menu is required.

```text
          [ GoDesk  创作台  我的游戏  设置  在 Codex 中使用 ]

                      把想法变成游戏，
                      邀请朋友一起玩。
                      Write / upload / generate
                    [    Compact composer    ]

先玩一局现成的
[ Harbor illustration ] [ Role cards ] [ Conversation ]
Title / people / time   Title / ...    Title / ...
Start a real session    Start ...      Start ...

继续创作                                      查看全部游戏
Project name                           Open Game Project
```

The game gallery uses three columns at wide sizes, two at tablet sizes, and one
on mobile. A sparse gallery keeps thumbnail widths bounded. Web Studio continues
to show the pending plan first, then joinable play after a Playable Build exists.
Shared Session controls use the same neutral frame around the actual game.

## Review against the brief

Removed the earlier Sunday-table green palette, fixed home sidebar, dealt-card
animations, glossy CTA sheen, and repeated raised containers. A decorative
marketing hero would delay creation, so the composer is the first interaction.
The gallery shows original executable examples, with buttons that open a real
Shared Session. Do not copy the reference's flower mark or its artwork.

## Interaction

Motion only answers a person's action: hover color, focus, selection, and
submission progress. Keep visible keyboard focus, 44px primary touch targets,
reduced-motion support, and legible empty/error states. Sharing is gated by the
Playability Floor; visual polish never substitutes for gameplay verification.
