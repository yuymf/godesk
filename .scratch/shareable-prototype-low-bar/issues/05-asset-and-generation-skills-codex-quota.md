# 05 — 资产/生图 Skills（Codex 额度）

**What to build:** Codex/Plugin Skills can harvest rulebook images, request
generative fill-in using the host user's quota when available, bind or replace
assets with provenance, and finish by returning the same project's invitation
URL — without forcing an Editor-first success path.

**Blocked by:** 02 — 规则书抽图进 Source Library 并绑到桌面; 03 — Visual Floor：排版渲染 + 主题 kit + 分享门闩

**Status:** ready-for-agent

- [ ] Skills exist for harvest, generative fill-in, and asset bind/replace
- [ ] Generative fill-in is documented to use Codex/host user capacity; website subscription metering remains out of scope
- [ ] When generative capacity is missing, Skills fall through to the Visual Floor path instead of naked placeholders
- [ ] Create/shareable prototype Skill path ends with Room + invitation URL, Editor secondary
- [ ] MCP/tool or Skill verification proves asset ops land in Source Library and Build presentation
- [ ] Automated tests cover the Plugin/MCP seam for harvest → floor → room invite URL
