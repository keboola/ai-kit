#!/bin/bash
# postgif.sh — turn a recorded webm into a docs "GIF": sped-up, scaled, looping mp4 + poster.
# Usage: scripts/postgif.sh <in.webm> <out-basename> [speedup]
# Produces <out-basename>.mp4 and <out-basename>-poster.png
set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"   # the docs-clip skill; outputs go where the caller says, relative to the project root
IN="$1"; OUT="$2"; SPEED="${3:-6}"
# setpts speeds up video; no audio track in Playwright recordings
ffmpeg -y -i "$IN" -vf "setpts=PTS/${SPEED},scale=1280:-2,fps=24" \
  -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart -an "${OUT}.mp4"
# poster = last frame (the result state), extracted from the sped-up file
DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${OUT}.mp4")
ffmpeg -y -ss "$(echo "$DUR - 0.1" | bc)" -i "${OUT}.mp4" -frames:v 1 "${OUT}-poster.png"
ls -la "${OUT}.mp4" "${OUT}-poster.png"
