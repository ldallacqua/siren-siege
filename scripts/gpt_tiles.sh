#!/usr/bin/env bash
# Has GPT image generation (through Codex CLI, signed in with the owner's ChatGPT plan) redraw
# every tile tN.png in the given work folders as oN.png, three at a time, up to three tries each.
# Usage: scripts/gpt_tiles.sh <work dir> [<work dir> …]     (folders made by gpt_upscale.py cut)
# Each tile is one GPT image (about two minutes). Tiles that already have their oN.png are skipped.
PROMPT="Call your built-in image generation tool exactly once, with the attached image as the input image and with transparent_background set to true, and use this instruction for it: 'This is an enlarged, soft section cut from a larger anime illustration of a woman. The flat dark colour around her is not part of the picture: it is empty background and must come out fully transparent. Redraw this section sharp, in the same 2:3 framing: keep every shape, line, colour, finger, fingernail, facial feature, ornament and pattern exactly where it is, edge to edge, with nothing moved, added, removed, completed or cropped, no border, no glow and no shadow around her. Add only the fine detail the softness hides: crisp clean line art and smooth shading, as a high resolution anime illustration with a transparent background.' Then copy the generated PNG, unchanged and with its alpha channel, to OUT in the current directory and stop. Do not write or run any code that creates or edits images. The only command you may run is the file copy. Do not read or change any other file."

one() {
  local dir="$1" n="$2" try
  for try in 1 2 3; do
    codex exec --skip-git-repo-check --ephemeral -s workspace-write -C "$dir" -i "$dir/t$n.png" -- "${PROMPT/OUT/o$n.png}" </dev/null >"$dir/log$n.txt" 2>&1
    [ -f "$dir/o$n.png" ] && break
  done
  [ -f "$dir/o$n.png" ] && echo "$dir/o$n.png ok" || echo "$dir/o$n.png FAILED"
}

running=0
for dir in "$@"; do
  dir="$(cd "$dir" && pwd -W 2>/dev/null || pwd)"
  for t in "$dir"/t*.png; do
    n="$(basename "$t" .png)"; n="${n#t}"
    [ -f "$dir/o$n.png" ] && continue
    one "$dir" "$n" &
    running=$((running + 1))
    if [ "$running" -ge 3 ]; then wait -n; running=$((running - 1)); fi
  done
done
wait
