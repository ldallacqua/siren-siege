# AI prompts for building Siren Siege

Three prompts, depending on what you need. Paste them into Claude (claude.ai with code execution, or Claude Code pointed at this repo).

---

## 1. Master prompt — build the game from zero

Use this if you ever want to regenerate the project from scratch, or give the whole vision to a new AI session.

```text
You are a senior game developer. Build "Siren Siege", a browser tower defense game where the
towers are alluring adult anime heroines. Deliver a working, deployable project, not a plan.

## Concept
- Tower defense modeled on Bloons TD 6: enemies follow a fixed path; you place heroines beside it;
  each heroine attacks automatically; enemies are layered (popping one layer reveals a weaker
  one); cash per pop and per wave; lives lost on leaks; 20 waves per map with a boss.
- Every heroine has cost, stats, an attack style, a damage type (physical/magic) and THREE upgrade
  paths with tiers. Crosspathing follows BTD6: at most two paths upgraded, only one beyond tier 2.
- Targeting priorities (First/Last/Strong/Close), sell for 70%, 1x/2x/3x speed, auto-start, pause.
- Meta progression "Bond": fielding a heroine earns her Bond XP (pops, wave reached, win bonus).
  Bond levels 1–10 unlock (a) branching chats and (b) gallery pictures, and give a small stat bonus.
- Chats: visual-novel style, big portrait with moods, text box, the player picks between 2
  options; options award affection XP; each heroine has her own voice.
- Gallery: pictures unlock at Bond 2/4/6/8/10; lightbox viewer; locked tiles show the requirement.
- Tone: flirty, teasing, suggestive fan service. All characters are adults (24+), stated in data.
  Never nudity or explicit content.

## MVP scope
- 1 map (20x12 tiles, snaking path), 20 hand-tuned waves.
- 4 heroines: vampire gunslinger (single-target DPS, armor-pierce path), snow witch (slow/freeze
  pulse AoE), oni flame dancer (splash bombs, burn, boss damage), moon priestess (support aura,
  income, optional arrows). 3 paths x 3 tiers each.
- Enemies: 5 layered types, 1 armored type immune to physical, 1 boss with HP bar.
- 2 chats per heroine, 5 gallery slots per heroine with generated placeholder art that is
  automatically replaced when real files exist at public/art/<id>/*.webp.
- Save to localStorage. Dev mode via ?dev (everything unlocked, lots of gold).

## Tech requirements
- Phaser 4 + TypeScript (strict) + Vite. UI (HUD, shop, upgrade panel, menus, chat, gallery) in
  DOM/CSS layered over the canvas; the battlefield in Phaser.
- Keep the simulation framework-free (no Phaser/DOM imports) with a fixed 60 Hz step so it can run
  in Node. Add a headless balance bot script (npm run sim) that plays the map and reports the wave
  reached; use it to tune waves.
- Must work great on mobile and desktop, in portrait AND landscape:
  landscape = map left + sidebar right; portrait = map top + dock bottom, and the map is transposed
  (x<->y) in portrait so it fills a tall screen. Render at devicePixelRatio (cap 2).
  Touch: tap/drag to position a placement ghost, tap again or press Place to confirm.
  Mouse: ghost follows cursor, click to place. Keyboard shortcuts on desktop.
- Deploy to GitHub Pages with a GitHub Actions workflow on push to main (vite base './').
- Docs: README, docs/GDD.md (vision, MVP vs v1 scope, systems, milestones),
  docs/ART_DIRECTION.md (style guide, asset specs, image-generation prompt template per heroine).

## Process
1. Scaffold, then build the sim + data first, then rendering, then UI, then meta screens.
2. Type-check and build. Run the balance bot. Test in a headless browser at 1280x720,
   390x844 (touch) and 844x390 (touch), screenshot each, fix layout bugs.
3. Commit in small logical commits and push. Report the live URL.
```

---

## 2. Continue-development prompt (use in every new session on this repo)

```text
You're working on Siren Siege (repo: ldallacqua/siren-siege), a Phaser 4 + TypeScript + Vite
browser tower defense where the towers are adult anime heroines, modeled on Bloons TD 6, with a
Bond / chat / gallery layer. Read CLAUDE.md, docs/GDD.md and docs/ART_DIRECTION.md first.

Rules:
- Keep src/game/sim and src/data free of Phaser and DOM imports.
- Every change must keep `npm run build` green and `npm run sim` winnable-but-not-trivial.
- Test in portrait and landscape, mouse and touch, before calling anything done.
- Content stays suggestive, never explicit; all characters are adults.
- Small commits with clear messages; push to main (Pages deploys automatically).

Today's task: <DESCRIBE THE TASK, e.g. "Milestone M2 — Juice: add sound effects, music,
pop particles, floating damage text and a screen shake when a boss spawns">.

Start by telling me your plan in 3–5 bullets, then implement it.
```

### Ready-made task lines for the prompt above

- **M1 art hookup:** "Add chibi map sprites: load public/art/<id>/chibi.webp if present and draw it instead of the colored circle, with a subtle idle bob and a recoil when she attacks."
- **M2 juice:** "Add Web Audio SFX (pop, shot, bomb, freeze, upgrade, wave start), a looping music track per map with a mute toggle, pop particles and floating '+$' text."
- **M3 depth:** "Add tiers 4 and 5 to every path (BTD6 rule: 5-2-0 max), plus camo enemies that only heroines with detection can target, and give Scarlet's Night Sight tier 2 camo detection."
- **M3 abilities:** "Add a hero ability per heroine unlocked at Bond 5: a button in her panel with a cooldown (e.g. Scarlet 'Blood Moon' — 5s of triple fire rate)."
- **M4 content:** "Add heroine #5: a kunoichi (ninja), camo detection, fast shuriken with high pierce; write 2 chats and register 5 gallery slots. Follow the data format in src/data."
- **New map:** "Add map 2 'Neon Harbor' with two entrances that merge, 25 waves, and a map-select screen."
- **Launch prep:** "Add an 18+ age gate on first launch, PWA offline support with a service worker, and a credits screen."

---

## 3. Art prompt

See `docs/ART_DIRECTION.md` for the full template and character sheets. Short version:

```text
masterpiece, best quality, anime key visual, gacha game splash art, 1 adult woman,
<age>-year-old <character sheet>, <pose>, <expression>, thighs-up portrait, alluring,
confident, tasteful fan service, form-fitting outfit, cel shading, rim light,
<color>-dominant palette, moonlit night, transparent background, aspect ratio 3:4
Negative: child, loli, young-looking, nsfw, nude, explicit, lowres, bad hands, text, watermark
```

Save as `public/art/<heroine>/portrait.webp` (and `portrait-<mood>.webp`, `gallery-<n>.webp`), commit, push — the game uses them automatically.
