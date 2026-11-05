---
name: recording-chatbot-demos
description: "Use when someone needs screen videos of a chat assistant or chatbot answering prompts (Agnes/KAiDE, Kai, any LLM chat UI) for a demo, sales call, customer or Slack: \"record the 7 prompts\", \"запиши видео как Agnes отвечает\". Clips for help.keboola.com pages belong to docs-clip."
---

# Recording chatbot demos

A person types a prompt, the assistant thinks, writes and finishes, and the viewer reads the whole
answer. Nothing else is in the video: no captions, no badges, no zoom. Takes are never spliced
together, though cutting still frames inside one take is fine. Speed-ups stay gentle because the
viewer can skip forward ("Agreed, it's too fast. Riley can skip forward or back", Jordan, 2026-10-15).

It works for any web chat with a composer, a Send button and a chat list. Each app gets a JSON config
(`examples/kaide.json`); the keys are described at the top of `scripts/record-chat.mjs`. Notes for one
app go in `references/<app>.md`, for example `references/kaide.md`.

## Before recording: settle with the requester

| Question | Why it matters |
|---|---|
| One chat for all prompts, or a new chat per prompt? Quote their words back. | Both were asked for on the same day. A full run spends part of the account's daily AI cap, so a wrong guess costs a whole run. Prompts that say "those", "that request" or "the top ones" lean on earlier answers; mention it if they want new chats (KAiDE still answered them correctly). |
| One video per prompt, one joined video, or both? | Per-prompt clips join with `ffmpeg -f concat` at no cost. A one-chat version is a separate recording. |
| Which login? | A demo persona changes the answers (row-level access, "my region"). Use the login the guide names. |

Record one prompt end to end and show it before doing the rest with the same settings.

## The pipeline

Run from a folder with Playwright in `node_modules`, or set `PLAYWRIGHT_PATH`. Every script explains its
options in its header.

1. `node scripts/save-session.mjs app.json` opens a headed window where the person logs in themselves. The script saves the session and closes the window.
2. `node scripts/record-chat.mjs --config app.json --prompts prompts.json --out <dir>/dry --dry` checks the session, the selectors and the sidebar filter, and types prompt 1 without sending it. It costs nothing, so run it before every real run.
3. Record:
   - One chat: `node scripts/record-chat.mjs --config app.json --prompts prompts.json --out <dir>/act`
   - A new chat per prompt: the same command with `--from N --only N --out <dir>/cN`, once for each N.

   Give each prompt in `prompts.json` an `expect` list of regexes taken from the guide, preferably names and codes, since the assistant formats numbers differently from run to run. The recorder saves each answer's text to `answers.json`.
4. `python3 scripts/build-raw.py <take>` turns the timed 2x frames into a real-time `raw.mp4`.
5. `python3 scripts/edit-clip.py <take> out.mp4 --prompts prompts.json` paces it. It adds a chapter per prompt (players can jump between questions; nothing appears on screen), writes a poster, and squeezes any still screen to 3.5 s. To slow it down or speed it up, use `--think`, `--type` and `--write-max` rather than editing the script.
6. `python3 scripts/check-clip.py out.mp4 --answers <take>/answers.json --prompts prompts.json` fails on a still screen over 4 s, on a recorder warning, and on an answer that misses its `expect`. It also writes `out-sheet.png` with one row per prompt. Read the sheet, run `keboola-docs:checker` until it returns PASS, then hand the files over.

An existing chat can be checked without recording anything: `record-chat.mjs ... --extract --session <url>` writes its `answers.json`.

## The rules the edit encodes

| Part | Rule | What went wrong before |
|---|---|---|
| Thinking | squeezed to about 10 s | 2-3 s (4-26x) was "too fast" |
| Answer being written | squeezed to about 10 s, so about 1x for a normal answer (a long stretch is mostly tool steps); `--write-max` caps it | 3-9x on text was too fast |
| Typing | 1.3x | 4x |
| After the answer | the still wait is cut; the question scrolls to the top, a short pause, then the page reads down to the end at 1x | 8 s of still screen while the recorder waited to call the answer done. On another run the chat did not follow a long answer, so only its first lines were in frame |
| Camera | decided by the screen, see "Zoom or the whole screen" below | KAiDE's chat fills the screen, so a 1.6x zoom only hid the interface and was taken out |
| Sidebar | only the chat being recorded is listed | hiding every chat looked broken; leaving them all showed other people's runs |
| Retakes | re-record the whole prompt | an insert spliced into a take made the page jump back for a moment and showed a "Files 2" badge from a later answer |

## Zoom or the whole screen

Look at a frame of the take at the size it will be watched, then pick:

| What the frame shows | Camera |
|---|---|
| The chat takes most of the screen and the point is the interface itself | the whole screen, 1:1 (no `--zoom`) |
| A large UI where the answer text is too small to read at the delivered size | `--zoom chat`: the whole screen for a moment, then the chat column |
| The prompt is hard to read while it is typed | `--zoom typing`: ease in on the composer, back out after Send |
| One detail is the point (a Sources row, a refusal line, a generated file) inside a screen that should otherwise be seen whole | `--zoom detail`: after each answer, ease in on the config's `zoomOn` element, hold, ease back out (adds 3 s per answer) |

Modes combine (`--zoom typing,detail`). A zoom renders through the `Plain` composition of `keboola-docs:docs-clip` (its `remotion/` needs `npm install` once, and `REMOTION_DIR` points elsewhere), so a 35 s clip takes about a minute and a 5-minute one several. The camera rules (cue on the whole screen first, keep a landmark in frame) are in that skill's `docs-clip/references/clip-grammar.md`.

## Common mistakes

- Clicking "Switch account" or "Sign out" in the login window revokes the saved session on the server, although the cookie still has 30 days left. Every page then redirects to the login, and `save-session` has to run again.
- In some apps `/` is a landing page even when you are logged in. Open the chat path directly.
- A pointer resting on suggestion chips highlights them. The recorder parks it in the blank right margin.
- A blank "Untitled chat" for a split second after Send is the app itself. Leave it in.
- Shared persona accounts collect a new chat on every run. List them for the person and leave them in place.
- Answers change between runs. Compare each one with the guide's figures before you send the videos.
