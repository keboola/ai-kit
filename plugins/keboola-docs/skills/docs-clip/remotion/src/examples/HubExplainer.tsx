import React from "react";
import { AbsoluteFill, continueRender, delayRender, Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";

// The Getting Started hub clip (getting-started/index.mdx), 10.0 s at 30 fps, 1280x800.
// Two slides, as since 2026-09-29: "How Keboola works" as four numbered dots on a line, then the
// app this guide builds (app/grid-preview.png, Free Plan project 6375) beside the closing line.
// 2026-10-06: Jordan found the clip long, so the line draws faster (Nikita: then 1.5 times slower
// than the first cut, a dot every 0.67 s); the closing slide gets "Want to build" with a phrase
// that changes; and the look follows Keboola's design system (@keboola/design 13: Inter, slate text,
// Keboola blue #2563eb, #f9fafb canvas, white cards with a #e5e7eb edge and blue-grey shadows,
// motion easing cubic-bezier(0.2, 0.7, 0.2, 1), spring entrances as in Keboola's own Remotion videos).

export const FPS = 30;
export const TOTAL = 300;

const BG = "#f9fafb"; // --background
const TEXT = "#1e293b"; // --foreground
const PAST = "#475569"; // slate-600: a step already passed, still AA on the canvas
const BLUE = "#2563eb"; // --primary in light mode: "Keboola blue, AA-tuned" (4.95:1 on the canvas)
const TRACK = "#e5e7eb"; // --border
export const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Inter is the face of both @keboola/design and help.keboola.com; the files are Inter 4 (SIL OFL).
const fontsReady = delayRender("Inter");
Promise.all(
  [
    ["Inter-Medium.otf", "500"],
    ["Inter-SemiBold.otf", "600"],
    ["Inter-Bold.otf", "700"],
  ].map(([file, weight]) =>
    new FontFace("Inter", `url(${staticFile(`fonts/${file}`)})`, { weight }).load().then((face) => {
      document.fonts.add(face);
    }),
  ),
).then(() => continueRender(fontsReady));

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const motion = Easing.bezier(0.2, 0.7, 0.2, 1); // --motion-easing
const draw = Easing.bezier(0.4, 0, 0.2, 1); // the line reaching the next dot

// ---------- slide 1: the line ----------
// Michal, 2026-10-07 (via Nikita): more Kai in the process. The line reads as a hand-off: you have an
// idea and tell Kai, Kai does the work. "Kai loads your data" is the Prompt path of
// getting-started/load (Kai sets up the HTTP data source and runs it); the hub's first paragraph
// says it too. One line per step, about as long as the 6 Oct labels, because the line keeps its
// timing (the checker: 79 characters in 3.9 s was too much to read); the word Kai in blue.
const STEPS = ["Your idea", "Tell Kai", "Kai loads your data", "Kai builds the app"];

// "Kai" in Keboola blue wherever it appears in a step
const withKai = (line: string) =>
  line.split(/(Kai)/).map((part, k) =>
    part === "Kai" ? (
      <span key={k} style={{ color: BLUE }}>
        Kai
      </span>
    ) : (
      part
    ),
  );
const X0 = 96;
const Y = 384;
const XS = [196, 484, 772, 1060]; // 288 px apart, so the two long labels keep a gap
const STEP_AT = [6, 26, 46, 66]; // a segment starts to draw every 20 frames (0.67 s)
const SEG = 12; // frames to draw one segment
const LINE_OUT = 118; // the whole line stays from frame 91 (0.9 s), then leaves over 10 frames

const dotAt = (i: number) => STEP_AT[i] + SEG - 1;

const LineScreen: React.FC<{ f: number }> = ({ f }) => {
  const out = interpolate(f, [LINE_OUT, LINE_OUT + 10], [0, 1], { ...clamp, easing: motion });
  const titleIn = interpolate(f, [0, 12], [0, 1], { ...clamp, easing: motion });
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `translateY(${-24 * out}px)` }}>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 86,
          fontSize: 46,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: TEXT,
          opacity: titleIn,
          transform: `translateY(${10 * (1 - titleIn)}px)`,
        }}
      >
        How Keboola works
      </div>
      <svg width={1280} height={800} viewBox="0 0 1280 800" style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={X0} y1={Y} x2={XS[3]} y2={Y} stroke={TRACK} strokeWidth={4} strokeLinecap="round" opacity={titleIn} />
        {XS.map((x, i) => {
          const from = i === 0 ? X0 : XS[i - 1];
          const p = interpolate(f, [STEP_AT[i], STEP_AT[i] + SEG], [0, 1], { ...clamp, easing: draw });
          if (p <= 0) return null;
          return <line key={`s${i}`} x1={from} y1={Y} x2={from + (x - from) * p} y2={Y} stroke={BLUE} strokeWidth={4} strokeLinecap="round" />;
        })}
        {XS.map((x, i) => {
          const t0 = dotAt(i);
          if (f < t0) return null;
          const s = spring({ frame: f - t0, fps: FPS, config: { damping: 12, stiffness: 170, mass: 0.7 } });
          const current = i === XS.length - 1 || f < dotAt(i + 1);
          const ring = current ? interpolate(f, [t0, t0 + 8], [0, 1], clamp) : 0;
          const pulse = 1 + 0.08 * (1 - Math.cos(((f - t0) / 48) * 2 * Math.PI)); // 1 -> 1.16 -> 1 in 1.6 s
          return (
            <g key={`d${i}`}>
              {ring > 0 ? <circle cx={x} cy={Y} r={34 * pulse} fill="rgba(37, 99, 235, 0.14)" opacity={ring} /> : null}
              <g transform={`translate(${x} ${Y}) scale(${s})`}>
                <circle r={22} fill={BLUE} />
                <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={24} fontWeight={600} fontFamily={FONT}>
                  {i + 1}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      {XS.map((x, i) => {
        const c0 = STEP_AT[i] + SEG + 1;
        const c = interpolate(f, [c0, c0 + 12], [0, 1], { ...clamp, easing: motion });
        const past = i < XS.length - 1 && f >= dotAt(i + 1);
        return (
          <div
            key={`c${i}`}
            style={{
              position: "absolute",
              left: x - 144,
              top: 452,
              width: 288,
              textAlign: "center",
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              color: past ? PAST : TEXT,
              opacity: c,
              transform: `translateY(${12 * (1 - c)}px)`,
            }}
          >
            {withKai(STEPS[i])}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- slide 2: the guide's app, and what else you could build ----------
// The first phrase points at the card, the guide's own app; the others are kinds from
// data-apps/what-are-apps "What you can build" (Dashboards; Anything interactive: "configurators,
// simulators"): apps, dashboards, something interactive, as Jordan put it. The hub's sample
// paragraph names them in one sentence.
const PHRASES = ["an app like this one?", "an interactive dashboard?", "a what-if simulator?"];
// Nikita, 2026-10-07: a screen under each phrase. The card shows the guide's grid, then two apps Kai
// built in project 264 on 2026-10-06 (the last frames of the ../apps-range takes): the Store pulse
// dashboard on the project's Shopify sample, switched to the last 12 months, and the Café staffing
// planner on this guide's café sales, at 31 °C on a Saturday. Each fades in as its phrase arrives.
const SCREENS = ["grid.png", "screens/dash.png", "screens/planner.png"];
const CARD_H = 445; // 712 wide at the takes' 1280x800; the grid (2068x1262) sits at the top of it
const CARD_IN = 126; // the card arrives as the line leaves
const TEXT_IN = 134;
const PHRASE_AT = [134, 184, 234]; // 1.67 s each; the last one stays until the fade
const PHRASE_IN = 10; // frames to come in from below
const PHRASE_OUT = 8; // frames to leave upwards; the next one starts 4 frames into this
const END_FADE = 284; // then 15 frames to the empty first frame, so the loop has no jump

const Phrase: React.FC<{ k: number; f: number }> = ({ k, f }) => {
  const start = PHRASE_AT[k];
  const inn = interpolate(f, [start, start + PHRASE_IN], [0, 1], { ...clamp, easing: motion });
  const leave = k < PHRASES.length - 1 ? PHRASE_AT[k + 1] - 4 : 0;
  const out = leave ? interpolate(f, [leave, leave + PHRASE_OUT], [0, 1], { ...clamp, easing: motion }) : 0;
  const o = inn * (1 - out);
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, right: 0, color: BLUE, opacity: o, transform: `translateY(${14 * (1 - inn) - 14 * out}px)` }}>
      {PHRASES[k]}
    </div>
  );
};

const BIG: React.CSSProperties = { fontSize: 40, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.02em" };

const GridScreen: React.FC<{ f: number }> = ({ f }) => {
  if (f < CARD_IN) return null;
  const fade = interpolate(f, [END_FADE, TOTAL - 1], [1, 0], { ...clamp, easing: motion });
  // a spring entrance, as Keboola's Remotion videos bring in their panels
  const card = spring({ frame: f - CARD_IN, fps: FPS, config: { damping: 15, stiffness: 100, mass: 1 } });
  const text = interpolate(f, [TEXT_IN, TEXT_IN + 12], [0, 1], { ...clamp, easing: motion });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {/* the card where it always was: left 56, top 132, 712 wide */}
      <div
        style={{
          position: "absolute",
          left: 56,
          top: 132,
          width: 712,
          height: CARD_H,
          borderRadius: 12,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 0 0 1px #e5e7eb, 0 1px 4px rgba(100, 135, 153, 0.15), 0 20px 44px -16px rgba(100, 135, 153, 0.35)",
          opacity: Math.min(1, card),
          transform: `translateY(${24 * (1 - card)}px)`,
        }}
      >
        {SCREENS.map((src, k) => {
          // through the card's white, in step with the phrase: the old screen goes in 5 frames, the
          // new one comes in 8, so two busy screens are never on top of each other
          const inn = k === 0 ? 1 : interpolate(f, [PHRASE_AT[k] - 1, PHRASE_AT[k] + 7], [0, 1], { ...clamp, easing: motion });
          const out = k < SCREENS.length - 1 ? interpolate(f, [PHRASE_AT[k + 1] - 6, PHRASE_AT[k + 1] - 1], [0, 1], clamp) : 0;
          const o = inn * (1 - out);
          if (o <= 0) return null;
          return (
            <Img
              key={src}
              src={staticFile(src)}
              style={{ position: "absolute", left: 0, top: 0, width: "100%", height: k === 0 ? "auto" : "100%", opacity: o, background: "#fff" }}
            />
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 808, top: 226, width: 420, color: TEXT }}>
        <div style={{ ...BIG, opacity: text }}>Want to build</div>
        {/* two lines high, so "an interactive dashboard?" fits and the closing line never moves */}
        <div style={{ ...BIG, position: "relative", height: 96, marginTop: 4 }}>
          {PHRASES.map((_, k) => (
            <Phrase key={k} k={k} f={f} />
          ))}
        </div>
        <div style={{ marginTop: 22, fontSize: 26, fontWeight: 500, lineHeight: 1.35, opacity: text, transform: `translateY(${10 * (1 - text)}px)` }}>
          Go through the guide
          <br />
          and try it yourself.
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const HubExplainer: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BG, fontFamily: FONT }}>
      {f < LINE_OUT + 10 ? <LineScreen f={f} /> : null}
      <GridScreen f={f} />
    </AbsoluteFill>
  );
};
