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
- Battlefield chibi sprites: drop `public/art/<id>/chibi.webp` and towers render it (idle bob, recoil on attack, flips toward the target); falls back to colored discs per heroine when missing.
- **MVP art shipped:** 19 generated WebP assets: portraits, right-facing transparent chibis and First Impression gallery scenes for all four heroines; seven expression variants. See `docs/ART_ASSETS.md` for inventory and prompts.
- Art pipeline for the owner: `docs/ART_GUIDE.md` (ChatGPT workflow, copy-paste prompts per heroine and asset, naming, phone upload); `npm run art` converts PNG/JPG uploads to sized WebP and lists misnamed files; assets live in `public/art/<id>/`.
- **Battlefield zoom (1×–3×):** pinch, mouse wheel, +/−/fit buttons in the map's empty corner, keys `+` `-` `0`; drag to pan when zoomed (clamped so the map never leaves the screen); tap still selects. Resets per battle and on rotation.
- **Juice (B-03):** synthesized Web Audio SFX for pop, shot, bomb, blast, freeze pulse, armor block, place, upgrade (bigger for tier 3), sell, wave start, wave bonus, leak, boss spawn, boss bounty, victory/defeat; generative music loop per map (`src/audio/`). Pop/upgrade particles, floating `+◆` for boss bounty, wave bonus and sell, screen shake on boss spawn/leak. Music/Sound sliders, mute and Reduced motion in Settings and the pause menu (persisted; reduced motion follows the OS by default); `M` mutes. Audio unlocks on the first tap/key.
- Save in localStorage; `?dev` mode.
- Tooling: unit tests (36), balance bot, real-browser smoke test (3 viewports), Prettier, CI on PRs, auto-deploy to GitHub Pages from `main`.

## Known issues / limitations

- **MVP art scope:** remaining mood variants fall back to the main portrait; gallery slots 2–5 still show placeholders. The owner explicitly deferred the full 64-image set. Optional follow-up: B-01.
- Audio is synthesized placeholder quality (no recorded samples); only one music track (Moonlit Shrine). 60 fps with 200 enemies on a mid phone is **not yet measured** (sounds are rate-limited to 24 voices, particles capped at 400).
- Balance only validated by the naive bot (`npm run sim`: loses around wave 19–20). No human playtest data yet.
- Upgrade tiers stop at 3 (BTD6 has 5). No camo/regrow enemies, no hero abilities.
- Only 2 of the planned 5 chats per heroine are written; `speaker: 'you'` lines are supported but unused.
- Fonts come from Google Fonts; offline or blocked networks fall back to Georgia/system fonts (fine, just less pretty).
- No 18+ age gate yet (required before any public promotion — see BACKLOG B-12).
- Saves are per-browser only; clearing site data wipes progress.
- Phaser bundle is ~1.4 MB (≈360 KB gzip); fine for now.
- **Owner decision pending:** license. `package.json` says `UNLICENSED` while the repo is public (all rights reserved by default).

## Last session

**2026-09-29 — art delivered, battlefield zoom, B-03 juice (Claude, cloud session)**

- Owner sent Codex's MVP art pass as a zip + git bundle (Codex couldn't push). Fast-forwarded it onto `main`, reviewed all 19 images (within the content ceiling), re-ran check + smoke, pushed. Details of that pass: `docs/ART_ASSETS.md`, D-012.
- Zoom/pan: pure math in `src/game/camera.ts` (tests in `tests/camera.test.ts`), folded into `BattleScene`'s tile→screen transform (D-013). Input rewritten as a small gesture machine (tap / pan / pinch / done); selection moved to pointer-up. Zoom buttons in `main.ts`, styled in `style.css` (`.zoom-ctl`). Dev hook exposes `siren.scene` (`zoom`, `pagePoint()`).
- Smoke now zooms with the buttons, selects a heroine while zoomed, drag-pans (mouse and touch), and pinches with two real touch points via CDP on the touch viewports; screenshots `*-8-zoomed.png`.
- B-03 juice: sim now emits presentation fx (`shot`, `place`, `upgrade`, `sell`, `wave`, `bonus`, `boss`, `bounty`; capped at 1000 for headless runs, never read back so determinism holds). `BattleScene.onFx()` routes each to `sound.fx()`, visuals, particles, floating text and shake. Audio engine `src/audio/sound.ts`, pure helpers + music patterns `src/audio/tuning.ts` (tested). Settings fields added to the save (merged, so old saves load). Smoke checks the audio unlock, pause-menu controls and that settings persist.
- Nothing half-done.

## Next up

1. **Owner listening pass** on the live site: sound mix, music taste. Tune the volumes and envelopes in `src/audio/sound.ts`.
2. **B-03 perf check**: 200 enemies at 3× on a mid phone (devtools CPU throttle 4×); if it drops, lower the particle count and pop-sound rate first.
3. **B-04 heroine barks**, then **B-12 18+ age gate** (needed before promoting the game), then **B-05 tiers 4–5**.
