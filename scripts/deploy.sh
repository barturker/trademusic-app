#!/usr/bin/env bash
# Zero-downtime deployment for TradeSync.
#
# Uses docker-rollout for the nextjs service (user-facing).
# Other services restart normally (socket.io auto-reconnects, tusd resumes).
#
# Usage:
#   ./scripts/deploy.sh          # full deploy (build + rollout)
#   ./scripts/deploy.sh --quick  # rollout only (skip build, use cached image)

set -euo pipefail

cd /root/tradesync

echo "=== Pulling latest code ==="
git pull

if [[ "${1:-}" != "--quick" ]]; then
  echo "=== Building images ==="
  docker compose build
fi

echo "=== Rolling out nextjs (zero downtime) ==="
docker rollout nextjs

echo "=== Restarting background services ==="
docker compose up -d --no-deps socket tusd worker

echo "=== Cleaning up old images ==="
docker image prune -af --filter until=24h
docker builder prune -af --filter until=24h

echo "=== Deploy complete ==="
docker compose ps
