# Deployment Guide

TradeMusic runs as 6 services via Docker Compose.

```
caddy    — reverse proxy (ports 80/443)
nextjs   — Next.js web app (internal)
socket   — Socket.io realtime (internal)
tusd     — TUS file upload (internal)
postgres — PostgreSQL (internal)
worker   — pg-boss job processor
```

## Prerequisites

- Docker CE
- [docker-rollout](https://github.com/wowu/docker-rollout) (for zero-downtime deploys)

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/barturker/trademusic-app.git
cd trademusic-app
cp .env.example .env
```

Generate secrets:

```bash
openssl rand -hex 32   # → SECRET_SALT
openssl rand -hex 32   # → ENCRYPTION_KEK
openssl rand -hex 32   # → SOCKET_INTERNAL_SECRET
openssl rand -hex 32   # → POSTGRES_PASSWORD
```

### 2. TLS certificates

Place your TLS certificates at `/etc/caddy/certs/`. Update the `Caddyfile` with your domain and cert filenames.

### 3. Build and start

```bash
docker compose up -d --build
```

### 4. Run migration

```bash
docker compose exec nextjs npx tsx node_modules/drizzle-kit/bin.cjs migrate
```

### 5. Verify

```bash
curl http://localhost:3000/api/health
```

## Zero-Downtime Deploys

Install docker-rollout:

```bash
mkdir -p ~/.docker/cli-plugins
curl https://raw.githubusercontent.com/wowu/docker-rollout/main/docker-rollout -o ~/.docker/cli-plugins/docker-rollout
chmod +x ~/.docker/cli-plugins/docker-rollout
```

Deploy:

```bash
git pull
docker compose build
docker rollout nextjs
docker compose up -d --no-deps socket tusd worker
```

## Local Development

```bash
# 1. Start Postgres and tusd
docker run --rm -d --name ts-postgres -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tradesync \
  postgres:17-alpine

mkdir -p data/uploads data/artifacts

docker run --rm -d --name ts-tusd -p 8080:8080 \
  -v "$(pwd)/data/uploads:/data/uploads" \
  tusproject/tusd:v2 \
  -host=0.0.0.0 -port=8080 -base-path=/uploads/ -upload-dir=/data/uploads \
  -hooks-http=http://host.docker.internal:3000/api/webhooks/tusd \
  -hooks-enabled-events=pre-create,post-finish,post-terminate \
  -max-size=157286400

# 2. Install deps + push DB schema
pnpm install
pnpm db:push

# 3. Start Next.js + Socket.io + Worker
pnpm dev:all
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| caddy | 80/443 | Reverse proxy with TLS |
| nextjs | 3000 (internal) | Web app, API, Server Actions |
| socket | 3001 (internal) | Real-time room updates |
| tusd | 8080 (internal) | Chunked file uploads (TUS protocol) |
| postgres | 5432 (internal) | Database |
| worker | — | Audio analysis, file cleanup |
