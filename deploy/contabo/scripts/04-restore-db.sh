#!/usr/bin/env bash
#
# 04-restore-db.sh
#
# Restore a pg_dump created by 01-backup-render-db.sh into the running
# sarfees-postgres container. Wipes the target DB first, so **the target
# DB should have no data you care about** — that's the migration case.
#
# Usage:
#   bash 04-restore-db.sh                          # picks latest .dump under ./backups/
#   bash 04-restore-db.sh /path/to/specific.dump   # explicit file
#
set -euo pipefail

CD="$(cd "$(dirname "$0")/.." && pwd)"
cd "$CD"

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
	DUMP="$(ls -1t backups/*.dump 2>/dev/null | head -1 || true)"
fi
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
	echo "!! No dump file found."
	echo "   Copy one into $CD/backups/ (e.g. via scp) then re-run."
	exit 1
fi

BASENAME="$(basename "$DUMP")"
echo "==> Using dump: $DUMP"

if ! docker compose ps postgres --status running --quiet | grep -q .; then
	echo "!! postgres container not running. Start it first: docker compose up -d postgres"
	exit 1
fi

DB_USER="$(grep '^DB_USERNAME' .env | cut -d= -f2)"
DB_NAME="$(grep '^DB_NAME'     .env | cut -d= -f2)"

echo "==> Warning — this will DROP and recreate database '$DB_NAME'."
read -p "    Type YES to continue: " CONFIRM
[ "$CONFIRM" = "YES" ] || { echo "aborted"; exit 1; }

echo "==> Dropping + recreating DB"
docker compose exec -T postgres psql -U "$DB_USER" -d postgres <<SQL
DROP DATABASE IF EXISTS "$DB_NAME";
CREATE DATABASE "$DB_NAME" OWNER "$DB_USER";
SQL

echo "==> Restoring $BASENAME"
# --no-owner + --no-privileges: strip Render's role/permission metadata;
# the local $DB_USER owns everything after restore.
docker compose exec -T postgres pg_restore \
	-U "$DB_USER" \
	-d "$DB_NAME" \
	--no-owner \
	--no-privileges \
	--verbose \
	"/backups/$BASENAME"

echo ""
echo "==> Restore complete. Row counts:"
docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
	"SELECT 'drivers=' || (SELECT COUNT(*) FROM drivers) UNION ALL
	 SELECT 'admins=' || (SELECT COUNT(*) FROM admins) UNION ALL
	 SELECT 'trip_requests=' || (SELECT COUNT(*) FROM trip_requests);"

echo ""
echo "==> Recycling api container so any cached prepared statements clear"
docker compose restart api
echo "done"
