# Project status

> Living handoff document. **Every session updates this before finishing** (see AGENTS.md §3).

**Version:** 0.1.0 (MVP vertical slice) · **Live:** https://ldallacqua.github.io/siren-siege/ · **Last updated:** 2026-09-28

## What works

- Full match loop on _Moonlit Shrine_: 20 waves, win/lose, results screen with Bond XP and unlock notices.
- 4 heroines (Scarlet, Yuki, Kaede, Selene), 3 upgrade paths × 3 tiers, BTD6 crosspath rule, targeting modes, sell 70%.
- Enemies: 5 layered types, armored Iron Husk (immune to physical), Blight Colossus boss with HP bar.
- Controls: speed 1×/2×/3×, auto-start, pause (auto-pauses when the tab is hidden), keyboard shortcuts.
- Bond 1–10 (+2% attack rate/level), 8 chat episodes (2 per heroine, Bond 1 and 3), 20 gallery slots (Bond 2/4/6/8/10).
- Unlocks: Kaede after reaching wave 10, Selene after clearing wave 20.
- Responsive: landscape sidebar, portrait bottom dock with transposed map, short-landscape compact mode. Touch/mouse/keyboard.
- Save in localStorage; `?dev` mode.
- Tooling: unit tests (24), balance bot, real-browser smoke test (3 viewports), Prettier, CI on PRs, auto-deploy to GitHub Pages from `main`.

## Known issues / limitations

- **All art is placeholder** (generated SVG cards; heroines on the map are colored circles with an initial). Real art drops into `public/art/<id>/` — see `docs/ART_DIRECTION.md`.
- **No audio** at all yet.
- Balance only validated by the naive bot (`npm run sim`: loses around wave 19–20). No human playtest data yet.
- Upgrade tiers stop at 3 (BTD6 has 5). No camo/regrow enemies, no hero abilities.
- Only 2 of the planned 5 chats per heroine are written; `speaker: 'you'` lines are supported but unused.
- Fonts come from Google Fonts; offline or blocked networks fall back to Georgia/system fonts (fine, just less pretty).
- Placeholder art text is visible faintly behind shop-card labels (cosmetic; disappears with real art).
- No 18+ age gate yet (required before any public promotion — see BACKLOG B-12).
- Saves are per-browser only; clearing site data wipes progress.
- Phaser bundle is ~1.4 MB (≈360 KB gzip); fine for now.
- **Owner decision pending:** license. `package.json` says `UNLICENSED` while the repo is public (all rights reserved by default).

## Last session

**2026-09-28 — initial build + AI-readiness (Claude, cloud session)**

- Built the MVP from scratch (engine choice, sim, rendering, UI, meta, docs) and deployed it.
- Made the repo agent-ready: AGENTS.md (canonical), CLAUDE/GEMINI/Copilot/Cursor pointers, STATUS/BACKLOG/ARCHITECTURE/DECISIONS docs, Vitest tests, smoke test, Prettier, CI, Claude Code SessionStart hook, devcontainer, PR template, Dependabot.
- Nothing half-done.

## Next up

1. **B-01 real art pass** — owner is generating heroine portraits; wire in chibi map sprites once they exist (B-02).
2. **B-03 juice** — sound effects, music, pop particles, floating gold text.
3. **B-05 tiers 4–5** on every path.
