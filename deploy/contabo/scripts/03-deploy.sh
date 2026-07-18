#!/usr/bin/env bash
#
# 03-deploy.sh
#
# Run inside /opt/sarfees/deploy/contabo on the Contabo VPS. Handles:
#   - git pull (pulls latest from origin/main)
#   - `docker compose up -d --build`
#   - Waits for the api container to report healthy
#   - Prints the endpoints so you can sanity-check
#
# Idempotent — safe to re-run on every deploy.
#
set -euo pipefail

CD="$(cd "$(dirname "$0")/.." && pwd)"
cd "$CD"

echo "==> git pull"
git -C ../.. pull --ff-only

if [ ! -f .env ]; then
	echo "!! .env not found. Copy .env.example → .env and fill it in first."
	exit 1
fi

echo "==> docker compose up -d --build"
docker compose up -d --build

echo "==> Waiting for postgres to accept connections"
for i in $(seq 1 30); do
	if docker compose exec -T postgres pg_isready -U "$(grep '^DB_USERNAME' .env | cut -d= -f2)" >/dev/null 2>&1; then
		echo "  postgres ready"
		break
	fi
	sleep 2
done

echo "==> Waiting for api to serve /faq"
API_URL="http://localhost"
for i in $(seq 1 60); do
	if curl -fsS -o /dev/null "$API_URL/faq" 2>/dev/null; then
		echo "  api ready"
		break
	fi
	sleep 2
	if [ "$i" = "60" ]; then
		echo "!! api didn't respond within 2 min. Check logs:"
		echo "   docker compose logs api --tail=100"
		exit 1
	fi
done

echo ""
echo "──────────────────────────────────────────────────"
echo " Deploy live."
echo "   HTTP  http://$(curl -fsS ifconfig.me 2>/dev/null || echo '<your-ip>')"
echo "   Health probe:  curl http://localhost/faq"
echo ""
echo " Next:"
echo "   - If migrating from Render: bash scripts/04-restore-db.sh"
echo "   - Point DNS at this box and update deploy/contabo/Caddyfile"
echo "──────────────────────────────────────────────────"
