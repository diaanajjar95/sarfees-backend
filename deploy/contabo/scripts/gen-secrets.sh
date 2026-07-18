#!/usr/bin/env bash
#
# gen-secrets.sh
#
# Fill the six JWT_* rows in ./deploy/contabo/.env with fresh random
# secrets. Idempotent — re-running rotates every JWT secret, which
# invalidates every existing driver/admin session (log everyone out).
#
# Usage:
#   bash scripts/gen-secrets.sh
#
set -euo pipefail

CD="$(cd "$(dirname "$0")/.." && pwd)"
ENV="$CD/.env"

if [ ! -f "$ENV" ]; then
	echo "!! $ENV not found. Copy .env.example → .env first."
	exit 1
fi

gen() { openssl rand -base64 48 | tr -d '\n'; }

set_env() {
	local key="$1"
	local val="$2"
	# Escape any special chars in val for sed
	local esc
	esc=$(printf '%s' "$val" | sed 's/[\/&|]/\\&/g')
	# Match "KEY=…" (with or without existing value) and replace the value
	if grep -qE "^$key=" "$ENV"; then
		sed -i.bak "s|^$key=.*|$key=$esc|" "$ENV"
	else
		echo "$key=$val" >> "$ENV"
	fi
}

echo "==> Rotating JWT secrets in $ENV"
set_env JWT_ACCESS_SECRET          "$(gen)"
set_env JWT_REFRESH_SECRET         "$(gen)"
set_env JWT_DRIVER_ACCESS_SECRET   "$(gen)"
set_env JWT_DRIVER_REFRESH_SECRET  "$(gen)"
set_env JWT_ADMIN_ACCESS_SECRET    "$(gen)"
set_env JWT_ADMIN_REFRESH_SECRET   "$(gen)"

rm -f "$ENV.bak"
echo "done. Sanity check (values redacted):"
grep '^JWT_' "$ENV" | sed 's/=.*$/=<64 base64 chars>/'
