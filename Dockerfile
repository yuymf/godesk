# GoDesk — local Worker + Assets + Durable Objects via Wrangler
# Build:  docker compose build
# Run:    docker compose up
# App:    http://127.0.0.1:8799
#
# Production path is Cloudflare Workers (`pnpm deploy` / wrangler), not this
# image. The container runs `wrangler dev --local` so strangers get a full
# local stack without installing Node on the host.

FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Client + Worker assets; wrangler serves dist/ via assets binding
RUN test -f .dev.vars || cp .dev.vars.example .dev.vars \
  && pnpm build

ENV NODE_ENV=development \
    HOST=0.0.0.0

EXPOSE 8799

# --ip 0.0.0.0 so port publish works from outside the container
CMD ["pnpm", "exec", "wrangler", "dev", "--local", "--ip", "0.0.0.0", "--port", "8799"]
