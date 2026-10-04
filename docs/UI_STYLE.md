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

## Backdrops

No screen is a flat dark fill: each sits on a painted backdrop (`public/art/scenes`), kept **faint** so the heroine and the text stay the subject.

- Chats (the story screen): the scene's painting at full brightness, no veil (`--dim` 0), with only a light grade at the top and bottom (`.scene-c`); the canvas particles stay. This is the one screen where the painting is not faint (D-033).
- Lobby and Bond screen: the featured heroine's own place (`HOME_SCENE`) under `--dim` ~0.42 with a wash of her colour; the lobby crossfades it when she changes.
- Title: the shrine courtyard (`menu`). Menu screens (lists, profile, results): the same courtyard, or her place on the profile, under `--veil` (76–88 % ink), so it reads as texture, not as a picture.
- A screen with a backdrop uses `backdrop(name)` (`src/ui/common.ts`) for fixed layouts or the `--scene` variable for scrolling ones. Art stays optional: without the file the old CSS-painted scene shows.
- On menus, don't raise the brightness to show a painting off. If text loses contrast on a phone, raise `--dim`/`--veil`.

The story screen (chats and story chapters) is the exception to the dark look: bright picture, no dark panels, colour from the speaker. Its target is `docs/VN_DIRECTION.md` section 7, with mock-ups in `docs/vn/`; the look is built (the chat block of `style.css`, sized in `--u` = 1 px on a 1080p-high landscape screen). It shares the fonts, gold hairlines and diamonds with the rest. Text there sits on the picture, so it is white with a dark edge, and nothing may cover her face.

## Typography

- **Cinzel 600/700:** logo, screen titles, heroine names, the story screen's speaker name and ribbon title, results headline. Title case, letter-spacing 0.02–0.04em.
- **Barlow Semi Condensed 400–700:** everything else. Button labels and section labels are UPPERCASE, 600, letter-spacing 0.06–0.1em. Numbers use `font-variant-numeric: tabular-nums`.
- Sizes: 12 / 13 / 15 / 17 / 20 / 28 / 44 px. Don't invent in-between sizes.

## Components

- `.btn`: chamfered; the edge is drawn by the element and the fill by `::before` (so the cut corners keep their border). Variants: `primary` (rose), default (glass), `ghost`, `danger`, `icon` (square, SVG only, needs `title` → aria-label).
- `.panel`: glass fill, hairline edge, a faint top highlight.
- Counters (lives, gold, wave): icon + tabular number in a dark chip.
- Section labels: small uppercase label with a short gold rule.
- Motion: see **Motion** below. Never re-render a screen for an in-screen change (update nodes in place, D-016).

- **Guide prompt** (`.guide`, the first battle): a small dark card with a gold left edge at the bottom of the battlefield (top when her panel is at the bottom), sized from the screen (`clamp(15px, 1.55vmin, 26px)`), never over her panel or the zoom buttons. It lets taps through; only Skip is a button. What it talks about is marked with a pulsing gold frame laid over the control (`.guide-lights`), because `clip-path` buttons cut their own outlines off.

## Motion (`src/ui/motion.ts` + the "motion" block at the end of `style.css`)

- Easing tokens: `--ease` (settle, most things), `--spring` (slight overshoot: pops, modals, badges), `--out` (exits). Micro-interactions 120–200 ms, entrances 350–450 ms, exits ~300 ms (exits are faster than entrances).
- Navigation is directional: `show()` slides the new screen in from the right and the old one out to the left; back buttons (`topbar`, or call `goingBack()` first) reverse it. The lobby "dives" (scale up + fade) into a destination and "surfaces" on return. The outgoing screen stays briefly as `.leaving` (inert, `aria-hidden`, titles stripped).
- Lists enter with `stagger(el)` (45 ms per item, capped at 14); add `pop` to the container for cards (spring scale) or `from-left` for rows. Card grids that are tappable art get `tilt(el)` (3D tilt + glare on mouse only).
- Menu ↔ battle goes through `wipe(mid, label, kicker)`; the arena name shows on the wipe. Battle: wave/boss banners over the stage, gold counts toward its value, shop cards flash when they become affordable, the dock panel slides in on change, heroines drop in when placed and pop on upgrade (`towerPresence()` in `chibiPose.ts`).
- Ambient motion is slow (≥ 3 s loops): moon glow, bond-bar shine, Battle-button glow, lobby particles per heroine, pointer/tilt parallax via `data-depth`.
- Reduced motion (Settings toggle or OS) sets `body.calm`: all CSS animation/transition collapses, `calm()` short-circuits every helper. Always check it before adding a JS-driven animation.

## Screen sizes

The game is played on a phone, a tablet and a desktop monitor, so every screen is designed for three shapes and checked on five sizes (`npm run smoke`): phone 390×844 and 844×390, tablet 820×1180, laptop 1280×720, big desktop 2560×1440.

- Portrait and landscape are split with `aspect-ratio` media queries; `max-height: 520px` in landscape means a phone on its side.
- A wide screen is not a stretched phone: don't leave a small card floating in a corner of a 1440p monitor. Use the height (a full-height column, a list that was a sheet on the phone) and scale type and spacing with the screen.
- The Bond screen is the model (`style.css`, "her bond screen", D-031): portrait keeps a card at the bottom; landscape gets a full-height column on the right with a heroine picker, what Bond gives, her favourite gifts and, from 1000×780, her episodes listed in place. Everything in that column is sized in `--u` (1px, then 1.15 / 1.3 / 1.5 px from 1000 / 1200 / 1400 px of height).
- Known gap: the other menu screens still use fixed pixel sizes and look small at 2560×1440 (BACKLOG B-21).

## Battlefield

- Everything is drawn by `BattleScene` (canvas). The static scene (ground, path, props, vignette) is painted once per map/orientation into a texture (`src/game/mapArt.ts`); per-frame drawing is only for live things (enemies, projectiles, fx, fireflies, lantern flicker).
- Effects scale with the upgrade path via `lookFor()` (`src/game/vfxLook.ts`): tier 0 is deliberately modest, each path shifts colour and adds its own detail, tier 3 adds a signature. Keep additive layers from saturating to white (use the deeper `body`/`rim` colours for bulk, `core` only for small centres). Check with `npm run fx`.
- Readability first: enemies must pop against the ground (lighter, saturated bodies with dark outlines); the path must read instantly; props never sit on the path.

## Checklist before shipping UI

1. Smoke screenshots on a phone, a tablet and a big desktop (`phone-portrait`, `tablet`, `desktop-large`), plus the other two when the layout changed; nothing clipped, no overlap, nothing tiny on the monitor, tap targets ≥ 40 px.
2. No emoji or Unicode symbols used as icons in UI chrome.
3. Only the two fonts; numbers are tabular.
4. At most one rose "primary" per view.
