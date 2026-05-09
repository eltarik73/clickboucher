#!/bin/bash
#
# SessionStart hook : affiche un rappel des regles SEO 2026 + status CI/GSC.
# Empeche d'oublier le garde-fou en debut de session.
#
# Sortie : un systemMessage JSON visible dans le UI Claude Code.

set -u

# Stats CI dernier run main
CI_STATUS="?"
LATEST_CI=$(curl -s --max-time 3 "https://api.github.com/repos/eltarik73/clickboucher/actions/runs?per_page=1&branch=main" 2>/dev/null)
if [ -n "$LATEST_CI" ]; then
  CI_CONC=$(echo "$LATEST_CI" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['workflow_runs'][0].get('conclusion','?')) " 2>/dev/null)
  if [ "$CI_CONC" = "success" ]; then
    CI_STATUS="OK"
  elif [ "$CI_CONC" = "failure" ]; then
    CI_STATUS="ROUGE"
  else
    CI_STATUS="$CI_CONC"
  fi
fi

# Branche actuelle
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")

# Output JSON pour Claude Code
cat <<EOF
{
  "systemMessage": "🛡️ Klik&Go SEO rules: noindex auto si shopCount=0 | WebSearch AVANT toute action SEO | Hook tsc anti-CI-break ACTIF | CI: $CI_STATUS | Branch: $BRANCH"
}
EOF
