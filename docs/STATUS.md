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
- Save in localStorage; `?dev` mode.
- Tooling: unit tests (27), balance bot, real-browser smoke test (3 viewports), Prettier, CI on PRs, auto-deploy to GitHub Pages from `main`.

## Known issues / limitations

- **MVP art scope:** remaining mood variants fall back to the main portrait; gallery slots 2–5 still show placeholders. The owner explicitly deferred the full 64-image set. Optional follow-up: B-01.
- **No audio** at all yet.
- Balance only validated by the naive bot (`npm run sim`: loses around wave 19–20). No human playtest data yet.
- Upgrade tiers stop at 3 (BTD6 has 5). No camo/regrow enemies, no hero abilities.
- Only 2 of the planned 5 chats per heroine are written; `speaker: 'you'` lines are supported but unused.
- Fonts come from Google Fonts; offline or blocked networks fall back to Georgia/system fonts (fine, just less pretty).
- No 18+ age gate yet (required before any public promotion — see BACKLOG B-12).
- Saves are per-browser only; clearing site data wipes progress.
- Phaser bundle is ~1.4 MB (≈360 KB gzip); fine for now.
- **Owner decision pending:** license. `package.json` says `UNLICENSED` while the repo is public (all rights reserved by default).

## Last session

**2026-09-28 — B-01 MVP art pass (Codex)**

- Generated 19 final assets with the built-in image tool, using each main portrait as the identity reference. Four portraits, four chibis, four First Impression gallery scenes; smile for everyone plus Scarlet tease, Yuki shy and Kaede laugh.
- Owner reduced scope from 64 images to the most important MVP assets. Remaining expressions and gallery scenes are intentionally deferred, not unfinished MVP work.
- Selene's final design uses a covered embroidered bodice consistently in portrait, smile, chibi and gallery. Yuki's design includes an ice staff.
- Imported with `npm run art` (WebP quality 85); preserved alpha; 256×256 chibis, 1086×1448 portraits and 1448×1086 gallery scenes. No game code or player progression changed.
- Improved smoke captures to finish finite screen fades and decode images before screenshots; added each heroine's first gallery lightbox, requiring shipped files to load as real WebP rather than silently falling back.
- Asset inventory and production prompt set: `docs/ART_ASSETS.md`.
- Validation: 19 WebP files inspected for dimensions/alpha; smoke passed at 1280×720, 390×844 touch and 844×390 touch. Reviewed battlefield, shop, profile, chat and gallery screenshots; no crop or layout adjustments required.
- Environment note: Chromium's bundled tar extraction failed on `chown`. Unpacked the existing npm-bundled Chromium/fonts/SwiftShader without ownership changes into a scratch TMPDIR, then ran the normal importer and smoke command. No dependency or repo workaround needed.

## Next up

1. **B-03 juice** — sound effects, music, pop particles, floating gold text.
2. **B-04 heroine barks**, then **B-05 tiers 4–5**.
3. **B-01 optional art expansion** only when requested; the MVP asset set is complete.
