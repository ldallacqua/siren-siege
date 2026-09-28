# Siren Siege

_Beauty is the last line of defense._

A browser tower defense where your towers are anime heroines. Built on the Bloons TD 6 model — layered enemies, three upgrade paths with crosspathing, targeting priorities — plus a **Bond** system: fight alongside each heroine to unlock flirty branching chats and gallery art.

**Play:** https://ldallacqua.github.io/siren-siege/ · works on desktop and mobile, portrait and landscape.

## Features (v0.1 MVP)

- 4 heroines — Scarlet (vampire gunslinger), Yuki (snow witch), Kaede (oni flame dancer), Selene (moon priestess) — each with 3 upgrade paths × 3 tiers
- 20 waves on _Moonlit Shrine_, layered "Blight" enemies, armored husks and a boss
- Bond levels 1–10 with stat bonus, 8 branching chat episodes, 20 gallery slots
- Responsive layout: sidebar in landscape, bottom dock in portrait with an auto-rotated map
- Touch, mouse and keyboard controls; progress saved in the browser

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/?dev  (dev mode: all unlocked, 20k gold)
npm run build      # type-check + build to dist/
npm run check      # the full gate: format, types, tests, balance bot, build
npm run smoke      # real-browser test on 3 viewports, screenshots in artifacts/smoke/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Adding art

Drop WebP files into `public/art/<heroine>/` — `portrait.webp`, `portrait-<mood>.webp`, `chibi.webp`, `gallery-1.webp`…`gallery-5.webp`. The game uses them automatically and shows placeholders for anything missing. Step-by-step guide with ChatGPT prompts: [docs/ART_GUIDE.md](docs/ART_GUIDE.md) · style bible: [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md). PNG/JPG uploads can be converted with `npm run art`.

## Resuming work with AI

Any AI agent can pick up where the last one stopped: start at [AGENTS.md](AGENTS.md); current state is in [docs/STATUS.md](docs/STATUS.md), the work queue in [docs/BACKLOG.md](docs/BACKLOG.md). The short resume prompt is in [PROMPT.md](PROMPT.md) (section 2).

## Docs

- [docs/GDD.md](docs/GDD.md) — game design, MVP vs v1 scope, systems, milestones
- [docs/ART_GUIDE.md](docs/ART_GUIDE.md) — how to generate the images with ChatGPT, name and upload them
- [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) — style guide, asset specs, image prompts
- [PROMPT.md](PROMPT.md) — AI prompts to rebuild or keep developing the game
- [AGENTS.md](AGENTS.md) — instructions for AI coding agents (CLAUDE.md, GEMINI.md, Copilot and Cursor files point to it)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/STATUS.md](docs/STATUS.md) · [docs/BACKLOG.md](docs/BACKLOG.md)

All characters are fictional adults.
