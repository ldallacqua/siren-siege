# Art quality gate

A heroine is **ready** when her art passes both halves of this gate: the automated checks (`npm run art:check`) and the eye checks below, signed off by the owner. New art goes through it before it is committed; existing art went through it on 2026-10-03.

Why it exists: art approved one picture at a time still shipped with defects nobody looked for. Every portrait had a faint ghost band around her (the keyer assumed the screen was pure #00FF00, generators return about (3, 248, 5); the owner saw it on Nemu). Scarlet's red hair had olive edges. Chats stretched the 1536 px portraits 2× on a 200 % display. Hands were the most common reason the owner rejected a picture.

## 1. Automated: `npm run art:check [ids…]`

Runs after every `npm run art`, and in the pre-push hook when `public/art/` or the art scripts change. It needs a browser (`$CHROME_PATH`, as for the smoke test). Thresholds are in `GATE` in `scripts/art-check.ts`.

| Check            | What it measures                                                                                                                                                                                                                                                 | Limit                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| files            | portrait, 9 moods, 4 chibi poses, 5 gallery pictures exist. Missing files are "not made yet" (placeholders show), not a defect                                                                                                                                   | all 19 for ready                 |
| portrait size    | ≥ 1500 px tall, within 1200×1600, 2:3                                                                                                                                                                                                                            |                                  |
| portrait edges   | **halo**: faint pixels (alpha 1–31) more than 3 px from her, per outline pixel. **tint**: outline pixels blended toward the screen colour. **spill**: screen-coloured pixels. Corners transparent                                                                | halo 0.1, tint 3 %, spill 0.1 %  |
| portrait framing | nothing of her cut off by the image border                                                                                                                                                                                                                       |                                  |
| mood alignment   | pose moods (`POSE_MOODS` in `scripts/artSpec.ts`): her head-to-feet height and the line her feet stand on vs the base portrait, so she doesn't grow, shrink or hop when chats swap poses. Older face-only moods: silhouette vs the base (IoU of the alpha masks) | height ±6 %, feet 2 %; IoU ≥ 0.9 |
| chibi frames     | 256×256, clean edges, feet not cut off, and the scale the battlefield applies to fit each pose to the front pose (`frameFit`)                                                                                                                                    | ×0.77–×1.3                       |
| gallery size     | landscape, ≥ 1200 px wide                                                                                                                                                                                                                                        |                                  |

Result per heroine: **DEFECTS** (fix before pushing; the command exits non-zero), **incomplete** (files missing), or **passes** (ready once the eye checks are signed off).

Measured on clean art: halo ≤ 0.03, tint ≤ 1.6 %, spill 0, mood IoU ≥ 0.99. Before the 2026-10-03 fix: halo 0.6–2.2 on every portrait, Scarlet tint 6–8 %.

## 2. Eye checks (review sheets in `artifacts/art-check/`)

`npm run art:check` writes these for each heroine. The agent reviews them first and says what it found; the owner signs off. Zoom in: every defect the owner caught so far was visible only zoomed.

1. **`<id>-1-cutout.png`** (base portrait on dark, light and magenta): no ghost outline, no coloured fringe on hair, weapon or translucent cloth; translucent parts (sleeves, flames, ice) still see-through.
2. **`<id>-2-moods.png`** (all ten portraits): same outfit, props and proportions in every pose; each pose and face reads as its mood from across the room; she is the same size in each; no weapon points at the viewer or at her own head; she shows cleavage (owner rule for every heroine). Face-only moods (not yet redrawn): same pose, only the face changes.
3. **`<id>-2b-hands.png`** (every hand in every portrait, zoomed; boxes in `HAND_BOXES`, `scripts/artSpec.ts`, one list per picture for pose moods): count the fingers on each hand; no nails on the palm side of a finger; the same nail colour in every picture; no fingers merging into a prop; hands near the chest don't read as extra anatomy. A crop that misses the hand means the box is wrong: fix the box, don't skip the hand.
4. **`<id>-3-chibi.png`** (four poses at 256 px and at 64 px both ways): same character and costume as the portrait; poses read at 64 px; no stray background.
5. **`<id>-4-gallery.png`**: hands and anatomy as in 3, costume matches, the scene matches her chat arc (`docs/LORE.md`).
6. **In the game** (`npm run smoke` screenshots, or the built game): the chat at 1920×1080 and on a phone, the home screen, her profile. She is sharp at 100 % and 200 % display scaling (chats and home never stretch her past 1.25 screen pixels per art pixel: `MAX_UPSCALE` in `src/ui/common.ts`).

## 3. Status (2026-10-03)

| Heroine | Automated               | Agent eye review (2026-10-03)                                                                                                                                                                                                                                                                                                                                                                 | Owner sign-off still needed                                                |
| ------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Scarlet | passes                  | **Nine pose moods (D-029), owner approved 2026-10-03** after three were redone for their hands (blush, tease, shy). Hands reviewed at 3× in all ten pictures: fingers countable, every held revolver gripped, nail colour consistent; same size in every pose; no gun toward the viewer or her head. Base portrait regenerated with real transparency (owner picked take A): clean hair edges | chibi front pose (predates her full-body art), gallery-1 (predates it too) |
| Yuki    | passes                  | **Nine pose moods (D-029), owner approved 2026-10-03.** Hands reviewed at 3.5–6×: every staff hand a closed grip with four fingers and a thumb, nails pale pink in every picture; same size in every pose. Base portrait: the original keyed one, kept by the owner's decision (regenerating it changed her hand and feet)                                                                    | chibi front pose, gallery-1                                                |
| Kaede   | passes                  | **Nine pose moods (D-029), owner approved 2026-10-03**, all first takes. Hands reviewed at 3.5–6×: fists with four knuckles and a thumb, hip hands with four countable fingers, the gourd gripped by its neck, hands hidden in smile, shy and pout; same size in every pose; no flame outside the base portrait                                                                               | chibi front pose, gallery-1                                                |
| Selene  | passes                  | **Nine pose moods (D-029), owner approved 2026-10-03.** Hands reviewed at 3.5–7×: every bow hand a closed grip with four fingers and a thumb, lilac nails in every picture, hands hidden in pout and (one) wink; a stray finger in the first shy was removed with an edit; same size in every pose; the bowstring is never drawn                                                              | —                                                                          |
| Nemu    | incomplete (no gallery) | **Nine pose moods (D-029), owner approved 2026-10-03.** Hands reviewed at 3.5–4×: hip hands and fists with countable fingers, hot-pink nails in every picture, a hand hidden in her sleeve in six poses; same size in every pose; tease and sad needed one plainer retry after a filter refusal                                                                                               | chibi front pose (B shipped, A the alternative), five gallery pictures     |

Already approved by the owner one picture at a time: every base portrait, the 15 new chibi poses and Selene's new front chibi, gallery 2–5 for the first four, Selene's gallery-1.

**Big copies (`public/art/<id>/hd/`, D-037):** made 2026-10-04 for all 50 portraits with `scripts/upscale.py` (`4x-UltraSharpV2`), not committed. Agent eye review at 3×: face and hand of Selene (shy), both hands of Scarlet (base), arm and outline of Kaede (blush): same fingers, nails and features as the approved pictures, sharper lines, no new fringe on the outline. **Owner sign-off still needed** before they go into the game.

## 4. Fixing what the gate finds

- **New cut-outs:** generate them with real transparency (ART_GUIDE §9, `transparent_background`), not a green screen: nothing to key, no coloured edges. `npm run art` strips the generator's faint fringe (`cleanAlpha`).
- **Halo or tint, source PNG available:** re-import it (`npm run art`); the keyer measures each image's real screen colour (`scripts/chroma.ts`).
- **Source lost:** `ghostBias` + `removeBias` remove the old keyer's band, `edgeTint(…, fix)` recolours screen-blended outline pixels from the colour just inside (both in `scripts/chroma.ts`). Re-encode at the quality in `artSpec.ts`.
- **Hands, anatomy, costume:** redraw (ART_GUIDE §9): an edit that redraws one hand, or a fresh take with a simpler hand pose.
- **Pose mood cut off, too big or too small:** regenerate it asking for "everything inside the image with a margin on every side, the same size as image 1" (Scarlet's first `angry` lost a boot to the edge).
- **Nail colour or another small detail differs between moods:** an edit (image 1 the picture, image 2 the portrait, "recreate image 1 exactly, change only …").
- **Face-only mood misaligned:** regenerate the mood with the base portrait as the reference and "change only the face".
- **Chibi pose too small or large:** regenerate with "the character the SAME SIZE as in image 1".
