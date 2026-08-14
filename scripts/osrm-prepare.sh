#!/usr/bin/env bash
#
# osrm-prepare.sh — one-time OSRM routing graph prep for Jordan.
#
# Downloads the Jordan OSM extract from Geofabrik (~50 MB), then runs
# osrm-extract → osrm-partition → osrm-customize to produce the
# .osrm files that osrm-routed serves. Total wall time: ~5 min on a
# modern laptop. Re-run whenever you want fresher road data (Geofabrik
# updates daily).
#
# Prereqs: docker, ~2 GB free disk under ./osrm-data
#
# Usage:
#   bash scripts/osrm-prepare.sh
#
# After it finishes:
#   docker compose --profile osrm up -d osrm
#   curl 'http://localhost:5000/route/v1/driving/35.9106,31.9539;35.85,32.5556?overview=false'
#
set -euo pipefail

REGION_URL="https://download.geofabrik.de/asia/jordan-latest.osm.pbf"
DATA_DIR="$(pwd)/osrm-data"
OSRM_IMAGE="osrm/osrm-backend:latest"
PBF="jordan-latest.osm.pbf"

mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

echo "==> Fetching latest Jordan OSM extract from Geofabrik"
if [ ! -f "$PBF" ] || [ -n "${FORCE_REDOWNLOAD:-}" ]; then
  curl -fsSL -o "$PBF.tmp" "$REGION_URL"
  mv "$PBF.tmp" "$PBF"
  echo "   downloaded $(du -h "$PBF" | cut -f1)"
else
  echo "   $PBF exists — skip (set FORCE_REDOWNLOAD=1 to refresh)"
fi

echo "==> Pulling OSRM image ($OSRM_IMAGE)"
docker pull "$OSRM_IMAGE"

run_osrm() {
  docker run --rm -v "$DATA_DIR:/data" "$OSRM_IMAGE" "$@"
}

echo "==> Extracting car routing graph (osrm-extract)"
run_osrm osrm-extract -p /opt/car.lua "/data/$PBF"

echo "==> Partitioning (osrm-partition)"
run_osrm osrm-partition "/data/jordan-latest.osrm"

echo "==> Customizing (osrm-customize)"
run_osrm osrm-customize "/data/jordan-latest.osrm"

echo ""
echo "==> Done. Next:"
echo "    docker compose --profile osrm up -d osrm"
echo "    curl 'http://localhost:5000/route/v1/driving/35.9106,31.9539;35.85,32.5556?overview=false'"
echo ""
echo "Add to .env:"
echo "    MAP_PROVIDER=osrm"
echo "    OSRM_BASE_URL=http://localhost:5000"
