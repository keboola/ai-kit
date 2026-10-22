// media-refs.mjs: the one parser for media references in docs pages, shared by media-inventory,
// the commit gate and retire. Replaces three regexes that disagreed (2026-10-14: an orphan list built
// from absolute refs only nearly deleted 65 live files).
//
// extractRefs(text)            → [{ raw, kind, alt, line }]  from markdown / mdx source
// extractHtmlRefs(html)        → [{ raw, kind, line }]       from built HTML (src, href, poster, srcset)
// resolveRef(raw, ctx)         → { resolved, via } | null    (null = external, data:, anchor)
// pageRefs(file, text, ctx)    → extractRefs + resolveRef, plus the page slug
//
// Resolution (ctx = { root, exists }):
//   /x/y.png            → public/x/y.png                                   via 'public'
//   y.png, ./y.png, ../y.png, imgs/y.png
//     1. against the page URL /<slug>/ under public/                      via 'public'
//        (raw <img>/<video> load it from there, and the markdown twin <slug>/index.md
//        resolves every relative ref that way, so this copy is in use whenever it exists)
//     2. markdown image syntax only: next to the source page in src/content/docs
//        (Astro bundles it into /_astro/)                                 via 'colocated'
//     neither exists                                                       via 'missing' (public path)
// Checked against a built site on 2026-10-14: same unreferenced set as dist/ (the ground truth).
import path from 'node:path';

export const MEDIA_EXT = /\.(png|jpe?g|gif|webp|svg|avif|mp4|webm|mov)$/i;

// Blank out fenced code, HTML comments and MDX comments, keeping line numbers.
export function maskNonContent(text) {
  const lines = text.split(/\r?\n/);
  let fence = null;
  const out = lines.map((l) => {
    const f = l.match(/^\s*(`{3,}|~{3,})/);
    if (fence) { if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; return ''; }
    if (f) { fence = f[1]; return ''; }
    return l;
  }).join('\n');
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  return out.replace(/<!--[\s\S]*?-->/g, blank).replace(/\{\/\*[\s\S]*?\*\/\}/g, blank);
}

const lineAt = (text, idx) => text.slice(0, idx).split('\n').length;
const clean = (raw) => raw.trim().replace(/^<|>$/g, '').split(/[?#]/)[0];

export function extractRefs(text) {
  const t = maskNonContent(text);
  const out = [];
  const push = (raw, kind, idx, alt = null, tag = false) => { if (raw) out.push({ raw: clean(raw), kind, alt, tag, line: lineAt(t, idx) }); };
  // markdown images, inline and reference-style
  for (const m of t.matchAll(/!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g)) push(m[2], 'image', m.index, m[1]);
  const defs = new Map();
  for (const m of t.matchAll(/^[ \t]{0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)/gm)) defs.set(m[1].toLowerCase(), m[2]);
  for (const m of t.matchAll(/!\[([^\]]*)\]\[([^\]]*)\]/g)) { const def = defs.get((m[2] || m[1]).toLowerCase()); if (def) push(def, 'image', m.index, m[1]); }
  // tags: <img>, <video>, <source>, and any component's src= (media extensions only)
  for (const m of t.matchAll(/<([A-Za-z][\w.]*)\b([^>]*?)\/?>/g)) {
    const tag = m[1], attrs = m[2];
    const get = (name) => attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`))?.slice(1).find((x) => x !== undefined);
    const alt = get('alt') ?? get('aria-label') ?? null;
    const src = get('src'), poster = get('poster'), srcset = get('srcset');
    const lower = tag.toLowerCase();
    if (src && (['img', 'video', 'source'].includes(lower) || MEDIA_EXT.test(clean(src)))) push(src, lower === 'video' || lower === 'source' ? 'video' : 'image', m.index, alt, true);
    if (poster) push(poster, 'poster', m.index, alt, true);
    if (srcset) for (const cand of srcset.split(',')) push(cand.trim().split(/\s+/)[0], 'image', m.index, alt, true);
  }
  // frontmatter image / poster / cover
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm) for (const m of fm[1].matchAll(/^(image|poster|cover):\s*['"]?([^'"\s]+)['"]?/gm)) out.push({ raw: clean(m[2]), kind: m[1] === 'poster' ? 'poster' : 'image', alt: null, line: lineAt(text, fm.index + m.index) });
  return out;
}

export function extractHtmlRefs(html) {
  const out = [];
  const t = html.replace(/<!--[\s\S]*?-->/g, (s) => s.replace(/[^\n]/g, ' '));
  for (const m of t.matchAll(/\b(src|href|poster|srcset|data-src)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const val = m[2] ?? m[3];
    const vals = m[1] === 'srcset' ? val.split(',').map((c) => c.trim().split(/\s+/)[0]) : [val];
    for (const v of vals) if (v) out.push({ raw: clean(v), kind: m[1], line: lineAt(t, m.index) });
  }
  return out;
}

export const isExternal = (raw) => !raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw);

// The page's URL slug: frontmatter slug, else the path under src/content/docs without extension/index.
export function slugOf(file, text, docsDir) {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const s = fm?.[1].match(/^slug:\s*['"]?([^'"\n]*?)['"]?\s*$/m)?.[1];
  if (s !== undefined && s !== null) return s.replace(/^\/|\/$/g, '');
  return path.relative(docsDir, file).replace(/\\/g, '/').replace(/\.(md|mdx)$/, '').replace(/(^|\/)index$/, '');
}

export function resolveRef(raw, { root, exists, pageFile = null, slug = '', tag = false }) {
  if (isExternal(raw)) return null;
  let decoded = raw; try { decoded = decodeURI(raw); } catch { /* keep raw */ }
  if (decoded.startsWith('/')) {
    const rel = path.posix.normalize(decoded).replace(/^\/+/, '');
    return { resolved: `public/${rel}`, via: exists(path.join(root, 'public', rel)) ? 'public' : 'missing' };
  }
  const urlPath = path.posix.normalize(path.posix.join('/', slug, decoded)).replace(/^\/+/, '');
  if (exists(path.join(root, 'public', urlPath))) return { resolved: `public/${urlPath}`, via: 'public' };
  if (pageFile && !tag) {
    const colocated = path.resolve(path.dirname(pageFile), decoded);
    if (exists(colocated)) return { resolved: path.relative(root, colocated).replace(/\\/g, '/'), via: 'colocated' };
  }
  return { resolved: `public/${urlPath}`, via: 'missing' };
}

export function pageRefs(pageFile, text, { root, exists, docsDir }) {
  const slug = slugOf(pageFile, text, docsDir);
  const refs = [];
  for (const r of extractRefs(text)) {
    const res = resolveRef(r.raw, { root, exists, pageFile, slug, tag: r.tag });
    if (res) refs.push({ ...r, ...res });
  }
  return { slug, refs };
}
