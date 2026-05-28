#!/usr/bin/env bash
# Re-pull COMPETITIVE Valorant data from the HenrikDev unofficial API into data/raw/.
#
# Requires a free "Basic" API key in VAL_API_KEY (see .env.example).
# Loads .env automatically if present.
#
# Usage:
#   ./scripts/fetch.sh                         # uses .env defaults
#   VAL_API_KEY=... ./scripts/fetch.sh NAME TAG REGION PLATFORM
set -euo pipefail
cd "$(dirname "$0")/.."

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

echo "Fetching COMPETITIVE data for $NAME#$TAG ($REGION/$PLAT)..."
# Account + rank context (rank/seasonal/RR are inherently competitive)
get account.json     "$BASE/v2/account/$NAME/$TAG"
get mmr.json         "$BASE/v3/mmr/$REGION/$PLAT/$NAME/$TAG"
get mmr_history.json "$BASE/v2/mmr-history/$REGION/$PLAT/$NAME/$TAG"
# Competitive match history (summary; the full retained window — ~130+ games)
get stored_competitive.json "$BASE/v1/stored-matches/$REGION/$NAME/$TAG?mode=competitive&size=200"
# 10 most recent competitive matches in FULL detail (per-round + kill feed; for deep dives)
get matches_competitive.json "$BASE/v4/matches/$REGION/$PLAT/$NAME/$TAG?mode=competitive&size=10"

echo "Done. Rebuild the dashboard data with: ./scripts/build-data.sh $NAME"
