# Project status

> Living handoff document. **Every session updates this before finishing** (see AGENTS.md §3).

**Version:** 0.4.0 · **Live:** https://ldallacqua.github.io/siren-siege/ · **Last updated:** 2026-09-29

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
- **Story:** lore bible `docs/LORE.md`; 20 chats (Bond 1/3/5/7/9 per heroine, Bond 9 = confession) + a prologue on first Play; richer bios; "Her story" entries on profiles unlocked by Bond; Codex screen (world + bestiary).
- **Chat player:** 14 painted scenes with ambient particles (snow, embers, steam, lanterns, stars…), breathing portrait with mood crossfades, typewriter with punctuation pauses and per-heroine voice blips, hearts + sound on favorite choices, live Bond meter, log, auto, skip, keyboard (Space/1/2/A/S/L/Esc), chapter-complete card with Bond gain and unlocks.
- **Combat visuals (`Vfx.ts`):** Scarlet tracers + muzzle flash + sparks; Yuki frost nova with ice spikes, shards, frozen-in-ice enemies; Kaede arcing fireballs, layered explosions, embers, smoke, scorch; Selene moon arrows with star trails and ally aura sparkles. Hit flashes, effects scale with tier. Per-heroine attack sounds.
- **UI sound/feedback:** click/select/back on every button, hover ticks, wave-clear chime, low-lives alarm + pulsing counter, hurt shake, gold pulse, unlock/bond-up fanfares on results.
- **Lobby home (gacha style):** full-screen featured heroine (tap her for a Bond-gated idle line with voice blips), Commander badge (wins, best wave), left rail tiles Messages (new-chat badge) / Gallery / Codex, heroine picker on the right, big Heroines + Battle tiles at the bottom.
- **Messages screen:** every chat across heroines, new first. **Arena select:** cards with painted map previews, difficulty, best wave, lock state.
- **Second arena, Frostveil Pass (Hard):** Mount Shirahane snow palette (snowy firs, frozen pond, ice-blue lanterns), shorter path; unlocks at wave 10 on Moonlit Shrine; own music track. Bot reaches wave 15 there vs 19 on the shrine.
- **Music with song forms:** every track (menu, 4 chat themes, 2 battle maps) is a 32–40 bar song with 3–4 sections and intro/breakdown/outro feels, about 2 minutes before it repeats, plus seeded variation (melody dropouts, bass hops, drum fills) so no pass is identical. Lofi style for menus/chats (swung e-piano, soft drums, low-pass; no crackle). Chords are written by name in `src/audio/tuning.ts`. Tracks crossfade, chats restore the previous track, pause/options duck the battle music.
- **Motion design (D-019, `docs/UI_STYLE.md` → Motion):** title card ("Tap to begin", unlocks audio); directional screen transitions (forward/back, lobby dive/surface); lobby entrance choreography, per-heroine particles, parallax, colour wash on heroine switch, glowing Battle button; staggered lists/cards, 3D tilt on arena/roster cards; springy modals; lightbox grows from the tapped picture; menu↔battle wipe naming the arena; wave and boss banners; gold count-up, affordable-card flash, dock panel slide; heroines drop in when placed and pop on upgrade; results title reveal and bond bars filling from the old value; chat letterbox + title card intro; bond-bar shine. All off with Reduced motion.
- **Skill effects scale with the upgrade path (`src/game/vfxLook.ts`):** each heroine's shots, impacts, pulses and blasts take size, density and colour from her tiers per path, and tier 3 of each path unlocks a signature effect: Scarlet heart-burst rounds / twin muzzle flashes + brass casings / blood-moon sniper beam + crescent; Yuki frost rune + ice crystals / shatter shards + frost ground / ripples + ice vortex; Kaede flame lotus + burning ground / firework shells + crackle / purple oni meteor + ground cracks + shake; Selene halo + light pillars on allies / gold coins / falling-star arrows. Upgraded heroines stand on a glowing sigil that gains detail per tier. Sounds scale too (deeper booms, sniper crack, shatter, chime, crackle). `npm run fx` renders a side-by-side comparison per heroine.
- Save in localStorage; `?dev` mode.
- Tooling: unit tests (40), balance bot, real-browser smoke test (3 viewports), Prettier, CI on PRs, auto-deploy to GitHub Pages from `main`.

## Known issues / limitations

- **MVP art scope:** remaining mood variants fall back to the main portrait; gallery slots 2–5 still show placeholders. The owner explicitly deferred the full 64-image set. Optional follow-up: B-01.
- Audio is synthesized placeholder quality (no recorded samples). 60 fps with 200 enemies on a mid phone is **not yet measured** (sounds are rate-limited to 24 voices, particles capped at 400).
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

**2026-09-29 — longer music, path-based skill effects (Claude, cloud session)**

- Owner: remove the lofi crackle, music repeats too often (extend all tracks), then make skill effects scale with the upgrade path (small fireball at low level, huge one at max).
- Music: `Track` now has `sections` (chords by name) + `form`; `songPlan()`/`songBar()` in `tuning.ts`; `sound.ts` plays feels (full/soft/bare), fills and seeded variation. Crackle removed.
- Effects: `vfxLook.ts` (pure, tested in `tests/vfx.test.ts`) maps hero + tiers → scale, density, palette, signature; sim fx carry `tiers`; `Vfx.ts` rewritten around it (new ring styles glyph/beam/crescent/burst/crystal/lotus, particles casing/heart/spark/coin, fire and crack decals, `sigil()` under towers); `BattleScene` wires sigils, blessing aura and shake; `sound.fx` scales pitch/adds signature sounds.
- New dev tool `npm run fx` (`scripts/fx-preview.ts`).
- Nothing half-done.

## Next up

1. **Owner playtest of the skill effects** (upgrade each path to 3 with `?dev`; are signatures readable, too flashy at 3× speed?) and the longer music. Then **owner playtest of music + motion** (is the lofi too quiet/loud? any animation that feels slow or annoying? Tweak durations in the motion block of `style.css`). Then **owner playtest of the lobby + Frostveil Pass**, then the previous items. **Owner playtest (earlier):** read a Bond 5+ chat, watch combat at tier 3, listen to the new sounds. Tune in `Vfx.ts` / `sound.ts`.
2. **Art:** more mood portraits now matter more (20 chats use all 9 moods), and scene backgrounds could become real art later (`.scene-*` in `style.css`).
3. **B-03b perf check** (Vfx adds particles; cap is 700), then **B-04 barks**, **B-12 age gate**, **B-05 tiers 4–5**.
