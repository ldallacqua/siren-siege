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

All four heroines now have a full-body `portrait.webp` and all nine `portrait-<mood>.webp` (1024×1536 with alpha), replacing the thighs-up files above. They were generated through the Codex CLI (ART_GUIDE §9) and keyed by `npm run art`: Scarlet, Yuki and Selene on green, Kaede on blue because of her flame. Each mood was generated from the approved portrait with only the face changing. `gallery-1` is still the MVP file except Selene's (redone 2026-10-03). Chibis: see Battlefield poses below.

Kaede's approved design, for future art of her: left hand on her hip with the elbow out, the happi jacket off both shoulders, a flame floating above her open right palm, a layered black-and-red skirt with a braided rope belt, a red marking on her left thigh, the sake gourd hanging at her left hip.

Selene's approved design, for future art of her: the owner asked for cleavage like the other heroines, so her gown now has an open plunging V neckline with halter straps (this replaces the covered high-neck bodice described below; her chibi was redone to match on 2026-10-03). Right hand raised with the fingertips on her bare shoulder, glossy lilac almond-shaped nails, left hand holding a tall moon bow upright at her side (large gold crescent above a dark grip, lower tip around her knee), thick side braid over her left shoulder, gold heeled sandals. The owner checks hands and nails closely: review both hands zoomed in before showing him a candidate.

## Pose moods (2026-10-03: Scarlet, Yuki and Kaede approved)

The owner wants each mood to be a whole pose and expression instead of the base portrait with a new face (D-029). Scarlet is the first; her nine `portrait-<mood>.webp` were generated with her `portrait.webp` as the reference and real transparency from the image tool (`transparent_background`, no green screen). The owner approved her set and the approach, then Yuki's and Kaede's; Selene and Nemu follow one at a time (B-20) and until then keep face-only moods and no `angry` or `sad`.

| Mood  | Scarlet's pose                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------- |
| smile | revolvers holstered, a hand on her hip, the other tucking hair behind her ear, a soft smile         |
| laugh | head back, eyes closed, fangs showing, a hand near her mouth, one revolver lowered at her side      |
| tease | revolvers holstered, leaning in, a loose fist under her chin, the other hand on her hip, a smirk    |
| wink  | one eye closed, a grin, one revolver held up beside her head (barrel up), the other hand on her hip |
| blush | bright red cheeks, eyes to the side, a hand on her cheek, the other arm behind her back             |
| shy   | revolvers holstered, a fist pulling her coat collar up to her cheek, the other arm behind her back  |
| pout  | revolvers holstered, both hands on her hips, lips pushed out, an annoyed look                       |
| angry | fighting stance, one revolver aimed out to the side, the other raised, eyes glowing, fangs bared    |
| sad   | head bowed, eyes downcast, one hand holding her other arm, one revolver hanging at her side         |

Lessons: the first `angry` (wide battle stance, arm fully out) lost a boot to the image edge and was redone with "everything inside the image with a margin"; `smile` and `laugh` came back with red nail polish and `wink` with black, fixed with an edit that changed only the nails (her nails are natural); the filter refused the first `wink` (blowing gun smoke near her lips) and passed a plainer one. The owner rejected the first `blush`, `tease` and `shy` for their hands (a hand lying on a revolver instead of gripping it, a second row of knuckles, clasped hands with no countable fingers); the replacements use hand poses the generator gets right: a closed fist, a hand on the hip, an arm behind her back. Her base `portrait.webp` was regenerated with real transparency too (an exact recreation of the keyed one, owner picked take A of two): clean crimson hair edges, halo 0.002 against 0.022.

Yuki keeps her staff in every pose (a closed grip around the shaft is a hand the generator draws well), and her long sleeves hide a hand wherever the pose allows:

| Mood  | Yuki's pose                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------------- |
| smile | weight on one leg, head tilted, staff upright in one hand, the other hand inside her sleeve          |
| laugh | eyes closed, laughing behind a raised sleeve (hand inside it), leaning on the staff                  |
| tease | leaning in, a loose fist under her chin, staff upright in the other hand, half-lidded eyes           |
| wink  | one eye closed, staff resting on her shoulder, the other hand on her hip                             |
| blush | bright pink cheeks, eyes to the side, a hand on her cheek, staff held close                          |
| shy   | the lower half of her face hidden behind a raised sleeve, staff held close, knees together           |
| pout  | turned away, cheeks puffed, arms folded with both hands in her sleeves, staff in the crook of an arm |
| angry | feet apart, staff gripped in both hands across her body, hair and sleeves in a freezing wind         |
| sad   | head bowed, both hands holding the staff close, her temple resting against it                        |

Lessons from Yuki: the first `smile` (a hand tucking her hair) came back with dark grey nails that two nail-only edits did not change, so the pose was replaced; no line of hers uses `angry` yet. Regenerating her base portrait with real transparency was tried and dropped: a "recreate exactly" take redraws small parts (the raised hand lost its detail, the feet changed shape; a second round with enlarged close-ups of those parts as extra `-i` images came close but shifted her skin tone). The owner's decision: approved originals stay as they are, and only new images use real transparency. Kaede's two takes were not used either.

Kaede's poses have no flame (a flame over an open palm is the hand the generator gets wrong; only her base portrait has it) and were made from her original keyed base:

| Mood  | Kaede's pose                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------- |
| smile | weight on one leg, both arms folded behind her head (hands hidden), a broad closed-mouth smile |
| laugh | head back, eyes closed, fangs showing, a hand on her hip, the gourd held up by its neck        |
| tease | leaning in, chin on a loose fist, the other hand on her hip, a fanged smirk                    |
| wink  | one eye closed, a wide grin, a fist pump beside her head, the other hand on her hip            |
| blush | red cheeks, eyes away, one hand rubbing the back of her neck (hidden), the other a loose fist  |
| shy   | both arms behind her back, shoulders up, toes turned in, looking down and away                 |
| pout  | arms crossed with the hands tucked in, turned away, cheeks puffed                              |
| angry | brawler stance, feet apart, both fists up, teeth bared, hair and jacket whipped by hot wind    |
| sad   | head bowed, tears welling, one hand holding her other arm, the other a loose fist at her side  |

All nine passed first time: closed fists, a hand on the hip and hidden hands are the reliable hand poses.

## Gallery 2, "Off Duty" (2026-10-02)

`gallery-2.webp` for all four heroines (1536×1024, opaque), each approved by the owner on the first take. Generated through the Codex CLI with her full-body `portrait.webp` as the identity reference; scenes follow `docs/LORE.md`.

| Heroine | Scene                                                                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scarlet | Her room at the shrine at night: lounging on a red velvet chaise in an open black silk shirt and shorts, red wine in hand, her two silver revolvers laid out for cleaning   |
| Yuki    | By a round shrine window on a snowy night: oversized cream sweater off one shoulder, a steaming cup of tea held in both hands, frost flowers on the glass, a warm lantern   |
| Kaede   | The shrine veranda at dusk after training: black cropped tank top and red shorts, towel around her neck, raising a sake cup, her gourd and a lantern she lit with her flame |
| Selene  | The shrine library window seat: lilac cardigan over a white satin slip dress, an old book on her lap, moon-phase fortune cards spread out, one card held up to the viewer   |

Prompt recipe (one Codex call per picture, `-i portrait.webp`): the portrait is the identity reference (list her face, hair, eyes, skin and signature details); "draw the same woman in a new pose, a new outfit and a full illustrated scene"; the theme; the scene paragraph (place, clothes, what each hand is doing, props from her lore, light, expression); the setting note (Moonlit Isles, Japanese-inspired fantasy under a huge moon, no modern objects); a HANDS paragraph asking for carefully drawn hands and nails; the style and adult-character lines from ART_GUIDE §5.1; wide 3:2 with a full painted background and her face near the centre. Kaede's hair came out longer than in her portrait; the owner approved it as is, but say "short-to-mid length as in the reference" in future prompts.

## Gallery 3, "Poolside" (2026-10-03)

`gallery-3.webp` for all four (1536×1024, opaque), each approved by the owner. Same recipe as gallery 2.

| Heroine | Scene                                                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scarlet | Standing at the moonlit shrine pool (a vampire only swims by moonlight): black one-piece with crimson trim, sheer black sarong, a lace parasol as a joke about the sun |
| Yuki    | An outdoor hot spring in the snow, the place Kaede took her: white frilled bikini, frost flowers spreading where her hand touches the rock                             |
| Kaede   | Knee-deep in the surf on the southern Ember coast, kicking a splash at the viewer, a bonfire she lit on the beach behind her                                           |
| Selene  | Wading along the moonlit shore below the shrine: lilac one-piece with a sheer sarong, straw hat in hand, motes of freed memories rising from the water                 |

What went wrong on the way, for next time:

- Reclining or lying poses in swimwear go wrong: Scarlet's first take (reclining at the pool's edge) had legs the owner called intertwined, and the image tool's filter then refused all three attempts to fix that pose (two edits, one fresh take). A standing pose in a one-piece passed at once. Prefer standing or sitting-upright poses for swimwear.
- Selene's first take looked back over her shoulder: her torso twisted impossibly and the high-cut swimsuit read as bare. Ask for a front or three-quarter view with the whole body turned the same way, and a normal swimsuit leg line.
- Small fixes (Selene's finger through the hat brim) work as an edit: attach the picture as image 1 and the portrait as image 2, and ask to redraw image 1 with exactly one thing changed.

## Battlefield poses (2026-10-03)

Every heroine has `chibi-attack`, `chibi-back` and `chibi-back-attack` (256×256, keyed; Kaede on blue), generated through Codex with her `chibi.webp` as image 1 and her portrait as image 2 ("the same chibi sprite, another frame for animation"); prompt in ART_GUIDE §5.5b. Selene also got a new `chibi.webp` first, from her portrait, because the old one still showed the closed-neck gown; her three poses were made from the new one. The generator draws the figure smaller in the square than the MVP chibis did; the game measures each frame (top of the head in the middle columns, feet line, middle of the legs) and fits it to the front frame, so no regeneration is needed for size.

## Nemu, the fifth heroine (2026-10-03)

`nemu/portrait.webp`, all nine moods (1024×1536, keyed from green) and `chibi.webp`. Her look follows Ellen Joe from Zenless Zone Zero, by the owner's request, for looks only (not a shark); the character, lore and weapon are original (`docs/LORE.md`).

Nemu's approved design, for future art of her: petite 21-year-old (about 150 cm) with a clearly adult face; short black bob with blunt bangs and hot-pink tips, a striped clip and a white X clip; pink-red half-lidded eyes, a beauty mark under her left eye, one pointed canine; black choker with a silver ring, ear cuffs; an oversized white haori with black trim and hot-pink lining slipping off her shoulders, a black belt with a long loose end, a short black dress with a low neckline (cleavage), black thigh-high socks, black platform geta with pink straps; long glossy hot-pink nails. Right hand holds a pink-and-white swirl lollipop by its stick near her chin; left hand hangs at her side holding her two long silver kanzashi hairpins (black lacquered tops, pink beads, pink tassels) pointing down.

How: one Codex call with Selene's portrait as a **style-only** reference ("use it only for the art style, framing, canvas and green background; draw a completely different character") and the full character sheet in the prompt. Three poses in parallel; the owner picked A and liked B (pins on her shoulder, lollipop in her mouth, hand on hip) and C (a raised pin like a dart) as poses, but both had hand problems. When only the white stick of a lollipop shows in her mouth it reads like a cigarette: ask for the pink candy to be visible. Moods used candidate A as the reference with the usual "only the face changes" prompt; all nine passed on the first try. Chibi: two candidates, B (two pins held forward) shipped.

## Gallery 4 "After Hours" and Gallery 5 "Heart Unveiled" (2026-10-03)

`gallery-4.webp` and `gallery-5.webp` for all four (1536×1024, opaque), each approved by the owner. Same recipe as gallery 2. After Hours follows each heroine's Bond 7 chat and Heart Unveiled her Bond 9 confession (`docs/LORE.md`).

| Heroine | 4 After Hours                                                                                                                                     | 5 Heart Unveiled                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Scarlet | A blood-moon night, when she is weakest: crimson satin gown, long lace gloves, the Commander's coat over her shoulders, wine on a balcony bench   | Candlelit hall, the night her heart beats again: one glove off, her bare hand offered back up; the gloved hand over her heart   |
| Yuki    | Kneeling on a futon in a pale-blue yukata, reaching out to test her touch on the Commander; frost flowers stop short of her hand                  | First snow on the shrine bridge that doesn't melt on her: the Commander's red scarf pressed to her cheek, happy tears           |
| Kaede   | A late teahouse drink: red maple kimono off one shoulder, raising her sake cup to the Commander; a candle she lit burns too bright                | The Ember Dance, which an oni dances only for the one who carries her flame: ceremonial costume, ribbons of flame, reaching out |
| Selene  | Her balcony at night after admitting the price in the old texts: lilac silk nightgown and chiffon robe, playing with her braid, the scroll by her | Before the Moongate under a moon halo, choosing to live: holding up her crescent hair ornament for the Commander, happy tears   |

Selene's `gallery-1` was redone the same day because the old one showed her closed-neck gown: image 1 her portrait (outfit and bow win), image 2 the old picture (composition, pose and scene kept).

What went wrong on the way, for next time:

- The owner rejected five of the first nine for hands that a quick look had passed. He checks every finger: a nail on the palm side of a finger (Yuki), a finger lost behind a wine glass (Scarlet), a badly shaped nail and a little finger sticking out (Kaede), rubbery fingers on a palm-up hand (Scarlet, two takes). He also caught cupped hands held in front of Selene's chest that read as a third breast. Check every hand at 2–4× zoom and count the fingers before showing a picture.
- The HANDS paragraph of the prompt now says: five fingers on each hand, three segments each, no fused, missing, rubbery or sticking-out fingers, and nails only on the backs of the fingers (finger pads on the palm side).
- An edit that redraws one hand (image 1 the picture, image 2 the portrait, "redraw image 1 with exactly one thing changed") fixed Scarlet's and Yuki's After Hours. Fresh takes that describe simple hand poses fixed the rest: the back of the hand toward the viewer, hands closed around a cup, a hand flat on a table. Palm-up open hands and a flame floating above a palm failed repeatedly, so Kaede's After Hours moved the flame to a candle.
- Keep props away from the chest; hold them at the waist or beside the face.

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
