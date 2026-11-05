import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Video } from "@remotion/media";

// Five Kai-built apps from project 264, one per kind on data-apps/what-are-apps "What you can build".
// Clips are 1280x800 @ 30 fps, cut and paced from the Playwright takes (see ../README.md).
const APPS = [
  { key: "dash", frames: 83, title: "Dashboards", text: "Track metrics, replace a BI seat for an internal view." },
  { key: "deal", frames: 109, title: "Internal tools", text: "Forms, approvals, and workflows that read and write back to your data." },
  { key: "story", frames: 115, title: "Data narratives", text: "Scrollable, explained stories built from your data." },
  { key: "planner", frames: 108, title: "Anything interactive", text: "Configurators, simulators, and more." },
  { key: "api", frames: 112, title: "Agent-facing services", text: "An API or an MCP server that other agents and services call." },
] as const;

export const FPS = 30;
const TURN = 26; // frames for one step of the ring
const N = APPS.length;

// play window of app i starts after i turns and the plays before it; a last turn brings app 0 back for the loop
const STARTS = APPS.reduce<number[]>((acc, a, i) => [...acc, i === 0 ? 0 : acc[i - 1] + APPS[i - 1].frames + TURN], []);
export const TOTAL = STARTS[N - 1] + APPS[N - 1].frames + TURN;

const ease = Easing.bezier(0.65, 0, 0.35, 1);

// fractional position of the ring: i while app i plays, i -> i+1 during a turn
const ringPosition = (frame: number) => {
  for (let i = 0; i < N; i++) {
    const playEnd = STARTS[i] + APPS[i].frames;
    if (frame < playEnd) return i;
    if (frame < playEnd + TURN) return i + ease((frame - playEnd) / TURN);
  }
  return N;
};

const KEBOOLA_BLUE = "#1F8FEB";
const NAVY = "#0B2039";
const GREY = "#516A80";
const CARD_W = 912;
const CARD_H = 570;

const Card: React.FC<{ i: number; p: number; frame: number }> = ({ i, p, frame }) => {
  // signed distance from the front, wrapped around the ring of five
  let d = i - (p % N);
  if (d > N / 2) d -= N;
  if (d < -N / 2) d += N;
  const angle = (d * 2 * Math.PI) / N;
  const x = Math.sin(angle) * 820;
  const z = (Math.cos(angle) - 1) * 1100;
  const opacity = interpolate(Math.abs(d), [0, 1, 1.7, 2], [1, 1, 0.35, 0], { extrapolateRight: "clamp" });
  const playing = frame >= STARTS[i] && frame < STARTS[i] + APPS[i].frames && Math.abs(d) < 0.01;
  const played = frame >= STARTS[i] + APPS[i].frames && frame < STARTS[i] + APPS[i].frames + TURN * 2;
  const a = APPS[i];
  return (
    <div
      style={{
        position: "absolute",
        left: (1280 - CARD_W) / 2,
        top: 200,
        width: CARD_W,
        height: CARD_H,
        transform: `translate3d(${x}px, 0px, ${z}px)`,
        zIndex: Math.round(100 - Math.abs(d) * 10),
        opacity,
        borderRadius: 14,
        overflow: "hidden",
        background: "#fff",
        border: "1px solid #DCE3EA",
        boxShadow: "0 18px 50px rgba(11, 32, 57, 0.10)",
      }}
    >
      {playing ? (
        <Video src={staticFile(`clips/${a.key}.mp4`)} from={STARTS[i]} style={{ width: "100%", height: "100%" }} muted />
      ) : (
        <Img src={staticFile(`clips/${a.key}-${played ? "last" : "first"}.png`)} style={{ width: "100%", height: "100%" }} />
      )}
    </div>
  );
};

export const AppsRange: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ringPosition(frame);
  const near = Math.round(p) % N;
  // the heading belongs to the app nearest the front; it fades out and in around the middle of a turn
  const titleOpacity = interpolate(Math.abs(p - Math.round(p)), [0, 0.25, 0.5], [1, 0.15, 0], { extrapolateRight: "clamp" });
  const a = APPS[near];
  return (
    <AbsoluteFill style={{ background: "#F6F8FB", fontFamily: "Inter, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ position: "absolute", left: 160, right: 160, top: 30, opacity: titleOpacity, textAlign: "center" }}>
        <div style={{ color: KEBOOLA_BLUE, fontSize: 22, fontWeight: 700, letterSpacing: "0.14em" }}>
          {near + 1} / {N} · WHAT YOU CAN BUILD
        </div>
        <div style={{ color: NAVY, fontSize: 48, fontWeight: 800, letterSpacing: "-0.01em", marginTop: 8, lineHeight: 1.1 }}>{a.title}</div>
        <div style={{ color: GREY, fontSize: 24, fontWeight: 500, marginTop: 8 }}>{a.text}</div>
      </div>
      <div style={{ position: "absolute", inset: 0, perspective: 1600, perspectiveOrigin: "50% 45%", transformStyle: "preserve-3d" }}>
        {APPS.map((_, i) => (
          <Card key={i} i={i} p={p} frame={frame} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
