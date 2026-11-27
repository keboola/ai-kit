# Capturing Keboola's UI: what cost a reshoot before

Rules and gotchas learned on the Apps and Getting Started reshoots (2026-09/10). `docs-clip` and
`docs-stage-strip` point here too. Everything below applies to screenshots and recordings alike.

## Viewport and scale

- Shoot at device scale 2 with a **1100 px** wide viewport. The app header stays on one line, and
  the shot renders larger in the 713-px docs column than a 1280–1600 px capture would.
- Crop to the element (`page.screenshot({ clip })` or `locator.screenshot()`), inset about 8 px so
  rounded corners and shadows survive. A whole viewport is only for a page the reader must
  recognise as a whole.
- Crop the top bar out (avatar, organisation, project) unless the shot is about it: in the 2026 UI
  it ends at about 50 CSS px, so crop below y ≈ 52 (a crop at 100 cuts controls under the title).
- Over CDP (`shoot-cdp.mjs`, `docs-clip/scripts/capture-states.mjs`) a new tab renders at 1x and
  stops painting while its window is covered: both scripts set device scale 2 and focus emulation
  and front the tab themselves. Use them rather than a hand-written `connectOverCDP` script.
- UI-locator shots only: the reader needs to find the screen, not read it. Code in a screenshot
  goes into a fenced block on the page instead.

## Nothing in frame that is not ours to publish (PRDCT-616)

- Colleague names: Versions lines render as `<span>N minutes ago</span> by <Name>`; blur the text
  node after " by ". The Apps list shows names in **Last Change**; crop to the Name column
  (x < ~860 CSS px with the Kai panel closed). The repository branch dropdown lists commit
  authors: never shoot it open.
- Never print or save a page's HTML or inline scripts while probing, and never curl or wget a
  Keboola page (even the public login page: R7 saved one with a CSRF token): the inline script holds
  session tokens (G7). Read element text and roles only (`capture-states.mjs --list`).
- Recon stays on read-only views: open tabs, menus and dialogs, then Escape. Never flip a switch or
  a checkbox to see what it does (R6 toggled Debug mode), never press Save, Run, Deploy or Delete.
- Names hide in more places than list views: the Events tab's "by" column, bucket and table owners,
  Last Change, Kai's chat history and its suggestions (they name configurations), and the top bar
  (organization and project) when `top` is under 52. Mask them in the plan; a mask that matches
  nothing is reported.
- Kai opens a "Cheaper Kai mode" promo popover on first open: press Escape before the shot.
- No tokens, no e-mail addresses, no other project's configurations. OCR every final frame and
  poster with `docs-clip/scripts/ocr-scan.swift` (`swiftc -O ocr-scan.swift`), and read it with
  your eyes as well.
- Masking placeholders stay consistent across reshoots: `my-gcp-project`,
  `bigquery-extractor@my-gcp-project.iam.gserviceaccount.com`, `my-tutorial-bucket`,
  `SAPI_WORKSPACE_12345678`.
- Scrubbing at scale (the 77 tutorial shots, PR #1100): Vision `VNRecognizeTextRequest` gives
  per-line text and pixel boxes; paint a matched line with the background sampled ~12 px left of
  its box, then re-check for flat grey rectangles where the sample hit an icon. Photo avatars sit
  at the content area's right edge, not the image edge.

## The UI fights back

- The UI's CSP silently drops Playwright `addStyleTag` (no error, no effect). Restyle through the
  CSSOM instead: `el.style.setProperty('…', '…', 'important')`.
- A modal's dim layer is the dialog's own fixed `bg-black/50` parent. Paint that parent white
  before cropping a dialog, or the shot reads as a dark block on the page.
- The "Latest update" promo toast survives its X button (it cycles cards). Remove the
  `position: fixed` ancestor of the element whose text starts with "Latest update" (the one snippet
  the plugin uses, in `capture-states.mjs` `cleanUp`):

  ```js
  for (const el of document.querySelectorAll('body *')) if ((el.innerText || '').startsWith('Latest update')) {
    let n = el; while (n && getComputedStyle(n).position !== 'fixed') n = n.parentElement; (n ?? el).remove(); break; }
  ```
- Kai panel: the expanded panel shows a left rail with your past chat titles; click
  `button:has-text("Hide chat history")` before a capture. Reopening the panel resumes the LAST
  chat (even an Apps-builder chat); click the header "+" for a fresh one. To frame a question
  with its answer, `scrollIntoView({ block: 'start' })` on the user's message.
- Chrome 136+ ignores `--remote-debugging-port` on the default profile: a CDP session always needs
  its own `--user-data-dir` (`~/.keboola-shots/chrome-cdp`), logged in once by hand.
- Sessions: `~/.keboola-shots/state.json` is a saved Playwright storage state that expires in
  days. Refresh it in a headed browser where the user logs in; never type credentials.
- Project 264 (europe-west3) is the demo project for shots; Getting Started shots may also come
  from the author's Free (BigQuery, us-east4) project, all from one project and one week.

## Recording real interaction

- Playwright `recordVideo` and `deviceScaleFactor` alone give 1x video. For 2x: launch Chrome with
  `--force-device-scale-factor=2`, save CDP `Page.startScreencast` frames with their timestamps
  (2560×1600), concat with ffmpeg, then crop 1:1.
- Draw the pointer yourself (an init script that paints a hollow ring with a ripple on click) and
  park it off any text after each click. A solid dot hid the labels it clicked.
- Kai's resolved approval cards keep enabled-looking Approve buttons in the history; count an
  approval only when the click removes a button from a card whose text you have not seen before.
- A throttled MutationObserver scrub misses ~0.1 s after a route change, so OCR the final frames.
