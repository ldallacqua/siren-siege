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

### D-011 · 2026-09-28 · Optional battlefield art probed with `<img>`, not the Phaser loader

Phaser's loader logs `console.error` for every missing file, and the smoke test (rightly) fails on console errors. Chibi sprites are optional, so `BattleScene` probes them with a plain `Image` after the scene starts (never blocking the battle) and adds successful loads with `textures.addImage`. Missing files only produce the browser's network 404 line, same as the DOM art fallback. Chibi art faces right; the scene mirrors it toward the target.

### D-012 · 2026-09-28 · Prioritize a 19-image MVP art set

The owner reduced the 64-image production brief to the most important assets per heroine: main portrait, battlefield chibi and first gallery unlock, retaining seven completed expressions. Missing moods continue to use the existing portrait fallback; later gallery slots keep placeholders. No unlock thresholds or game data changed. The committed portraits are the visual references for future art; inventory and prompt set live in `docs/ART_ASSETS.md`. Selene uses a covered embroidered ceremonial bodice across her final set, and Yuki uses the ice staff established by her portrait.

### D-013 · 2026-09-29 · Battlefield zoom via our own view transform, not Phaser's camera

Zoom/pan is folded into the existing `sx/sy/toWorld` tile→screen mapping (`src/game/camera.ts`, pure and unit-tested) instead of `cameras.main.setZoom/scroll`. Reasons: the portrait transposition already lives in that mapping, so one transform serves both; text (tower initials) is re-rasterized at the new size rather than blown up blurry; and the smoke test can compute exact tap positions via `siren.scene.pagePoint()`. Zoom range 1×–3×; at 1× the view is exactly the old fitted layout, and the camera is clamped so the map never pans off-screen. Tapping to select now happens on pointer-up so a drag can pan instead; placement input is unchanged.

### D-014 · 2026-09-29 · Synthesized audio; sim emits presentation events

All SFX and music are generated with Web Audio (`src/audio/sound.ts`): zero asset downloads, no licensing, tiny bundle, and instantly tweakable by agents. Recorded CC0 samples can replace individual sounds later without changing callers. Sound and visual feedback are driven by one channel: `BattleSim.fx` events (now also `shot`, `place`, `upgrade`, `sell`, `wave`, `bonus`, `boss`, `bounty`), so key presses, HUD buttons and the bot all produce the same feedback, and the sim stays free of DOM/audio. Sim fx are write-only (determinism unaffected) and capped at 1000 because headless runs never drain them.
