# Project status

> Living handoff document. **Every session updates this before finishing** (see AGENTS.md §3).

**Version:** 0.2.0 · **Live:** https://ldallacqua.github.io/siren-siege/ · **Last updated:** 2026-09-28

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
- **In-battle Options** (⚙ on the battlefield, above the zoom buttons): music/sound volume, mute, reduced motion; pauses while open. The ☰ pause menu has the same controls.
- **Full portrait viewer:** tapping a heroine's picture (profile, or the round avatar in the battle panel) opens her whole portrait uncropped; in battle it pauses until closed.
- **Update check:** GitHub Pages caches the page for 10 min; on boot the game asks for the current build and reloads once (or shows a toast mid-game) if it's running an old one.
- **UI overhaul ("Moonlit Noir", see `docs/UI_STYLE.md`):** self-hosted fonts, SVG icons, chamfered buttons, one accent color; lobby-style home with a featured heroine (avatar picker); restyled HUD (stat chips, wave progress, icon controls, framed shop cards with hotkeys), roster/profile/gallery/chat/results/settings/pause.
- **Painted battlefield:** moss ground, flagstone path, stone lanterns (flickering), torii exit, spawn portal, pond, sakura/shrubs, fireflies, lighting; scenery continues past the map edges on wide screens. Enemies are shaded spirits with eyes; projectiles are light streaks; towers stand on colored pads; range rings are dashed.
- Save in localStorage; `?dev` mode.
- Tooling: unit tests (36), balance bot, real-browser smoke test (3 viewports), Prettier, CI on PRs, auto-deploy to GitHub Pages from `main`.

## Known issues / limitations

- **MVP art scope:** remaining mood variants fall back to the main portrait; gallery slots 2–5 still show placeholders. The owner explicitly deferred the full 64-image set. Optional follow-up: B-01.
- Audio is synthesized placeholder quality (no recorded samples); only one music track (Moonlit Shrine). 60 fps with 200 enemies on a mid phone is **not yet measured** (sounds are rate-limited to 24 voices, particles capped at 400).
- Balance only validated by the naive bot (`npm run sim`: loses around wave 19–20). No human playtest data yet.
- Upgrade tiers stop at 3 (BTD6 has 5). No camo/regrow enemies, no hero abilities.
- Only 2 of the planned 5 chats per heroine are written; `speaker: 'you'` lines are supported but unused.
- Battlefield texture is 80 px/tile: slightly soft at 3× zoom on high-DPI phones. Scenery props are decorative only (you can place a heroine on a tree or pond).
- Portraits have a baked-in dark background (not true alpha); the home and chat screens feather the edges with CSS masks.
- No 18+ age gate yet (required before any public promotion — see BACKLOG B-12).
- Saves are per-browser only; clearing site data wipes progress.
- Phaser bundle is ~1.4 MB (≈360 KB gzip); fine for now.
- **Owner decision pending:** license. `package.json` says `UNLICENSED` while the repo is public (all rights reserved by default).

## Last session

**2026-09-29 — UI overhaul (Claude, cloud session)**

- Owner asked for a more polished, professional UI ("looks like old Flash games"). Audited every screen, researched modern gacha/TD UI and HUD guidance, and wrote `docs/UI_STYLE.md` (rules + checklist).
- Design system: fonts in `public/fonts/` (OFL), `src/ui/icons.ts`, full `style.css` rewrite on tokens. New home (`showHome` in `screens.ts`, featured heroine = highest bond, switchable). HUD markup in `Hud.ts` uses icons and stat chips. Settings screen has panels, switches, slider readouts and a key list; the sfx slider is now called "Effects".
- Battlefield: `src/game/mapArt.ts` paints the scene (seeded, cached per map, 3-tile margin); `BattleScene` shows it as an image and adds an additive `glow` layer, fireflies, lantern flicker, `drawEnemy()`, light-streak projectiles, dashed `drawRange()`, tower pads and diamond pips. The checkerboard `drawBackground` and map `theme` colors are no longer used for the ground.
- Verified with smoke on all 3 viewports plus extra roster/gallery/results screenshots. Nothing half-done.

## Next up

1. **Owner feedback on the new look** (live site). Easy knobs: colors/tokens at the top of `style.css`; scenery in `mapArt.ts`.
2. **Owner confirms sound on phone**, then **B-03b perf check** (the new glow layer and fireflies add draw calls; measure with 200 enemies at 3×).
3. **B-04 heroine barks**, then **B-12 18+ age gate**, then **B-05 tiers 4–5**.
