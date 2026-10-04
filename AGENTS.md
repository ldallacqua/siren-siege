# AGENTS.md — start here

This file is the single source of truth for any AI coding agent (Claude Code, Codex, Cursor, Copilot, Gemini, Jules, Aider…) working on this repo. Tool-specific files (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/`) only point here.

## 1. What this project is

**Siren Siege** — a browser tower defense game (modeled on _Bloons TD 6_) where the towers are alluring adult anime heroines. Fielding a heroine raises her **Bond**; Bond unlocks branching **chats** and **gallery** art. Runs on desktop and mobile, portrait and landscape.

- Live: https://ldallacqua.github.io/siren-siege/ (served from the `gh-pages` branch, deployed by CI on every push to `main`)
- Owner: Lucas (ldallacqua). Talks to agents in English or Portuguese.
- Design: `docs/GDD.md` · Architecture: `docs/ARCHITECTURE.md` · **UI look: `docs/UI_STYLE.md` (read before any UI/CSS/battlefield change)** · **Story canon: `docs/LORE.md` and story craft: `docs/VN_DIRECTION.md` (read both before writing chats, bios or enemies, or changing the chat player; the reference is Yuzusoft's visual novels)** · Art: `docs/ART_DIRECTION.md` (style) + `docs/ART_GUIDE.md` (owner's ChatGPT workflow, file names) + **`docs/ART_QA.md` (the gate every heroine's art must pass)**

## 2. Resume protocol (do this first, every session)

1. Read **`docs/STATUS.md`** — current state, known issues, what the last session did, what's next.
2. Read **`docs/BACKLOG.md`** — prioritized tasks with IDs and acceptance criteria. Work on the top unblocked item unless the owner asked for something else.
3. `npm ci` (cloud sessions do this automatically via `.claude/settings.json` → `scripts/session-start.sh`).
4. `npm run check` — must be green before you start. If it isn't, fixing it is your first task.
5. Skim `docs/DECISIONS.md` before changing anything structural, so you don't undo a deliberate choice.

## 3. Handoff protocol (do this last, every session)

Before you finish — even if the work is incomplete:

1. `npm run check` green (and `npm run smoke` if you touched UI, input, layout or rendering).
2. Update **`docs/STATUS.md`**: move finished work into "What works", add anything broken to "Known issues", rewrite "Last session" (date, what you did, anything half-done and where), and set "Next up".
3. Update **`docs/BACKLOG.md`**: tick or remove done items, add new ones you discovered (with acceptance criteria).
4. Add a `docs/DECISIONS.md` entry for any non-obvious design/architecture choice.
5. Commit with a clear message and push. Half-done work goes on a branch named `wip/<topic>` and is described in STATUS, never left only in a local checkout.

The next agent has **no memory of your session** — if it isn't in the repo, it didn't happen.

## 4. Commands

| Command             | What it does                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`       | Dev server on :5173. Open `/?dev` for dev mode (all unlocked incl. the gallery, 20k gold, `window.siren` debug hook)      |
| `npm run check`     | **The gate.** Prettier check + typecheck (app and node) + unit tests + balance sim + production build                     |
| `npm test`          | Vitest unit tests (`tests/`): data integrity + simulation behavior                                                        |
| `npm run sim`       | Headless balance bot plays all 20 waves and prints per-wave lives/cash (`npm run sim -- scarlet yuki`)                    |
| `npm run smoke`     | Build + real-browser test on five screens (below); screenshots → `artifacts/smoke/`. `-- tablet large` runs only those    |
| `npm run fx`        | Build + fires each heroine's effects for 5 upgrade builds side by side; screenshots → `artifacts/fx/`                     |
| `npm run format`    | Prettier write                                                                                                            |
| `npm run shots`     | Build + regenerate the README images in `docs/readme/` (`-- --banner`: banner and heroine cards only)                     |
| `npm run art`       | Convert PNG/JPG in `public/art/<id>/` to correctly sized WebP, delete sources, list misnamed files, then run the art gate |
| `npm run art:check` | **The art gate** (`docs/ART_QA.md`): measured checks per heroine + review sheets → `artifacts/art-check/`                 |
| `npm run build`     | Typecheck + Vite build to `dist/`                                                                                         |

**Look at the smoke screenshots** (`artifacts/smoke/*.png`) after UI changes — that's how you "see" the game. The five screens: `phone-portrait` 390×844, `phone-landscape` 844×390, `tablet` 820×1180, `desktop` 1280×720 (a laptop) and `desktop-large` 2560×1440. **Every UI change is looked at on a phone, a tablet and a big desktop** (`phone-portrait`, `tablet`, `desktop-large`) before it is called done: the owner plays on all three, and a screen that is fine on a laptop can be tiny or empty on a 1440p monitor. The smoke test finds Chromium via `$CHROME_PATH`, then `@sparticuz/chromium` (bundled via npm, works in sandboxed/cloud Linux where browser downloads are blocked), then Playwright's own (`npx playwright-core install chromium` on macOS/Windows).

## 5. Code map

```
src/
  data/            PURE DATA, no Phaser/DOM. Content lives here.
    types.ts         All shared types (Stats, HeroineDef, EnemyDef, Wave, ChatEpisode…)
    heroines.ts      Roster, base stats, 3 upgrade paths × tiers (apply() mutates Stats)
    enemies.ts       Layered enemies, rbe() = total layers
    maps.ts          Maps (path, palette, blurb, difficulty, unlock) + WAVES
    dialogues.ts     Chat episodes (node graph, Bond 1/3/5/7/9 per heroine): the first-generation sketches
    script.ts        Notation for long episodes: lines in reading order, branches that rejoin -> node graph
    kaede.ts         Kaede's route rewritten to docs/VN_DIRECTION.md (six episodes, Bond 10 "After")
    story.ts         Main-story chapters (play by themselves once, replayable from the Story page)
    faces.ts         Where her face is in every portrait (close-ups are framed on it); measured by scripts/faces.py
    gifts.ts         Gift items, heroine tastes, gift XP, battle drops, reaction lines
    lore.ts          Codex entries, bestiary text, per-heroine story entries unlocked by Bond
    progression.ts   Bond XP thresholds, gallery slots, art file naming, moods, scenes
  game/
    sim/             PURE LOGIC, no Phaser/DOM. Deterministic, fixed 60 Hz.
      BattleSim.ts     Spawning, movement, targeting, projectiles, damage/pop, economy, waves
      upgrades.ts      computeStats(), BTD6 crosspath rule canBuyUpgrade(), sell value
      path.ts          Polyline distance lookup
    Vfx.ts           Battle particles/rings/decals/trails/hit flashes, per-heroine styles
    vfxLook.ts       Pure: hero + tiers per path → effect scale, palette, tier-3 signature
    mapArt.ts        Paints a map's static scenery (ground, path, props, lighting) once into a canvas texture
    camera.ts        Pure zoom/pan math (fit, zoomAt, panBy, clamping) for the battlefield
    chibiPose.ts     Pure bob/recoil/facing math for chibi sprites
    Battle.ts        One match: sim + interaction state (placing, selected, speed, pause), change events
    BattleScene.ts   Phaser scene: draws a Battle, maps pointer input (tap, drag-pan, pinch, wheel); transposes map in portrait
  ui/                DOM UI over the canvas
    Hud.ts           Sidebar (landscape) / dock (portrait): stats, controls, shop, placing; heroine panel floating over the map
    upgradeTree.ts   Full-screen BTD6-style upgrade tree (battle: buys, pauses; profile: preview); emblems.ts draws its badges
    bond.ts          Messages: heroine select, her Bond screen (diary of episodes, Talk, Gift); giftArt.ts draws gift badges
    preload.ts       Image preloading + known-missing art (chats wait for their moods)
    screens.ts       Home, roster, profile, Story (replay everything), codex, gallery, results, pause, options, settings
    chat.ts          The story screen (VN_DIRECTION 7): scene, big sprite, camera (far/mid/close), frameless window, choice bars, log/auto/skip, end card
    guide.ts         The first battle's guide: four prompts that follow the player's moves (D-035)
    common.ts        show(), artChain(), backdrop(), bondBar(), topbar() shared by screens
    art.ts           Loads public/art files, falls back to generated SVG placeholders; lightbox
    icons.ts         Inline SVG icon set (use this, never emoji/unicode glyphs in UI chrome)
    dom.ts           h() hyperscript helper, toast, formatters
  audio/           sound.ts: synthesized SFX + music (Web Audio, unlocks on first gesture); tuning.ts: pure note/limiter/track data
  state/save.ts    localStorage save (versioned), bond XP, unlocks, ?dev flag
  main.ts          Boot, DPR-aware resize, app flow (home ↔ battle ↔ results), match XP awards
  style.css        All styling; orientation handled with aspect-ratio media queries
scripts/           balance-sim.ts, smoke.ts, art-import.ts + art-check.ts (the art gate; chroma.ts keying, artSpec.ts file spec, browser.ts), make-icons.ts (PWA icons), session-start.sh,
                   faces.py (measures face positions -> src/data/faces.ts), upscale.py (big copies of portraits -> public/art/<id>/hd/, D-037)
public/sw.js       Service worker (installable PWA, offline); public/manifest.webmanifest
tests/             data, sim, chibi, camera and audio tests
public/art/<id>/   Heroine art (portrait.webp, portrait-<mood>.webp, gallery-<n>.webp; hd/: big copies of the portraits)
public/art/scenes/ Painted backdrops: one per chat scene + menu (SCENE_FILES in progression.ts)
docs/              GDD, ARCHITECTURE, UI_STYLE, VN_DIRECTION (+ vn/ mock of the story screen), LORE, ART_DIRECTION, ART_GUIDE, STATUS, BACKLOG, DECISIONS
public/fonts/      Self-hosted Cinzel + Barlow Semi Condensed (OFL)
```

## 6. Common tasks — recipes

**Add a heroine:** append a `HeroineDef` to `HEROINES` in `src/data/heroines.ts` (unique id, `age` ≥ 21, color/accent, cost, `baseStats({...})`, three paths). Add ≥1 episode at `level: 1` in `dialogues.ts`. Gallery slots are generated automatically. Keyboard shortcut = her index + 1. Run `npm test` (data tests catch most mistakes) and `npm run sim -- <id> scarlet` to sanity-check strength.

**Add an upgrade tier / new stat:** add the field to `Stats` in `types.ts`, default in `baseStats()`, implement it in `BattleSim` (usually `damage()` or `updateTowers()`), then use it in an upgrade's `apply`. Add a test in `tests/sim.test.ts`.

**Add an enemy:** add to `ENEMIES` (children must exist; `armored` = immune to physical; `boss` uses `hp` and a HP bar). Use it in `WAVES`. Rendering is generic (color/radius).

**Tune difficulty:** edit `WAVES` in `maps.ts`, enemy `speed`/`hp`, or economy constants in `BattleSim.endWave()`/`pop()`. Target: `npm run sim` (a naive bot buying cheapest upgrades) should reach wave ~18–20 and lose narrowly; a thinking player wins.

**Write a chat:** read `docs/LORE.md` (canon) and `docs/VN_DIRECTION.md` (the standard for a heroine and a scene, sections 4–6, and the checklist in section 10) first. Write it with the notation in `src/data/script.ts` (see `src/data/kaede.ts`): lines in reading order, `ask()` for a decision whose branches rejoin, `cast('yuki')` for a second voice, `cg()` to show one of her gallery pictures, `at()` to move the scene, `far()` / `close()` to move the camera for a line (without them her mood decides: a blush comes close). The older episodes in `dialogues.ts` use `her()/nar()/pick()/end()` with hand-written ids; a route moves to its own file when it is rewritten. Main-story chapters go in `src/data/story.ts`. The owner reads the story in the game, not as a draft: do not paste plot or lines into your replies. Two choices per decision; `affection` 10 (meh) – 30 (she loves it). Moods must be one of `MOODS` in `src/data/progression.ts`: smile, laugh, tease, wink, blush, shy, pout, angry, sad. Each is a whole pose of hers, so pick the one whose body language fits the line, give every line of hers a mood (a line without one falls back to `smile` and she snaps back to that pose), and only use a mood she has art for (`public/art/<id>/portrait-<mood>.webp`; a test fails otherwise). Tests verify links, reachability and endings.

**Write a lobby line** (what she says when tapped on the home screen): add it to `IDLE_LINES` in `src/data/lore.ts` with the Bond `level` that unlocks it and a `mood`. She takes that pose while the line shows. Only the everyday moods are allowed there (`LOBBY_MOODS`: smile, tease, wink, pout); the other five stay a surprise for her chats (a test enforces it).

**Add art:** drop files into `public/art/<id>/` using the names in `docs/ART_GUIDE.md` §2. No code change. For a new or replaced portrait also run `python scripts/faces.py` and paste its output into `src/data/faces.ts` (close-ups are framed on her face), and if she is in `HD_PORTRAITS` remake her big copy with `scripts/upscale.py` (a test fails without it). If the owner uploaded PNG/JPG ("import the new art"), run `npm run art`, fix anything it lists, then `npm run smoke` and check the screenshots. Art is not done until it passes the art gate (`docs/ART_QA.md`): `npm run art:check` green, the review sheets looked at (count fingers on every hand), and the owner's sign-off recorded in the ART_QA status table.

**Add a new screen:** add a `showX()` in `ui/screens.ts` that builds DOM with `h()` and calls `show()`. Style in `style.css` with a portrait and a short-landscape variant.

## 7. Rules

- `src/data/**` and `src/game/sim/**` must never import Phaser or touch `window`/`document`/`localStorage`. They run in Node (tests, sim bot).
- Imports use explicit `.ts` extensions (Node strip-types needs them).
- Sim units: tiles and seconds. Colors: `0xRRGGBB` numbers. The sim must stay deterministic (no `Math.random()` in `sim/`; if you need randomness, add a seeded RNG).
- Only `src/state/save.ts` touches `localStorage`. If you change the save shape, keep `load()` backward compatible or bump `version` with a migration.
- UI must work in portrait and landscape, touch and mouse, from a phone to a 2560×1440 monitor. Tap targets ≥ 40px. Test with `npm run smoke` and look at the phone, tablet and big-desktop screenshots.
- Never hard-require an art file to exist; always go through `artImg()` / `artChain()`.
- **Any generated image that needs a transparent background (portraits, moods, chibis, cut-out props) is requested transparent from the image generator**: tell it to use its image tool with `transparent_background` set to true (`docs/ART_GUIDE.md` §9). Don't generate on a green screen and key it out: keyed edges keep a coloured outline in the hair. The green screen is only the fallback for a tool without that switch. This is for new images: pictures the owner already approved (the base portraits) are not regenerated to get transparency, because a regenerated copy redraws hands, feet and skin tone (D-029).
- Phaser 4 (not 3). Its API docs for agents ship inside the package: `node_modules/phaser/skills/<topic>/SKILL.md` (see `v3-to-v4-migration` before using v3 examples from the web).
- Keep dependencies minimal; ask the owner before adding a framework.
- **Content policy:** all characters are adults (age stated in data, ≥ 21). Tone and art are suggestive fan service — flirty, teasing, revealing outfits — never nudity or explicit sexual content. This keeps the game hostable and within what image generators produce.

## 8. Definition of done

- `npm run check` green; `npm run smoke` green for UI work, and you looked at the screenshots.
- New logic has a unit test; new content passes the data tests.
- Works on a phone (390×844 and 844×390), a tablet (820×1180), a laptop (1280×720) and a big desktop (2560×1440): the smoke test passes on all five and you looked at the phone, tablet and big-desktop screenshots of what you changed.
- STATUS/BACKLOG updated, committed, pushed to `main` (CI deploys it).

## 9. Environment notes

- Node ≥ 22.6 (`.nvmrc`). No backend; static hosting only.
- Cloud agent sandboxes often block arbitrary outbound HTTP (Google Fonts, github.io, browser downloads). That's expected — fonts fall back, and the smoke test uses the npm-bundled Chromium.
- GitHub Pages serves the `gh-pages` branch; don't commit to it by hand — `.github/workflows/deploy.yml` owns it.
- `git push` runs `.githooks/pre-push` (installed by `npm install`): `npm run check` + `npm run smoke` on the pushed commit (~3 min; skipped for trees that already passed, Prettier only for docs-only pushes; `SKIP_SMOKE=1` skips the browser test). In cloud sandboxes give the push a long timeout.
- CI (`.github/workflows/ci.yml`) runs `npm run check` on branch pushes and adds `npm run smoke` on pull requests; the deploy runs `npm run check` only.
