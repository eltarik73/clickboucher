#!/bin/bash
#
# Status line custom : affichage temps reel sous le prompt Claude.
#
# Format : [branch] [unpushed] [CI] [GSC] [TS]
# Mise a jour : toutes les 30s + sur events Claude Code (settings.refreshInterval)

set -u

# Branche actuelle (court)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | sed 's|claude/|c/|' || echo "?")

# Commits non pushed
UNPUSHED=$(git log "@{u}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ')
UNPUSHED=${UNPUSHED:-0}
if [ "$UNPUSHED" = "0" ]; then
  PUSH_TXT=""
else
  PUSH_TXT=" ⬆${UNPUSHED}"
fi

# Working tree dirty ?
DIRTY=""
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  DIRTY=" ●"
fi

# CI status (cache 60s)
CI_CACHE=/tmp/klikgo-ci-status.txt
if [ -f "$CI_CACHE" ] && [ "$(($(date +%s) - $(stat -f %m "$CI_CACHE" 2>/dev/null || echo 0)))" -lt 60 ]; then
  CI_STATUS=$(cat "$CI_CACHE")
else
  CI_CONC=$(curl -s --max-time 2 "https://api.github.com/repos/eltarik73/clickboucher/actions/runs?per_page=1&branch=main" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['workflow_runs'][0].get('conclusion','?'))" 2>/dev/null)
  case "$CI_CONC" in
    success) CI_STATUS="✅" ;;
    failure) CI_STATUS="❌" ;;
    *) CI_STATUS="🟡" ;;
  esac
  echo "$CI_STATUS" > "$CI_CACHE" 2>/dev/null
fi

# Vercel deploy status (cache 120s)
VERCEL_CACHE=/tmp/klikgo-vercel-status.txt
if [ -f "$VERCEL_CACHE" ] && [ "$(($(date +%s) - $(stat -f %m "$VERCEL_CACHE" 2>/dev/null || echo 0)))" -lt 120 ]; then
  VERCEL_STATUS=$(cat "$VERCEL_CACHE")
else
  # Just a placeholder — Vercel API requires auth, skip
  VERCEL_STATUS="?"
  echo "$VERCEL_STATUS" > "$VERCEL_CACHE" 2>/dev/null
fi

# Output 1 ligne
echo "🍖 [${BRANCH}${DIRTY}${PUSH_TXT}] CI:${CI_STATUS}"
