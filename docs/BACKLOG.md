# Backlog

Prioritized. Take the top **unblocked** item unless the owner asks otherwise. When done: delete it here, note it in `docs/STATUS.md`. When you discover new work: add it with acceptance criteria.

Legend: **P1** next · **P2** soon · **P3** later · 🔒 blocked (reason given)

---

### B-18 · P1 · Every heroine through the art gate (owner sign-off)

The art gate (`docs/ART_QA.md`) is in place and every heroine passes its automated half; Nemu is incomplete (no gallery). Remaining is the owner's half, per the ART_QA status table:

- Owner reviews `artifacts/art-check/<id>-*.png` (or the game) and signs off each heroine's moods, chibi front pose and gallery; record it in the ART_QA table.
- Anything rejected gets redrawn (ART_GUIDE §9) and goes through `npm run art` → `npm run art:check` again.
- Likely redraws already known: the front chibis of Scarlet, Yuki and Kaede and their `gallery-1` predate the full-body portraits (B-01); Nemu's five gallery pictures.
- Accept: every row in the ART_QA status table reads "ready".

### B-19 · P3 · Sharper portraits for large high-DPI screens (owner decision)

Portraits are 1536 px tall (the generator's maximum). On a 4K screen at 200 % the chat and home now show her smaller (head to ankle) to stay sharp (`MAX_UPSCALE` 1.25), where 1080p shows head to mid-thigh. Getting that framing back needs portraits ~3000 px tall: an AI upscaler (e.g. Real-ESRGAN anime, a new local tool) or a generator that outputs larger images. Codex's built-in image tool has no size option (checked 2026-10-03: always 1024×1536); its own notes say the paid API route (`gpt-image-2` with an `OPENAI_API_KEY`) takes sizes up to 2160×3840 but cannot output transparency, so that route would mean an API key (cost per image) plus the green screen again. Every upscaled portrait goes through the art gate again (hands!).

- Accept: owner chooses; if done, `MAX_UPSCALE` framing on 4K matches 1080p and the gate passes.

## Visual novel direction (`docs/VN_DIRECTION.md`)

The owner's reference for the story side is Yuzusoft. Order of work is section 9 of that document; decisions waiting for him are its section 11. Each item is checked on phone, tablet and big desktop.

### ~~B-22 · P1 · Story screen look~~ (done 2026-10-03, D-033)

The chat player has the target look (VN_DIRECTION 7.1–7.3): frameless window in the speaker's colour, name without a plate, text sized from the screen, big sprite, backdrop at full brightness, chapter ribbon, choice bars, quick menu in small caps. Smoke asserts text size, sprite size and sharpness, and that nothing covers her face, on all five screens. Waiting for the owner's playtest.

### ~~B-23 · P1 · Pictures inside scenes~~ (done 2026-10-03, D-034)

A line can show a gallery picture full screen (`cg`), and Hide clears the window and menus until the next tap. Kaede's six episodes show her five pictures; Scarlet, Yuki and Selene show their fifth at the confession. Their Bond 7 pictures wait for their rewrites (the pictures are pin-ups and need a scene written around them), and Nemu has no gallery art yet.

### B-24 · P1 · A cast on stage

Done already (D-034): a speaker per line (`who`); she takes the stage alone with her own name, colour and blip. Still to do: two or three sprites at once on landscape (left, centre, right), shots (far, mid, near), the listener dimmed, entrances and exits, the speaker's face icon; an upright phone keeps one sprite and gets small faces above the window.

- Accept: works with one, two and three characters at all five screens; the data says who is on stage, not only who speaks.

### B-25 · P2 · Reader's tools

Back one line; Skip stops at unread lines by default; leaving mid-episode keeps the place and the Diary offers Continue; Config (text speed, auto speed, window strength, blips); tap a log line to return to it.

- Accept: read lines and the resume point are in the save, backward compatible; keyboard and touch.

### B-26 · P1 · Routes written to the standard

Kaede is done (`src/data/kaede.ts`, six episodes, D-034) and is the sample. The owner reads it in the game, not as a draft; his verdict comes first. Then Scarlet, Yuki, Selene, Nemu: each in her own file with `script.ts`, 25–40 lines an episode, second voices, her four other pictures written into scenes, a Bond 10 After, her sheet completed in LORE.

- Accept: the "rewritten route" data test covers her; LORE updated; the episode checklist (VN_DIRECTION 10).
- Scarlet's proposed gap ("out of date") and the side cast were never put to the owner (VN_DIRECTION 11, decisions 5 and 6). He asked not to review story drafts, so decide in the writing and let him react to the result.

### B-29 · P1 · A guide through the first battle

The opening now explains the world and what the Sirens do, but nothing in the battle itself shows a first-time player what to tap. Three or four prompts in the HUD on the first battle only: pick a heroine, place her beside the road, start the wave, tap her to upgrade.

- Accept: shows once per save, can be dismissed, works by touch and mouse on all five screens.

### B-27 · P2 · Chibi cut-ins

A chibi illustration style test with the generator (two candidates, the owner picks), then one cut-in per route at its gag, shown as a framed panel (VN_DIRECTION 7.4).

- Accept: owner-approved style in ART_GUIDE; art gate rules for the new kind of picture; a node can show a cut-in.

### B-28 · P2 · Day and dusk backdrops

Day and dusk versions of the places the scenes use most, generated with the backdrop prompt frame and a different light; a scene names its time of day.

- Accept: the set is all there or not at all per place; owner approved.

### B-21 · P1 · Menus scale up on big desktop monitors

At 2560×1440 (`desktop-large` in the smoke test) only the Bond screen scales (D-031). The lobby tiles and name, Messages, arena select, roster, profile, gallery, codex, settings, the upgrade tree, the chat box and the battle HUD keep their phone pixel sizes and look small, with wide empty margins.

- One scale for the whole UI from the screen height (the Bond screen's `--u` steps are the reference: 1 / 1.15 / 1.3 / 1.5), or per-screen wide layouts where a list should become columns.
- If it is a global `zoom`, check every `vh`/`vw`/`dvh` size, the lightbox, and the battlefield's pointer maths (`BattleScene`, `tileToPage` in the smoke test); then remove the Bond screen's own `--u` steps.
- Done when the `desktop-large` smoke screenshots read comfortably from a normal distance and the other four screens are unchanged.

### B-03b · P1 · Juice follow-ups

B-03 shipped (synth SFX + music, particles, floating gold, shake, settings). Remaining:

- Measure 60 fps with 200 enemies at 3× on a mid phone (`npm run dev`, devtools CPU throttle 4×). Knobs: `MAX_PARTICLES` and `FX_LIFE` in `BattleScene.ts`, `GAP`/`Limiter` voices in `src/audio/sound.ts`.
- A music track per new map (add to `TRACKS` in `src/audio/tuning.ts`); optionally swap synth SFX for small CC0 samples in `public/sfx/` if the owner wants a richer sound.
- Motion perf: check the lobby (particles + parallax + backdrop blur) and screen transitions stay smooth on a mid Android phone; if not, drop `backdrop-filter` during transitions or halve `LOBBY_FX` particle counts.
- Accept: owner is happy with the mix; perf measurement recorded in STATUS.

### B-04 · P1 · Floating in-battle heroine barks

When placed / upgraded to tier 3 / Bond level up, show a short speech bubble line from the heroine near her position (2–3 s). Lines in `src/data/barks.ts`, 3+ per heroine per event.

- Accept: data test for barks; bubbles clamp inside the stage in both orientations.

### B-05 · P2 · Tiers 4 and 5 (BTD6 parity)

(The upgrade tree screen, `src/ui/upgradeTree.ts`, reads tier counts from data; its grid and `emblems.ts` need 2 more columns/badge levels.)

Raise `MAX_TIER` to 5; crosspath rule becomes 5-2-0 max (logic already generic). Design tier 4–5 for all 12 paths (big, visible power spikes; tier 5 costs 15–40k). Pips UI shows 5.

- Accept: `canBuyUpgrade` tests for 5-2-0 / 5-3-0 / 4-2-1; balance sim still loses naive bot around wave 18–20; UI fits portrait (3 path columns).

### B-06 · P2 · Camo and Regrow enemy modifiers

Enemy flags `camo` (untargetable unless tower has `detection`) and `regrow` (regains a layer every 3 s up to its original type). Render camo with dashed outline/transparency, regrow with a small leaf/heart mark. Give detection to Scarlet Night Sight T2 and Selene Blessing T3 (buff).

- Accept: unit tests for both; waves 12+ include some camo.

### B-07 · P2 · Hero abilities (Bond 5)

Each heroine gets an active ability unlocked at Bond 5: button in her panel, cooldown, visual. Ideas: Scarlet _Blood Moon_ (5 s triple fire rate), Yuki _Whiteout_ (freeze all on screen 2 s), Kaede _Oni Rampage_ (giant fire burst), Selene _Lunar Blessing_ (+50% rate to all for 8 s).

- Accept: sim-level implementation with tests; works by tap and by hotkey (Z).

### B-08 · P2 · Difficulty modes

Easy / Normal / Hard / Impoppable: multipliers on enemy speed, start cash, lives, costs (BTD6: Easy 0.85× cost, Hard 1.08×, Impoppable 1.2× + 1 life). Map select screen showing best result per difficulty (medals).

- Accept: stored per map+difficulty in save (migrate save v1 → v2).

### B-10 · P3 · Heroines 6–8

Heroine 5 (Nemu, the Dream Eater) shipped 2026-10-03. Ideas for the rest: kunoichi (camo detection, shuriken pierce), mecha pilot (long range, missiles), succubus (charm: enemies walk backwards briefly), pirate captain (economy + cannon). Each needs data, chats, art sheet in ART_DIRECTION.

- Blocked by: B-06 for the kunoichi's identity.

### B-11 · P3 · Maps 3–4

Map select and Frostveil Pass are done. Next: _Neon Harbor_ (two entrances merging; needs multi-path support in the sim) and _Blood Moon Castle_ (Scarlet's Crimson Keep, expert). Each needs a palette in `mapArt.ts`, a music track and a bot run.

- Accept: sim tests for multi-path spawning; bot result recorded in STATUS.

### B-12 · P2 · 18+ age gate + legal

First-launch modal: "This game contains suggestive content. Are you 18 or older?" Remember the answer in save. Add Credits/Privacy screen (no tracking yet). Needed before promoting the game anywhere.

- Accept: gate appears once; declining shows a polite exit screen.

### B-13 · P3 · PWA / offline

Service worker caching the build + art (vite-plugin-pwa or a small hand-written SW), install prompt, fullscreen display. Self-host the two fonts in `public/fonts/` instead of Google Fonts.

### B-14 · P3 · Freeplay after wave 20 + stats

Endless waves generated by formula after victory; stats page (pops, games, best wave, favorite heroine).

### B-15 · P3 · Outfits (skins)

Alternate outfits unlocked at Bond 7; outfit picker in profile; art file naming `outfit-<n>-portrait.webp`.

---

### B-01 · P3 · Optional art expansion after MVP

The MVP pass is complete: 19 assets (all four portraits/chibis/First Impression scenes plus seven expressions). See `docs/ART_ASSETS.md`. The owner explicitly requested the most important images only; completing all 64 is not a release gate.

- Follow the approved full-body portraits (designs in `docs/ART_ASSETS.md`). Nemu has no gallery pictures yet (all five slots are placeholders; the two portrait poses the owner liked, lollipop-in-mouth with pins on her shoulder and a raised pin, are candidates). The other heroines' 20 gallery pictures are done (Selene's `gallery-1` was redone in her new gown). Selene's chibi still shows her old closed-neck gown and small bow, Kaede's chibi and `gallery-1` show her old pose, and Scarlet's and Yuki's `gallery-1` predate their full-body portraits: redo them from the new portraits when this item is picked up.
- Accept: no body/framing jump between expressions, proper alpha, no face cropping in cards, gallery lightboxes and all three smoke viewports verified.

### B-16 · P2 · Main story chapters

The lore sets up a main plot (the Crimson Eclipse, Keeper Haruo, Selene's price, the Hollow King). Add story chapters unlocked by map progress (e.g. after wave 10, after winning), using `playChat` with `noReward` and multi-heroine scenes (needs a `speaker` per node for other heroines). **Started (D-034):** `src/data/story.ts` has chapters 1-1 (opening), 1-2 (after the first battle) and 1-3 (Kaede arrives), with `who` lines for the other heroines and the Story page to replay them. Next: 1-4 when Nemu joins (wave 15) and 1-5 when Selene joins the road (wave 20), then act 2. This is the "common route" of `docs/VN_DIRECTION.md` 5.1: ensemble chapters numbered "Chapter 1-1", densest in comedy, never assuming a romance. It comes after B-22 to B-24 and after the side cast is designed with the owner (decision 6).

- Accept: at least 3 chapters; multi-speaker chat support with tests; stays consistent with docs/LORE.md.

## Tech debt / nice to have

- T-06 · Optionally make scenery props block placement (BTD6-style obstacles) so heroines can't stand on trees/ponds; needs sim support (`canPlace`) + tests.
- T-07 · Sharper battlefield at max zoom: raise `PX` in `mapArt.ts` on large screens only, or paint a second hi-res texture on zoom > 2.

- T-01 · Split `ui/screens.ts` into one file per screen when it passes ~600 lines.
- T-02 · Lazy-load Phaser after the home screen renders to speed up first paint.
- T-03 · Replace per-frame `Graphics.clear()` redraw with pooled sprites once real sprites exist (only if profiling shows a need).
- T-08 · Drop the `FULL_BODY` set now that all five heroines are full body: make the `.full` framing in `style.css` the default for portraits and remove the class from `art.ts` / `common.ts`. Check the generated SVG placeholders (a new heroine without art) still frame sensibly in cards, avatars, home and profile.
- T-09 · `.screen.home` is `overflow: hidden` but wider than the viewport inside (scaled picker avatars, the hero image), so a programmatic scroll-into-view can shift the whole lobby sideways (seen with Playwright's `click()` at 390×844; a real tap does not). `overflow: clip` on the screen would rule it out; check Safari support and the smoke screenshots.
- T-04 · Smarter balance bot (buys tier 3s, positions by role) so balance targets are closer to real players.

### B-17 · P3 · Heroine look changes with upgrades on the map

BTD6 towers visibly change per crosspath. Ours get a sigil and pips; next step is an accessory per path at tier 3 (e.g. Scarlet's second pistol, Yuki's crown of ice, Kaede's glowing horns, Selene's halo) drawn over the chibi or as art variants `chibi-<path>.webp`.

- Accept: a 3-x-x heroine is recognizable from a 0-0-3 one at fit zoom on a phone; falls back to the plain chibi when art is missing.
