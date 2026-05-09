#!/bin/bash
#
# PreToolUse hook : bloque `git commit` ou `git push` si tsc echoue.
# Evite les commits qui cassent le CI Typecheck (deja arrive 7 fois cumule).
#
# Lit le JSON sur stdin, extrait la commande, et :
# - si elle commence par "git commit" ou "git push" -> run npx tsc --noEmit
# - si tsc echoue -> exit 2 (bloque le tool)
# - sinon -> exit 0 (laisse passer)
#
# Configure dans .claude/settings.local.json (PreToolUse / Bash matcher).

set -u

# Lis le JSON sur stdin
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null)

# Si pas une commande git commit/push, laisse passer
if ! echo "$CMD" | grep -qE '^git (commit|push)'; then
  exit 0
fi

# Trouve la racine du repo (compatible worktrees)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  echo "[pre-git-typecheck] Pas dans un repo git, skip" >&2
  exit 0
fi

cd "$REPO_ROOT" || exit 0

# Skip si pas de tsconfig.json (probablement pas un projet TS)
if [ ! -f "tsconfig.json" ]; then
  exit 0
fi

# Run tsc (timeout gere par le hook config Claude, pas besoin de gtimeout/timeout)
echo "[pre-git-typecheck] Running npx tsc --noEmit before: $CMD" >&2
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?

if [ "$TSC_EXIT" -eq 0 ]; then
  echo "[pre-git-typecheck] OK - TypeScript check passed" >&2
  exit 0
fi

# Echec : print errors + bloquer
echo "" >&2
echo "[pre-git-typecheck] BLOCKED - TypeScript errors detected:" >&2
echo "$TSC_OUTPUT" | head -30 >&2
echo "" >&2
echo "Fix the errors above before committing/pushing (CI will fail otherwise)." >&2
exit 2
