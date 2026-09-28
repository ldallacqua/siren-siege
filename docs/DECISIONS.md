# Decision log

Short records of non-obvious choices. Add a new entry at the bottom (`D-NNN · date · title`); don't rewrite old ones — supersede them.

### D-001 · 2026-09-28 · Phaser 4 + TypeScript + Vite

Phaser is the most mature 2D web engine with good mobile performance; v4 (current `latest` on npm) has the new WebGL renderer and ships agent-readable docs in `node_modules/phaser/skills/`. Alternatives considered: PixiJS (renderer only, more plumbing), Godot web export (heavy download, weaker mobile web), Unity WebGL (much heavier, poor mobile browser support).

### D-002 · 2026-09-28 · DOM for UI, canvas only for the battlefield

Menus, upgrade panels, chats and galleries are text-heavy and need to reflow for portrait/landscape. HTML/CSS does that for free, is crisper, accessible, and easier for agents to test (Playwright roles). Canvas UI would need a custom layout system.

### D-003 · 2026-09-28 · Framework-free deterministic simulation

`src/game/sim` has no Phaser/DOM and a fixed 60 Hz step. Enables Node unit tests, the headless balance bot, and future features (replays, daily challenges with verifiable scores, server-side validation).

### D-004 · 2026-09-28 · Transpose the map in portrait instead of a separate portrait map

One map definition serves both orientations and survives live rotation. Cost: portrait maps are "mirrored" relative to landscape (path enters from top instead of left) — acceptable.

### D-005 · 2026-09-28 · BTD6 crosspathing, tiers capped at 3 in MVP

Rule implemented generically (`canBuyUpgrade`); raising `MAX_TIER` to 5 plus data is enough to reach parity (BACKLOG B-05).

### D-006 · 2026-09-28 · Bond as the only meta progression, no gacha

Heroines unlock by playing (wave milestones), Bond by fighting and chatting. Keeps the design fair and simple. Bond gives only +2%/level so skill beats grind.

### D-007 · 2026-09-28 · Content ceiling: suggestive, never explicit

Fan service through outfits, poses and flirty writing; adults only with ages in data. Keeps the game hostable (GitHub Pages, itch.io, web portals) and within what mainstream image generators produce. Revisit only with an explicit owner decision and a platform that allows adult content.

### D-008 · 2026-09-28 · Deploy from the `gh-pages` branch

The session's GitHub credentials couldn't enable Pages "GitHub Actions" source via API, and a user push of a `gh-pages` branch auto-enables Pages. CI now publishes to that branch with `peaceiris/actions-gh-pages`. Switching to the artifact-based Pages flow later requires changing Pages source in repo settings first.

### D-009 · 2026-09-28 · AGENTS.md as the single agent instruction file

One canonical file (read natively by Codex, Jules, Cursor, and others); `CLAUDE.md` imports it with `@AGENTS.md`; other tools get one-line pointers. Living state goes in `docs/STATUS.md` and `docs/BACKLOG.md` so any agent can resume without chat history.

### D-010 · 2026-09-28 · Smoke tests use `@sparticuz/chromium` on Linux

Cloud/sandboxed agents usually can't download Playwright browsers, but can install npm packages. The npm-bundled Chromium works there and in GitHub Actions. It runs single-process, so the smoke test launches one browser per viewport.
