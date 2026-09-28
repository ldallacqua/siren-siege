# Siren Siege — Art Direction & Asset Guide

## Look & feel

- **Style:** high-quality anime / gacha key-art (think _Azur Lane_, _NIKKE_, _Blue Archive_ splash art). Clean lineart, cel shading with soft gradients, rim light, glossy highlights.
- **Mood:** night, moonlight, neon-pink and violet accents, shrine lanterns. UI palette: deep purple `#140a1f`, pink `#ff5fa2`, violet `#7b3fe4`, gold `#ffd23f`.
- **Heroines:** clearly adult women (mid-20s and up), mature proportions and faces, confident and alluring. Fan service through outfit design, pose, framing and expression — cleavage, thighs, bare shoulders, tight fits, swimsuits, teasing looks, blushing. **Ceiling: suggestive, never nude or explicit.**
- Each heroine owns a color: Scarlet crimson, Yuki ice-blue, Kaede ember-orange, Selene lilac. Keep it dominant in her outfit, effects and UI frame.

## Asset list & specs

All files go in `public/art/<heroine-id>/`. The game picks them up automatically; missing files fall back to placeholders.

| File                                | Size            | Notes                                                                                                                                                      |
| ----------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `portrait.webp`                     | 1200×1600 (3:4) | Default. Thighs-up, facing viewer, transparent or simple dark background. Used in shop cards, roster, profile                                              |
| `portrait-<mood>.webp`              | 1200×1600       | Same pose/crop as `portrait`, only expression/arms change. Moods used by chats: `smile`, `tease`, `smirk`, `wink`, `laugh`, `blush`, `shy`, `pout`, `grin` |
| `gallery-1.webp` … `gallery-5.webp` | 1600×1200 (4:3) | Unlockable illustrations (see themes below)                                                                                                                |
| `chibi.webp` _(v1)_                 | 256×256         | Map sprite, 2–3 head-tall chibi, top-down-ish 3/4 view                                                                                                     |

Export WebP quality 85. Keep portraits on transparent backgrounds where possible so chats can layer them over scenes.

**Gallery themes by Bond level:** 2 _First Impression_ (battle outfit, heroic pose) · 4 _Off Duty_ (casual, relaxed, flirty) · 6 _Poolside_ (swimsuit) · 8 _After Hours_ (elegant nightwear / evening dress, bedroom-eyes) · 10 _Heart Unveiled_ (most intimate moment of her story, romantic, still non-explicit).

## Character sheets

**Scarlet Vane — Crimson Gunslinger (vampire, 27)**
Long wavy crimson hair, pale skin, red eyes with slit pupils, tiny fangs. Black-and-red gothic duster coat worn open over a corset top with deep neckline, high-waisted leather shorts, garter straps, thigh-high boots, twin silver revolvers. Rose and bat motifs. Expression: confident smirk.

**Yuki Frostveil — Snow Witch (yuki-onna, 24)**
Very long straight white-silver hair with ice-blue tips, pale blue eyes, porcelain skin. Off-shoulder white kimono-inspired dress with a high side slit, translucent ice-blue sleeves, obi with snowflake crest, bare feet with frost anklets. Floating ice crystals. Expression: aloof, shy blush.

**Kaede Emberhorn — Oni Flame Dancer (oni, 29)**
Short-to-mid messy orange-red hair, two red horns, amber eyes, athletic curvy build, sun-kissed skin with red tribal markings. Cropped festival happi jacket worn open over a sarashi chest wrap, short hakama, tabi and geta, sake gourd on hip, fire in hand. Expression: big grin, wink.

**Selene Moonwhisper — Moon Priestess (26)**
Long lavender hair in a loose braid, violet eyes, crescent-moon hair ornament, elegant curvy figure. Backless white-and-lilac priestess gown with gold trim, sheer layered skirt with thigh slit, detached sleeves, moon-phase jewelry, bow of moonlight. Expression: gentle, mischievous smile.

## Image-generation prompt template

Use the same template for every image so the cast stays consistent. Fill the brackets.

```
masterpiece, best quality, anime key visual, gacha game splash art,
1 adult woman, [AGE]-year-old, [CHARACTER SHEET DESCRIPTION],
[POSE], [EXPRESSION], [FRAMING: thighs-up portrait / full body],
alluring, confident, tasteful fan service, form-fitting outfit,
cel shading, soft rim light, glossy highlights, detailed eyes,
[COLOR]-dominant palette, moonlit night, soft bokeh,
[BACKGROUND: transparent background / simple dark gradient / scene],
aspect ratio [3:4 or 4:3]
Negative: child, loli, young-looking, nsfw, nude, nipples, explicit, lowres, bad hands, extra fingers, text, watermark, logo
```

**Example — Scarlet `portrait-tease.webp`:**

```
masterpiece, best quality, anime key visual, gacha game splash art,
1 adult woman, 27-year-old vampire gunslinger, long wavy crimson hair, pale skin,
red eyes, tiny fangs, black-and-red gothic duster coat open over a corset top with
deep neckline, leather shorts, garter straps, thigh-high boots, silver revolver
resting on her shoulder, leaning forward slightly, teasing smile, one eyebrow raised,
thighs-up portrait, alluring, confident, cel shading, rim light, crimson-dominant
palette, transparent background, aspect ratio 3:4
Negative: child, loli, young-looking, nsfw, nude, explicit, lowres, bad hands, text, watermark
```

**Consistency tips:** generate `portrait.webp` first, then create mood variants with the same seed / image-to-image / character reference (e.g. Midjourney `--cref`, SD IP-Adapter or a small LoRA trained on 15–20 approved images of each heroine).

**Licensing:** make sure the tool you use grants commercial rights to outputs if you ever monetize, and never feed copyrighted characters in as references.
