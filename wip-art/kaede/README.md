# Kaede full-body portrait (work in progress, not yet approved by the owner)

- `portrait-green.png`: first Codex result (green screen). Body and costume clean; the flame got a yellow-green fringe when keyed.
- `portrait-blue.png`: the same image regenerated on a pure blue screen (#0000FF) so the flame keys cleanly. Not yet checked.
- `prompt.txt`: the prompt used (reference was the old `public/art/kaede/portrait.webp`).

Next: key `portrait-blue.png` (copy to `public/art/kaede/portrait.png`, run `npm run art`; the keyer detects blue), check the flame edges, show the owner. Once approved: generate the 9 moods on blue (see docs/ART_GUIDE.md §9), import, add 'kaede' to FULL_BODY in src/data/progression.ts, smoke, then delete this folder and branch.
