# Verify the current ChatCut and Codex platform contract

Type: research
Status: resolved
Blocked by:

## Question

Which current, first-party Codex Plugin, remote MCP, OAuth, MCP App, editor
handoff, tool-result, and installation constraints must the Godesk refactor
honor, and which observed ChatCut behaviors are product choices rather than
host requirements?

## Answer

[ChatCut and Codex platform contract](../research/chatcut-codex-platform-contract.md)
separates the required plugin/MCP/OAuth/tool-result contract from ChatCut's
product choices. Godesk should adopt ChatCut's thin plugin, authoritative
backend, exact editor handoff, refresh-before-edit, editable-project checkpoint,
dual structural/visual verification, and durable-job patterns. MCP Apps remain
optional progressive enhancement, and private installation must be verified per
host/version because this machine's `codex-cli 0.34.0` does not expose the
plugin-management commands described by the current manual.
