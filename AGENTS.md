# AGENTS.md — start here

This file is the single source of truth for any AI coding agent (Claude Code, Codex, Cursor, Copilot, Gemini, Jules, Aider…) working on this repo. Tool-specific files (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/`) only point here.

## 1. What this project is

**Siren Siege** — a browser tower defense game (modeled on _Bloons TD 6_) where the towers are alluring adult anime heroines. Fielding a heroine raises her **Bond**; Bond unlocks branching **chats** and **gallery** art. Runs on desktop and mobile, portrait and landscape.

- Live: https://ldallacqua.github.io/siren-siege/ (served from the `gh-pages` branch, deployed by CI on every push to `main`)
- Owner: Lucas (ldallacqua). Talks to agents in English or Portuguese.
- Design: `docs/GDD.md` · Architecture: `docs/ARCHITECTURE.md` · **UI look: `docs/UI_STYLE.md` (read before any UI/CSS/battlefield change)** · **Story canon: `docs/LORE.md` (read before writing chats, bios or enemies)** · Art: `docs/ART_DIRECTION.md` (style) + `docs/ART_GUIDE.md` (owner's ChatGPT workflow, file names)

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

| Command          | What it does                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run dev`    | Dev server on :5173. Open `/?dev` for dev mode (all unlocked, 20k gold, `window.siren` debug hook)     |
| `npm run check`  | **The gate.** Prettier check + typecheck (app and node) + unit tests + balance sim + production build  |
| `npm test`       | Vitest unit tests (`tests/`): data integrity + simulation behavior                                     |
| `npm run sim`    | Headless balance bot plays all 20 waves and prints per-wave lives/cash (`npm run sim -- scarlet yuki`) |
| `npm run smoke`  | Build + real-browser test at 1280×720, 390×844 touch, 844×390 touch; screenshots → `artifacts/smoke/`  |
| `npm run format` | Prettier write                                                                                         |
| `npm run art`    | Convert PNG/JPG in `public/art/<id>/` to correctly sized WebP, delete sources, list misnamed files     |
| `npm run build`  | Typecheck + Vite build to `dist/`                                                                      |

**Look at the smoke screenshots** (`artifacts/smoke/*.png`) after UI changes — that's how you "see" the game. The smoke test finds Chromium via `$CHROME_PATH`, then `@sparticuz/chromium` (bundled via npm, works in sandboxed/cloud Linux where browser downloads are blocked), then Playwright's own (`npx playwright-core install chromium` on macOS/Windows).

## 5. Code map

```
src/
  data/            PURE DATA, no Phaser/DOM. Content lives here.
    types.ts         All shared types (Stats, HeroineDef, EnemyDef, Wave, ChatEpisode…)
    heroines.ts      Roster, base stats, 3 upgrade paths × tiers (apply() mutates Stats)
    enemies.ts       Layered enemies, rbe() = total layers
    maps.ts          Maps (path, palette, blurb, difficulty, unlock) + WAVES
    dialogues.ts     Chat episodes (node graph, Bond 1/3/5/7/9 per heroine) + PROLOGUE
    lore.ts          Codex entries, bestiary text, per-heroine story entries unlocked by Bond
    progression.ts   Bond XP thresholds, gallery slots, art file naming
  game/
    sim/             PURE LOGIC, no Phaser/DOM. Deterministic, fixed 60 Hz.
      BattleSim.ts     Spawning, movement, targeting, projectiles, damage/pop, economy, waves
      upgrades.ts      computeStats(), BTD6 crosspath rule canBuyUpgrade(), sell value
      path.ts          Polyline distance lookup
    Vfx.ts           Battle particles/rings/decals/trails/hit flashes, per-heroine styles scaled by tier
    mapArt.ts        Paints a map's static scenery (ground, path, props, lighting) once into a canvas texture
    camera.ts        Pure zoom/pan math (fit, zoomAt, panBy, clamping) for the battlefield
    chibiPose.ts     Pure bob/recoil/facing math for chibi sprites
    Battle.ts        One match: sim + interaction state (placing, selected, speed, pause), change events
    BattleScene.ts   Phaser scene: draws a Battle, maps pointer input (tap, drag-pan, pinch, wheel); transposes map in portrait
  ui/                DOM UI over the canvas
    Hud.ts           Sidebar (landscape) / dock (portrait): stats, controls, shop, placing, upgrade panel
    screens.ts       Home, roster, profile, codex, gallery, results, pause, options, settings
    chat.ts          Visual-novel chat player (scenes, ambient canvas, voice blips, log/auto/skip, end card)
    common.ts        show(), artChain(), bondBar(), topbar() shared by screens
    art.ts           Loads public/art files, falls back to generated SVG placeholders; lightbox
    icons.ts         Inline SVG icon set (use this, never emoji/unicode glyphs in UI chrome)
    dom.ts           h() hyperscript helper, toast, formatters
  audio/           sound.ts: synthesized SFX + music (Web Audio, unlocks on first gesture); tuning.ts: pure note/limiter/track data
  state/save.ts    localStorage save (versioned), bond XP, unlocks, ?dev flag
  main.ts          Boot, DPR-aware resize, app flow (home ↔ battle ↔ results), match XP awards
  style.css        All styling; orientation handled with aspect-ratio media queries
scripts/           balance-sim.ts, smoke.ts, art-import.ts, session-start.sh
tests/             data, sim, chibi, camera and audio tests
public/art/<id>/   Heroine art (portrait.webp, portrait-<mood>.webp, gallery-<n>.webp)
docs/              GDD, ARCHITECTURE, UI_STYLE, ART_DIRECTION, ART_GUIDE, STATUS, BACKLOG, DECISIONS
public/fonts/      Self-hosted Cinzel + Barlow Semi Condensed (OFL)
```

## 6. Common tasks — recipes

**Add a heroine:** append a `HeroineDef` to `HEROINES` in `src/data/heroines.ts` (unique id, `age` ≥ 21, color/accent, cost, `baseStats({...})`, three paths). Add ≥1 episode at `level: 1` in `dialogues.ts`. Gallery slots are generated automatically. Keyboard shortcut = her index + 1. Run `npm test` (data tests catch most mistakes) and `npm run sim -- <id> scarlet` to sanity-check strength.

**Add an upgrade tier / new stat:** add the field to `Stats` in `types.ts`, default in `baseStats()`, implement it in `BattleSim` (usually `damage()` or `updateTowers()`), then use it in an upgrade's `apply`. Add a test in `tests/sim.test.ts`.

**Add an enemy:** add to `ENEMIES` (children must exist; `armored` = immune to physical; `boss` uses `hp` and a HP bar). Use it in `WAVES`. Rendering is generic (color/radius).

**Tune difficulty:** edit `WAVES` in `maps.ts`, enemy `speed`/`hp`, or economy constants in `BattleSim.endWave()`/`pop()`. Target: `npm run sim` (a naive bot buying cheapest upgrades) should reach wave ~18–20 and lose narrowly; a thinking player wins.

**Write a chat:** read `docs/LORE.md` first. Add a `ChatEpisode` (with a `scene`) to `EPISODES` using the `her()/nar()/pick()/you()/end()` helpers. Two choices per decision; `affection` 10 (meh) – 30 (she loves it). Moods must be one of: smile, tease, smirk, wink, laugh, blush, shy, pout, grin. Tests verify links, reachability and endings.

**Add art:** drop files into `public/art/<id>/` using the names in `docs/ART_GUIDE.md` §2. No code change. If the owner uploaded PNG/JPG ("import the new art"), run `npm run art`, fix anything it lists, then `npm run smoke` and check the screenshots.

**Add a new screen:** add a `showX()` in `ui/screens.ts` that builds DOM with `h()` and calls `show()`. Style in `style.css` with a portrait and a short-landscape variant.

## 7. Rules

- `src/data/**` and `src/game/sim/**` must never import Phaser or touch `window`/`document`/`localStorage`. They run in Node (tests, sim bot).
- Imports use explicit `.ts` extensions (Node strip-types needs them).
- Sim units: tiles and seconds. Colors: `0xRRGGBB` numbers. The sim must stay deterministic (no `Math.random()` in `sim/`; if you need randomness, add a seeded RNG).
- Only `src/state/save.ts` touches `localStorage`. If you change the save shape, keep `load()` backward compatible or bump `version` with a migration.
- UI must work in portrait and landscape, touch and mouse. Tap targets ≥ 40px. Test with `npm run smoke`.
- Never hard-require an art file to exist; always go through `artImg()` / `artChain()`.
- Phaser 4 (not 3). Its API docs for agents ship inside the package: `node_modules/phaser/skills/<topic>/SKILL.md` (see `v3-to-v4-migration` before using v3 examples from the web).
- Keep dependencies minimal; ask the owner before adding a framework.
- **Content policy:** all characters are adults (age stated in data, ≥ 21). Tone and art are suggestive fan service — flirty, teasing, revealing outfits — never nudity or explicit sexual content. This keeps the game hostable and within what image generators produce.

## 8. Definition of done

- `npm run check` green; `npm run smoke` green for UI work, and you looked at the screenshots.
- New logic has a unit test; new content passes the data tests.
- Works at 1280×720, 390×844 and 844×390.
- STATUS/BACKLOG updated, committed, pushed to `main` (CI deploys it).

## 9. Environment notes

- Node ≥ 22.6 (`.nvmrc`). No backend; static hosting only.
- Cloud agent sandboxes often block arbitrary outbound HTTP (Google Fonts, github.io, browser downloads). That's expected — fonts fall back, and the smoke test uses the npm-bundled Chromium.
- GitHub Pages serves the `gh-pages` branch; don't commit to it by hand — `.github/workflows/deploy.yml` owns it.
- CI (`.github/workflows/ci.yml`) runs `npm run check` + `npm run smoke` on every PR and branch push.
