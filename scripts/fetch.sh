#!/usr/bin/env bash
# Re-pull raw Valorant data from the HenrikDev unofficial API into data/raw/.
#
# Requires a free "Basic" API key in VAL_API_KEY (see .env.example).
# Loads .env automatically if present.
#
# Usage:
#   ./scripts/fetch.sh                         # uses .env defaults
#   VAL_API_KEY=... ./scripts/fetch.sh NAME TAG REGION PLATFORM
set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env if present (KEY=VALUE lines)
if [ -f .env ]; then set -a; . ./.env; set +a; fi

: "${VAL_API_KEY:?Set VAL_API_KEY — see .env.example}"
NAME="${1:-${RIOT_NAME:-ST1CCS}}"
TAG="${2:-${RIOT_TAG:-STONE}}"
REGION="${3:-${REGION:-na}}"
PLAT="${4:-${PLATFORM:-pc}}"

BASE="https://api.henrikdev.xyz/valorant"
mkdir -p data/raw

get() { # <outfile> <url>
  curl -s -H "Authorization: $VAL_API_KEY" "$2" -o "data/raw/$1" -w "  $1 -> HTTP %{http_code}\n"
}

echo "Fetching $NAME#$TAG ($REGION/$PLAT)..."
get account.json     "$BASE/v2/account/$NAME/$TAG"
get mmr.json         "$BASE/v3/mmr/$REGION/$PLAT/$NAME/$TAG"
get matches.json     "$BASE/v4/matches/$REGION/$PLAT/$NAME/$TAG"
get mmr_history.json "$BASE/v2/mmr-history/$REGION/$PLAT/$NAME/$TAG"
get lifetime.json    "$BASE/v1/lifetime/matches/$REGION/$NAME/$TAG?size=10"

echo "Done. Rebuild the dashboard data with: ./scripts/build-data.sh $NAME"
