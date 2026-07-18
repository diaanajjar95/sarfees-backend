#!/usr/bin/env bash
#
# 01-backup-render-db.sh
#
# Dump the current Render Postgres DB to a local file. Run this on your
# workstation (Mac / Linux) BEFORE you touch the Contabo box — the Render
# free-tier DB suspends after inactivity and every day it's suspended
# risks the wake-up failing.
#
# Prerequisites:
#   brew install libpq && brew link --force libpq       # Mac
#   sudo apt install postgresql-client                   # Ubuntu
#
# Usage:
#   bash 01-backup-render-db.sh
#
# Output:
#   ./backups/sarfees-render-YYYYMMDD-HHMMSS.dump    (custom pg_dump format)
#
set -euo pipefail

# ─── Render DB connection ─────────────────────────────────────
# (Grabbed from the sarfees-api service Render dashboard → Environment.)
RENDER_DB_HOST="dpg-d7dckqf7f7vs73errg0g-a.oregon-postgres.render.com"
RENDER_DB_PORT="5432"
RENDER_DB_USER="sarfees_db_user"
RENDER_DB_PASSWORD="OdY46ROXxdqOTKGHyOiQclVL69cmzcrl"
RENDER_DB_NAME="sarfees_db"

TS="$(date -u +%Y%m%d-%H%M%S)"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
OUT_FILE="$OUT_DIR/sarfees-render-$TS.dump"

mkdir -p "$OUT_DIR"

echo "==> Sanity-checking Render DB connectivity"
PGPASSWORD="$RENDER_DB_PASSWORD" psql \
	"host=$RENDER_DB_HOST port=$RENDER_DB_PORT dbname=$RENDER_DB_NAME user=$RENDER_DB_USER sslmode=require" \
	-tAc "SELECT 'drivers=' || COUNT(*)::text FROM drivers"

echo "==> Dumping to $OUT_FILE"
PGPASSWORD="$RENDER_DB_PASSWORD" pg_dump \
	--host="$RENDER_DB_HOST" \
	--port="$RENDER_DB_PORT" \
	--username="$RENDER_DB_USER" \
	--dbname="$RENDER_DB_NAME" \
	--format=custom \
	--no-owner \
	--no-privileges \
	--verbose \
	--file="$OUT_FILE"

echo ""
echo "==> Done. Size:"
ls -lh "$OUT_FILE"
echo ""
echo "Next: scp this dump to the Contabo box, then run 04-restore-db.sh there."
echo "  scp $OUT_FILE root@<contabo-ip>:/opt/sarfees/deploy/contabo/backups/"
