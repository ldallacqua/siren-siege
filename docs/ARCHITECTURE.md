# Architecture

## Layers

```
            ┌───────────────────────── browser ─────────────────────────┐
            │                                                            │
 input ───▶ │  BattleScene (Phaser)        Hud / screens (DOM)           │
            │   draws + maps pointer        sidebar, dock, menus, chat   │
            │        │   ▲                        │   ▲                  │
            │        ▼   │ reads state            ▼   │ subscribe()      │
            │  ┌────────────── Battle (one match) ──────────────┐        │
            │  │ placing · ghost · selected · speed · paused     │        │
            │  │ tick(dt) → fixed-step BattleSim.step(1/60)      │        │
            │  └─────────────────────┬───────────────────────────┘        │
            │                        ▼                                    │
            │  BattleSim (pure TS) ◀── data/ (heroines, enemies, waves)   │
            │                                                            │
            │  save.ts ◀──▶ localStorage     main.ts: app flow + XP      │
            └────────────────────────────────────────────────────────────┘
```

- **data/** and **game/sim/** are framework-free and deterministic → they run in Node for `npm test` and `npm run sim`.
- **Battle** is the only object both the canvas and the DOM know about. The scene calls `battle.tick(dt)` from Phaser's update loop.
- **main.ts** wires everything: creates the Phaser game, the Hud, starts/ends battles, awards Bond XP, records best wave (which drives unlocks).

## Simulation step (`BattleSim.step`)

Order each 1/60 s tick:

1. Recompute ally buffs if towers changed (`buffsDirty`) — support auras (Selene) multiply `rate`/`range` and can grant `armorPierce` into each tower's `eff` stats.
2. Spawn due enemies from the wave's spawn queue.
3. Move enemies along the path (burn DoT ticks, stun = 0 speed, slow multiplies speed). Reaching the end = leak: lose lives = remaining RBE.
4. Towers attack when cooldown ≤ 0: `pulse` hits all in range (up to pierce); `bolt`/`bomb` fire projectiles with target leading; `none` = support only.
5. Projectiles move and collide. Bolts hit up to `pierce` enemies; bombs explode (splash radius, up to `pierce` victims).
6. Wave ends when spawn queue and enemies are empty → bonus cash + income, auto-start next if enabled, `won` after the last wave.

**Damage** (`damage()`): armored + physical without armorPierce → blocked. Status effects apply first (slow/stun/burn/vuln). Each damage point pops a layer; overflow carries into the first child; children are added to the projectile's hit set so a single bullet can't pop the same bloon chain repeatedly (BTD behavior). Bosses have HP and use `bossMult`.

**Stats pipeline:** `def.base` → apply each purchased tier in path order → bond bonus (`computeStats`) → ally buffs (`eff`). Upgrades are functions that mutate a `Stats` copy, so new mechanics = new `Stats` fields.

## Rendering (`BattleScene`)

- Phaser runs in `Scale.NONE`; `main.ts` resizes the canvas to `stage CSS size × devicePixelRatio` (cap 2) and sets zoom `1/dpr` → sharp on retina, CSS-pixel layout.
- Map layout: `tile = min(W/cols, H/rows)`, centered. **Portrait** (`H > W × 1.05`) transposes coordinates: `screen = (oy + x·tile, ox + y·tile)` swapped. The sim never knows about orientation; rotating mid-game just re-lays out.
- Background (ground, path) drawn once per layout into one `Graphics`; everything dynamic (enemies, projectiles, towers, fx, ghost, ranges) redrawn every frame into a second `Graphics`. Tower letters are `Text` objects keyed by tower uid.
- Visual effects: the sim pushes `Fx` events (`pulse`, `boom`, `pop`, `leak`, `block`); the scene drains them each frame and animates them with its own lifetimes.

## UI (`ui/`)

- DOM built with the tiny `h()` helper; no framework.
- **Hud** rebuilds its DOM only when a _structure key_ changes (placing, selection + tiers + targeting, wave active, speed, auto, pause, result). Frequent changes (cash, lives, wave number, button affordability) update existing nodes in `update()` — this avoids destroying buttons mid-tap.
- **screens.ts** renders full-screen overlays into `#screens`. Only one screen at a time; `closeScreens()` returns to the battle.
- Orientation-specific layout is pure CSS (`@media (min-aspect-ratio: 1/1)` / `(max-aspect-ratio: 1/1)` / short landscape `max-height: 520px`).

## Save format (`state/save.ts`)

```ts
{ version: 1,
  heroines: { [id]: { xp: number, chatsDone: string[] } },
  bestWave: { [mapId]: number },   // drives heroine unlocks
  wins: number,
  settings: { autoStart: boolean, speed: number } }
```

`load()` merges stored data over a fresh default, so adding fields is backward compatible. Breaking changes: bump `version` and migrate inside `load()`.

## Assets

`artImg(file)` / `artChain([files])` try real files under `public/art/<id>/` and fall back to `placeholderArt()` (cached SVG data URIs in heroine colors). Nothing ever hard-fails on missing art.

## Deployment

- `.github/workflows/deploy.yml` (push to `main`): `npm ci` → build → sim → publish `dist/` to `gh-pages` with `peaceiris/actions-gh-pages`. Pages serves `gh-pages` (auto-enabled). Vite `base: './'` so the build works under `/siren-siege/`.
- `.github/workflows/ci.yml` (PRs and non-main branches): `npm run check` + `npm run smoke`, uploads smoke screenshots as an artifact.
