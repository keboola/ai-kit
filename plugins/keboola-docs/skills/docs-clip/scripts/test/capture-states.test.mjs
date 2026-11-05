// capture-states.test.mjs: runs capture-states.mjs against fixture.html in the debug Chrome on 9222.
//
//   node --test <plugin>/skills/docs-clip/scripts/test/capture-states.test.mjs
//
// Each case is a pattern that broke a states GIF in the field (V8–V12, G1–G7). Skipped when no Chrome
// listens on 9222 or Playwright is not found (PLAYWRIGHT_PATH, else ~/keboola-docs/node_modules).
// Captures take the same lock as field runs (/tmp/kbl-capture.lock), so they never share the tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, '..', 'capture-states.mjs');
const FIXTURE = 'file://' + path.join(HERE, 'fixture.html');
const PW = process.env.PLAYWRIGHT_PATH ?? path.join(os.homedir(), 'keboola-docs', 'node_modules', 'playwright', 'index.mjs');

const chromeUp = await fetch('http://localhost:9222/json/version', { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
const skip = !chromeUp ? 'no Chrome on 9222' : !fs.existsSync(PW) ? `no Playwright at ${PW}` : false;

function capture(steps, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-'));
  const plan = path.join(dir, 'plan.json');
  fs.writeFileSync(plan, JSON.stringify({ out: path.join(dir, 'frames'), steps, ...extra }));
  const r = spawnSync('lockf', ['-k', '/tmp/kbl-capture.lock', process.execPath, SCRIPT, plan],
    { encoding: 'utf8', env: { ...process.env, PLAYWRIGHT_PATH: PW }, timeout: 120000 });
  assert.equal(r.status, 0, `capture failed: ${r.stderr}\n${r.stdout}`);
  return { dir: path.join(dir, 'frames'), log: r.stdout + r.stderr, rings: JSON.parse(fs.readFileSync(path.join(dir, 'frames', 'rings.json'), 'utf8')) };
}
// Mean luma of a frame (and of a box in CSS px), through Pillow like the checker measures it.
function luma(png, box) {
  const crop = box ? `.crop(tuple(int(v*2) for v in ${JSON.stringify([box.x, box.y, box.x + box.w, box.y + box.h])}))` : '';
  const r = spawnSync('uv', ['run', '-q', '--with', 'pillow', 'python', '-c',
    `from PIL import Image, ImageStat; print(ImageStat.Stat(Image.open(${JSON.stringify(png)}).convert('L')${crop}).mean[0])`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return Number(r.stdout.trim());
}

function crop(dir) {
  const r = spawnSync('uv', ['run', '-q', '--with', 'pillow', 'python', path.join(HERE, '..', 'ring-frames.py'), dir, '--crop', 'action'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const m = r.stdout.match(/cropped to \[(\d+), (\d+), (\d+), (\d+)\]/);
  return { box: m ? m.slice(1).map(Number) : null, out: r.stdout + r.stderr };
}

test('dialog: veil lightened, focus box holds the badge above the dialog', { skip }, () => {
  const { dir, rings } = capture([
    { goto: FIXTURE }, { shot: 'page', ring: { role: 'button', name: 'Create item' } },
    { click: { role: 'button', name: 'Create item' } }, { shot: 'dialog' },
  ]);
  assert.ok(luma(path.join(dir, 'dialog.png')) > 200, 'the veil was lightened');
  const f = rings.focus.dialog;
  assert.ok(f, 'the dialog shot has a focus box');
  // the badge sits 22 px above the dialog's top edge: the box must start at least that high
  const dialogTop = (760 - 52) / 2;   // rough: the dialog is centred in the viewport below the top bar
  assert.ok(f.y < dialogTop, `focus box starts above the dialog (y=${f.y})`);
  assert.equal(rings.modal.dialog, true, 'the dialog shot is marked modal');
  const { box } = crop(dir);   // the dim veil must not widen the crop to the whole frame (human test T2, R7)
  assert.ok(box && box[2] - box[0] < 740 && box[3] - box[1] < 690, `crop stays around the dialog (${box})`);
});

test('a dialog taller than the viewport grows it and replays the plan', { skip }, () => {
  const { rings, log } = capture([
    { goto: FIXTURE + '#tall' }, { click: { role: 'button', name: 'Create item' } }, { shot: 'dialog' },
  ]);
  assert.match(log, /replaying the plan/);
  assert.ok(rings.viewport[1] > 760, `viewport grew to ${rings.viewport[1]}`);
});


test('hover: a hover step keeps the pointer, so a hover-only control can be ringed (G1)', { skip }, () => {
  const { dir, rings, log } = capture([{ goto: FIXTURE }, { hover: { css: '#row' } }, { shot: 'hover', ring: { role: 'button', name: 'Bucket detail' } }]);
  const r = rings.rings.hover;
  assert.ok(r && r.w > 0 && r.h > 0, 'the hover-revealed button has a box');
  assert.ok(luma(path.join(dir, 'hover.png'), r) < 170, 'the blue button is painted in the frame, not just in the DOM');
  assert.doesNotMatch(log, /outside the frame|transparent/);
});

test('popover without a role: exact text wins over a partial match and the crop holds the panel (G4)', { skip }, () => {
  const { dir, rings } = capture([
    { goto: FIXTURE }, { shot: 'page', ring: { role: 'button', name: 'Add task' } },
    { click: { role: 'button', name: 'Add task' }, after: 400 }, { shot: 'panel', ring: { text: 'Component' } },
  ]);
  assert.ok(rings.rings.panel.x > 760 - 300 - 10, `ringed the panel's Component, not the sidebar's Components (x=${rings.rings.panel.x})`);
  const { box } = crop(dir);
  assert.ok(box && box[2] >= 750, `the crop reaches the panel at the right edge (${box})`);
});

test('a target below the fold of an inner scroll box is scrolled into the frame (G5)', { skip }, () => {
  const { rings, log } = capture([{ goto: FIXTURE }, { shot: 'far', ring: { role: 'button', name: 'Data retention' } }]);
  const r = rings.rings.far;
  assert.ok(r.y >= 0 && r.y + r.h <= 760 - 52, `ring inside the frame (y=${r.y})`);
  assert.doesNotMatch(log, /outside the frame/);
});

test('a fast shot catches a 0.6 s toast, and the crop takes it in (G6)', { skip }, () => {
  const { dir } = capture([
    { goto: FIXTURE }, { shot: 'before', ring: { role: 'button', name: 'Copy URL' } },
    { click: { role: 'button', name: 'Copy URL' }, after: 100 }, { shot: 'toast', fast: true },
  ]);
  const t = { x: 300, y: 708 - 75, w: 160, h: 40 };   // the toast: bottom centre, 24 px up
  assert.ok(luma(path.join(dir, 'toast.png'), t) < 150, 'the dark toast is in the frame');
  const { box } = crop(dir);
  assert.ok(box && box[3] >= 708 - 30, `the crop reaches the toast at the bottom (${box})`);
  assert.ok(box[2] - box[0] >= 400, 'the crop is at least 400 px wide');
});

test('with no rings and no dialog, what changed between frames sets the crop (G1, G3)', { skip }, () => {
  const { dir } = capture([{ goto: FIXTURE }, { shot: 'a' }, { click: { role: 'button', name: 'Add task' }, after: 400 }, { shot: 'b' }]);
  const { box } = crop(dir);
  assert.ok(box && box[2] >= 750 && box[3] >= 600, `the crop covers the panel that appeared (${box})`);
});

test('a mask rewrites text next to an icon, and a mask that matches nothing warns (G7)', { skip }, () => {
  const { log } = capture([{ goto: FIXTURE }, { shot: 'crumb' }], { mask: ['Jane Doe Org', 'Nobody Here'] });
  assert.doesNotMatch(log, /"Jane Doe Org" matched nothing/);
  assert.match(log, /"Nobody Here" matched nothing/);
});

test('nth/in targets pick one row; redact rewrites a column; a ring on plain text warns (R2, R5, R7)', { skip }, () => {
  const { rings, log } = capture([
    { goto: FIXTURE },
    { shot: 'a', ring: { role: 'button', name: 'More actions', in: { css: '#t tr', nth: 0 } } },
    { shot: 'b', ring: { role: 'button', name: 'More actions', in: { css: '#t tr', nth: 1 } } },
    { shot: 'c', ring: { css: '#crumb' } },
  ], { redact: [{ css: '#t td:nth-child(1)' }, { css: '.no-such-cell' }] });
  assert.ok(rings.rings.b.y > rings.rings.a.y + 10, 'the second row\'s button, not the first one again');
  assert.match(log, /redact .*no-such-cell.* matched nothing/);
  assert.doesNotMatch(log, /redact .*#t td.* matched nothing/);
  assert.match(log, /"c": the ring target is not a control/);
});

test('ring-frames warns when the page scrolled between states (R5)', { skip }, () => {
  const { dir } = capture([
    { goto: FIXTURE }, { shot: 'top', ring: { role: 'button', name: 'Create item' } },
    { shot: 'far', ring: { role: 'button', name: 'Data retention' } },
  ]);
  assert.match(crop(dir).out, /scrolled between states/);
});

test('a combobox is ringed with its field box and chevron, not the bare input (Q4)', { skip }, () => {
  const { rings } = capture([{ goto: FIXTURE }, { shot: 'f', ring: { role: 'combobox', name: 'Status' } }]);
  assert.ok(rings.rings.f.w >= 220, `the ring covers the 220 px field (w=${rings.rings.f.w})`);
});
