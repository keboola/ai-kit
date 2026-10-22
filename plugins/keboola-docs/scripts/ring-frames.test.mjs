// Tests for docs-clip/scripts/ring-frames.py (needs uv + Pillow; skipped without uv). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'docs-clip', 'scripts', 'ring-frames.py');
const hasUv = spawnSync('uv', ['--version']).status === 0;
const py = (code, cwd) => spawnSync('uv', ['run', '-q', '--with', 'pillow', 'python', '-c', code], { cwd, encoding: 'utf8' });

test('ring-frames draws the ring outside the control, downscales to 1x and prints the plan', { skip: !hasUv && 'uv not installed' }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rings-'));
  // two 2x frames, 400x240 (200x120 CSS px), light grey with a dark "label" block at CSS (60,40)-(120,60)
  let r = py(`from PIL import Image, ImageDraw
for n in ('a', 'b'):
    im = Image.new('RGB', (400, 240), (240, 240, 240)); ImageDraw.Draw(im).rectangle([120, 80, 240, 120], fill=(20, 20, 20)); im.save(n + '.png')`, d);
  assert.equal(r.status, 0, r.stderr);
  fs.writeFileSync(path.join(d, 'rings.json'), JSON.stringify({ scale: 2, order: ['a', 'b'], rings: { a: { x: 60, y: 40, w: 60, h: 20 } } }));
  r = spawnSync('uv', ['run', '-q', '--with', 'pillow', 'python', SCRIPT, d], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /2 states at 200x120 \(full screen\), [\d.]+ s at 30 fps/, 'full screen and 30 fps by default (2026-10-22)');
  const plan = r.stdout.match(/states-to-gif\.sh <out\.mp4> 30 "([^"]+)"/)[1].split(' ').map((x) => { const i = x.lastIndexOf(':'); return [x.slice(0, i), Number(x.slice(i + 1))]; });
  const holds = plan.filter(([, n]) => n > 1);
  assert.equal(holds.length, 2, 'one hold per state');
  assert.ok(plan.length > holds.length + 8, `ring fade-in and dissolve frames between the holds (${plan.length} items)`);
  const secs = plan.reduce((t, [, n]) => t + n, 0) / 30;
  assert.ok(secs > 4 && secs < 6, `about 1.6 + 2.8 s plus transitions (${secs})`);
  const mid = plan[plan.indexOf(holds[0]) + 6][0];   // inside the dissolve from state a to b
  r = py(`from PIL import Image
a = Image.open('${holds[0][0]}'); b = Image.open('${holds[1][0]}'); m = Image.open('${mid}')
print(a.size, a.getpixel((54, 50)), a.getpixel((90, 50)), b.getpixel((54, 50)), m.getpixel((54, 50)))`, d);
  assert.equal(r.status, 0, r.stderr);
  const [size, edge, inside, noRing, between] = r.stdout.trim().match(/\([^)]*\)/g);
  assert.equal(size, '(200, 120)');
  const [er, , eb] = edge.slice(1, -1).split(',').map(Number);
  assert.ok(eb > 180 && er < 120, `ring outline is blue: ${edge}`);
  assert.equal(inside, '(20, 20, 20)', 'the label inside the ring is untouched (no glow over it)');
  assert.equal(noRing, '(240, 240, 240)', 'a shot without a ring gets none');
  assert.ok(between !== edge && between !== noRing, `a dissolve frame sits between the two states: ${between}`);
  r = spawnSync('uv', ['run', '-q', '--with', 'pillow', 'python', SCRIPT, d, '--crop', 'action'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /full screen|cropped to/, 'the action crop is opt-in');
});
