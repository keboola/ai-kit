#!/bin/bash
# states-to-gif.sh — a behaviour GIF from a handful of stills, the way the component docs do it.
#
# The small GIFs under extend/component/ui-options/ui-examples are near-slideshows: a few states,
# long holds, cropped to one control, under ~250 KB. Smooth screen recording of a text-heavy page
# comes out at 2-3 MB; five states with repeated frames come out at 20-100 KB, because gifsicle
# collapses the repeats back into one frame each. So: capture states with Playwright
# (page.screenshot with a clip), then run this.
#
# Usage: states-to-gif.sh <out.gif> <fps> "<png>:<frames> <png>:<frames> ..." [crop=W:H:X:Y]
#   e.g. states-to-gif.sh add-task.gif 5 "s1.png:7 s2.png:4 s3.png:10 s4.png:4 s5.png:12"
#   <frames> is how many times the still repeats at <fps>: 10 frames at 5 fps = a 2 s hold.
# PRDCT-616: capture BELOW the top bar (clip.y >= 52 at 1280 wide) so the organization, project and
# branch names are never in a frame; do not rely on masking after the fact.
set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"   # the docs-clip skill; outputs go where the caller says, relative to the project root
OUT="$1"; FPS="$2"; PLAN="$3"; CROP="${4:-}"
SEQ="$(mktemp -d)"; i=0
for item in $PLAN; do
  png="${item%%:*}"; n="${item##*:}"
  for _ in $(seq "$n"); do i=$((i+1)); cp "$png" "$SEQ/f$(printf '%03d' "$i").png"; done
done
VF="split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none"
[ -n "$CROP" ] && VF="crop=${CROP#crop=},$VF"
ffmpeg -v error -y -framerate "$FPS" -i "$SEQ/f%03d.png" -vf "$VF" "$SEQ/raw.gif"
gifsicle -O3 --lossy=40 --colors 96 "$SEQ/raw.gif" -o "$OUT" 2>/dev/null
rm -rf "$SEQ"
printf '%s  %s bytes  ' "$OUT" "$(stat -f%z "$OUT")"
ffprobe -v error -select_streams v -show_entries stream=width,height,nb_frames -of csv=p=0 "$OUT"
