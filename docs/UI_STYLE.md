# UI style guide: "Moonlit Noir"

The visual language for every screen. Read it before touching `src/style.css`, `src/ui/**` or the battlefield renderer. Goal: look like a current premium mobile gacha/TD game (_Arknights_, _Blue Archive_, _NIKKE_, _BTD6_), **not** a 2000s Flash game.

## What made it look like a Flash game (and the rule that replaces it)

| Before                                               | Rule now                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Rounded "bubble" font (Nunito), mixed fallbacks      | Two self-hosted fonts only: **Cinzel** (display) + **Barlow Semi Condensed** (UI, numbers). No third font.     |
| Emoji and Unicode glyphs as icons (♥ ◆ ❚❚ ☰ 🔒 ✕)   | One inline SVG icon set (`src/ui/icons.ts`), same stroke and grid everywhere. Emoji never appear in UI chrome. |
| Candy gradients everywhere (pink→violet, gold rings) | Dark neutral surfaces; **one** hot accent (rose) for the primary action; gold only for currency and ornaments. |
| Big rounded pills, thick colored borders             | Chamfered (cut-corner) buttons with 1 px hairline edges; small radii on panels; thin accent lines.             |
| Flat checkerboard map, neon-tube path, bare circles  | A painted scene: textured ground, cobbled path with edges, props, soft lighting and vignette; shaded enemies.  |
| Centered web-form card on the home screen            | Full-bleed key art of a featured heroine, logo lockup, side menu, like a gacha lobby.                          |

## Tokens (`:root` in `style.css`)

- Surfaces: `--ink-0` (deepest) → `--ink-3` (raised panel), `--glass` for translucent overlays over art or the map.
- Lines: `--hair` (default 1 px edge), `--hair-2` (hover and focus), `--gold-line` (ornamental rules under titles).
- Text: `--text`, `--text-2` (secondary), `--text-3` (disabled and hints).
- Accents: `--rose` (primary action, selection, "hot" state; use sparingly), `--gold` (currency, rewards, tier pips), `--danger`.
- Per heroine: components set `--c` (her color) and `--a` (her accent) inline; use them for her name, frame edge and glow, never as a large fill.
- Shape: `--cut` chamfer size; `--r` panel radius (6 px). Interactive elements are chamfered, containers are softly rounded.

## Typography

- **Cinzel 600/700:** logo, screen titles, heroine names, chat speaker plates, results headline. Title case, letter-spacing 0.02–0.04em.
- **Barlow Semi Condensed 400–700:** everything else. Button labels and section labels are UPPERCASE, 600, letter-spacing 0.06–0.1em. Numbers use `font-variant-numeric: tabular-nums`.
- Sizes: 12 / 13 / 15 / 17 / 20 / 28 / 44 px. Don't invent in-between sizes.

## Components

- `.btn`: chamfered; the edge is drawn by the element and the fill by `::before` (so the cut corners keep their border). Variants: `primary` (rose), default (glass), `ghost`, `danger`, `icon` (square, SVG only, needs `title` → aria-label).
- `.panel`: glass fill, hairline edge, a faint top highlight.
- Counters (lives, gold, wave): icon + tabular number in a dark chip.
- Section labels: small uppercase label with a short gold rule.
- Motion: see **Motion** below. Never re-render a screen for an in-screen change (update nodes in place, D-016).

## Motion (`src/ui/motion.ts` + the "motion" block at the end of `style.css`)

- Easing tokens: `--ease` (settle, most things), `--spring` (slight overshoot: pops, modals, badges), `--out` (exits). Micro-interactions 120–200 ms, entrances 350–450 ms, exits ~300 ms (exits are faster than entrances).
- Navigation is directional: `show()` slides the new screen in from the right and the old one out to the left; back buttons (`topbar`, or call `goingBack()` first) reverse it. The lobby "dives" (scale up + fade) into a destination and "surfaces" on return. The outgoing screen stays briefly as `.leaving` (inert, `aria-hidden`, titles stripped).
- Lists enter with `stagger(el)` (45 ms per item, capped at 14); add `pop` to the container for cards (spring scale) or `from-left` for rows. Card grids that are tappable art get `tilt(el)` (3D tilt + glare on mouse only).
- Menu ↔ battle goes through `wipe(mid, label, kicker)`; the arena name shows on the wipe. Battle: wave/boss banners over the stage, gold counts toward its value, shop cards flash when they become affordable, the dock panel slides in on change, heroines drop in when placed and pop on upgrade (`towerPresence()` in `chibiPose.ts`).
- Ambient motion is slow (≥ 3 s loops): moon glow, bond-bar shine, Battle-button glow, lobby particles per heroine, pointer/tilt parallax via `data-depth`.
- Reduced motion (Settings toggle or OS) sets `body.calm`: all CSS animation/transition collapses, `calm()` short-circuits every helper. Always check it before adding a JS-driven animation.

## Battlefield

- Everything is drawn by `BattleScene` (canvas). The static scene (ground, path, props, vignette) is painted once per map/orientation into a texture (`src/game/mapArt.ts`); per-frame drawing is only for live things (enemies, projectiles, fx, fireflies, lantern flicker).
- Effects scale with the upgrade path via `lookFor()` (`src/game/vfxLook.ts`): tier 0 is deliberately modest, each path shifts colour and adds its own detail, tier 3 adds a signature. Keep additive layers from saturating to white (use the deeper `body`/`rim` colours for bulk, `core` only for small centres). Check with `npm run fx`.
- Readability first: enemies must pop against the ground (lighter, saturated bodies with dark outlines); the path must read instantly; props never sit on the path.

## Checklist before shipping UI

1. Smoke screenshots at all three viewports; nothing clipped, no overlap, tap targets ≥ 40 px.
2. No emoji or Unicode symbols used as icons in UI chrome.
3. Only the two fonts; numbers are tabular.
4. At most one rose "primary" per view.
