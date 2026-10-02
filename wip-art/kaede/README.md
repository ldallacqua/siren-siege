# Kaede full-body portrait (work in progress, not yet approved by the owner)

## Round 1 (rejected by the owner, 2026-10-02)

- `portrait-green.png`: first Codex result (green screen). The flame got a yellow-green fringe when keyed.
- `portrait-blue.png`: the same image regenerated on a pure blue screen (#0000FF).
- `prompt.txt`: the prompt used (reference was the old `public/art/kaede/portrait.webp`).
- Rejected: her left arm (viewer's right) has no upper arm or elbow behind the forearm, and the flame hand has a stray digit and a purple patch inside the fire.

## Round 2 (waiting for the owner to pick one)

Generated from `portrait-blue.png` as the reference, asking for the same image with the left arm and the flame hand redrawn (flame solid, floating above an open palm). All on blue.

- `v2-a-hand-on-hip.png` (`prompt-v2-a.txt`): hand on hip, elbow out, bare left shoulder. Keys cleanly.
- `v2-b-relaxed-arm.png` (`prompt-v2-b.txt`): arm hanging relaxed, hand on the gourd, bare left shoulder with a marking. Keys cleanly; cleanest hand.
- `v2-c-hand-on-hip-take2.png` (`prompt-v2-a.txt` again): jacket stays on the shoulder. Its flame has blue streaks painted inside, which key to grey patches. Weakest.
- `candidates-v2.png`: the three keyed, side by side on a dark backdrop.

## Next

1. Owner picks a candidate (or asks for another round).
2. Copy it to `public/art/kaede/portrait.png`, run `npm run art` (the keyer detects blue), add `'kaede'` to `FULL_BODY` in `src/data/progression.ts`.
3. Generate the 9 moods on blue with the approved PNG as reference (docs/ART_GUIDE.md §9; each took about 2 minutes here), import, check each silhouette is within about 0.5 % of the base.
4. `npm run smoke`, look at home, profile, chat and Bond; update `docs/ART_ASSETS.md`; delete this folder and the branch.
