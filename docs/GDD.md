# Siren Siege — Game Design Document

> _Beauty is the last line of defense._

**Genre:** Tower defense (Bloons TD 6 model) + dating-sim bond layer
**Platform:** Web browser — desktop and mobile, portrait and landscape
**Rating target:** Suggestive / ecchi (Teen–Mature). Adults only as characters. No nudity or explicit content.
**Status:** v0.1 MVP vertical slice

---

## 1. Vision

A polished, fast tower defense where every tower is an alluring anime heroine with her own personality, upgrade tree and story. You defend the shrine with them, and between battles you get to know them. Fighting together raises **Bond**, Bond unlocks **chats** and **gallery art**, and higher Bond makes each heroine a little stronger. The TD has to be genuinely good on its own; the heroines are why you keep coming back.

### Pillars

1. **BTD6-grade tower defense** — layered enemies, 3 upgrade paths with crosspathing, targeting priorities, speed-up, readable chaos.
2. **Heroines, not turrets** — each one looks, plays and talks differently. Her kit matches her personality.
3. **Bond is the progression** — every match feeds affection; every level gives a reward you can _see_.
4. **Anywhere, any orientation** — a phone held upright on the bus and a 27" monitor both get a first-class layout.

### Core loop

```
Battle (place heroines, upgrade, survive waves)
   → earn Bond XP for every heroine you fielded
      → Bond level-ups unlock chats + gallery pictures + small stat bonus
         → chats award more Bond (good answers = more)
            → stronger heroines, new maps/heroines unlock → next battle
```

---

## 2. Scope

### MVP (v0.1 — this repository, playable now)

| System    | In MVP                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------ |
| Maps      | 1 — _Moonlit Shrine_, 20 waves                                                                   |
| Heroines  | 4 — Scarlet (single-target DPS), Yuki (slow/AoE pulse), Kaede (splash), Selene (support/economy) |
| Upgrades  | 3 paths × 3 tiers each, BTD6 crosspath rule (one path to 3, another to 2)                        |
| Enemies   | 5 layered types + armored Iron Husk + Blight Colossus boss                                       |
| Targeting | First / Last / Strong / Close                                                                    |
| Controls  | 1×/2×/3× speed, auto-start, pause, sell (70%)                                                    |
| Bond      | 10 levels, XP from pops + wave reached + win bonus; +2% attack rate per level                    |
| Chats     | 2 branching episodes per heroine (Bond 1 and 3), 2-choice dialogue, affection XP                 |
| Gallery   | 5 slots per heroine (Bond 2/4/6/8/10), lightbox viewer                                           |
| Unlocks   | Kaede at wave 10, Selene on first clear                                                          |
| Save      | localStorage                                                                                     |
| Layout    | Landscape sidebar / portrait bottom dock, map auto-rotates                                       |
| Deploy    | GitHub Pages via Actions                                                                         |
| Art       | Generated placeholders; drop-in real art by filename                                             |

### v1.0 — "Full release" target

- Tiers 4–5 on every path (BTD6 parity) with a visual change on tier 3+.
- 8 heroines (add: a kunoichi for camo detection, a mecha pilot for long range, a succubus for debuff/charm, a pirate captain for economy/boats).
- 4 maps (beginner/intermediate/advanced/expert) + Easy/Normal/Hard/Impoppable difficulties.
- Camo and Regrow enemy modifiers, 2 more bosses.
- Bond levels 1–10 fully written: 5 chat episodes + 5 gallery pieces per heroine.
- Heroine "hero ability" (active skill with cooldown) unlocked at Bond 5.
- Chibi sprites with idle/attack animations on the map; portraits with 5 moods each.
- Sound: music per map, voice-line barks (placement, upgrade, level-up).
- Achievements, stats page, freeplay after wave 20.
- PWA install + offline.

### Later / stretch

- Outfits (skins) as rewards or cosmetics — the natural monetization lever if ever needed.
- Daily challenge with fixed loadouts and a leaderboard (needs a backend: Supabase/Cloudflare D1).
- Cloud save and account login.
- Co-op (2 players, split cash) — only after everything else is great.
- Native wrappers (Capacitor) for app stores — requires staying inside store content policies.

### Explicitly out of scope

- Gacha / loot boxes (keeps it fair and simple; Bond is earned by playing).
- Explicit sexual content or nudity.
- Real-time PvP.

---

## 3. Systems

### 3.1 Battlefield

- Map is a 20×12 tile grid in world units. Enemies follow a polyline path.
- **Portrait:** the renderer transposes the map (x↔y), so a 20×12 landscape map becomes 12×20 and fills a phone screen. The simulation never knows; rotating mid-battle just works.
- Heroines occupy a 0.42-tile radius circle; they can't overlap each other or the path.

### 3.2 Heroines (towers)

Each heroine has: cost, base stats, attack kind (`bolt`, `bomb`, `pulse`, `none`), damage type (`physical` / `magic`), and three upgrade paths.

| Heroine                                     | Role                | Attack                           | Signature                                                                                   |
| ------------------------------------------- | ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| **Scarlet Vane**, 27 — vampire gunslinger   | Single-target DPS   | Fast piercing bullets (physical) | _Silver Bullets_ unlock armor damage; _Heartseeker_ triples boss damage                     |
| **Yuki Frostveil**, 24 — snow witch         | Crowd control       | Radial frost pulse (magic)       | Slows 40→70%; _Absolute Zero_ freezes; _Shatter_ makes slowed enemies take +2 from everyone |
| **Kaede Emberhorn**, 29 — oni flame dancer  | Splash / anti-armor | Lobbed fire bombs (magic)        | _Crimson Lotus_ burn; _Fireworks Finale_ 3 bombs; _Oni Awakening_ boss killer               |
| **Selene Moonwhisper**, 26 — moon priestess | Support / economy   | None by default                  | Aura +rate/+range/armor-pierce; _Tribute_ cash per wave; can buy an arrow attack            |

**Crosspathing (BTD6 rule):** at most two paths may have upgrades, and only one of them may exceed tier 2. (MVP caps at tier 3, so legal builds are like 3-2-0, 2-2-0, 0-3-1.) Implemented in `canBuyUpgrade()`.

**Damage model (BTD-style):** each point of damage pops one layer; overflow carries into the first child; children are immune to the projectile that spawned them. Armored enemies ignore physical damage unless the source has `armorPierce`. Bosses have HP and take `bossMult`.

### 3.3 Enemies — "the Blight"

| Enemy           | Layers (RBE) | Speed | Notes                       |
| --------------- | ------------ | ----- | --------------------------- |
| Mote            | 1            | 1.6   |                             |
| Flicker         | 2            | 2.1   | → Mote                      |
| Glimmer         | 3            | 2.7   | → Flicker                   |
| Blaze           | 4            | 4.0   | → Glimmer, fast             |
| Twin Wisp       | 9            | 2.4   | → 2 Blaze                   |
| Iron Husk       | 19           | 1.3   | **Armored**, → 2 Twin       |
| Blight Colossus | 400 HP + 56  | 0.55  | **Boss**, → 2 Iron + 2 Twin |

Leaking an enemy costs lives equal to its remaining RBE.

### 3.4 Economy

- Start: 650 gold, 100 lives.
- +1 gold per layer popped, +60 per boss.
- End-of-wave bonus: `70 + 3 × wave` + Selene Tribute income.
- Sell refund: 70% of total spent.
- Balance is checked with `npm run sim` — a greedy bot that buys the cheapest upgrades reaches wave ~19–20 and loses, so a player who plans tier-3s wins with margin. Retune there first.

### 3.5 Bond (meta progression)

- 10 levels. XP thresholds: 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200.
- Match XP per heroine fielded: `pops × 0.1 + wave × 4 + (win ? 150 : 0)`.
- Chat XP: sum of choice affection (10–30 each) + 50 on first completion.
- Bonus: +2% attack rate per level above 1 (small, so skill > grind).
- Rewards per level (v1 plan):

| Bond | Reward                              |
| ---- | ----------------------------------- |
| 1    | Chat 1                              |
| 2    | Gallery 1 _First Impression_        |
| 3    | Chat 2                              |
| 4    | Gallery 2 _Off Duty_                |
| 5    | Hero ability _(v1)_ + Chat 3 _(v1)_ |
| 6    | Gallery 3 _Poolside_                |
| 7    | Chat 4 _(v1)_ + alt outfit _(v1)_   |
| 8    | Gallery 4 _After Hours_             |
| 9    | Chat 5 _(v1)_                       |
| 10   | Gallery 5 _Heart Unveiled_          |

### 3.6 Chats

Visual-novel presentation: large mood portrait, text box with type-on effect, tap to advance, two choice buttons. Data format in `src/data/dialogues.ts`:

```ts
{ id, heroine, title, level, start, nodes: [
  { id, speaker: 'her' | 'you' | 'narration', text, mood?, next? | choices?: [a, b] | end? }
]}
```

Writing rules: she's an adult with a distinct voice; flirting is teasing and playful; the "good" option is the one that fits _her_ personality (Scarlet likes boldness, Yuki likes gentleness, Kaede likes nerve, Selene likes romance). Keep it suggestive, never explicit.

### 3.7 Gallery

Unlocked by Bond level. Files are loaded from `public/art/<heroine>/gallery-<n>.webp`; missing files show a generated placeholder, so art can be added one file at a time with zero code changes.

---

## 4. UX & layout

| Viewport                                       | Layout                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Landscape (desktop, tablet, phone sideways)    | Battlefield left, sidebar right (210–320 px): stats, controls, shop 2×2 or selected-heroine panel                            |
| Portrait (phone upright)                       | Battlefield top (map transposed), dock bottom (≤46% height): stats row, controls, shop 4-across or panel with 3 path columns |
| Short landscape (phone sideways, ≤520 px tall) | Compact sidebar, square cards, hidden descriptions                                                                           |

**Placing:** mouse = click to place (ghost follows cursor). Touch = tap/drag to position the ghost, tap again (or press _Place_) to confirm. Invalid spots show a red ghost.

**Keyboard:** Space next wave · 1–5 pick heroine · Q/W/E quick-upgrade paths · U upgrade screen · Tab targeting · Delete sell · P pause · F speed · Esc cancel · +/− zoom · 0 fit map.

**Zoom:** pinch (touch), mouse wheel, or the +/−/⤢ buttons in the battlefield corner (1×–3×). When zoomed, drag the map to pan; a short tap still selects.

---

## 5. Technology

| Choice                                         | Why                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Phaser 4** (WebGL)                           | Mature 2D engine, great mobile performance, input + scale managers, ships its own AI-readable docs in `node_modules/phaser/skills/`              |
| **TypeScript + Vite**                          | Fast dev server, tiny config, static build for any host                                                                                          |
| **DOM overlay for UI**                         | Menus, chats, upgrade panels are easier, crisper and more accessible in HTML/CSS than in canvas, and responsive CSS handles orientation for free |
| **Framework-free simulation** (`src/game/sim`) | Deterministic fixed 60 Hz step; runs in Node for balance bots and tests; Phaser only draws it                                                    |
| **localStorage saves**                         | Zero backend for MVP                                                                                                                             |
| **GitHub Pages + Actions**                     | Free hosting, deploy on every push to `main`                                                                                                     |

Rendering is at device pixel ratio (capped at 2) with `Scale.NONE` + zoom, so the map stays sharp on retina phones.

---

## 6. Content & distribution notes

- Every heroine's canonical age is stated in data and on her profile (all 24+).
- Art ceiling: suggestive fan service — form-fitting or revealing outfits, swimsuits, lingerie-adjacent "after hours" outfits, alluring poses, blush and teasing expressions. No nudity, no explicit acts. This keeps the game hostable on GitHub Pages, itch.io, Newgrounds and CrazyGames, and is the ceiling most image generators will produce anyway.
- Add an 18+ age gate on first launch before any public launch or ad network.

---

## 7. Milestones

| #   | Milestone             | Done when                                                                               |
| --- | --------------------- | --------------------------------------------------------------------------------------- |
| M0  | **Vertical slice** ✅ | 1 map, 4 heroines, 20 waves, bond, chats, gallery, deploy                               |
| M1  | **Real art pass**     | Portraits (5 moods) + chibi map sprites for 4 heroines, first 2 gallery images each     |
| M2  | **Juice**             | Sound, music, hit particles, floating pop text, attack animations, screen shake on boss |
| M3  | **Depth**             | Tiers 4–5, camo/regrow, hero abilities, difficulty modes                                |
| M4  | **Content**           | 8 heroines, 4 maps, full Bond 1–10 chats and gallery                                    |
| M5  | **Launch**            | Age gate, PWA, analytics, itch.io + custom domain                                       |
