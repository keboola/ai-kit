#!/usr/bin/env python3
"""pace.py: cut and pace a raw 2x capture into public/<name>.mp4 and write public/timeline.json
for the Narrated composition. Generalised from the with-kai take 8 edit (edit8.py, 2026-10-09).

    python3 scripts/pace.py plan.json

plan.json:
{
  "raw": "~/.keboola-shots/<take>/raw.mp4",      # the 2x capture (e.g. 2560x1600)
  "name": "pause",                                # writes public/pause.mp4 and public/timeline.json
  "fps": 30, "zoom": 1.6, "srcW": 2560, "srcH": 1600,
  "segments": [                                   # raw seconds; speed 1 plays real time; holds clone a frame
    {"id": "A", "from": 1.2, "to": 3.9, "speed": 1, "holdBefore": 1.4},
    {"id": "C", "from": 12.6, "to": 47.4, "speed": 10},
    {"id": "E", "from": 61.4, "to": 63.0, "speed": 1, "holdAfter": 2.4}
  ],
  "marks": {"click-kai": 3.2, "click-approve": 51.0},   # raw seconds of the clicks (from the recorder's log)
  "camera": [                                     # clip-time expressions: a number, "mark:<name>±s", "seg:<id>.start±s" / ".end±s"
    {"t": 0, "cx": 1280, "cy": 800, "z": 1}, {"t": 1.6, "cx": 1280, "cy": 800, "z": 1},
    {"t": "mark:click-kai-0.9", "cx": 1760, "cy": 500, "z": "zoom"},
    {"t": "seg:E.end-1.6", "cx": 1280, "cy": 800, "z": 1}, {"t": "seg:E.end", "cx": 1280, "cy": 800, "z": 1}
  ],
  "rings": [{"from": 0.45, "to": "mark:click-kai+0.05", "x": 2269, "y": 16, "w": 187, "h": 64}],
  "captions": [
    {"from": 0, "to": "seg:C.start", "n": "1", "html": "Open <b>Kai Agent</b>"},
    {"from": "seg:C.start", "to": "seg:C.end", "html": "Kai works on it", "pill": "sped up 10×"}
  ],
  "steps": [0, "seg:C.end"]
}
Times are resolved to clip seconds; boxes stay in raw pixels (the composition scales them).
"""
import json, os, re, subprocess, sys

plan = json.load(open(sys.argv[1]))
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.expanduser(plan["raw"])
FPS = plan.get("fps", 30)
Z = plan.get("zoom", 1.6)
SEGS = plan["segments"]

starts, t = [], 0.0
for s in SEGS:
    starts.append(t)
    t += s.get("holdBefore", 0) + (s["to"] - s["from"]) / s.get("speed", 1) + s.get("holdAfter", 0)
TOTAL_S = t
segT = {s["id"]: (round(st, 3), round(st + s.get("holdBefore", 0) + (s["to"] - s["from"]) / s.get("speed", 1) + s.get("holdAfter", 0), 3)) for s, st in zip(SEGS, starts)}

def clip(r):
    for s, st in zip(SEGS, starts):
        if s["from"] <= r <= s["to"]:
            return round(st + s.get("holdBefore", 0) + (r - s["from"]) / s.get("speed", 1), 3)
    raise ValueError(f"raw time {r} is in no segment")

marks = {k: clip(v) for k, v in plan.get("marks", {}).items()}

def resolve(v):
    if isinstance(v, (int, float)): return round(float(v), 3)
    if v == "zoom": return Z
    m = re.fullmatch(r"(mark|seg):([\w-]+?)(?:\.(start|end))?([+-]\d+(?:\.\d+)?)?", v)
    if not m: raise ValueError(f"bad time {v}")
    kind, name, edge, delta = m.groups()
    base = marks[name] if kind == "mark" else segT[name][0 if edge == "start" else 1]
    return round(base + float(delta or 0), 3)

inputs, chains = [], []
for i, s in enumerate(SEGS):
    inputs += ["-ss", str(s["from"]), "-to", str(s["to"]), "-i", RAW]
    pad = ""
    if s.get("holdBefore"): pad += f",tpad=start_duration={s['holdBefore']}:start_mode=clone"
    if s.get("holdAfter"): pad += f",tpad=stop_duration={s['holdAfter']}:stop_mode=clone"
    chains.append(f"[{i}:v]setpts=(PTS-STARTPTS)/{s.get('speed', 1)},fps={FPS}{pad},format=yuv420p[s{i}]")
fc = ";".join(chains) + ";" + "".join(f"[s{i}]" for i in range(len(SEGS))) + f"concat=n={len(SEGS)}:v=1:a=0[o]"
out = os.path.join(R, "public", plan["name"] + ".mp4")
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-map", "[o]", "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", "-an", out], check=True, timeout=900)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout)
frames = round(dur * FPS)

timeline = {
    "src": plan["name"] + ".mp4", "srcW": plan.get("srcW", 2560), "srcH": plan.get("srcH", 1600), "total": frames,
    "camera": [{"t": resolve(c["t"]), "cx": c["cx"], "cy": c["cy"], "z": resolve(c["z"])} for c in plan["camera"]],
    "rings": [{"from": resolve(r["from"]), "to": resolve(r["to"]), "x": r["x"], "y": r["y"], "w": r["w"], "h": r["h"]} for r in plan.get("rings", [])],
    "captions": [{"from": resolve(c["from"]), "to": resolve(c["to"]), "n": c.get("n", ""), "html": c["html"], "pill": c.get("pill", ""), "pillTo": resolve(c["pillTo"]) if c.get("pillTo") else None} for c in plan["captions"]],
    "steps": [resolve(s) for s in plan.get("steps", [0])],
}
json.dump(timeline, open(os.path.join(R, "public", "timeline.json"), "w"), indent=1, ensure_ascii=False)
print(f"{out}: {dur:.2f} s, {frames} frames; segments {segT}; marks {marks}")
print("next: npx remotion render Narrated out/" + plan["name"] + ".mp4, then the encode in docs-clip SKILL.md")
