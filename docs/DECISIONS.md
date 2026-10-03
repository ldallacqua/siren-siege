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

### D-027 · 2026-10-03 · Battlefield sprites have four optional poses, fitted at load

The owner wanted more variety than one sprite mirrored left and right. Each heroine can have `chibi` (front), `chibi-attack`, `chibi-back` and `chibi-back-attack`; `chibiFrame()` (pure, tested) turns her around when her target is above (aim y below −0.45, back to the front above −0.15, so she doesn't flicker), shows the attack pose while `Tower.flash` is on, and falls back to the closest pose that exists. Mirroring still covers left and right, so four drawings give eight looks. Generated frames don't keep the figure the same size or in the same place, so `BattleScene` measures each frame when it loads (head top in the middle columns so weapons and effects don't count, feet line, legs centre) and `frameFit()` scales and anchors it to the front frame. With a drawn attack pose the old recoil squash (6 % wider and shorter on every attack) is off: on a fast attacker it made the sprite look stretched (owner's remark on Nemu).

### D-026 · 2026-10-02 · Portraits are full body; agents generate art through Codex CLI; green screen keyed at import

Owner wanted no cropped legs. Portraits are now generated full body (2:3), but the owner wants the upper-body focus on screen, so the game frames it: home and profile head to mid-thigh (the image is ~1.6× the visible height, anchored at the top, fading out at the bottom, so any screen shape cuts her with a fade rather than a hard edge), small cards and avatars closer with CSS `scale` (Safari-safe, unlike `object-view-box`); only the lightbox shows her whole. A `FULL_BODY` set marks converted heroines so old thighs-up art keeps its framing during the transition. Generators rarely return real transparency, so prompts ask for flat #00FF00 and `npm run art` keys it (no new image dependency; it runs in the smoke-test Chromium). Codex CLI was chosen over an API key or browser automation because it uses the owner's existing ChatGPT plan and is an official OpenAI client (ChatGPT web automation would break its terms).
Update (same day): art is **network-first** in the service worker. Replaced art keeps its file name, so stale-while-revalidate showed the old waist-up Yuki inside the new full-body framing for a whole visit (owner's phone). Cache bumped to `siren-siege-v2` to clear old copies; the HTTP cache still makes repeat loads cheap.
Update (same day, Kaede): heroines with fire or yellow are generated on pure blue instead, because green left a yellow-green fringe on the flame. Blue has its own trap: orange and red blended with blue turn purple, which is not "bluer than red", so the keyer kept it as her colour. On a blue screen the keyer now also unmixes saturated purple (blue above green by 24, green under 150) within 8 px of clear screen. The distance limit is deliberate: Kaede has real maroon and lilac shading inside her jacket that must stay. The prompt side matters as much: ask for a solid, opaque flame floating clear of her hand, since a translucent flame has the screen colour painted into it.
Update (2026-10-03, Nemu): a new heroine is generated with an existing approved portrait as a **style** reference only ("draw a completely different character"), which kept the rendering, framing and green screen consistent without copying the other heroine.
Update (same day, Selene): the owner asked for Selene to show cleavage like the other three, so her full-body portrait has an open V neckline. This overrides the covered bodice of D-012 for portraits (still within the content ceiling: no nudity). Keying her on green had the mirror image of Kaede's problem: lilac hair blended with green turns teal, greener than red but not greener than blue, so it stayed as a teal fringe. The keyer now unmixes "greener than red" pixels within 8 px of clear screen, but only when the heroine has no teal of her own: under 1 % of her pixels deeper than 16 px inside are greener than red. Measured on the shipped portraits laid over green: Selene 0.05 % and Scarlet 0 % (rule on), Yuki 33 % (rule off, so her ice-blue keys as before). Kaede's blue-screen portrait re-keys to a byte-identical file. Scarlet's and Yuki's raw sources were not on this machine, so their files were not re-keyed; a future Scarlet import runs with the rule on.

### D-028 · 2026-10-03 · An art gate: measured screen colour, automated checks, eye checks with owner sign-off

The owner saw a "ghostly aura" around Nemu and blurry chat portraits on desktop, and asked for a quality gate every heroine must pass before she counts as ready. Causes: (1) the keyer projected each pixel against pure #00FF00, but generators return (3, 248, 5)-ish, so every screen pixel within 12 px of her came out about 3 % opaque in her colour: a faint band with a hard outer edge on every portrait (worst on dark hair). The keyer now measures the screen colour (median of clearly-screen pixels) and clears alpha under 3 % (`scripts/chroma.ts`, unit-tested; art-import decodes and encodes in the browser and keys in Node). (2) The chat's image had no sized grid track, so it showed at its natural 1536 px on every desktop: head-to-waist on a laptop, stretched 2× at 200 % display scaling (the owner's 4K screen). Chat and home now frame her from the screen size and never stretch her past `MAX_UPSCALE` = 1.25 screen pixels per art pixel; on such screens she shows smaller and sharp. Phones keep their framing (dense enough that the stretch doesn't show). Getting the head-to-thigh framing back on a 4K screen needs art about twice as tall, which the image generator doesn't produce (an upscaler would be a new tool: owner decision).
The gate (`docs/ART_QA.md`) has two halves. `npm run art:check` measures what can be measured (files, size, halo, screen tint and spill on the outline, nothing cut off, moods aligned with the base, chibi poses that fit without heavy rescaling) and writes review sheets, including every hand in every portrait zoomed (`HAND_BOXES`). It runs after `npm run art` and in the pre-push hook when art changes; missing files mark a heroine incomplete but don't block a push, defects do. The eye checks are reviewed by the agent first and signed off by the owner; the status table lives in ART_QA. Existing art was repaired: re-keyed from the original PNGs where they still existed (Nemu, Selene and Kaede portraits, all chibi poses); for Scarlet's and Yuki's portraits the old keyer's bias was removed from the WebP and Scarlet's olive hair edges recoloured from inside. Cut-outs are encoded at WebP quality 0.92 (was 0.85; blocky hair at chat size).

### D-029 · 2026-10-03 · Moods are whole poses; cut-outs come transparent from the generator (trial: Scarlet, branch `wip/pose-moods`)

The owner asked for a pose per emotion instead of the base portrait with a new face (he first considered three poses × nine faces = 27 pictures per outfit, then chose nine pictures where pose and expression change together). The mood set became nine distinct emotions: smile, laugh, tease, wink, blush, shy, pout, **angry**, **sad** (`MOODS`, now defined once in `src/data/progression.ts`); `smirk` and `grin` were dropped as near-duplicates of tease and laugh and their lines retagged. Scarlet is the trial; the other four keep face-only moods (and have no angry/sad yet) until the owner approves hers. Consequences: the chat fades the old pose out under the new one (`.leave`) instead of removing it; the art gate checks a pose mood's size and footing against the base rather than its silhouette (`POSE_MOODS`), and `HAND_BOXES` holds boxes per picture; a data test fails if a chat line uses a mood its heroine has no picture for.
The owner also asked whether the generator could output transparency itself. It can: Codex's image tool has `transparent_background`. Its cut-out is cleaner than keying a green screen (no screen colour to unmix, halo ≤ 0.003 against 0.008–0.028) once `npm run art` drops the faint fringe it leaves (alpha 1–4 up to ~10 px out; `cleanAlpha`). New cut-outs use it; the green screen stays as the fallback for the ChatGPT app. The tool has no size option (still 1024×1536), so B-19 is unchanged.
