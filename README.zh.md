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

环境变量表与架构说明见 [英文 README](README.md)。

## 许可证

源码可见、**保留所有权利** — 见 [`LICENSE`](./LICENSE)。版权 (c) 2026 俞孟凡。这不是 MIT/Apache/GPL 开源项目。
