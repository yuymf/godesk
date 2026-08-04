# 05 — 资产/生图 Skills（Codex 额度）

**What to build:** Codex/Plugin Skills can harvest rulebook images, request
generative fill-in using the host user's quota when available, bind or replace
assets with provenance, and finish by returning the same project's invitation
URL — without forcing an Editor-first success path.

**Blocked by:** 02 — 规则书抽图进 Source Library 并绑到桌面; 03 — Visual Floor：排版渲染 + 主题 kit + 分享门闩

**Status:** done

- [x] Skills exist for harvest, generative fill-in, and asset bind/replace
- [x] Generative fill-in is documented to use Codex/host user capacity; website subscription metering remains out of scope
- [x] When generative capacity is missing, Skills fall through to the Visual Floor path instead of naked placeholders
- [x] Create/shareable prototype Skill path ends with Room + invitation URL, Editor secondary
- [x] MCP/tool or Skill verification proves asset ops land in Source Library and Build presentation
- [x] Automated tests cover the Plugin/MCP seam for harvest → floor → room invite URL

## Done

- Added asset and shareable-prototype Plugin Skills, including host-quota and
  Visual Floor fallback guidance.
- Extended MCP asset inputs and provenance so harvested and host-generated
  images persist in Source Library and bind into a passing Build presentation.
- Verified the complete MCP harvest → floor → compile → Room invitation path.
