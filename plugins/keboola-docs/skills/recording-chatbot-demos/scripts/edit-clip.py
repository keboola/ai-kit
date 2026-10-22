#!/usr/bin/env python3
"""edit-clip.py <take-dir> <out.mp4> [--prompts prompts.json] [--think 10] [--write-max N] [--type 1.3]
                                   [--max-still 3.5] [--zoom chat,typing,detail]

Paces a record-chat.mjs take into the delivered video. Works for one prompt or many asked in one chat.
Screen 1:1 by default (no captions, no badges), 1920 px wide, a short fade through white at both ends
so clips join cleanly back to back. Also writes:
  <out>.json         clip time of each prompt's events (check-clip.py reads it)
  <out>-poster.png   the frame with the last prompt's answer read to its end
  chapters           one per prompt, inside the MP4 (titles from --prompts); players can jump between them

--zoom (pick by the screen, SKILL.md "Zoom or the whole screen"); the camera eases, never cuts:
  chat     the whole screen for a moment, then the chat column for the rest (a large UI, small text)
  typing   ease in on the composer while the prompt is typed, back out after Send
  detail   after each answer, ease in on the config's zoomOn element (e.g. the Sources row), back out
Rendered by the Plain composition of keboola-docs:docs-clip (its remotion/, REMOTION_DIR overrides).

Pacing, per prompt (accepted on 2026-10-15 after "too fast" on a 3-5x faster cut):
  the empty chat and the click   1x (dead time over ~6 s compressed)
  typing                         --type, 1.3x
  typed -> Send                  1x (over ~4 s compressed)
  Thinking (before text appears) squeezed to --think s, ~10 (a 3 min wait plays at 18x; a short one at 1x)
  the answer being written       squeezed to ~10 s, so ~1x for a normal answer. A long stretch here is mostly tool
                                 steps ("Running a command…"), not text; --write-max caps the speed if text is shown
  the 8 s the recorder waits to call the answer done   CUT (the screen does not change in it)
  back to the question, a short pause, read down to the end   1x, 1 s hold at the very end
  any other still screen in the take (found with ffmpeg freezedetect)   squeezed to --max-still, 3.5 s
"""
import argparse, json, os, re, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument("take"); ap.add_argument("out")
ap.add_argument("--prompts", help="prompts.json, for chapter titles")
ap.add_argument("--think", type=float, default=10.0, help="seconds the Thinking wait is squeezed to")
ap.add_argument("--write-max", type=float, default=99.0, help="cap the speed of the writing stretch (default: no cap)")
ap.add_argument("--type", type=float, default=1.3, help="typing speed")
ap.add_argument("--max-still", type=float, default=3.5, help="longest a still screen may play, in seconds")
ap.add_argument("--zoom", default="", help="comma list of chat, typing, detail (renders through docs-clip's Remotion Plain)")
A = ap.parse_args()
WRITE_S = 10.5
zoom = [z for z in A.zoom.split(",") if z]
DETAIL_HOLD = 3.0   # extra seconds on the finished answer, for the ease in on the detail and back

d = json.load(open(os.path.join(A.take, "marks.json")))
M = {m[0]: m[1] for m in d["marks"]}
M_extra = {m[0]: m[2] for m in d["marks"]}
qs = sorted({int(k[1:].split("-")[0]) for k in M if k.startswith("q") and k.endswith("-end")})
if not qs:
    sys.exit("no finished prompt in marks.json (look for an 'error' mark)")

segs, cur = [], 0.3
def seg(a, b, speed=1.0, hold_before=0.0, hold_after=0.0):
    global cur
    if b - a >= 0.05:
        segs.append((a, b, max(1.0, speed), hold_before, hold_after))
    cur = b

for n in qs:
    t = lambda k: M[f"q{n}-{k}"]
    seg(cur, t("type") + 0.8, (t("type") + 0.8 - cur) / 6, hold_before=0.4 if n == qs[0] else 0)
    seg(cur, t("typed"), A.type)
    seg(cur, t("send") + 0.8, (t("send") + 0.8 - cur) / 4)
    first = M.get(f"q{n}-first", t("done"))
    seg(cur, first, (first - cur) / A.think)
    last = max(cur + 0.5, t("done") - 7.5)            # the last change on screen
    seg(cur, last, min(A.write_max, (last - cur) / WRITE_S))
    cur = M.get(f"q{n}-up", t("done")) - 0.3          # skip the still stretch
    extra = DETAIL_HOLD if "detail" in zoom and M_extra.get(f"q{n}-detail") else 0
    seg(cur, t("end"), 1.0, hold_after=(1.0 if n == qs[-1] else 0) + extra)

# The marks only roughly tell when the screen stopped changing, so find the still stretches in the raw
# take itself (the check-clip.py detector, cached in stills.json) and squeeze any of them that would
# play longer than --max-still. Typing and a "Thinking…" indicator count as motion at -95 dB.
cache = os.path.join(A.take, "stills.json")
if os.path.exists(cache) and os.path.getmtime(cache) > os.path.getmtime(os.path.join(A.take, "raw.mp4")):
    stills = json.load(open(cache))
else:
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", os.path.join(A.take, "raw.mp4"), "-vf", "freezedetect=n=-95dB:d=1.5",
                          "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    ss = [float(x) for x in re.findall(r"freeze_start: ([0-9.]+)", err)]
    es = [float(x) for x in re.findall(r"freeze_end: ([0-9.]+)", err)] + [1e9]
    stills = []
    for s, e in zip(ss, es):
        if stills and s - stills[-1][1] < 0.4: stills[-1][1] = e
        else: stills.append([s, e])
    json.dump(stills, open(cache, "w"))
out_segs = []
for a, b, sp, hb, ha in segs:
    pieces, x = [], a
    for s, e in stills:
        s, e = max(s, a), min(e, b)
        if e - s > 0 and (e - s) / sp > A.max_still:
            if s > x: pieces.append([x, s, sp])
            pieces.append([s, e, (e - s) / A.max_still]); x = e
    if b > x: pieces.append([x, b, sp])
    for i, (pa, pb, psp) in enumerate(pieces):
        out_segs.append((pa, pb, max(1.0, psp), hb if i == 0 else 0, ha if i == len(pieces) - 1 else 0))
segs = [s for s in out_segs if s[1] - s[0] >= 0.05]

# raw time -> clip time
starts, acc = [], 0.0
for a, b, sp, hb, ha in segs:
    starts.append(acc); acc += hb + (b - a) / sp + ha
total = acc
def clip(r):
    for (a, b, sp, hb, ha), st in zip(segs, starts):
        if a <= r <= b:
            return round(st + hb + (r - a) / sp, 2)
    return None
events = {}
for n in qs:
    e = {k: clip(M[f"q{n}-{k}"]) for k in ("click", "typed", "send", "first", "up", "read", "end") if f"q{n}-{k}" in M}
    e["answer"] = clip(M[f"q{n}-done"] - 7.6)          # the answer just finished, before the scroll
    e["warn"] = [k for k in M if k.startswith(f"q{n}-WARN")]
    events[n] = e

raw = os.path.join(A.take, "raw.mp4")
inputs, chains = [], []
for i, (a, b, sp, hb, ha) in enumerate(segs):
    inputs += ["-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", raw]
    pad = (f",tpad=start_duration={hb}:start_mode=clone" if hb else "") + (f",tpad=stop_duration={ha}:stop_mode=clone" if ha else "")
    chains.append(f"[{i}:v]setpts=(PTS-STARTPTS)/{sp:.4f},fps=30{pad}[s{i}]")
scale_fade = f"scale=1920:-2:flags=lanczos,fade=t=in:st=0:d=0.25:color=white,fade=t=out:st={total - 0.6:.2f}:d=0.6:color=white,"
fc = ";".join(chains) + ";" + "".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0[c];" \
     f"[c]{'' if zoom else scale_fade}format=yuv420p[o]"

# chapters: one per prompt, starting where its click begins (the first one at 0)
prompts = json.load(open(A.prompts)) if A.prompts else []
title = lambda n: (prompts[n - 1] if isinstance(prompts[n - 1], str) else prompts[n - 1]["prompt"]) if n <= len(prompts) else f"Prompt {n}"
meta = os.path.splitext(A.out)[0] + ".chapters.txt"
with open(meta, "w") as f:
    f.write(";FFMETADATA1\n")
    bounds = [0.0] + [max(0.0, (events[n].get("click") or 0) - 1.5) for n in qs[1:]] + [total]
    for i, n in enumerate(qs):
        t_ = title(n).replace("=", "\\=").replace(";", "\\;").replace("#", "\\#")
        f.write(f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={int(bounds[i] * 1000)}\nEND={int(bounds[i + 1] * 1000)}\ntitle={n} · {t_[:90]}\n")

def encode_final(src_inputs, vf_map):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *src_inputs, "-i", meta, *vf_map, "-map_chapters", str(src_inputs.count("-i")),
                    "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-movflags", "+faststart", "-an", A.out], check=True)

if not zoom:
    encode_final(inputs, ["-filter_complex", fc, "-map", "[o]"])
else:
    R = os.environ.get("REMOTION_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs-clip", "remotion")
    if not os.path.exists(os.path.join(R, "node_modules")):
        sys.exit(f"no Remotion project with node_modules at {R}: npm install there, or set REMOTION_DIR")
    name = "chatdemo-" + os.path.splitext(os.path.basename(A.out))[0]
    paced = os.path.join(R, "public", name + ".mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-map", "[o]", "-c:v", "libx264",
                    "-preset", "medium", "-crf", "12", "-an", paced], check=True)
    sw, sh = map(int, subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                                      "-of", "csv=p=0", paced], capture_output=True, text=True).stdout.strip().split(","))
    css = 2.0   # raw px per css px: record-chat.mjs captures at device scale 2
    FULL = {"cx": sw / 2, "cy": sh / 2, "z": 1}
    last_n = qs[-1]
    fb, sb = M_extra[f"q{last_n}-field"], M_extra[f"q{last_n}-send-box"]
    left, right = fb["x"] - 50, sb["x"] + sb["w"] + 50
    CHAT = {"cx": (left + right) / 2 * css, "cy": sh / 2, "z": round(min(1.6, (sw / css) / (right - left)), 3)}
    base = CHAT if "chat" in zoom else FULL
    cam = [(0, FULL), (1.2, FULL), (2.4, base)] if "chat" in zoom else [(0, FULL)]
    for n in qs:
        ev = events[n]
        if "typing" in zoom and ev.get("click") and ev.get("send"):
            f_, s_ = M_extra[f"q{n}-field"], M_extra[f"q{n}-send-box"]
            l2, r2 = f_["x"] - 60, s_["x"] + s_["w"] + 30
            Z = {"cx": (l2 + r2) / 2 * css, "cy": (f_["y"] + f_["h"] / 2) * css - 150, "z": round(min(1.6, (sw / css) / (r2 - l2)), 3)}
            cam += [(ev["click"] - 1.2, base), (ev["click"] - 0.3, Z), (ev["send"] + 0.4, Z), (ev["send"] + 1.4, base)]
        det = M_extra.get(f"q{n}-detail")
        if "detail" in zoom and det and ev.get("end"):
            E = ev["end"] + DETAIL_HOLD + (1.0 if n == qs[-1] else 0)   # where this prompt's held answer ends
            Z = {"cx": (det["x"] + det["w"] / 2) * css, "cy": (det["y"] + det["h"] / 2) * css,
                 "z": round(min(1.6, (sw / css) / (det["w"] + 80)), 3)}
            cam += [(E - 4.4, base), (E - 3.5, Z), (E - 1.1, Z), (E - 0.2, base)]
    cam += [(total - 0.9, base), (total - 0.15, FULL), (total, FULL)]
    cam.sort(key=lambda c: c[0])
    kept = []
    for t_, c in cam:
        if kept and t_ - kept[-1][0] < 0.05: continue
        kept.append((round(t_, 3), c))
    props = {"timeline": {"src": name + ".mp4", "srcW": sw, "srcH": sh, "total": round(total * 30),
                          "camera": [{"t": t_, **c} for t_, c in kept], "rings": []}}
    pj = os.path.join(R, "public", name + ".props.json")
    json.dump(props, open(pj, "w"))
    rendered = os.path.join(R, "out", name + ".mp4")
    subprocess.run(["npx", "remotion", "render", "Plain", rendered, f"--props={pj}", "--log=error"], cwd=R, check=True)
    encode_final(["-i", rendered], ["-vf", "scale=in_range=pc:out_range=tv,format=yuv420p", "-map", "0:v"])
    for x in (paced, pj, rendered): os.remove(x)
os.remove(meta)
poster = os.path.splitext(A.out)[0] + "-poster.png"
pt = events[qs[-1]].get("read") or events[qs[-1]]["answer"] or total - 1.5
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{pt:.2f}", "-i", A.out, "-frames:v", "1", poster], check=True)
json.dump({"total": round(total, 2), "prompts": events}, open(os.path.splitext(A.out)[0] + ".json", "w"), indent=1)
print(A.out, f"{total:.1f} s,", len(segs), "segments, prompts", qs, "| poster", os.path.basename(poster))
