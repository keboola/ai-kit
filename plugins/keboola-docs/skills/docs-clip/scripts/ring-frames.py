# ring-frames.py: draw clip-grammar rings on the stills capture-states.mjs wrote, then print the
# states-to-gif.sh plan.
#
#   uv run --with pillow python ring-frames.py <frames dir> [--crop full|action] [--hold 1.6] [--final 2.8] [--fps 30]
#
# Reads <dir>/rings.json ({order, rings, scale}) and writes the frames of a smooth GIF at 1x: each
# state appears, its ring fades in (~0.25 s), it holds, then it crossfades (~0.4 s) into the next
# state; the last state crossfades back into the first, so the loop has no jump. Identical frames
# cost almost nothing in H.264, so the page clip is a 30 fps MP4 loop (Nikita, 2026-10-22: a 5 fps
# slideshow with hard cuts read as choppy; a GIF as smooth was 720 KB, the MP4 110 KB). Prints the
# plan line to pass to states-to-gif.sh. For a GIF (Slack, a PR): --fps 10 --xfade 0.2 --ring-in 0.2.
#
# Frame (Nikita, 2026-10-22): the whole screen by default (--crop full). --crop action cuts every
# frame to the part of the screen where the action happens; the author picks one at STOP 2. A plan's
# top-level "crop": "full" | "action" | [x, y, w, h] does the same when --crop is not given.
#
# Ring (clip-grammar.md, "Rings in a states GIF"): Keboola blue #2563eb, 3 px, radius 10, a soft
# 70-alpha glow 4 px OUTSIDE the outline (never over the label), 6 px of padding around the control.
# Measured in CSS px and multiplied by the capture scale, so the ring looks the same at any DPR.
#
# Action crop: every frame is cut to the same box: the union of the
# rings, the focus boxes from rings.json (open dialog, menu, listbox, tooltip, popper) and WHAT CHANGED
# between consecutive frames (a pixel diff), plus 24 px. The diff is what makes tabs, a new page, a
# popover without a role and a toast land in the frame (G1, G3, G4, G6 cut them away when only rings
# and dialogs counted). The box is at least 400 x 260 (one ring on a 32 px icon gave an 80x80 GIF,
# G6) and is at least 60 % of the screen's width and 40 % of its height (an action crop never
# collapses into a small square), is shifted inside the frame rather than clipped at an edge, and warns when it is wider than
# 760 px (labels fall under 13 px in the page column). A plan's top-level "crop": [x, y, w, h] wins;
# --no-crop keeps the full viewport. The card or row around each ringed control counts too, and every
# edge is then pushed outward (up to 48 px) until it runs through blank space, not through a line of
# text (R3 cut an app title, R6 sliced "2m 51s"). Warns when the GIF is taller than 600 px or the page
# scrolled between states (one scroll position per GIF, R5). A shot's "hold" (seconds) from the plan
# overrides --hold for that state.
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

BLUE = (37, 99, 235)
PAD, WIDTH, RADIUS, GLOW = 6, 3, 10, 4
MARGIN = 24
MIN_W, MIN_H, MAX_W = 400, 260, 760


def arg(name, default):
    return float(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


def ring(im, r, s):
    box = [(r['x'] - PAD) * s, (r['y'] - PAD) * s, (r['x'] + r['w'] + PAD) * s, (r['y'] + r['h'] + PAD) * s]
    glow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle(box, radius=RADIUS * s, outline=BLUE + (70,), width=(WIDTH + GLOW * 2) * s)
    glow = glow.filter(ImageFilter.GaussianBlur(GLOW))
    hole = Image.new('L', im.size, 255)                     # keep the glow outside the outline only
    ImageDraw.Draw(hole).rounded_rectangle(box, radius=RADIUS * s, fill=0)
    glow.putalpha(Image.composite(glow.getchannel('A'), Image.new('L', im.size, 0), hole))
    im = Image.alpha_composite(im, glow)
    ImageDraw.Draw(im).rounded_rectangle(box, radius=RADIUS * s, outline=BLUE + (255,), width=WIDTH * s)
    return im


def changed_box(a, b, s):
    """Bounding box (CSS px) of what changed between two raw frames, ignoring stray pixels."""
    if a.size != b.size:
        return None
    # Full resolution: Keboola draws white panels on a near-white page (~5 luma apart) whose 1 px
    # border is the only real edge; downscaling averaged it away (fixture test). Keep every pixel
    # that moved by more than 10 and ignore a change of a few pixels (a caret, an anti-aliasing flicker).
    mask = ImageChops.difference(a.convert('L'), b.convert('L')).point(lambda v: 255 if v > 10 else 0)
    if mask.histogram()[255] < 30 * s * s:
        return None
    bb = mask.getbbox()
    return None if not bb else {'x': bb[0] / s, 'y': bb[1] / s, 'w': (bb[2] - bb[0]) / s, 'h': (bb[3] - bb[1]) / s}


def crop_box(meta, d, s):
    first = Image.open(d / f"{meta['order'][0]}.png")
    fw, fh = first.width / s, first.height / s
    raw = [Image.open(d / f'{n}.png') for n in meta['order']]
    if meta.get('crop'):
        x, y, w, h = meta['crop']
        x0, y0, x1, y1 = snap_to_blank(raw, s, fw, fh, max(0, x), max(0, y), min(fw, x + w), min(fh, y + h))
        return [round(v) for v in (x0, y0, x1, y1)]
    boxes = list(meta.get('focus', {}).values()) + list(meta.get('rings', {}).values()) + list(meta.get('cards', {}).values())
    modal = meta.get('modal', {})
    for (na, a), (nb, b) in zip(zip(meta['order'], raw), zip(meta['order'][1:], raw[1:])):
        if modal.get(na) or modal.get(nb):
            continue   # a dialog frame: its veil dims every pixel; the dialog's own focus box counts instead
        cb = changed_box(a, b, s)
        if cb:
            boxes.append(cb)
    if not boxes:
        return None
    x0 = min(b['x'] for b in boxes) - MARGIN
    y0 = min(b['y'] for b in boxes) - MARGIN
    x1 = max(b['x'] + b['w'] for b in boxes) + MARGIN
    y1 = max(b['y'] + b['h'] for b in boxes) + MARGIN
    # grow a small box around its centre, then shift it inside the frame instead of clipping the margin
    if x1 - x0 < MIN_W:
        c = (x0 + x1) / 2; x0, x1 = c - MIN_W / 2, c + MIN_W / 2
    if y1 - y0 < MIN_H:
        c = (y0 + y1) / 2; y0, y1 = c - MIN_H / 2, c + MIN_H / 2
    if x0 < 0: x1, x0 = x1 - x0, 0
    # at least 60 % of the screen's width and 40 % of its height: a small square crop read badly
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w, h = min(fw, max(x1 - x0, fw * 0.6)), min(fh, max(y1 - y0, fh * 0.4))
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2
    if x0 < 0: x1, x0 = x1 - x0, 0
    if x1 > fw: x0, x1 = max(0, x0 - (x1 - fw)), fw
    if y0 < 0: y1, y0 = y1 - y0, 0
    if y1 > fh: y0, y1 = max(0, y0 - (y1 - fh)), fh
    x0, y0, x1, y1 = snap_to_blank(raw, s, fw, fh, x0, y0, x1, y1)
    box = [round(v) for v in (x0, y0, x1, y1)]
    return None if box == [0, 0, round(fw), round(fh)] else box   # the whole frame: no crop


def has_ink(raw, s, line, horizontal, lo, hi):
    """True when the row (horizontal) or column at CSS px `line` crosses text or an edge in any frame."""
    for im in raw:
        g = im.convert('L')
        box = (int(lo * s), int(line * s), int(hi * s), int(line * s) + 1) if horizontal else (int(line * s), int(lo * s), int(line * s) + 1, int(hi * s))
        mn, mx = g.crop(box).getextrema()
        if mx - mn > 40:
            return True
    return False


def snap_to_blank(raw, s, fw, fh, x0, y0, x1, y1, reach=48, step=2):
    for _ in range(0, reach, step):
        if y0 > 0 and has_ink(raw, s, y0, True, x0, x1): y0 = max(0, y0 - step)
        else: break
    for _ in range(0, reach, step):
        if y1 < fh - 1 and has_ink(raw, s, y1 - 1, True, x0, x1): y1 = min(fh, y1 + step)
        else: break
    for _ in range(0, reach, step):
        if x0 > 0 and has_ink(raw, s, x0, False, y0, y1): x0 = max(0, x0 - step)
        else: break
    for _ in range(0, reach, step):
        if x1 < fw - 1 and has_ink(raw, s, x1 - 1, False, y0, y1): x1 = min(fw, x1 + step)
        else: break
    return x0, y0, x1, y1


def crop_mode(meta):
    if '--no-crop' in sys.argv:
        return 'full'
    if '--crop' in sys.argv:
        return sys.argv[sys.argv.index('--crop') + 1]
    c = meta.get('crop')
    return 'box' if isinstance(c, list) else (c or 'full')


def main():
    if len(sys.argv) < 2:
        sys.exit('usage: ring-frames.py <frames dir> [--crop full|action] [--hold 1.6] [--final 2.8] [--fps 30]')
    d = Path(sys.argv[1])
    meta = json.loads((d / 'rings.json').read_text())
    s = int(meta.get('scale', 2))
    fps, hold, final = arg('--fps', 30), arg('--hold', 1.6), arg('--final', 2.8)
    ring_in, xfade = max(1, round(arg('--ring-in', 0.25) * fps)), max(1, round(arg('--xfade', 0.4) * fps))
    mode = crop_mode(meta)
    if mode not in ('full', 'action', 'box'):
        sys.exit(f'--crop is full or action, not {mode!r}')
    crop = crop_box(meta, d, s) if mode in ('action', 'box') else None
    if mode == 'box' and not meta.get('crop'):
        crop = None
    bare, ringed = [], []
    for name in meta['order']:
        im = Image.open(d / f'{name}.png').convert('RGBA')
        withr = ring(im, meta['rings'][name], s) if name in meta['rings'] else im
        out = []
        for x in (im, withr):
            if crop:
                x = x.crop(tuple(v * s for v in crop))
            out.append(x.convert('RGB').resize((x.width // s, x.height // s), Image.LANCZOS))
        bare.append(out[0]); ringed.append(out[1])
    plan, k = [], 0
    def emit(img, n):
        nonlocal k
        k += 1
        path = d / f'g{k:03d}.png'
        img.save(path)
        plan.append(f'{path}:{n}')
    order = meta['order']
    for i, name in enumerate(order):
        is_last = i == len(order) - 1
        h = meta.get('holds', {}).get(name, final if is_last else hold)
        hold_n = max(1, round(h * fps))
        if name in meta['rings']:
            # the state first, then its ring fades in, then the hold with the ring
            for j in range(1, ring_in + 1):
                emit(Image.blend(bare[i], ringed[i], j / ring_in), 1)
            hold_n = max(1, hold_n - ring_in)
        emit(ringed[i], hold_n)
        nxt = 0 if is_last else i + 1   # the last state crossfades into the first: a seamless loop
        for j in range(1, xfade):
            t = j / xfade
            t = t * t * (3 - 2 * t)   # ease in and out
            emit(Image.blend(ringed[i], bare[nxt], t), 1)
    last = ringed[-1]
    secs = sum(int(p.rsplit(':', 1)[1]) for p in plan) / fps
    print(f'{len(order)} states at {last.size[0]}x{last.size[1]} ({"cropped to " + str(crop) if crop else "full screen"}), {secs:.1f} s at {fps:g} fps')
    sc = meta.get('scroll', {})
    if len(set(sc.get(n, 0) for n in order)) > 1:
        print(f'the page scrolled between states ({", ".join(f"{n}: {sc.get(n, 0)}" for n in order)}): one scroll position per GIF; split it or ring a control that is on screen with the others', file=sys.stderr)
    if crop and last.size[1] > 600:
        print(f'frames are {last.size[1]} px tall, over 600: the GIF will fill the reader\'s screen; crop tighter or split it', file=sys.stderr)
    if last.size[0] > MAX_W:
        print(f'frames are {last.size[0]} px wide, over {MAX_W}: UI labels fall under 13 px in the page column; split the GIF or capture a narrower state', file=sys.stderr)
    if secs > 9:
        print('over the 9 s states-GIF budget: fewer states or shorter holds', file=sys.stderr)
    print(f'states-to-gif.sh <out.mp4> {fps:g} "{" ".join(plan)}"')


if __name__ == '__main__':
    main()
