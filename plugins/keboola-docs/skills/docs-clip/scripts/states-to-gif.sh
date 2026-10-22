#!/bin/bash
# states-to-gif.sh — a behaviour GIF from a handful of stills, the way the component docs do it.
#
# The small GIFs under extend/component/ui-options/ui-examples are near-slideshows: a few states,
# long holds, cropped to one control, under ~250 KB. Smooth screen recording of a text-heavy page
# comes out at 2-3 MB; five states with repeated frames come out at 20-100 KB, because gifsicle
# collapses the repeats back into one frame each. So: capture states with Playwright
# (page.screenshot with a clip), then run this.
#
# Usage: states-to-gif.sh <out.mp4|out.gif> <fps> "<png>:<frames> <png>:<frames> ..." [crop=W:H:X:Y]
#
# For a docs page the output is an MP4 loop (Nikita, 2026-10-22): 30 fps with the dissolves
# ring-frames.py draws, H.264, about 110 KB for a full 760 px screen, where a GIF with the same
# smoothness was 720 KB. It plays like a GIF (<video autoplay loop muted playsinline poster>), and
# <out>-poster.png (the first state with its ring) is written next to it for reduced motion.
# A .gif output is for Slack and PRs: pass ring-frames.py --fps 10 --xfade 0.2 --ring-in 0.2.
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
  for _ in $(seq "$n"); do i=$((i+1)); cp "$png" "$SEQ/f$(printf '%04d' "$i").png"; done
done
CROPF=""; [ -n "$CROP" ] && CROPF="crop=${CROP#crop=},"
case "$OUT" in
  *.mp4)
    # even sides for yuv420p; slow preset + crf 26 keeps UI text sharp at ~100 KB
    ffmpeg -v error -y -framerate "$FPS" -i "$SEQ/f%04d.png" \
      -vf "${CROPF}pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0:white,format=yuv420p" \
      -c:v libx264 -preset slow -crf 26 -movflags +faststart -an "$OUT"
    POSTER="${OUT%.mp4}-poster.png"
    first=""; for item in $PLAN; do n="${item##*:}"; if [ "$n" -gt 1 ]; then first="${item%%:*}"; break; fi; done
    if [ -n "$CROP" ]; then ffmpeg -v error -y -i "${first:-$SEQ/f0001.png}" -vf "${CROPF%,}" "$POSTER"; else cp "${first:-$SEQ/f0001.png}" "$POSTER"; fi
    ;;
  *)
    VF="${CROPF}split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle"
    ffmpeg -v error -y -framerate "$FPS" -i "$SEQ/f%04d.png" -vf "$VF" "$SEQ/raw.gif"
    gifsicle -O3 --lossy=40 --colors 96 "$SEQ/raw.gif" -o "$OUT" 2>/dev/null
    ;;
esac
rm -rf "$SEQ"
printf '%s  %s bytes  %ss  ' "$OUT" "$(stat -f%z "$OUT")" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")"
ffprobe -v error -select_streams v -show_entries stream=width,height -of csv=p=0 "$OUT"
[ -n "${POSTER:-}" ] && echo "poster: $POSTER"
true

