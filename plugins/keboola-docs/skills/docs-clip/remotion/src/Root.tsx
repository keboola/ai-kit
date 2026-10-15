import React from "react";
import { Composition } from "remotion";
import { FPS as NFPS, H as NH, W as NW, Narrated, narratedTotal } from "./Narrated";
import { FPS as HFPS, HubExplainer, TOTAL as HTOTAL } from "./examples/HubExplainer";
import { AppsRange, TOTAL as RTOTAL } from "./examples/AppsRange";
import timeline from "../public/timeline.json";

// Three forms (docs-clip/references/clip-grammar.md):
//   Narrated     a 2x recording with a caption band above the frame, camera, rings, labelled speed-ups
//                data: public/timeline.json + the source mp4 it names (made by scripts/pace.py)
//   HubExplainer the Getting Started hub: a line that draws itself, then a card with the app (example)
//   AppsRange    five app cards on a ring (example; needs public/clips/<key>.mp4 and -first/-last.png)
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Narrated" component={Narrated} durationInFrames={narratedTotal(timeline)} fps={NFPS} width={NW} height={NH} />
    <Composition id="HubExplainer" component={HubExplainer} durationInFrames={HTOTAL} fps={HFPS} width={1280} height={800} />
    <Composition id="AppsRange" component={AppsRange} durationInFrames={RTOTAL} fps={30} width={1280} height={800} />
  </>
);
