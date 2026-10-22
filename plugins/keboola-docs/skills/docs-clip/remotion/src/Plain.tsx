import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";

// Plain recording (recording-chatbot-demos --zoom): the Narrated camera and rings with no caption band,
// no step dots and no words anywhere. A 2x capture plays under a camera that eases between keyframes; the clip
// ends with a fade through white so it loops. Data: the timeline passed as props (edit-clip.py --zoom writes it).
export type Timeline = {
  src: string;
  srcW: number;
  srcH: number;
  total: number;
  camera: { t: number; cx: number; cy: number; z: number }[];
  rings: { from: number; to: number; x: number; y: number; w: number; h: number }[];
};

export const FPS = 30;
export const W = 1920;
export const H = 1200;

const BLUE = "#1F8FEB";
const ease = Easing.bezier(0.65, 0, 0.35, 1);
const fade = (t: number, from: number, to: number, d = 0.2) =>
  interpolate(t, [from - d, from, to - d, to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const Plain: React.FC<{ timeline: Timeline }> = ({ timeline: tl }) => {
  const t = useCurrentFrame() / FPS;
  const C = tl.camera;
  let i = 0;
  while (i < C.length - 2 && t >= C[i + 1].t) i++;
  const a = C[i];
  const b = C[i + 1];
  const p = ease(Math.min(1, Math.max(0, (t - a.t) / Math.max(0.001, b.t - a.t))));
  const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * p);
  const s = (W / tl.srcW) * z;
  const hw = W / 2 / s;
  const hh = H / 2 / s;
  const cx = Math.min(tl.srcW - hw, Math.max(hw, a.cx + (b.cx - a.cx) * p));
  const cy = Math.min(tl.srcH - hh, Math.max(hh, a.cy + (b.cy - a.cy) * p));
  const end = tl.total / FPS;
  const white = interpolate(t, [0, 0.25, end - 0.6, end], [1, 0, 0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#fff", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: tl.srcW, height: tl.srcH, transformOrigin: "0 0", transform: `translate(${W / 2 - cx * s}px, ${H / 2 - cy * s}px) scale(${s})` }}>
        <OffthreadVideo src={staticFile(tl.src)} muted style={{ width: tl.srcW, height: tl.srcH }} />
        {tl.rings.map((r, k) => {
          const o = fade(t, r.from, r.to, 0.18);
          if (o <= 0) return null;
          const pad = 8 / s;
          return (
            <div
              key={k}
              style={{
                position: "absolute", left: r.x - pad, top: r.y - pad, width: r.w + 2 * pad, height: r.h + 2 * pad,
                border: `${3.5 / s}px solid ${BLUE}`, borderRadius: 12 / s, boxShadow: `0 0 0 ${6 / s}px rgba(31, 143, 235, 0.18)`, opacity: o,
              }}
            />
          );
        })}
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: white }} />
    </AbsoluteFill>
  );
};
