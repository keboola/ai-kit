#!/bin/zsh
# clip_metrics.sh — the numbers a docs clip is judged by, so no one has to eyeball them.
# Usage: clip_metrics.sh [--page-width <px>] <clip.mp4|clip.gif> [poster.png|.jpg|.webp] [out_dir]
# The second argument is taken as the poster only when it has an image extension, so
# `clip_metrics.sh clip.mp4 <out_dir>` works too.
# --page-width: how wide the page shows a full-width clip, default 713. Measured 2026-10-06 on a
# local preview of help.keboola.com (Starlight: 18rem sidebar, 52rem content, right-hand TOC) in a
# 1280-px window. Text a reader sees = canvas px x (713 / 1280) on a 1280-wide clip; the page
# shrinks a wider clip to the column (max-width: 100%) but never enlarges a narrower one.
# Prints duration, size, brightness (mean / min / darkest seconds), color range, cuts, and writes a contact sheet.
# Budgets it checks (docs-clip skill): an MP4 on a page <= 30 s and <= 1 MB; a GIF <= 250 KB and 3-9 s;
# either one bright: mean luma >= 200 and every sampled frame >= 180; the poster >= 180 too.
# The luma budget is measured on limited-range (tv) video, which is what yuv420p H.264 normally is
# (PNG and GIF frames are converted to tv range before they are measured). A full-range file
# (yuvj420p, color_range=pc) reads about 18 points brighter for the same picture, so the script
# prints the color range it measured and warns on pc; the budgets stay as they are.
zparseopts -D -E -F -- -page-width:=pw || exit 2
page_w="${${pw[-1]}#=}"; page_w="${page_w:-713}"
[[ "$page_w" == <1-> ]] || { echo "--page-width takes a width in px, got: $page_w"; exit 2; }
clip="$1"; poster=""; out=""
case "${2:l}" in
  *.png|*.jpg|*.jpeg|*.webp) poster="$2"; out="$3" ;;
  *) out="$2" ;;
esac
out="${out:-${TMPDIR:-/tmp}/clip-metrics}"
[[ -f "$clip" ]] || { echo "no such clip: $clip"; exit 2; }
mkdir -p "$out"
# ffprobe values one per line, not csv: for a stream with side data (Remotion's MP4s carry an ICC
# profile) ffprobe 9 appends an empty csv field, so the clip read "1280,800," against its poster's
# "1280,800", and s=x only turns that into "1280x800x".
probe() { ffprobe -v error -select_streams v:0 -show_entries "stream=$2" -of default=nw=1:nk=1 "$1"; }
wxh() { local -a v=( ${(f)"$(probe "$1" width,height)"} ); echo "${v[1]//[^0-9]}x${v[2]//[^0-9]}"; }
dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$clip")
size=$(stat -f%z "$clip")
dims=$(wxh "$clip")
[[ "$dims" == <1->x<1-> ]] || { echo "can't read the video size of $clip (got '$dims')"; exit 2; }
fps=$(probe "$clip" r_frame_rate)
range=$(probe "$clip" color_range); pixfmt=$(probe "$clip" pix_fmt)
ffmpeg -v error -i "$clip" -vf "fps=2,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=$out/luma.txt" -f null - 2>/dev/null
lum=$(awk '/pts_time:/{match($0,/pts_time:[0-9.]+/); t=substr($0,RSTART+9,RLENGTH-9)} /YAVG=/{split($0,a,"="); print t, a[2]}' "$out/luma.txt")
mean=$(echo "$lum" | awk '{s+=$2; n++} END{printf "%.0f", s/n}')
min=$(echo "$lum" | awk 'NR==1||$2<m{m=$2} END{printf "%.0f", m}')
dark=$(echo "$lum" | awk '$2<180{n++; if(n<=12) printf "%.1fs(%.0f) ", $1, $2} END{if(n>12) printf "... and %d more below 180", n-12}')
# fps=2 and a low threshold also catch crossfades, which never cross 0.25 frame to frame
cuts=$(ffmpeg -v error -i "$clip" -vf "fps=2,select='gt(scene,0.08)',metadata=print:file=-" -f null - 2>/dev/null | awk -F'pts_time:' '/pts_time/{split($2,a," "); printf "%.1f ", a[1]}')
ffmpeg -v error -y -i "$clip" -vf "fps=1/1.5,scale=640:-1,tile=4x5:margin=4:padding=4:color=white" -frames:v 1 "$out/contact.png"
ok() { [[ "$1" == 1 ]] && echo "ok" || echo "OVER BUDGET"; }
echo "clip:        $clip"
echo "dims / fps:  $dims @ $fps"
if [[ "${clip:l}" == *.gif ]]; then
  printf 'duration:    %.1f s   [%s, budget 3-9 s for a GIF]\n' "$dur" "$(ok $(echo "$dur >= 3 && $dur <= 9" | bc -l))"
  printf 'size:        %s B      [%s, budget 250 KB for a GIF]\n' "$size" "$(ok $(( size <= 256000 )))"
else
  printf 'duration:    %.1f s   [%s, budget 30 s]\n' "$dur" "$(ok $(echo "$dur <= 30" | bc -l))"
  printf 'size:        %s B      [%s, budget 1 MB]\n' "$size" "$(ok $(( size <= 1048576 )))"
fi
echo "brightness:  mean $mean, min $min (0-255)   [$( (( mean >= 200 && min >= 180 )) && echo ok || echo TOO DARK), budget mean>=200, min>=180]"
if [[ "$range" == pc || "$pixfmt" == yuvj* ]]; then
  echo "color range: $range ($pixfmt)  FULL RANGE: luma reads about 18 points brighter than on the tv video the budget is set on, so the brightness verdict is too kind; re-encode as yuv420p (tv) and measure again"
else
  echo "color range: $range ($pixfmt)"
fi
echo "dark frames: ${dark:-none below 180}"
echo "cuts at:     ${cuts:-none detected}"
echo "contact:     $out/contact.png  (read it)"
if [[ -n "$poster" && ! -f "$poster" ]]; then
  echo "poster:      $poster  MISSING (a page shows a black box until the video decodes)"
elif [[ -n "$poster" ]]; then
  pd=$(wxh "$poster")
  pl=$(ffmpeg -v error -i "$poster" -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - 2>/dev/null | awk -F= '/YAVG/{printf "%.0f", $2}')
  echo "poster:      $poster  $pd  luma $pl  [$( [[ "$pd" == "$dims" ]] && echo 'same dims as clip' || echo "DIMS DIFFER from the clip's $dims"), $( (( pl >= 180 )) && echo 'bright' || echo 'TOO DARK')]"
fi
cw=${dims%x*}
# the page shrinks a clip wider than the column to fit it and never enlarges a narrower one
shown=$(( cw < page_w ? cw : page_w )); scale=$(( 1.0 * shown / cw ))
printf 'rendered at: %d px wide in a %d-px column (--page-width) -> scale %d/%d = %.3f\n' $shown $page_w $shown $cw $scale
printf 'text size:   canvas px x %.3f = what a reader sees; want >= 13, so >= %d px on the canvas\n' $scale $(( (13 * cw + shown - 1) / shown ))
