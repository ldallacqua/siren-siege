# Art guide — making the heroine images with ChatGPT and putting them in the game

This is the hands-on companion to [`ART_DIRECTION.md`](ART_DIRECTION.md) (the style bible). It tells you **exactly which images to make, how to prompt ChatGPT for each one, how to name them, and how to get them into the game.** Every prompt below is copy-paste ready.

> **Short version**
>
> 1. Open one ChatGPT conversation per heroine. Paste the **Brief** (§5.1), then her **Character block** (§5.2).
> 2. Make her `portrait` first (§5.3). Regenerate until you love it. Everything else is built from it.
> 3. Make the `chibi` (§5.5), the mood variants (§5.4) and the gallery pictures (§5.6), in that order.
> 4. Ask ChatGPT to convert them all to correctly named WebP files (§6, Option A), **or** just upload the PNGs with the right names and ask a coding agent to run `npm run art` (Option B).
> 5. Upload into `public/art/<heroine>/` on GitHub (§6.3). The site redeploys by itself in about 3 minutes.

> **Agents can generate the art themselves** with the owner's ChatGPT plan through the Codex CLI: see §9.

---

## 1. What the game needs

There are 5 heroines. Each uses the same set of files. **Everything is optional**: any missing file shows a generated placeholder, so you can add art a little at a time.

| File                                                             | Ideal size      | Pick in ChatGPT        | Background                  | Where it appears                                                                               |
| ---------------------------------------------------------------- | --------------- | ---------------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `portrait.webp`                                                  | 1024×1536 (2:3) | Portrait / tall (2:3)  | **Transparent** or green    | Shop cards, home screen, roster, profile, results, battle panel                                |
| `portrait-<mood>.webp` (×9 moods)                                | 1024×1536 (2:3) | Portrait / tall (2:3)  | **Transparent** or green    | Chat scenes: her pose and expression change line by line                                       |
| `chibi.webp`                                                     | 256×256 (1:1)   | Square                 | **Transparent**             | Her little figure standing on the battlefield (the actual tower)                               |
| `chibi-attack.webp`, `chibi-back.webp`, `chibi-back-attack.webp` | 256×256 (1:1)   | Square                 | **Transparent** or green    | Extra battlefield poses: attacking, seen from behind (target above her), attacking from behind |
| `gallery-1.webp` … `gallery-5.webp`                              | 1600×1200 (4:3) | Landscape / wide (3:2) | Full scene (no transparent) | Unlockable gallery pictures (Bond levels 2, 4, 6, 8, 10)                                       |

That's 19 files per heroine and 95 in total. You don't need them all at once. **Suggested order:**

1. `portrait.webp` for all 4. This has the biggest visual impact because it appears on almost every screen.
2. `chibi.webp` for all 4. This replaces the colored circles on the map.
3. The moods the existing chats already use (the others can wait; a missing mood falls back to `portrait.webp`):

   | Heroine | Moods used today (most-used first)         |
   | ------- | ------------------------------------------ |
   | Scarlet | tease, smile, smirk, laugh, blush, wink    |
   | Yuki    | shy, blush, smile, pout, tease, wink       |
   | Kaede   | grin, laugh, blush, pout, shy, smile, wink |
   | Selene  | smile, tease, blush, wink                  |
   | Nemu    | blush, smile, pout, shy, smirk, grin       |

4. `gallery-1` … `gallery-5`. Players unlock these slowly, so they can come last.

**Exact sizes don't matter.** ChatGPT's 1024×1536 (2:3) and 1536×1024 (3:2) outputs are fine: the game crops or fits them automatically, and `npm run art` shrinks anything too large. What matters is **orientation** (tall, square or wide) and the **framing rules** in §3.

## 2. Folders and file names (must be exact)

```
public/art/
  scarlet/   yuki/   kaede/   selene/   nemu/  ← folder = heroine id, lowercase
    portrait.webp
    portrait-smile.webp   portrait-tease.webp  portrait-smirk.webp
    portrait-wink.webp    portrait-laugh.webp  portrait-blush.webp
    portrait-shy.webp     portrait-pout.webp   portrait-grin.webp
    chibi.webp            chibi-attack.webp    chibi-back.webp    chibi-back-attack.webp
    gallery-1.webp  gallery-2.webp  gallery-3.webp  gallery-4.webp  gallery-5.webp
```

- All lowercase, a hyphen (not an underscore) before the mood or number, and the `.webp` extension.
- Only these 9 moods exist: `smile tease smirk wink laugh blush shy pout grin`. Anything else (for example `portrait-sad`) is ignored.
- The game only loads `.webp`. PNG/JPG files need converting first (§6).

## 3. How each image is shown (framing rules)

Follow these rules or faces get cut off:

- **Portraits (`portrait*.webp`)**
  - Framing: **full body**, head to feet, centered, standing, facing the viewer, with a small margin above her head and below her shoes. Nothing cropped (not her hair ornaments, not her heels).
  - Full body is the source so no screen ever cuts her off at a hard edge; the game still frames her **head to mid-thigh** on the home screen and profile (fading out below), zooms further in on cards, avatars and the chat, and shows her whole in "View full art".
  - After adding a heroine's first full-body portrait, add her id to `FULL_BODY` in `src/data/progression.ts` (that switches her small views to the zoomed framing). Older thighs-up art still works without it.
  - The background must be **transparent** (a box behind her looks bad on the home screen). Two ways to get it:
    - **Best: real transparency from the generator.** Codex's image tool has a `transparent_background` switch (§9). `npm run art` only strips the near-invisible fringe its cut-out leaves. No screen colour ever touches her, so there are no coloured hair edges to repair (measured halo ≤ 0.003; keyed art is 0.008–0.028).
    - **Fallback: a green screen.** The ChatGPT app usually can't output transparency, so ask for a **flat solid pure green (#00FF00)** background: `npm run art` detects green corners and removes the green, edges included.
  - **Moods are different poses, the same size.** Each `portrait-<mood>.webp` is a new pose and expression (§5.4), but her outfit, her size (head-to-feet height) and the line her feet stand on must match `portrait.webp`: in chats one picture fades into the next, so a change of size or footing shows as her growing or hopping. The art gate measures it. (Kaede, Selene and Nemu still have the older kind, the base pose with only the face changed, until theirs are redrawn.)
- **Chibi (`chibi.webp`)**
  - It is drawn about **one map tile tall**, which is tiny (roughly 40–80 px on screen). It needs a bold silhouette, big head, simple shapes, her signature color and weapon, and no fine details.
  - **She must face screen-RIGHT** (her body angled right, weapon pointing right). The game mirrors her when enemies are on the left.
  - Full body, **feet near the bottom edge**, centered, **transparent background** (asked from the generator, the same way as portraits), and **no ground shadow** (the game draws its own).
  - She bobs gently and kicks back when attacking, so a neutral "ready" stance works best.
- **Gallery (`gallery-*.webp`)**
  - Wide landscape illustrations with a full background scene. They are shown whole (fit, not cropped) in the lightbox and as 4:3 thumbnails.
  - Keep her and her face near the center so the thumbnail crop still reads.

## 4. ChatGPT workflow (for consistency)

The hard part is keeping each heroine looking like **the same person** in all 16 images. Work like this:

1. **Use one conversation per heroine**, and stay in it for all her images. ChatGPT remembers the earlier pictures in the same conversation.
2. **Message 1: the Brief** (§5.1). This sets the style and rules for the whole conversation.
3. **Message 2: her Character block** (§5.2) plus _"Generate her main portrait"_ (§5.3). Regenerate or give feedback until you love it, for example _"same, but longer hair and a smugger smile"_. **This approved portrait is her reference from now on.**
4. For every later image, start with: _"Using the exact same character as the approved portrait above…"_
5. If a conversation gets long and ChatGPT starts drifting (hair color changes, outfit details vanish), **start a new conversation**. Upload the approved `portrait` image, paste the Brief and the Character block, and say _"This image is the reference for her face, hair and outfit. Keep her identical."_
6. Download each image you like and **rename it right away** to its final name (for example `portrait-tease.png`), so nothing gets mixed up.

**If ChatGPT refuses a prompt:** it has its own content filter, which is stricter than our ceiling on some wording. Rephrase with fashion or glamour language ("elegant", "confident", "stylish", "form-fitting", "glamorous evening dress", "swimsuit editorial"), keep "adult woman, [age]-year-old" in the prompt, and drop words like "seductive" or "sexy". Never try to get around the filter toward anything explicit. The game's ceiling is **suggestive, never nude or explicit** (see `ART_DIRECTION.md`).

---

## 5. Copy-paste prompts

### 5.1 The Brief (first message in every heroine's conversation)

```
I'm making character art for a browser tower-defense game called "Siren Siege".
The heroes are glamorous adult anime heroines. I'll ask for several images of the
SAME character, and she must stay identical across all of them (face, hair, eye
color, outfit, colors, proportions).

Style for every image:
- High-quality anime / gacha-game key art: clean lineart, cel shading with soft
  gradients, soft rim light, glossy highlights, detailed eyes.
- Mood: moonlit night, neon-pink and violet accents.
- She is clearly an adult woman (mid-20s+), with mature face and proportions,
  confident and alluring. Fan-service through outfit, pose and expression
  (form-fitting outfits, bare shoulders, thigh-high boots, teasing looks,
  blushing), always tasteful: no nudity, nothing explicit.
- No text, no logos, no watermark, no signature, no UI, no frame.

Rules I'll reference:
- "PORTRAIT RULES": tall 2:3 image, FULL BODY from the top of the head to the soles of
  the shoes, nothing cropped, small margin above the head and below the feet,
  centered, standing, facing the viewer. Background: perfectly flat solid pure green
  (#00FF00), no glow, gradient, floor or shadow, no green light on her.
- "CHIBI RULES": square image, cute 2.5-heads-tall chibi version of her, full body,
  3/4 view with her body and weapon facing to the RIGHT side of the image, feet near
  the bottom edge, bold simple shapes that read at 64 px, TRANSPARENT background, no
  ground shadow.
- "GALLERY RULES": wide 3:2 image, full illustrated background scene, she is the
  focus near the center, cinematic lighting.

Please confirm, and wait for the character description.
```

### 5.2 Character blocks (second message; paste the one for this conversation)

**Scarlet** (folder `scarlet`)

```
Character: Scarlet Vane, "the Crimson Gunslinger". A 27-year-old adult vampire woman.
- Long wavy crimson hair, pale porcelain skin, red eyes with slit pupils, two tiny
  fangs visible when she smiles.
- Outfit: black-and-red gothic duster coat worn open over a black corset top with a
  deep neckline, high-waisted black leather shorts, garter straps, black thigh-high
  boots, fingerless gloves. Rose and bat motifs, silver buckles.
- Weapons: twin ornate silver revolvers.
- Signature color: crimson (#e0284f), with black and silver.
- Personality/default expression: confident, amused smirk; dangerous and playful.
```

**Yuki** (folder `yuki`)

```
Character: Yuki Frostveil, "the Snow Witch". A 24-year-old adult yuki-onna (snow spirit) woman.
- Very long straight white-silver hair with ice-blue tips, pale blue eyes, porcelain
  skin, graceful slender figure.
- Outfit: off-shoulder white kimono-inspired dress with a high side slit,
  translucent ice-blue sleeves, obi sash with a snowflake crest, bare feet with frost
  anklets.
- Magic: small floating ice crystals and snowflakes around her.
- Signature color: ice-blue (#5cc8ff), with white and silver.
- Personality/default expression: aloof and elegant, but easily flustered; shy blush.
```

**Kaede** (folder `kaede`)

```
Character: Kaede Emberhorn, "the Oni Flame Dancer". A 29-year-old adult oni woman.
- Short-to-mid-length messy orange-red hair with red braided cords and gold bells,
  two red horns, amber eyes, athletic curvy build, sun-kissed skin with red tribal
  markings on her arms, cheeks and one thigh.
- Outfit: cropped red-and-black festival happi jacket with gold patterns worn open
  and off the shoulders over a white sarashi chest wrap, short black-and-red layered
  skirt with a red-and-black braided rope belt and tassels, tabi socks and geta
  sandals, sake gourd on her hip.
- Magic: a flame floating above her open palm (solid and opaque, clear of her hand).
- Signature color: ember-orange (#ff7a1a), with red and black.
- Personality/default expression: loud, cheerful, cocky; big grin and a wink.
```

**Selene** (folder `selene`)

```
Character: Selene Moonwhisper, "the Moon Priestess". A 26-year-old adult woman.
- Long lavender hair in a loose side braid, violet eyes, crescent-moon hair
  ornament, elegant curvy figure.
- Outfit: white-and-lilac priestess gown with gold filigree trim and an open plunging
  V neckline that shows her cleavage (halter straps, bare shoulders, a small crescent
  pendant), sheer layered skirt with a thigh slit, detached sheer sleeves, moon-phase
  jewelry, gold heeled sandals. Glossy lilac almond-shaped nails.
- Weapon: a tall ornate moon bow, silver-white and gold with lilac limbs and a large
  gold crescent above the grip (solid and opaque, no glow).
- Signature color: lilac (#c79bff), with white and gold.
- Personality/default expression: gentle, serene, with a quietly mischievous smile.
```

**Nemu** (folder `nemu`)

```
Character: Nemu Sugardream, "the Dream Eater", a baku. A 21-year-old adult woman.
- Petite (about 150 cm), slender with soft curves, a clearly adult face.
- Short black bob with blunt bangs and vivid hot-pink tips, a striped hair clip and
  a white X-shaped clip; pink-red half-lidded eyes, a beauty mark under her left eye,
  one slightly pointed canine; black choker with a silver ring, ear cuffs.
- Outfit: oversized white haori with black trim and hot-pink lining slipping off her
  shoulders, black belt with a long loose end, short black dress with a low neckline
  that shows her cleavage, black thigh-high socks, black platform geta with pink
  straps. Long glossy hot-pink nails.
- Props: a pink-and-white swirl lollipop (show the pink candy, not just the stick);
  two long silver kanzashi hairpins with black tops, pink beads and tassels.
- Signature color: hot pink (#ff4f9a), with black and white.
- Personality/default expression: bored, deadpan, half-lidded, a faint smirk.
```

### 5.3 Main portrait → `portrait.webp`

```
Generate her main portrait following the PORTRAIT RULES. Full body, standing in a
confident relaxed pose, holding her weapon/magic, looking at the viewer with her
default expression. This will be the reference image for every other picture of her,
so make the outfit and hair clear and complete.
```

Iterate until it's perfect, then save it as `portrait.png` (or `.webp`).

### 5.4 Mood variants → `portrait-<mood>.webp`

A mood is a **whole pose and expression**: her body shows the emotion, not just her face (owner decision 2026-10-03, D-029; Scarlet is the first, see "Pose moods" in [ART_ASSETS.md](ART_ASSETS.md)). The nine moods are in `MOODS` (`src/data/progression.ts`). Send one message per mood, with the approved portrait attached:

```
Image 1 is the approved design. Create ONE new image of the SAME character: keep her
face, hair, eyes, the whole outfit, her weapon and the art style exactly. Change her
POSE and FACIAL EXPRESSION together, so her whole body shows this emotion: [EMOTION]
[POSE]
Keep the PORTRAIT RULES: full body, head to feet, nothing cropped, a clear margin on
every side, the same size and camera distance as image 1 (the pictures swap in a
chat, she must not grow, shrink or hop). Natural unpainted nails as in image 1.
```

Write `[POSE]` for her character (what her hands, weapon, shoulders and legs do). Starting points:

| File                  | [EMOTION]                             | [POSE] ideas                                                                  |
| --------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `portrait-smile.webp` | warm, content, at ease                | weapon put away, a hand on her hip, the other in her hair                     |
| `portrait-laugh.webp` | delighted laughter                    | head back, eyes closed, a hand near her mouth, weapon lowered                 |
| `portrait-tease.webp` | amused, flirty                        | leaning toward the viewer, one eyebrow raised, weapon held up beside her      |
| `portrait-wink.webp`  | playful, cheerful                     | one eye closed, head tilted, a hand on her hip                                |
| `portrait-blush.webp` | flustered, caught off guard           | a hand on her cheek, eyes to the side, shoulders up                           |
| `portrait-shy.webp`   | shy, vulnerable                       | hands clasped in front of her, knees together, looking down and away          |
| `portrait-pout.webp`  | sulking, mildly annoyed               | both hands on her hips, cheeks puffed, a sideways look                        |
| `portrait-angry.webp` | cold fury, ready to fight             | fighting stance, weapon aimed to the side (never at the viewer), brows down   |
| `portrait-sad.webp`   | sad, remembering what she lost (LORE) | shoulders dropped, head bowed, one hand holding the other arm, weapon hanging |

What went wrong on Scarlet's set, so you can ask for it up front: a wide stance or an outstretched arm gets cut off by the image edge (say "everything stays inside the image with a margin"); nail polish changes colour between pictures (say "natural unpainted nails"); the filter refused "blowing the smoke from the barrel near her lips" (plainer wording passed).

### 5.5 Chibi → `chibi.webp`

```
Now make a chibi version of the same character following the CHIBI RULES: square
image, cute 2.5-heads-tall chibi, full body, standing in a ready battle stance, body
angled in 3/4 view facing to the RIGHT of the image, weapon/magic pointing right.
Same hair, eye color, outfit and signature color as the portrait, simplified into
bold shapes with thick clean outlines so it reads when shown very small (64 px).
Feet near the bottom edge, centered, transparent background, no ground shadow, no
effects that extend past the edges.
```

To check it, zoom your phone out until the image is about the size of a fingernail. You should still recognize her by her silhouette and color. If she's facing left, say _"mirror it so she faces right"_.

### 5.5b Extra battlefield poses → `chibi-attack`, `chibi-back`, `chibi-back-attack`

The game picks the pose by itself: from behind when her target is above her, the attack pose for a moment each time she attacks, and it mirrors every pose for targets on the left. Each pose is optional (a missing one falls back to the closest one that exists), and the game lines up her feet and body height across poses, so small size differences between generations are fine. Attach her `chibi.webp` (and her portrait for costume details) and ask for the SAME chibi in a new pose, facing screen-right, same size, feet near the bottom, on flat green (blue for Kaede):

- attack: front three-quarter view, mid-attack toward the right (firing, casting, throwing).
- back: three-quarter BACK view, turned away from the viewer and facing up-right, the back of her head visible, weapon ready.
- back-attack: the back view, attacking toward the upper right.

### 5.6 Gallery → `gallery-1.webp` … `gallery-5.webp`

```
Using the exact same character (face, hair, body) as the approved portrait, create a
gallery illustration following the GALLERY RULES.
Theme: [THEME]. Scene: [SCENE].
Mood: [MOOD]. Keep her face clearly visible near the center.
```

The themes are fixed by the game (the titles already appear in the gallery):

| File        | Unlocks at | [THEME]                                                               |
| ----------- | ---------- | --------------------------------------------------------------------- |
| `gallery-1` | Bond 2     | "First Impression": her battle outfit, heroic action pose             |
| `gallery-2` | Bond 4     | "Off Duty": casual clothes, relaxed, flirty                           |
| `gallery-3` | Bond 6     | "Poolside": swimsuit, summer night, playful                           |
| `gallery-4` | Bond 8     | "After Hours": elegant evening dress or silk nightwear, intimate mood |
| `gallery-5` | Bond 10    | "Heart Unveiled": the most romantic moment of her story, tender       |

Scene ideas for `[SCENE]` and `[MOOD]` (take them as they are or tweak them):

| Heroine | 1 First Impression                                                                   | 2 Off Duty                                                                          | 3 Poolside                                                                   | 4 After Hours                                                                            | 5 Heart Unveiled                                                                             |
| ------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Scarlet | Mid-air on a gothic rooftop under a blood moon, both revolvers firing, coat flaring  | Oversized band shirt and shorts, lounging on a velvet sofa with a glass of red wine | Black-and-red swimsuit, sunglasses, parasol at a moonlit pool, teasing smile | Crimson satin evening gown on a castle balcony, city lights, bedroom eyes                | Removing one glove to take the viewer's hand, candlelight, soft genuine smile, fangs showing |
| Yuki    | Summoning a blizzard on a snowy shrine bridge, hair and sleeves whipping in the wind | Cozy oversized white sweater, drinking hot cocoa by a frosted window                | White frilled swimsuit at a hot-spring pool at night, steam, shy blush       | Silky pale-blue yukata loosely tied, sitting by paper lanterns, eyes half-lidded         | Holding the viewer's scarf to her face in falling snow, tearful happy smile                  |
| Kaede   | Leaping through a festival street, a huge fireball in her hands, lanterns everywhere | Tank top and shorts, sitting on a dojo porch with a sake cup, wink                  | Orange sports bikini at a beach bonfire, laughing, splashing water           | Red kimono slipping off one shoulder at a lantern-lit teahouse, playful grin             | Resting her forehead against the viewer's under fireworks, blushing, honest smile            |
| Selene  | Drawing her moonlight bow on a temple roof, a giant full moon behind her             | Reading in a library window seat in a soft cardigan, braid over her shoulder        | Lilac one-piece swimsuit with a sheer sarong, walking along a moonlit shore  | Sheer lilac nightgown with a robe, on a balcony under the stars, gentle mischievous look | Offering the viewer her crescent hair ornament under a moon halo, tender smile               |

---

## 6. Getting the images into the game

### 6.1 Option A: ChatGPT converts them (no computer needed)

When you have a batch of approved images in one conversation, send:

```
Using Python, prepare the approved images of this character as game files:
- Convert each to WebP, quality 85, KEEPING the transparent background.
- Resize without cropping or stretching so they fit inside: portraits 1200x1600,
  chibi 256x256, gallery 1600x1200 (never upscale).
- Name them exactly (lowercase): portrait.webp, portrait-<mood>.webp (moods: smile,
  tease, smirk, wink, laugh, blush, shy, pout, grin), chibi.webp, gallery-1.webp …
  gallery-5.webp.
- Put them in a zip and give me the download link, and list which file is which.
```

If ChatGPT can't reach the images it generated earlier, download them, upload them back into the conversation, and send the same message.

### 6.2 Option B: upload PNGs and let an agent convert them

Upload the PNG or JPG files with the right names (for example `portrait-tease.png`) into the heroine's folder (§6.3). **They won't appear in the game until they're converted.** In the next coding-agent session, say _"import the new art"_. The agent runs:

```
npm run art      # converts public/art/**/*.png|jpg → correctly sized .webp, deletes the originals,
                 # lists any misnamed files or folders, then runs the art gate (npm run art:check)
```

Then it reviews the gate's sheets in `artifacts/art-check/` (hands zoomed in every portrait), runs the smoke test, and shows you what needs your sign-off. Art counts as ready only after the gate: see [ART_QA.md](ART_QA.md).

### 6.3 Uploading on GitHub (works from the phone browser)

1. Go to `github.com/ldallacqua/siren-siege` → `public` → `art` → the heroine's folder (`scarlet`, `yuki`, `kaede`, `selene` or `nemu`). The folders already exist.
2. Tap **Add file → Upload files** and pick the files. On a phone, unzip the zip in the Files app first.
3. Leave **"Commit directly to the main branch"** selected → **Commit changes**.
4. The site redeploys automatically. After about 3 minutes, open the live game and hard-refresh (or close and reopen the tab).

Uploading a file with the same name replaces the old picture, so re-doing an image is simply uploading it again.

### 6.4 Check it

- **Portrait:** shop cards in battle, the home screen, Heroines → her profile. Make sure the face isn't cut off at the top of the small cards.
- **Chibi:** start a battle and place her. She should stand on her shadow, face the enemies, and bob. If she's too big, small or low, tell the agent: the size and offset are one line each in `src/game/BattleScene.ts` (`drawChibi`).
- **Moods:** open a chat (profile → chat). The expression should change without the body jumping.
- **Gallery:** profile → gallery (use `?dev` at the end of the URL to unlock everything for testing: `https://ldallacqua.github.io/siren-siege/?dev`).

---

## 7. Troubleshooting

| Problem                                       | Fix                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Still shows the placeholder                   | Check the file name (lowercase, hyphen, `.webp`) and the folder. PNGs need converting (§6). Wait for the deploy, then hard-refresh.                                |
| White or checkerboard box behind her in chats | The background isn't really transparent (a fake checkerboard is drawn into the pixels). Ask ChatGPT: _"remove the background, make it truly transparent (alpha)"_. |
| Face cut off in small cards                   | Her face is too low. Regenerate with _"zoom out a bit, more space above her head, face in the top third"_.                                                         |
| She "jumps" between moods in chats            | The mood image doesn't match the main pose. Regenerate: _"same pose and position as the main portrait, only the face changes"_.                                    |
| Chibi faces the wrong way                     | _"Mirror it horizontally so she faces right."_ The game flips it toward enemies by itself.                                                                         |
| Chibi unreadable on the map                   | Ask for a bolder, simpler version: thicker outline, bigger head, fewer small details, stronger signature color.                                                    |
| Character drifts between images               | Start a new conversation and upload the approved portrait as the reference (§4 step 5).                                                                            |
| ChatGPT refuses                               | Rephrase with fashion/glamour wording and keep the adult age stated (§4). Don't push toward explicit content.                                                      |

## 8. Rules that don't change

- Every heroine is an adult (the age is stated in the prompts). The ceiling is **suggestive, never nude or explicit**. This keeps the game hostable.
- Don't use copyrighted characters or a living artist's name as a style reference.
- If you ever sell the game, keep the ChatGPT conversations: they record that the images are yours to use under OpenAI's terms.

## 9. Generating art from a coding agent (Codex CLI)

OpenAI's Codex CLI signs in with the owner's ChatGPT plan (no API key) and has a built-in image generator, so a cloud agent can make the art directly. This is how Scarlet's full-body set was made.

1. Install and sign in (the cloud container is wiped between sessions, so this is needed each session; never store the login in the repo):
   ```
   npm i --prefix "$SCRATCH" @openai/codex
   "$SCRATCH/node_modules/.bin/codex" login --device-auth
   ```
   It prints a link and a one-time code (15 minutes). Give both to the owner; he approves on his phone. `codex login status` confirms.
2. Generate one image per call, with the approved image as reference (`-i`). Put the prompt **after `--`**: `-i` takes several files and would swallow it otherwise.
   ```
   codex exec --skip-git-repo-check -s workspace-write -C <dir> -i ref.png -- "Use your image generation tool to create ONE image, then save it in this directory as smile.png. …" < /dev/null
   ```
   In PowerShell `--` is dropped when calling `codex`, so pipe the prompt instead: `$prompt | codex exec --skip-git-repo-check -s workspace-write -C <dir> -i ref.webp`.
   Each image takes about 5–7 minutes (about 2 on the owner's PC); three in parallel works.
   **Cut-outs (portraits, moods, chibis): ask for real transparency.** The image tool takes `transparent_background: true`; say so in the prompt ("use your image generation tool with transparent_background set to true … save the tool's output unchanged, no post-processing"). The PNG comes back 1024×1536 with a real alpha channel, and `npm run art` strips its faint fringe. Don't judge these PNGs in an image viewer that ignores alpha: the hidden pixels hold a glow the tool painted behind her. The green screen (§5.1 PORTRAIT RULES; pure blue #0000FF for fire or yellow, as Kaede) is the fallback for tools without the switch.
   For moods, describe the pose (§5.4) and say she keeps the size of image 1. If the image tool refuses a mood, retry once with plainer wording (Selene's `tease` passed as "a playful, amused smile with one eyebrow slightly raised"; Scarlet's `wink` passed once the gun-smoke near her lips was dropped); don't push past a second refusal.
   A small fix to a finished picture works as an edit: attach it as image 1 and the portrait as image 2, and ask to recreate image 1 exactly with one thing changed.
3. A base portrait that was keyed from a green screen is regenerated with real transparency before its pose moods are made (it is their reference, and its coloured hair edges would carry over): attach it as image 1 and ask to "recreate image 1 EXACTLY … the only differences: clean hair edges with no green tint, and a truly transparent background". Make two or three takes; everything is redrawn, so attach enlarged close-ups of the parts that must survive (hands, feet) as extra images, compare those parts with the original at 3×, and let the owner pick (he rejected Yuki's first takes for a simplified hand and changed feet). Show the owner the main portrait before making moods from it. Check moods line up (Scarlet's differed from the base by < 0.5 % of the silhouette).
4. Copy the PNGs into `public/art/<id>/` with their final names and run `npm run art` (green is removed there), then `npm run smoke` and look at home, profile, chat and Bond screenshots.
5. Keep the source PNGs until the owner signs off (`npm run art -- --keep`, or generate in a scratch folder and copy): the keyer improves over time and re-keying from the source is the only clean way to fix an edge problem later (Scarlet's and Yuki's sources were lost). Run the art gate ([ART_QA.md](ART_QA.md)) and fix every ✗ before showing the owner.
