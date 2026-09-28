# CLAUDE.md

All project instructions live in AGENTS.md so every AI tool shares them:

@AGENTS.md

## Claude Code specifics

- Cloud sessions run `scripts/session-start.sh` via the SessionStart hook in `.claude/settings.json`: it installs dependencies (cloud only) and prints the current STATUS summary into your context. You still need to read `docs/STATUS.md` and `docs/BACKLOG.md` in full.
- To see the game, run `npm run smoke` and Read the PNGs in `artifacts/smoke/`.
- End every session with the handoff protocol in AGENTS.md §3 — the owner resumes work from the cloud on his phone and relies on STATUS.md being current.
