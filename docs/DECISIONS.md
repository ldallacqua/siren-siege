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

### D-015 · 2026-09-29 · "Moonlit Noir" UI system; painted battlefield texture

Owner feedback: the UI "looks like old Flash games". Research on modern gacha/TD UIs (Arknights, Blue Archive, NIKKE, BTD6) and HUD-design guidance pointed to: two fonts max, one icon language, one hot accent, restrained surfaces, and a readable, place-like battlefield. So: self-hosted Cinzel + Barlow Semi Condensed (offline-safe, no Google Fonts), an inline SVG icon set, chamfered buttons, and one rose accent (rules in `docs/UI_STYLE.md`). The battlefield scenery is painted once per map with Canvas 2D (`mapArt.ts`, seeded) and shown as one image, transposed for portrait by flipY + 90° rotation; only live things are drawn per frame (plus an additive glow layer). Canvas 2D gives gradients and soft shadows cheaply and avoids per-frame geometry. Trade-off: the texture is 80 px/tile, so at 3× zoom on a high-DPI phone it's slightly soft.

### D-016 · 2026-09-29 · Update DOM in place; don't re-render screens for small state changes

`h()` + `show()` rebuild everything, which is fine for navigation but reads as a "page reload" (entrance animation replays, images re-decode) when used for a toggle. Rule: navigation may rebuild; in-screen state (featured heroine, HUD speed/pause/auto/wave, costs) must update existing nodes. The smoke test checks node identity so regressions get caught.

### D-017 · 2026-09-29 · Rendering-only data on sim fx; Vfx module owns battle effects

Per-heroine visuals need to know who fired and how upgraded she is, so `Fx` gained optional `hero`, `tier`, `angle` (and `hit` events carry the enemy uid in `value`). The sim still never reads fx back, so determinism and balance are untouched. All transient battle visuals moved from `BattleScene` into `Vfx.ts` (tile-space particles projected through the scene view each frame) so the scene stays about layout/input and effects can grow independently. Chat backdrops are CSS gradients + a small 2D-canvas particle loop rather than images, so every scene works with zero art and is replaceable later.

### D-018 · 2026-09-29 · Gacha-style lobby; maps themed by palette, not by new renderers

Owner asked for a NIKKE-like home: destinations as tiles around a full-screen heroine you can tap. The lobby keeps the in-place update rule (D-016) for switching heroines. New arenas reuse the generic `mapArt.ts` painter with a `Palette` per `MapDef.art`, so a map is data (path, palette, blurb, unlock) plus a music track, not new rendering code. Arena difficulty comes from path length and is checked with the bot (`MAP=… npm run sim`).

### D-019 · 2026-09-29 · Motion system in CSS + tiny helpers; lofi music synthesized like the rest

Owner asked for "motion everywhere" and lofi music for menus/chats. Motion stays dependency-free: CSS keyframes keyed off classes (`enter-fwd/back`, `leaving`, `stagger`, `pop`, `tilt`, `wipe`, `banner`) plus a ~150-line `src/ui/motion.ts` (stagger indices, count tweens, wipe, tilt, parallax, FLIP). No animation library: the effects are simple, CSS runs off the main thread, and `body.calm` can switch all of it off with one rule. `show()` keeps the outgoing screen for ~300 ms so exits animate (made inert so tests and assistive tech ignore it). A title card ("Tap to begin") was added because browsers block audio until a gesture; making that gesture the first thing means the lobby music starts exactly as the lobby animates in. Music: a second synth style (`style: 'lofi'` in `tuning.ts`) with swung e-piano chords, soft drums, low-pass and vinyl crackle; players crossfade on change, chats swap to the heroine's theme and restore the previous track, menus duck the battle music.

### D-020 · 2026-09-29 · Effect style is a pure function of the upgrade path; music is a song form, not a loop

Owner wanted effects to "scale" like a small fireball growing into a huge one, and different per path. Rather than branching on tier inside every draw call, `lookFor(hero, tiers)` (`src/game/vfxLook.ts`) turns the path into a small style record (power, scale, density, 5-colour palette, tier-3 signature) and all effect code reads from it. It is pure and unit-tested, the sim only passes a reference to the tower's `tiers` on fx (rendering-only, as in D-017), and new heroines just add a palette row and three signature names. Sound uses the same look. Music: 4-bar loops repeated every ~13 s; tracks are now a named-chord song form (sections + form with full/soft/bare feels, ~2 min) plus seeded variation, which keeps them tiny and editable as data without recording anything.

### D-021 · 2026-09-29 · Heroine panel floats over the map; the tree is a full screen that pauses

Like BTD6: selecting a heroine never replaces the shop. Her panel (quick-buy per path, Upgrades, targeting, sell) floats on the stage edge away from her (chosen once per selection from her screen position; portrait uses a top/bottom sheet). "Upgrades" opens the full-screen tree, which **pauses the match**; there a tap only selects a badge and the Upgrade button buys (no accidental buys). Sell/targeting live only in the panel. (An intermediate version removed quick-buy entirely; the owner reversed that.) Readability is solved in rendering: the outline is baked into the chibi texture at load, sprites scale by `CHIBI_H`; sim placement rules are unchanged, so balance is unaffected.

### D-022 · 2026-09-29 · PWA with a hand-written service worker; preload art in the UI layer

No plugin (vite-plugin-pwa would be a new dependency): `public/sw.js` is ~50 lines. Pages are network-first so the existing update check (`checkForUpdate`, `no-store` fetch) and fresh deploys keep working; other same-origin files are stale-while-revalidate (hashed bundles never go stale; art refreshes on the next visit). Registered only when the hashed bundle is present (production). Image preloading lives in `ui/preload.ts`: it also records which optional art files are missing, so fallback chains stop paying a 404 per mood change.

### D-023 · 2026-09-29 · Messages is per heroine; gifts are a battle drop with hidden tastes

Following NIKKE's Advise screen: Messages first picks a heroine, then shows her Bond screen with episodes in Bond order (a diary), so order and progress are obvious. Gifts give Bond XP outside battle but are **earned in battle** (1 per 5 waves, +2 on a win), so fighting stays the main loop and there's no new currency or shop to balance. Each heroine loves 2 gifts and likes 1 (from LORE); tastes are hidden until you've given that gift once, which makes gifting a small discovery game. Sheets (gift, diary) live inside the Bond screen instead of going through `show()`, because `show()` replaces the current screen with a modal.

### D-024 · 2026-09-29 · Smoke test runs in a pre-push hook, not in the deploy

The smoke test took ~11 min on the 2-core GitHub runner (software WebGL) and ran twice per session (branch CI + deploy), so every deploy waited on it. It takes ~1:45 on a dev machine (viewports in parallel when there are 4+ cores). `.githooks/pre-push` runs `npm run check` + `npm run smoke` against the exact commit being pushed (a temporary worktree if the checkout is dirty), remembers trees that passed in `.git/siren-smoke-ok` so branch + main pushes cost one run, and only runs Prettier for docs-only pushes. No husky: `npm install`'s `prepare` sets `core.hooksPath`. CI keeps `npm run check` (~11 s) as the safety net before deploying; pull requests (Dependabot, contributors) still get the smoke test since they never pass through the hook. Trade-off: `git push --no-verify` can ship an unsmoked build.

### D-025 · 2026-09-29 · README images are generated, not hand-made

`npm run shots` stages the game (dev mode for unlocks, dev label removed, a wave-12 battle with upgraded heroines) and writes `docs/readme/*.webp`: banner, screenshots, heroine cards and an animated battle clip. Chromium encodes the WebPs (canvas) and the script muxes the animated WebP itself, so no image tools or new dependencies. Re-run it when the look changes.

### D-026 · 2026-10-02 · Portraits are full body; agents generate art through Codex CLI; green screen keyed at import

Owner wanted no cropped legs. Portraits are now generated full body (2:3), and the game picks the framing per view: home and profile show her whole, small cards and avatars zoom to the upper body with CSS `scale` (Safari-safe, unlike `object-view-box`), chat and Bond stay close-ups. A `FULL_BODY` set marks converted heroines so old thighs-up art keeps its framing during the transition. Generators rarely return real transparency, so prompts ask for flat #00FF00 and `npm run art` keys it (no new image dependency; it runs in the smoke-test Chromium). Codex CLI was chosen over an API key or browser automation because it uses the owner's existing ChatGPT plan and is an official OpenAI client (ChatGPT web automation would break its terms).
