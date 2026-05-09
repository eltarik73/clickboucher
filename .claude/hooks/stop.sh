#!/bin/bash
#
# Stop hook : affiche un recap rapide en fin de session/turn.
# Stats GSC + CI status + branche, pour avoir le pulse en un coup d'oeil.

set -u

# Branche
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")

# Commits non pushed
UNPUSHED=$(git log "@{u}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ')
UNPUSHED=${UNPUSHED:-0}

# CI status (cache 60s pour pas spammer GitHub API)
CI_CACHE=/tmp/klikgo-ci-status.txt
if [ -f "$CI_CACHE" ] && [ "$(($(date +%s) - $(stat -f %m "$CI_CACHE" 2>/dev/null || echo 0)))" -lt 60 ]; then
  CI_STATUS=$(cat "$CI_CACHE")
else
  CI_CONC=$(curl -s --max-time 3 "https://api.github.com/repos/eltarik73/clickboucher/actions/runs?per_page=1&branch=main" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['workflow_runs'][0].get('conclusion','?'))" 2>/dev/null)
  case "$CI_CONC" in
    success) CI_STATUS="✅ OK" ;;
    failure) CI_STATUS="❌ ROUGE" ;;
    *) CI_STATUS="$CI_CONC" ;;
  esac
  echo "$CI_STATUS" > "$CI_CACHE" 2>/dev/null
fi

# Output JSON
cat <<EOF
{
  "systemMessage": "📊 Branch: $BRANCH | Unpushed: $UNPUSHED | CI: $CI_STATUS"
}
EOF
