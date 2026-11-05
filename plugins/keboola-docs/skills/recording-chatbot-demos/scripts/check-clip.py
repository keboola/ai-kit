#!/usr/bin/env python3
"""check-clip.py <clip.mp4> [--answers answers.json --prompts prompts.json] [--max-still 4]

Checks a clip made by edit-clip.py (it reads <clip>.json next to it) before it is sent:
  still stretches   ffmpeg freezedetect at -95 dB on full resolution: typing and a "Thinking…" indicator
                    count as motion, a screen that only waits does not. Longer than --max-still = FAIL
  recorder warnings a WARN mark for a prompt (e.g. its answer was never scrolled through) = FAIL
  expected values   with --answers and --prompts: every "expect" regex of a prompt must match its answer (case-insensitive)
  contact sheet     <clip>-sheet.png, one row per prompt: typed, thinking, answer, question at the top, end
Prints PASS or FAIL with the reasons; exit code 1 on FAIL. Read the sheet yourself either way.
"""
import argparse, json, os, re, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument("clip")
ap.add_argument("--max-still", type=float, default=4.0)
ap.add_argument("--answers"); ap.add_argument("--prompts")
A = ap.parse_args()
base = os.path.splitext(A.clip)[0]
info = json.load(open(base + ".json"))
P = {int(k): v for k, v in info["prompts"].items()}
fails, notes = [], []

# 1. still stretches
err = subprocess.run(["ffmpeg", "-hide_banner", "-i", A.clip, "-vf", "freezedetect=n=-95dB:d=1.5", "-an", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r"freeze_start: ([0-9.]+)", err)]
ends = [float(x) for x in re.findall(r"freeze_end: ([0-9.]+)", err)] + [info["total"]] * 2
runs = []
for s, e in zip(starts, ends):
    if runs and s - runs[-1][1] < 0.4:   # a one-frame blip splits one still stretch in two
        runs[-1][1] = e
    else:
        runs.append([s, e])
for s, e in runs:
    at_end = e > info["total"] - 0.8          # the last still runs into the fade to white
    if e - s > (A.max_still + 1.5 if at_end else A.max_still):
        where = next((f"prompt {n}" for n, ev in sorted(P.items()) if (ev.get("click") or 0) - 2 <= s <= (ev.get("end") or 1e9)), "between prompts")
        fails.append(f"still for {e - s:.1f} s at {s:.1f}-{e:.1f} s ({where})")

# 2. recorder warnings
for n, ev in sorted(P.items()):
    for w in ev.get("warn", []):
        fails.append(f"prompt {n}: {w}")

# 3. expected values in the answers
if A.answers and A.prompts:
    answers = {int(k): v for k, v in json.load(open(A.answers)).items()}
    for i, p in enumerate(json.load(open(A.prompts)), 1):
        for want in (p.get("expect", []) if isinstance(p, dict) else []):
            if i in answers and not re.search(want, answers[i], re.I):
                fails.append(f"prompt {i}: answer does not match {want!r}")
            elif i not in answers:
                notes.append(f"prompt {i}: no answer text saved")

# 4. contact sheet
rows = []
for n, ev in sorted(P.items()):
    ts = [ev.get("typed"), (ev.get("send") or 0) + 2, ev.get("answer"), (ev.get("up") or 0) + 2.2, (ev.get("end") or 0) - 0.5]
    tiles = []
    for j, t in enumerate(ts):
        f = f"{base}-sheet-{n}-{j}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0, t or 0):.2f}", "-i", A.clip, "-frames:v", "1", "-vf", "scale=480:-2", f], check=True)
        tiles.append(f)
    row = f"{base}-sheet-{n}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *sum([["-i", t] for t in tiles], []), "-filter_complex", f"hstack={len(tiles)}", row], check=True)
    rows.append(row); [os.remove(t) for t in tiles]
sheet = base + "-sheet.png"
subprocess.run(["ffmpeg", "-v", "error", "-y", *sum([["-i", r] for r in rows], []), "-filter_complex", f"vstack={len(rows)}" if len(rows) > 1 else "null", sheet], check=True)
[os.remove(r) for r in rows]

print(("FAIL" if fails else "PASS"), os.path.basename(A.clip), f"{info['total']:.1f} s, {len(P)} prompt(s), sheet {os.path.basename(sheet)}")
for f in fails: print("  FAIL", f)
for x in notes: print("  note", x)
sys.exit(1 if fails else 0)
