# 02 — 规则书抽图进 Source Library 并绑到桌面

**What to build:** When a rulebook contains usable images, generation harvests
them into the Source Library and binds them onto components/zones so the
playable table shows extracted art instead of text-only cards.

**Blocked by:** None — can start immediately.

**Status:** claimed

- [ ] Rulebook image harvest produces Source Library entries with `kind: "image"` and provenance
- [ ] Harvested images can bind to Definition presentation / components / zones
- [ ] Room or playable preview renders bound extracted art for at least one non-trivial rulebook fixture
- [ ] Missing or unusable pages fail honestly without claiming art that was not extracted
- [ ] Automated tests cover harvest → Source Library → bound presentation at the asset seam
