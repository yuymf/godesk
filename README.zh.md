<div align="center">
  <img src="src/assets/godesk-mark.svg" alt="GoDesk" width="72" height="72">

# GoDesk

**上传规则，得到可玩的游戏。**

[English](README.md) · [中文](#) · [词汇表](docs/GLOSSARY.md) · [设计](DESIGN.md) · [ADR](docs/adr/README.md)
</div>

GoDesk 把剧本、规则书或文字想法变成**可玩、可分享**的规则编排游戏。朋友只需打开邀请链接即可在浏览器里一起玩，不必安装 Codex 或 GoDesk。

```
素材进入  →  可玩成品输出  →  他人能一起玩
```

## 快速开始（Docker）

```bash
git clone https://github.com/yuymf/godesk.git
cd godesk
cp .dev.vars.example .dev.vars
docker compose up --build
```

打开 **http://127.0.0.1:8799**。

> 完整产品依赖 Cloudflare Worker 与 Durable Objects，**没有**诚实的一键 Vercel 部署。本地用 Docker，生产用 Cloudflare。

## 快速开始（pnpm）

需要 **Node.js ≥ 22** 与 pnpm `10.15.1`。

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev:worker
```

## 部署（Cloudflare）

```bash
pnpm deploy
```

部署前写入密钥（勿提交到仓库）：

```bash
wrangler secret put GODESK_SHARE_SECRET
wrangler secret put GODESK_WEB_CLIENT_ID
wrangler secret put GODESK_WEB_CLIENT_SECRET
```

> 本仓库为 public：Cloudflare `account_id` 与 Zero Trust 标识符（Issuer / Audience / AUD）不进 git。
> `wrangler.jsonc` 只保留占位符；生产部署由 GitHub Actions secrets 经 `wrangler deploy --var` 注入，
> 本地开发写在 gitignore 的 `.dev.vars`。详见 [英文 README](README.md) 的 Deploy / Environment 一节。

### 密钥闸门（以及 2026-10 历史定性）

2026-10-28 本公开仓曾把真实 Cloudflare Zero Trust **标识符**写进 `wrangler.jsonc`，
2026-10-29 已挪出 git——但那是事后人肉清理。现在由机制拦：

```bash
pnpm secrets:check          # 拦 staged diff，离线；也可装成 .git/hooks/pre-commit
pnpm secrets:check:all      # 扫「git 会发布的全部文件」，CI 跑这条
pnpm secrets:check:canary   # 自测：规则仍要命中，允许清单仍须窄
pnpm secrets:install-hook   # 新机器上 opt-in 装提交钩子
```

规则在 [`.gitleaks.toml`](.gitleaks.toml)；gitleaks 二进制按 `scripts/gitleaks.lock.json`
校验 SHA256 后缓存到 `~/.cache/godesk-secretscan`，首次之后完全离线。允许清单只豁免
**行形态**（`wrangler types` 生成哈希、JSDoc `@example`、测试里的 `idempotencyKey:`、
文档占位符），不豁免整文件。输出恒为脱敏——公开仓的 CI 日志是公开的。

历史**定性为不清洗**：全量扫描的历史命中全部属于标识符类（Account ID / Access team
域名 / OIDC app UUID / AUD tag），逐行比对真凭据值的结果是 **0 命中**，即没有任何
client secret / share secret / API token 值进过 git，**因此不需要轮换**。而这些标识符
本身在 Zero Trust 面板里就公开展示，team 域名今天仍可从本仓公开的
`scripts/verify-production-smoke.mjs` 里的 workers.dev 主机名拼出——洗历史换不到任何
额外的隐蔽性，只会让所有 clone 失效、fork 与缓存里的旧对象仍在。结论与理由全文见
[英文 README](README.md#secret-gate-and-the-2026-10-history-note)。

环境变量表与架构说明见 [英文 README](README.md)。

## 许可证

源码可见、**保留所有权利** — 见 [`LICENSE`](./LICENSE)。版权 (c) 2026 俞孟凡。这不是 MIT/Apache/GPL 开源项目。
