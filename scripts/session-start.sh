#!/usr/bin/env bash
# SessionStart hook (see .claude/settings.json). Runs at the start/resume of every
# Claude Code session. In cloud sessions it installs dependencies; everywhere it
# prints a short orientation that becomes part of the agent's context.
set -u
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  # Reinstall only when node_modules is missing or older than the lockfile.
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    npm ci --no-audit --no-fund --loglevel=error >/tmp/siren-npm-ci.log 2>&1 \
      && echo "[setup] npm ci done" \
      || echo "[setup] npm ci FAILED — see /tmp/siren-npm-ci.log"
  fi
fi

echo "=== Siren Siege — session orientation ==="
echo "Read AGENTS.md (rules), then docs/STATUS.md and docs/BACKLOG.md before working."
echo "Gate: npm run check · UI changes: npm run smoke (screenshots in artifacts/smoke/)."
echo "Finish with the handoff protocol (AGENTS.md §3): update STATUS + BACKLOG, commit, push."
echo
echo "--- git ---"
git log --oneline -5 2>/dev/null
git status --short 2>/dev/null | head -10
echo
if [ -f docs/STATUS.md ]; then
  echo "--- docs/STATUS.md: Next up ---"
  awk '/^## Next up/{f=1;next} /^## /{f=0} f' docs/STATUS.md | sed '/^$/d' | head -8
fi
exit 0
