#!/usr/bin/env node
// retire.mjs — retire one page with a redirect: delete, merge into, or rename/move. Writes files.
//
//   node <plugin>/scripts/retire.mjs --from <slug> --to <slug> [--merge] [--root <dir>] [--dry-run] [--json] [--delete-orphans]
//   node <plugin>/scripts/retire.mjs --from <slug> --rename <new-slug> [--root <dir>] [--dry-run] [--json]
//
// What it does, in order:
//   1. adds the retired URL (and the retired page's own redirect_from entries, so no chains) to the
//      target's `redirect_from:`; on --rename the moved page keeps its own list plus the old URL
//   2. removes (or on --rename re-points) the nav entry in _data/navigation.yml
//   3. rewrites inbound links to the old URL across src/ and _data/ (`/old/`, `/old/#anchor`)
//   4. deletes the page, or on --merge appends its body to the target under a TEMPLATE: note,
//      or on --rename moves the file and sets its slug
//   5. lists media only the retired page referenced (deleted with --delete-orphans)
// It never touches dist/. Run docs-link-redirect-check afterwards; the commit gate checks the redirect.
import fs from 'node:fs';
import path from 'node:path';
import { pageRefs } from './lib/media-refs.mjs';

const args = process.argv.slice(2);
const flagVal = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? null) : null; };
const has = (n) => args.includes(n);
const ROOT = path.resolve(flagVal('--root') ?? process.cwd());
const DOCS = path.join(ROOT, 'src', 'content', 'docs');
const NAV = path.join(ROOT, '_data', 'navigation.yml');
const DRY = has('--dry-run'), JSON_OUT = has('--json'), MERGE = has('--merge'), DEL_ORPHANS = has('--delete-orphans');
const norm = (s) => '/' + String(s ?? '').trim().replace(/^\/+|\/+$/g, '') + '/';
const FROM = flagVal('--from') ? norm(flagVal('--from')) : null;
const TO = flagVal('--to') ? norm(flagVal('--to')) : null;
const RENAME = flagVal('--rename') ? norm(flagVal('--rename')) : null;
const die = (m) => { console.error(`✗ ${m}`); process.exit(2); };
if (!fs.existsSync(DOCS)) die(`src/content/docs not found under ${ROOT}`);
if (!FROM || (!TO && !RENAME) || (TO && RENAME)) die('usage: --from <slug> with either --to <slug> [--merge] or --rename <new-slug>');
if (FROM === TO || FROM === RENAME) die('from and to are the same URL');

const pageFile = (url) => { const s = url.replace(/^\/|\/$/g, ''); for (const c of [s + '.md', s + '.mdx', path.join(s, 'index.md'), path.join(s, 'index.mdx')]) { const p = path.join(DOCS, c); if (fs.existsSync(p)) return p; } return null; };
const fromFile = pageFile(FROM); if (!fromFile) die(`no page for ${FROM} under src/content/docs`);
const toFile = TO ? pageFile(TO) : null; if (TO && !toFile) die(`no page for ${TO} under src/content/docs (the target must exist)`);
if (RENAME && pageFile(RENAME)) die(`${RENAME} already has a page`);
const rel = (p) => path.relative(ROOT, p);
const read = (p) => fs.readFileSync(p, 'utf8');
const writes = new Map(); const deletes = new Set();
const write = (p, s) => writes.set(p, s);

const splitFm = (text) => { const m = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/); return m ? { open: m[1], fm: m[2], close: m[3], body: m[4] } : null; };
const redirectsIn = (fmText) => { const m = fmText.match(/^redirect_from:[ \t]*(\[.*\])?\s*$((?:\r?\n[ \t]+-[ \t]+.*)*)/m); if (!m) return []; const out = []; if (m[1]) out.push(...m[1].slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)); for (const l of (m[2] ?? '').split(/\r?\n/)) { const x = l.match(/^[ \t]+-[ \t]+(.*)$/); if (x) out.push(x[1].trim().replace(/^['"]|['"]$/g, '')); } return out; };
const withRedirects = (fmText, urls) => {
  const existing = redirectsIn(fmText).map(norm); const add = urls.map(norm).filter((u) => !existing.includes(u)); if (!add.length) return { fm: fmText, added: [] };
  const all = [...existing, ...add]; const block = 'redirect_from:\n' + all.map((u) => `  - ${u}`).join('\n');
  const re = /^redirect_from:[ \t]*(\[.*\])?\s*$((?:\r?\n[ \t]+-[ \t]+.*)*)/m;
  return { fm: re.test(fmText) ? fmText.replace(re, block) : fmText.replace(/\s*$/, '') + '\n' + block, added: add };
};
const fromText = read(fromFile); const fromParts = splitFm(fromText) ?? die(`${rel(fromFile)} has no frontmatter`);
const carried = redirectsIn(fromParts.fm).map(norm);
const result = { from: FROM, fromFile: rel(fromFile), to: TO ?? RENAME, mode: RENAME ? 'rename' : MERGE ? 'merge' : 'delete', redirectsAdded: [], navChanged: false, linksRewritten: [], orphanMedia: [], dryRun: DRY };
// ---- inbound links ------------------------------------------------------------------------------------
const NEW = TO ?? RENAME;
const esc = FROM.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const linkRe = new RegExp(`(?<=[("'\`\\s=])${esc}(?=[)"'\`\\s#?]|$)`, 'g');
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); } else if (/\.(md|mdx|astro|mjs|js|ts|yml|yaml|json)$/.test(e.name)) out.push(p); } return out; };
for (const f of [...walk(path.join(ROOT, 'src')), ...(fs.existsSync(path.join(ROOT, '_data')) ? walk(path.join(ROOT, '_data')) : [])]) {
  if (f === fromFile || f === NAV) continue;
  const t = writes.get(f) ?? read(f);
  let n = 0; const u = t.replace(linkRe, () => { n++; return NEW; });
  if (!n) continue;
  // redirect_from entries must keep the OLD url: undo the rewrite inside the frontmatter list
  const parts = splitFm(u); const fixed = parts && /redirect_from/.test(parts.fm) ? parts.open + parts.fm.replace(new RegExp(`(-\\s+)${NEW.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`, 'g'), (x, p) => p + FROM) + parts.close + parts.body : u;
  write(f, fixed); result.linksRewritten.push({ file: rel(f), count: n });
}

// ---- frontmatter: redirect_from ------------------------------------------------------------------

let targetText = null, targetFile = null;
if (TO) {
  targetFile = toFile; const parts = splitFm(writes.get(toFile) ?? read(toFile)) ?? die(`${rel(toFile)} has no frontmatter`);
  const { fm, added } = withRedirects(parts.fm, [FROM, ...carried]); result.redirectsAdded = added;
  let body = parts.body;
  if (MERGE) {
    const fromBody = fromParts.body.replace(/^\s+/, '');
    const note = `\n<!-- TEMPLATE: folded in from ${FROM} by docs-retire. Keep what this page lacks, delete the rest, one type per page (D8). -->\n\n${fromBody.replace(/\n\*\*Next:\*\*[^\n]*\n?\s*$/, '\n')}`;
    const i = body.search(/\n\*\*Next:\*\*/); body = i >= 0 ? body.slice(0, i) + '\n' + note + body.slice(i) : body.replace(/\s*$/, '\n') + note;
  }
  targetText = parts.open + fm + parts.close + body; write(toFile, targetText); deletes.add(fromFile);
} else {
  const s = RENAME.replace(/^\/|\/$/g, ''); const ext = path.extname(fromFile); const asIndex = /\/index\.mdx?$/.test(fromFile);
  targetFile = path.join(DOCS, asIndex ? path.join(s, 'index' + ext) : s + ext);
  const { fm } = withRedirects(fromParts.fm, [FROM]); result.redirectsAdded = [FROM];
  const fm2 = /^slug:/m.test(fm) ? fm.replace(/^slug:.*$/m, `slug: '${s}'`) : fm + `\nslug: '${s}'`;
  write(targetFile, fromParts.open + fm2 + fromParts.close + fromParts.body); deletes.add(fromFile);
}
result.targetFile = rel(targetFile);

// ---- nav --------------------------------------------------------------------------------------------
if (fs.existsSync(NAV)) {
  const lines = read(NAV).split(/\r?\n/); const out = []; let skipIndent = null; let changed = false;
  for (const l of lines) {
    if (skipIndent !== null) { const ind = l.match(/^(\s*)/)[1].length; if (l.trim() === '' || ind > skipIndent) continue; skipIndent = null; }
    const m = l.match(/^(\s*)-\s+url:\s*(\S+)\s*$/);
    if (m && norm(m[2]) === FROM) { changed = true; if (RENAME) { out.push(l.replace(m[2], RENAME)); continue; } skipIndent = m[1].length; continue; }
    out.push(l);
  }
  if (changed) { write(NAV, out.join('\n')); result.navChanged = true; }
}

// ---- orphan media ---------------------------------------------------------------------------------------
const refCtx = { root: ROOT, exists: (f) => fs.existsSync(f), docsDir: DOCS };
const publicRefs = (file, text) => new Set(pageRefs(file, text, refCtx).refs.filter((r) => r.resolved.startsWith('public/')).map((r) => r.resolved));
const fromMedia = publicRefs(fromFile, fromText);
if (fromMedia.size) {
  const others = new Set();
  for (const f of walkPages(DOCS)) { if (f === fromFile) continue; for (const m of publicRefs(f, writes.get(f) ?? read(f))) others.add(m); }
  if (MERGE && targetText) for (const m of publicRefs(targetFile, targetText)) others.add(m);
  for (const m of fromMedia) if (!others.has(m)) { const p = path.join(ROOT, m); if (fs.existsSync(p)) { result.orphanMedia.push(m); if (DEL_ORPHANS) deletes.add(p); } }
}
// Relative refs resolve against the page's folder and URL: a merge or a rename moves the text, so they can break.
result.relativeRefs = [];
if (MERGE || RENAME) for (const r of pageRefs(fromFile, fromText, refCtx).refs) if (!r.raw.startsWith('/')) result.relativeRefs.push(`${r.raw} (${r.via}: ${r.resolved})`);
function walkPages(d, out = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walkPages(p, out); else if (/\.(md|mdx)$/.test(e.name)) out.push(p); } return out; }

// ---- apply ---------------------------------------------------------------------------------------------------
if (!DRY) {
  for (const [p, s] of writes) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }
  for (const p of deletes) fs.rmSync(p, { force: true });
}
result.deleted = [...deletes].map(rel);
if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`${DRY ? '(dry run) ' : ''}retire ${FROM} → ${NEW} (${result.mode})`);
  console.log(`  redirect_from on ${result.targetFile}: ${result.redirectsAdded.length ? result.redirectsAdded.join(', ') : 'already present'}`);
  console.log(`  nav: ${result.navChanged ? (RENAME ? 'url re-pointed' : 'entry removed') : 'no entry found (check _data/navigation.yml by hand)'}`);
  for (const l of result.linksRewritten) console.log(`  links: ${l.file} (${l.count})`);
  for (const d of result.deleted) console.log(`  ${DEL_ORPHANS && d.startsWith('public/') ? 'deleted media' : 'deleted'}: ${d}`);
  if (result.relativeRefs.length) console.log(`  relative media refs move with the text, check them on the target: ${result.relativeRefs.join(', ')}`);
  if (result.orphanMedia.length && !DEL_ORPHANS) console.log(`  media only this page used (delete if nothing keeps it): ${result.orphanMedia.join(', ')}`);
  console.log(`next: ${MERGE ? 'fold the TEMPLATE: block into ' + result.targetFile + ', then ' : ''}npm run build && docs-link-redirect-check --base keboola/main`);
}
