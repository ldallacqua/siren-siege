# CLAUDE.md — working notes for AI agents

Siren Siege: Phaser 4 + TypeScript + Vite browser tower defense (BTD6 model) where towers are adult anime heroines, plus a Bond/chat/gallery layer. Design: `docs/GDD.md`. Art: `docs/ART_DIRECTION.md`.

## Commands
- `npm run dev` — dev server (add `?dev` to the URL: everything unlocked, 20,000 gold, `window.siren` debug hook)
- `npm run build` — type-check + production build to `dist/`
- `npm run sim` — headless balance bot (`npm run sim -- scarlet yuki` restricts the roster)

## Architecture
- `src/data/` — pure data: heroines + upgrade trees, enemies, maps + waves, dialogues, progression (bond thresholds, gallery). No Phaser/DOM.
- `src/game/sim/` — deterministic battle simulation (`BattleSim`, fixed 60 Hz). No Phaser/DOM. Runs in Node.
- `src/game/Battle.ts` — one match: owns the sim + interaction state (placing, selection, speed, pause); emits changes.
- `src/game/BattleScene.ts` — Phaser scene that draws a Battle and forwards pointer input. Portrait stages transpose the map.
- `src/ui/` — DOM UI: `Hud.ts` (sidebar/dock), `screens.ts` (home, roster, profile, chat, gallery, results, pause), `art.ts` (real art with placeholder fallback).
- `src/state/save.ts` — localStorage save, bond XP, unlocks.
- `src/main.ts` — boot, DPR-aware resize, app flow.

## Conventions
- Imports use explicit `.ts` extensions (needed for Node strip-types in `npm run sim`).
- Units in the sim are tiles and seconds. Colors are `0xRRGGBB` numbers in data.
- New heroine = add to `HEROINES` + episodes in `dialogues.ts`; gallery slots are generated automatically.
- Art is loaded by filename from `public/art/<id>/`; never hard-require an asset to exist.
- Content ceiling: suggestive, non-explicit. All characters adults, age stated in data.
- Test both orientations (1280×720, 390×844 touch, 844×390 touch) before shipping UI changes.
