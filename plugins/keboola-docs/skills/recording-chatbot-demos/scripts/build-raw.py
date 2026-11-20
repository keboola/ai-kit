#!/usr/bin/env python3
"""build-raw.py <take-dir> : the screencast frames + their timestamps (marks.json) -> <take>/raw.mp4 at a
constant 30 fps in real time, so a mark at t seconds is at t seconds in the video."""
import json, os, subprocess, sys
T = sys.argv[1]
d = json.load(open(os.path.join(T, "marks.json")))
fr = d["frames"]
end = max(fr[-1][1] + 0.5, max(m[1] for m in d["marks"]))
with open(os.path.join(T, "frames.txt"), "w") as f:
    for i, (name, t) in enumerate(fr):
        nxt = fr[i + 1][1] if i + 1 < len(fr) else end
        f.write(f"file 'frames/{name}'\nduration {max(0.001, nxt - t):.3f}\n")
    f.write(f"file 'frames/{fr[-1][0]}'\n")
first = fr[0][1]
# pad the start with the first frame so video time == mark time
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "frames.txt",
                "-vf", f"tpad=start_duration={first:.3f}:start_mode=clone,fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
                "-c:v", "libx264", "-preset", "medium", "-crf", "14", "raw.mp4"], check=True, cwd=T)
print("raw.mp4", round(end, 2), "s,", len(fr), "frames")
