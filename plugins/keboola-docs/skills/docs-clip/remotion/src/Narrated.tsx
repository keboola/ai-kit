import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";

// Narrated recording: the with-kai "Where" clip form (take 8, 2026-10-09), made generic.
// A 2x capture plays under a camera that starts on the whole screen, eases to 1.6x on each target
// and pulls back out at the end; a rounded outline marks each control just before the pointer
// clicks it; captions sit in a band ABOVE the frame, never over the UI; every speed-up carries a
// pill ("sped up 10×"); step dots at the right. Data: public/timeline.json (scripts/pace.py writes it).
export type Timeline = {
  src: string;            // file under public/, the paced source (concat of the cut segments)
  srcW: number;           // raw capture size, e.g. 2560x1600 for a 1280x800 window at 2x
  srcH: number;
  total: number;          // frames
  camera: { t: number; cx: number; cy: number; z: number }[];              // keyframes, raw px, zoom
  rings: { from: number; to: number; x: number; y: number; w: number; h: number }[]; // raw px
  captions: { from: number; to: number; n?: string; html: string; pill?: string; pillTo?: number | null }[];
  steps: number[];        // clip seconds where a numbered step starts (for the dots)
};

export const FPS = 30;
export const W = 1280;
const BAND = 80;
export const H = 800 + BAND;
export const narratedTotal = (t: Timeline) => t.total;

const BLUE = "#1F8FEB";
const NAVY = "#0B2039";
const GREY = "#B8C4CF";
const FONT = "Inter, -apple-system, 'Segoe UI', Roboto, sans-serif";
const ease = Easing.bezier(0.65, 0, 0.35, 1);

const fontsReady = delayRender("Inter");
Promise.all(
  [["Inter-Medium.otf", "500"], ["Inter-SemiBold.otf", "600"], ["Inter-Bold.otf", "700"]].map(([file, weight]) =>
    new FontFace("Inter", `url(${staticFile(`fonts/${file}`)})`, { weight }).load().then((face) => document.fonts.add(face)),
  ),
).then(() => continueRender(fontsReady), () => continueRender(fontsReady));

const fade = (t: number, from: number, to: number, d = 0.2) =>
  interpolate(t, [from - d, from, to - d, to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const Narrated: React.FC<{ timeline?: Timeline }> = ({ timeline }) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tl: Timeline = timeline ?? (require("../public/timeline.json") as Timeline);
  const t = useCurrentFrame() / FPS;
  const camera = (time: number) => {
    const C = tl.camera;
    let i = 0;
    while (i < C.length - 2 && time >= C[i + 1].t) i++;
    const a = C[i];
    const b = C[i + 1];
    const p = ease(Math.min(1, Math.max(0, (time - a.t) / Math.max(0.001, b.t - a.t))));
    const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * p);
    const s = (W / tl.srcW) * z;
    const hw = W / 2 / s;
    const hh = 400 / s;
    const cx = Math.min(tl.srcW - hw, Math.max(hw, a.cx + (b.cx - a.cx) * p));
    const cy = Math.min(tl.srcH - hh, Math.max(hh, a.cy + (b.cy - a.cy) * p));
    return { s, cx, cy };
  };
  const { s, cx, cy } = camera(t);
  const step = tl.steps.filter((x) => t >= x).length - 1;
  return (
    <AbsoluteFill style={{ background: "#fff", fontFamily: FONT }}>
      <div style={{ position: "absolute", left: 0, top: BAND, width: W, height: 800, overflow: "hidden", background: "#F7F8FA" }}>
        <div style={{ position: "absolute", width: tl.srcW, height: tl.srcH, transformOrigin: "0 0", transform: `translate(${W / 2 - cx * s}px, ${400 - cy * s}px) scale(${s})` }}>
          <OffthreadVideo src={staticFile(tl.src)} muted style={{ width: tl.srcW, height: tl.srcH }} />
          {tl.rings.map((r, i) => {
            const o = fade(t, r.from, r.to, 0.18);
            if (o <= 0) return null;
            const pad = 8 / s;
            return (
              <div
                key={i}
                style={{
                  position: "absolute", left: r.x - pad, top: r.y - pad, width: r.w + 2 * pad, height: r.h + 2 * pad,
                  border: `${3.5 / s}px solid ${BLUE}`, borderRadius: 12 / s, boxShadow: `0 0 0 ${6 / s}px rgba(31, 143, 235, 0.18)`, opacity: o,
                }}
              />
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: BAND, borderBottom: "1px solid #E3E8EE", background: "#fff" }}>
        {tl.captions.map((c, i) => {
          const o = i === 0 && t < 0.2 ? 1 : fade(t, c.from, c.to, 0.2);
          if (o <= 0) return null;
          return (
            <div key={i} style={{ position: "absolute", left: 28, top: 0, height: BAND, display: "flex", alignItems: "center", gap: 14, opacity: o, color: NAVY, fontSize: 27, fontWeight: 600 }}>
              {c.n ? (
                <span style={{ display: "inline-grid", placeItems: "center", width: 40, height: 40, borderRadius: 20, background: BLUE, color: "#fff", fontSize: 24, fontWeight: 700 }}>{c.n}</span>
              ) : null}
              <span dangerouslySetInnerHTML={{ __html: c.html }} />
              {c.pill ? (
                <span style={{ marginLeft: 6, padding: "4px 14px", borderRadius: 999, background: "#E8F3FD", color: "#0B5CAD", fontSize: 24, fontWeight: 700, opacity: c.pillTo ? fade(t, c.from, c.pillTo, 0.2) : 1 }}>{c.pill}</span>
              ) : null}
            </div>
          );
        })}
        <div style={{ position: "absolute", right: 30, top: 0, height: BAND, display: "flex", alignItems: "center", gap: 10 }}>
          {tl.steps.map((_, k) => (
            <span key={k} style={{ width: 12, height: 12, borderRadius: 6, background: k <= step ? BLUE : GREY, opacity: k < step ? 0.45 : 1 }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
