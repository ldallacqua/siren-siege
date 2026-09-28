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

## 2. Resume prompt (use this to start every new session — cloud or local)

The repo carries its own memory (`AGENTS.md`, `docs/STATUS.md`, `docs/BACKLOG.md`), so this short prompt is all a new AI session needs:

```text
Resume work on Siren Siege (GitHub: ldallacqua/siren-siege).
Follow the resume protocol in AGENTS.md: read AGENTS.md, docs/STATUS.md and docs/BACKLOG.md,
run npm ci and npm run check, then work on <the top unblocked BACKLOG item | TASK DESCRIPTION>.
Tell me your plan in 3-5 bullets before big changes. Finish with the handoff protocol
(AGENTS.md section 3): check + smoke green, STATUS/BACKLOG updated, committed and pushed to main.
```

**From your phone:** open the Claude app → **Code** tab (or claude.ai/code), pick the `ldallacqua/siren-siege` repository, paste the prompt above. The cloud session installs dependencies automatically, and every push to `main` redeploys the live game.

### Ready-made task lines (or just say "the top BACKLOG item")

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
