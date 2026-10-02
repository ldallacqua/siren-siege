# MVP art inventory

Generated with ChatGPT's built-in image generation tool for this project on 2026-09-28 (owner timezone). Imported with `npm run art`: WebP quality 85, no cropping or upscaling, alpha preserved.

## Shipped files

All paths below are relative to `public/art/`.

| Heroine | Files                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Scarlet | `scarlet/portrait.webp`, `scarlet/chibi.webp`, `scarlet/portrait-smile.webp`, `scarlet/portrait-tease.webp`, `scarlet/gallery-1.webp` |
| Yuki    | `yuki/portrait.webp`, `yuki/chibi.webp`, `yuki/portrait-smile.webp`, `yuki/portrait-shy.webp`, `yuki/gallery-1.webp`                  |
| Kaede   | `kaede/portrait.webp`, `kaede/chibi.webp`, `kaede/portrait-smile.webp`, `kaede/portrait-laugh.webp`, `kaede/gallery-1.webp`           |
| Selene  | `selene/portrait.webp`, `selene/chibi.webp`, `selene/portrait-smile.webp`, `selene/gallery-1.webp`                                    |

19 files: four main portraits, four chibis, seven expressions and four First Impression illustrations. Portraits are 1086×1448 with alpha; chibis are 256×256 with alpha; gallery illustrations are opaque 1448×1086 landscapes. Total approximately 5.6 MB.

The owner explicitly reduced the full 64-image brief to an MVP pass. Other expressions intentionally fall back to the matching main portrait; gallery slots 2–5 retain their placeholders. Do not treat the remaining 45 images as a release blocker.

## Full-body sets (2026-10-02)

All four heroines now have a full-body `portrait.webp` and all nine `portrait-<mood>.webp` (1024×1536 with alpha), replacing the thighs-up files above. They were generated through the Codex CLI (ART_GUIDE §9) and keyed by `npm run art`: Scarlet, Yuki and Selene on green, Kaede on blue because of her flame. Each mood was generated from the approved portrait with only the face changing. Chibis and `gallery-1` are still the MVP files.

Kaede's approved design, for future art of her: left hand on her hip with the elbow out, the happi jacket off both shoulders, a flame floating above her open right palm, a layered black-and-red skirt with a braided rope belt, a red marking on her left thigh, the sake gourd hanging at her left hip.

Selene's approved design, for future art of her: the owner asked for cleavage like the other heroines, so her gown now has an open plunging V neckline with halter straps (this replaces the covered high-neck bodice described below, which her chibi and `gallery-1` still show). Right hand raised with the fingertips on her bare shoulder, glossy lilac almond-shaped nails, left hand holding a tall moon bow upright at her side (large gold crescent above a dark grip, lower tip around her knee), thick side braid over her left shoulder, gold heeled sandals. The owner checks hands and nails closely: review both hands zoomed in before showing him a candidate.

## Gallery 2, "Off Duty" (2026-10-02)

`gallery-2.webp` for all four heroines (1536×1024, opaque), each approved by the owner on the first take. Generated through the Codex CLI with her full-body `portrait.webp` as the identity reference; scenes follow `docs/LORE.md`.

| Heroine | Scene                                                                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scarlet | Her room at the shrine at night: lounging on a red velvet chaise in an open black silk shirt and shorts, red wine in hand, her two silver revolvers laid out for cleaning   |
| Yuki    | By a round shrine window on a snowy night: oversized cream sweater off one shoulder, a steaming cup of tea held in both hands, frost flowers on the glass, a warm lantern   |
| Kaede   | The shrine veranda at dusk after training: black cropped tank top and red shorts, towel around her neck, raising a sake cup, her gourd and a lantern she lit with her flame |
| Selene  | The shrine library window seat: lilac cardigan over a white satin slip dress, an old book on her lap, moon-phase fortune cards spread out, one card held up to the viewer   |

Prompt recipe (one Codex call per picture, `-i portrait.webp`): the portrait is the identity reference (list her face, hair, eyes, skin and signature details); "draw the same woman in a new pose, a new outfit and a full illustrated scene"; the theme; the scene paragraph (place, clothes, what each hand is doing, props from her lore, light, expression); the setting note (Moonlit Isles, Japanese-inspired fantasy under a huge moon, no modern objects); a HANDS paragraph asking for carefully drawn hands and nails; the style and adult-character lines from ART_GUIDE §5.1; wide 3:2 with a full painted background and her face near the centre. Kaede's hair came out longer than in her portrait; the owner approved it as is, but say "short-to-mid length as in the reference" in future prompts.

## Visual reference and prompt set

Use each committed `portrait.webp` as the identity reference for future art. Follow [ART_DIRECTION.md](ART_DIRECTION.md) and [ART_GUIDE.md](ART_GUIDE.md), with these production choices:

- Style: high-quality anime gacha key art, clean lineart, cel shading with soft gradients, glossy highlights, detailed eyes, pink-violet rim light.
- Main portraits: adult character sheets from ART_GUIDE §5.2, tall 3:4, thighs-up, centered facing viewer, face in top third, holding signature weapon/magic, true transparent background. No scenery, text, UI, frame or watermark.
- Scarlet: 27-year-old vampire, crimson hair, red eyes, gothic black/crimson duster and corset, leather shorts, twin silver revolvers, amused smirk.
- Yuki: 24-year-old snow witch, silver hair and blue eyes, white/ice-blue kimono, snowflake ornaments, ice magic. The generated design includes an ice staff, retained across her assets.
- Kaede: 29-year-old oni, orange-red hair, red horns, amber eyes, tribal markings, red/black festival jacket, white sarashi wrap, short hakama, gourd, flame magic.
- Selene: 26-year-old moon priestess, lavender side braid, violet eyes, crescent ornament, white/lilac/gold gown, moonlight bow. Final portrait and chibi use an opaque high-neck embroidered bodice with full chest coverage. This replaces the initial low-neck design after an expression generation was rejected.

### Chibi prompt

Reference: the same heroine's main portrait.

> Create the character's battlefield chibi sprite: adult fantasy heroine represented as a nonsexual 2.5-head-tall miniature, simplified bold shapes and thick outlines that read at 64 px. Preserve signature hair, eyes, ornaments, palette and weapon. Square canvas, full body including both feet, centered ready stance angled in three-quarter view facing screen-right, weapon/magic aimed right. Feet near bottom, transparent alpha background, no ground shadow, scenery, text or UI.

Selene's final chibi was edited to match the covered embroidered bodice of her final portrait.

### Expression prompt

Reference: the same heroine's main portrait.

> Change only facial expression to [expression]. Preserve identity, head angle and position, hair silhouette, exact body pose, hands, costume and coverage, jewelry, weapon/magic, lighting, colors, canvas dimensions and transparent alpha. No zoom, reframe, body movement, scenery or text. These images swap during dialogue.

| File suffix      | Expression                                           |
| ---------------- | ---------------------------------------------------- |
| smile (all four) | Warm genuine smile with soft eyes                    |
| tease (Scarlet)  | Teasing smile, one eyebrow raised                    |
| shy (Yuki)       | Bashful sidelong eyes, strong blush, small shy smile |
| laugh (Kaede)    | Laughing openly, both eyes closed with joy           |

### First Impression gallery prompts

Reference: the same heroine's main portrait. New action pose; wide 4:3 full illustrated scene; face near center; preserve identity, battle outfit and style. Cinematic moonlight, no text, border, UI, nudity, explicit content or gore.

| Heroine | Scene                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Scarlet | Gothic rooftop under a blood moon, both revolvers firing outward, crimson-lined coat and hair flowing, amused smirk                   |
| Yuki    | Summoning a glittering blizzard on a snowy shrine bridge, sleeves and hair in the wind, ice crystals around staff and free hand       |
| Kaede   | Leaping through a lantern-lit festival street, large fireball between her hands, fierce joyous grin                                   |
| Selene  | Drawing her moonlight bow from a temple roof, giant full moon and clouds, lavender braid flowing, covered embroidered ceremonial gown |

## Verification

- Inspect alpha channels and dimensions after importing.
- Run `npm run check` and `npm run smoke`.
- Smoke captures home, battlefield, upgrade, profile, chat and each heroine's First Impression lightbox in all three viewports. Screenshots finish finite animations and wait for image decoding.
- The smoke test raises only its disposable in-memory Bond values to 2 for gallery inspection. Normal player progression is unchanged.
