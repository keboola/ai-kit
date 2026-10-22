#!/usr/bin/env node
// check.mjs: the mechanical half of the Diátaxis page check for keboola/connection-docs. Read-only.
//
// Run from the repo root (a worktree is fine):
//   node <plugin>/skills/docs-diataxis-check/scripts/check.mjs [pages...] [--base <ref>] [--paths <prefix>]
//        [--dist] [--json] [--root <dir>] [--index]
//
// Page selection: explicit paths, or --base (pages changed since the merge-base with <ref>, plus the
// working tree), or --paths (every page under a prefix). The rules are numbered D1..D12 and listed
// in ../references/rules.md; this script never judges a page's type, it records what it can count
// and leaves the verdict on type (D8, D10, D13..D15) to the diataxis-checker agent.
// Exit 1 when any page has a FAIL, 2 on a usage error. Never edits anything.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { makeSource } from '../../../scripts/lib/source.mjs';

const args = process.argv.slice(2);
const flagVal = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? null) : null; };
const has = (n) => args.includes(n);
const ROOT = path.resolve(flagVal('--root') ?? process.cwd());
const DOCS = path.join(ROOT, 'src', 'content', 'docs');
const DIST = path.join(ROOT, 'dist');
const NAV = path.join(ROOT, '_data', 'navigation.yml');
const JSON_OUT = has('--json');
const WANT_DIST = has('--dist');
const BASE = flagVal('--base');
const PATHS = flagVal('--paths');
// --index: read pages and the nav from the git index (what the next commit records); the commit gate uses it.
// --ref <commit>: read them from a commit instead (the gate's merge-base with main, to tell old findings from new).
const REF = flagVal('--ref');
const SRC = makeSource(ROOT, { index: has('--index'), ref: REF });

const usage = (m) => { console.error(`✗ ${m}`); process.exit(2); };
if (!SRC.exists(DOCS)) usage(`src/content/docs not found under ${ROOT}: run from the repo root or pass --root`);
const sh = (cmd) => { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

// ---- page selection -----------------------------------------------------------------------------
const isPage = (f) => /\.(md|mdx)$/.test(f) && !f.includes('/dist/');
const walk = (d) => SRC.list(d, isPage);
const selected = new Set();
const skipFlagValues = new Set(['--root', '--base', '--paths', '--ref']);
for (let i = 0; i < args.length; i++) { const a = args[i]; if (a.startsWith('--')) { if (skipFlagValues.has(a)) i++; continue; } selected.add(path.resolve(ROOT, a)); }
if (BASE) {
  const mergeBase = sh(`git merge-base ${BASE} HEAD`) || BASE;
  const lines = (sh(`git diff --name-only -M ${mergeBase} -- src/content/docs`) + '\n' + sh('git status --porcelain -- src/content/docs').split('\n').map((l) => l.slice(3)).join('\n')).split('\n');
  for (const l of lines) { const rel = l.trim(); if (rel && isPage(rel)) selected.add(path.join(ROOT, rel)); }
}
if (PATHS) for (const p of walk(path.resolve(ROOT, PATHS))) selected.add(p);
const files = [...selected].filter((p) => SRC.exists(p) && isPage(p)).sort();
if (!files.length) usage('no pages selected: pass page paths, --base <ref> or --paths <prefix>');

// ---- frontmatter + body helpers ------------------------------------------------------------------
const fm = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/); if (!m) return { _raw: null };
  const out = { _raw: m[0], _lines: m[0].split('\n').length }; const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z_]+):\s*(.*)$/); if (!kv) continue;
    const [, k, v] = kv;
    if (v === '') { const arr = []; while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) arr.push(lines[++i].replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, '')); out[k] = arr.length ? arr : ''; }
    else out[k] = v.replace(/^['"]|['"]$/g, '');
  }
  return out;
};
const norm = (u) => { let s = u.split('#')[0].split('?')[0]; if (!s.startsWith('/')) s = '/' + s; if (!s.endsWith('/')) s += '/'; return s; };
const slugToUrl = (slug) => norm('/' + String(slug).replace(/^\/|\/$/g, '') + '/');
const pathSlug = (file) => path.relative(DOCS, file).replace(/\\/g, '/').replace(/\.(md|mdx)$/, '').replace(/\/index$/, '').replace(/^index$/, '');
const pageUrlOf = (file, f) => (f.slug ? slugToUrl(f.slug) : (pathSlug(file) ? slugToUrl(pathSlug(file)) : '/'));

// Mask fenced code so no heading/marker/term regex sees what is inside a code block.
const maskFences = (lines) => { let inFence = false, fence = ''; return lines.map((l) => { const m = l.match(/^\s*(`{3,}|~{3,})/); if (m) { if (!inFence) { inFence = true; fence = m[1][0]; return ''; } if (l.trim().startsWith(fence.repeat(3))) { inFence = false; return ''; } } return inFence ? '' : l; }); };
// Keep only the text inside HTML / JSX comments, line-wise (the inverse of maskComments).
const commentsOnly = (lines) => { let inC = false; return lines.map((l) => { let out = '', s = l; while (s.length) { if (inC) { const e = s.search(/-->|\*\/\}/); if (e < 0) { out += s; s = ''; } else { out += s.slice(0, e); s = s.slice(e + 3); inC = false; } } else { const o = s.search(/<!--|\{\/\*/); if (o < 0) s = ''; else { s = s.slice(o + (s[o] === '<' ? 4 : 3)); inC = true; } } } return out; }); };
// Mask HTML / JSX comments too, line-wise (markers are read from the unmasked text separately).
const maskComments = (lines) => { let inC = false; return lines.map((l) => { let s = l; if (inC) { const e = s.search(/-->|\*\/\}/); if (e < 0) return ''; s = s.slice(e + 3); inC = false; } s = s.replace(/<!--[\s\S]*?-->|\{\/\*[\s\S]*?\*\/\}/g, ''); const o = s.search(/<!--|\{\/\*/); if (o >= 0) { inC = true; s = s.slice(0, o); } return s; }); };

// ---- all pages (for Next resolution) -------------------------------------------------------------
const pagesByUrl = new Map();
for (const p of walk(DOCS)) pagesByUrl.set(pageUrlOf(p, fm(SRC.read(p))), p);

// ---- nav: reading order per top-level section ----------------------------------------------------
// Minimal indentation parser for _data/navigation.yml: `- url:` / `- title:` items, `items:` children.
function parseNav(text) {
  const root = { items: [] }; const stack = [{ indent: -1, node: root }];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.search(/\S/); const line = raw.trim();
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent && !(stack[stack.length - 1].isItem && stack[stack.length - 1].indent + 2 === indent)) stack.pop();
    let top = stack[stack.length - 1];
    if (line.startsWith('- ')) {
      while (stack.length > 1 && top.isItem && top.indent >= indent) { stack.pop(); top = stack[stack.length - 1]; }
      const item = {}; (top.node.items ??= []).push(item);
      stack.push({ indent, node: item, isItem: true });
      const rest = line.slice(2); const kv = rest.match(/^([A-Za-z_]+):\s*(.*)$/); if (kv) item[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '');
      continue;
    }
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/); if (!kv) continue;
    if (kv[1] === 'items') { top.node.items = []; continue; }
    top.node[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '');
  }
  return root;
}
const nav = SRC.exists(NAV) ? parseNav(SRC.read(NAV)) : { items: [] };
const sequences = []; // [{ section, urls: [...] }]
const groupIndex = new Map(); // nested group url → its own sequence
// A sequence is a nav item with a url and children (a top-level section or a nested group);
// a label-only group (no url) stays inside its parent's sequence. A nested group's url also stays in
// the parent's sequence as a stop, so the page before the group points at the group's index. The
// url therefore sits in two sequences; groupIndex says which one is its own (next = its first child).
// A url listed as a group twice keeps its first entry, as the old first-match scan did.
const build = (item, out) => {
  if (item.url) out.push(norm(item.url));
  for (const c of item.items ?? []) {
    if (c.url && c.items?.length) { out.push(norm(c.url)); const seq = { section: c.title ?? c.url, urls: [] }; if (!groupIndex.has(norm(c.url))) groupIndex.set(norm(c.url), seq); build(c, seq.urls); sequences.push(seq); }
    else build(c, out);
  }
};
for (const sec of nav.items ?? []) { const urls = []; build(sec, urls); sequences.push({ section: sec.title ?? sec.url ?? '?', urls }); }
// Test hook: check.test.mjs reverses the list to prove navPos does not lean on push order.
if (process.env.DIATAXIS_CHECK_NAV_ORDER === 'reverse') sequences.reverse();
const navPos = (url) => { for (const s of groupIndex.has(url) ? [groupIndex.get(url)] : sequences) { const i = s.urls.indexOf(url); if (i >= 0) return { section: s.section, index: i, last: i === s.urls.length - 1, next: s.urls[i + 1] ?? null }; } return null; };

// ---- the checks ---------------------------------------------------------------------------------
const TYPE_RE = /\b(tutorial|how-to|reference|explanation|overview)(?:-hub)?(?:-type)?\s+page\b/i;
const EXEMPT_NEXT = new Set(['reference', 'troubleshooting']);
// Connector catalogs list their pages alphabetically, so the next connector is not a reading path
// (Nikita, 2026-10-13): no Next footer needed (D5), no nav-order check on a Next that is there (D12).
export const CATALOG_PREFIXES = ['/components/extractors/', '/components/writers/', '/components/applications/'];
const inCatalog = (u) => CATALOG_PREFIXES.some((p) => u.startsWith(p));

function checkPage(file) {
  const text = SRC.read(file);
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const f = fm(text);
  const url = pageUrlOf(file, f);
  const allLines = text.split(/\r?\n/);
  const fmLines = f._raw ? f._lines : 0;
  const body = allLines.slice(fmLines);           // 0-based index i ↔ file line fmLines + i + 1
  const ln = (i) => fmLines + i + 1;
  const noFence = maskFences(body);
  const clean = maskComments(noFence);
  const findings = []; const add = (id, level, line, msg) => findings.push({ id, level, line, msg });
  const isMdx = file.endsWith('.mdx');

  // D1 frontmatter
  if (!f._raw) add('D1', 'FAIL', 1, 'no frontmatter');
  else {
    if (!f.title) add('D1', 'FAIL', 1, 'frontmatter has no title');
    // The site root (src/content/docs/index.md) has slug '' and path slug '': that is its slug, not a missing one.
    const rootSlug = f.slug === '' && pathSlug(file) === '' && /^slug:\s*(''|"")\s*$/m.test(f._raw);
    if (!f.slug && !rootSlug) add('D1', 'FAIL', 1, 'frontmatter has no slug');
    else if (f.slug.replace(/^\/|\/$/g, '') !== pathSlug(file) && pathSlug(file) !== '') add('D1', 'WARN', 1, `slug '${f.slug}' differs from the file path '${pathSlug(file)}'`);
    if (!f.description) add('D1', 'FAIL', 1, 'frontmatter has no description (or it is empty)');
  }

  // D2 declared type: comment marker or <PageMeta genre="…">
  let declared = null, via = null, markerLine = null;
  for (let i = 0; i < noFence.length; i++) {
    const l = noFence[i];
    if (/<!--|\{\/\*/.test(l)) { const m = l.match(TYPE_RE); if (m) { declared = m[1].toLowerCase(); via = 'marker'; markerLine = ln(i); break; } }
    const pm = l.match(/<PageMeta\b[^>]*\bgenre="([^"]+)"/); if (pm) { declared = pm[1].toLowerCase().replace(/\s+/g, '-'); via = 'PageMeta'; markerLine = ln(i); break; }
  }
  if (declared === 'overview') declared = 'explanation';
  if (/^reference$/i.test(declared ?? '')) declared = 'reference';
  if (!declared) add('D2', 'WARN', fmLines + 1, 'no type declared: add `<!-- <Type>-type page. Source … verified … -->` after the lede (or PageMeta genre on a Getting Started page)');

  // D3 lede: the first content block must be prose
  let firstIdx = -1;
  for (let i = 0; i < clean.length; i++) {
    const l = clean[i].trim(); if (!l) continue;
    if (isMdx && (/^import\s/.test(l) || /^<[A-Z][\w.]*\b[^>]*\/>$/.test(l) || /^<\/?[A-Z][\w.]*\b/.test(l) && !/^[A-Za-z]/.test(l.replace(/<[^>]+>/g, '').trim()))) continue;
    if (/^<video\b|^<\/video>|^<source\b/.test(l)) continue;
    firstIdx = i; break;
  }
  if (firstIdx < 0) add('D3', 'FAIL', fmLines + 1, 'empty body');
  else { const l = clean[firstIdx].trim(); if (/^#{1,6}\s/.test(l)) add('D3', 'FAIL', ln(firstIdx), `page opens with a heading, no lede: "${l.slice(0, 60)}"`); else if (/^([-*]|\d+\.)\s/.test(l)) add('D3', 'FAIL', ln(firstIdx), 'page opens with a list, no lede'); }
  // D2 position: the comment marker goes after the lede (PageMeta sits under the title by design).
  if (via === 'marker' && firstIdx >= 0 && markerLine < ln(firstIdx)) add('D2', 'WARN', markerLine, 'type marker before the lede: move it below the first prose block');

  // D4 H1 in the body
  clean.forEach((l, i) => { if (/^#\s/.test(l)) add('D4', 'FAIL', ln(i), `H1 in body: "${l.trim().slice(0, 60)}"`); });

  // D5 / D12 Next footer
  const pos = navPos(url);
  const typeForExempt = declared ?? (/(^|\/)(reference|troubleshooting)\/$/.test(url) ? url.match(/(reference|troubleshooting)\/$/)[1] : null);
  const exemptNext = EXEMPT_NEXT.has(typeForExempt ?? '') || /\/troubleshooting\/$/.test(url) || (pos?.last ?? false) || inCatalog(url);
  // A page with the course bar (Getting Started's <CourseLine>) already shows the next step there and
  // in Starlight's Prev/Next, so D5 does not apply: no Next is fine, and a closing **Next:** line may
  // be a prose fork (Nikita, 2026-10-09).
  const courseBar = isMdx && /<CourseLine\b/.test(text);
  let lastIdx = -1; for (let i = clean.length - 1; i >= 0; i--) if (clean[i].trim()) { lastIdx = i; break; }
  const nextIdx = courseBar ? -2 : clean.findIndex((l) => /^\*\*Next:\*\*/.test(l.trim()));
  if (nextIdx === -2) { /* course bar: D5 does not apply */ }
  else if (nextIdx < 0) { if (!exemptNext) add('D5', 'FAIL', lastIdx >= 0 ? ln(lastIdx) : fmLines + 1, `no **Next:** footer${pos ? ` (nav says the next page is ${pos.next})` : ' (page is not in _data/navigation.yml, so no exemption applies)'}`); }
  else {
    const m = clean[nextIdx].match(/^\*\*Next:\*\*\s*\[[^\]]*\]\(([^)\s]+)\)/);
    // An exempt page needs no footer, so a closing prose line there is a style note, not a broken footer.
    if (!m) add('D5', exemptNext ? 'WARN' : 'FAIL', ln(nextIdx), exemptNext ? 'prose Next on an exempt page: write `**Next:** [label →](/slug/)` or drop the line' : 'Next footer is not `**Next:** [label →](/slug/)`');
    else {
      const target = norm(m[1]);
      if (/^https?:/.test(m[1])) add('D5', 'WARN', ln(nextIdx), `Next points off-site: ${m[1]}`);
      else if (!pagesByUrl.has(target)) add('D5', 'FAIL', ln(nextIdx), `Next target ${target} is not a page in src/content/docs`);
      else if (pos && pos.next && target !== pos.next && !inCatalog(url)) add('D12', 'WARN', ln(nextIdx), `Next goes to ${target}; nav order says the next page is ${pos.next}`);
      if (nextIdx !== lastIdx) add('D5', 'WARN', ln(nextIdx), 'Next is not the last block of the page');
    }
  }
  if (!pos) add('D12', 'WARN', 1, `${url} is not in _data/navigation.yml`);

  // D6 length band
  const total = allLines.length - (allLines[allLines.length - 1] === '' ? 1 : 0);
  if (total > 250) add('D6', 'WARN', total, `${total} lines: over the 250-line split trigger (band is 50 to 220)`);
  else if (total > 220) add('D6', 'WARN', total, `${total} lines: above the 50 to 220 band`);
  else if (total < 50) add('D6', 'WARN', total, `${total} lines: under the 50 to 220 band (fine for a leaf; a stub if it only links elsewhere)`);

  // D7 how-to recipe shape
  const sections = []; clean.forEach((l, i) => { const m = l.match(/^##\s+(.*)/); if (m) sections.push({ title: m[1].trim(), start: i }); });
  // A how-to with no `##` at all writes its tasks as `###`; those are the task level then.
  const tasks = sections.length ? sections : clean.flatMap((l, i) => { const m = l.match(/^###\s+(.*)/); return m ? [{ title: m[1].trim(), start: i }] : []; });
  if (declared === 'how-to' && tasks.length) {
    const lacking = tasks.filter((s, k) => { const end = tasks[k + 1]?.start ?? clean.length; const chunk = clean.slice(s.start, end).join('\n'); return !(/\*\*Goal:\*\*/.test(chunk) && /\*\*Result:\*\*/.test(chunk)); }).map((s) => s.title);
    if (lacking.length) add('D7', 'WARN', ln(tasks[0].start), `how-to sections without **Goal:** → steps → **Result:**: ${lacking.join(' · ')}`);
  }

  // D8 counts + smell hits
  const counts = { orderedLists: 0, tables: 0, clickSentences: 0, conceptHeadings: 0, tabs: 0, fieldTables: 0 };
  let inList = false, inTable = false;
  clean.forEach((l) => {
    const ol = /^\s*\d+\.\s/.test(l); if (ol && !inList) counts.orderedLists++; inList = ol || (inList && /^\s{2,}\S/.test(l));
    const tb = /^\s*\|/.test(l); if (tb && !inTable) counts.tables++; inTable = tb;
    if (/\bClick\s+\*\*|\*\*Click\b|^\d+\.\s+(Click|Open|Select|Choose|Go to|Enter)\b/.test(l)) counts.clickSentences++;
    if (/^##\s+(How .+ works?|Why\b|What (is|are)\b|How it fits|Concepts?\b)/i.test(l)) counts.conceptHeadings++;
    if (/<TabItem\b/.test(l)) counts.tabs++;
    if (/^\s*\|\s*(Field|Parameter|Option|Flag|Key|Setting|Header|Property|Variable|Column)s?\s*\|/i.test(l)) counts.fieldTables++;
  });
  const smells = [];
  if (counts.conceptHeadings && counts.orderedLists) smells.push(`concept headings (${counts.conceptHeadings}) + numbered steps (${counts.orderedLists})`);
  if (counts.orderedLists && counts.tables) smells.push(`numbered steps (${counts.orderedLists}) + tables (${counts.tables})`);
  if (counts.tabs >= 3 && sections.length > counts.tabs) smells.push(`per-client tabs (${counts.tabs}) next to other sections`);
  if (counts.clickSentences >= 2 && (declared === 'reference' || declared === 'explanation')) smells.push(`${counts.clickSentences} click-here sentences on a ${declared} page`);
  if (smells.length >= 2) add('D8', 'EVIDENCE', fmLines + 1, `mixed-type evidence (${smells.length} smells): ${smells.join('; ')}: the agent judges, the page map is Nikita's call`);
  else if (smells.length === 1) add('D8', 'EVIDENCE', fmLines + 1, `1 of the 4 smells: ${smells[0]}`);

  // D10 overview as link directory
  if (/(^|\/)index\.mdx?$/.test(file) || url.split('/').filter(Boolean).length <= 1) {
    const content = clean.filter((l) => l.trim() && !/^\*\*Next:\*\*/.test(l.trim()));
    const linkLines = content.filter((l) => /^\s*[-*]\s*\[[^\]]+\]\([^)]+\)\s*$/.test(l)).length;
    const words = content.join(' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').split(/\s+/).filter(Boolean).length;
    if (content.length && (linkLines / content.length > 0.5 || words < 150)) add('D10', 'EVIDENCE', fmLines + 1, `thin overview: ${words} words of prose, ${linkLines} of ${content.length} content lines are bare links: an overview says what the thing is and what you can do with it`);
  }

  // D9 VERIFY / TODO markers: an owner in the source comment, and nothing in dist.
  // D16 template leftovers: a `TEMPLATE:` instruction (from docs-page's templates) still on the page.
  text.split(/\r?\n/).forEach((l, i) => { if (/\bTEMPLATE:/.test(l)) add('D16', 'FAIL', i + 1, `template instruction left on the page: "${l.trim().slice(0, 60)}"`); });
  // Only comment text counts: "VERIFY" in prose or a link label is not a marker. Inside a comment,
  // `VERIFY(` and `VERIFY:` are markers; a bare word is one only when it opens the comment, so a type
  // marker that mentions VERIFY in passing is not flagged.
  const PLACEHOLDER = /^<?(owner|name|who|tbd|someone|somebody|team|\?+|[\w-]+-owner|owner-[\w-]+)>?$/i;
  commentsOnly(noFence).forEach((l, i) => {
    for (const m of l.matchAll(/\b(VERIFY|TODO)\b(\(([^)]*)\)|:|\s|$)/g)) {
      const bare = !m[2].startsWith('(') && m[2] !== ':';
      if (bare && l.slice(0, m.index).trim() !== '') continue;
      const owner = m[2].startsWith('(') ? m[3].trim() : '';
      if (!owner) add('D9', 'FAIL', ln(i), `${m[1]} without an owner: write ${m[1]}(<the person who can confirm it>): …`);
      else if (PLACEHOLDER.test(owner)) add('D9', 'FAIL', ln(i), `${m[1]}(${owner}) is a placeholder, not a person: name who can confirm it, e.g. ${m[1]}(Jordan Burger): …`);
    }
  });
  if (WANT_DIST && fs.existsSync(DIST)) {
    const leaked = ['index.md', 'index.html'].filter((name) => { const p = path.join(DIST, url, name); return fs.existsSync(p) && /VERIFY\(|TODO\(/.test(fs.readFileSync(p, 'utf8')); });
    if (leaked.length) add('D9', 'FAIL', 0, `VERIFY/TODO marker reached dist${url}${leaked.join(' and ')}: strip-comments.mjs missing or bypassed`);
  }

  // D11 "plugin" for a component
  clean.forEach((l, i) => { if (/\bplugins?\b/i.test(l) && !/kbagent|dataapp-developer|claude|cowork|chrome|vs code|ide\b|remark|rehype|astro|starlight|\bmcp\b|windsurf|cursor|copilot|jetbrains|browser/i.test(l)) add('D11', 'WARN', ln(i), `"plugin": say connector or component: "${l.trim().slice(0, 70)}"`); });

  const fail = findings.filter((x) => x.level === 'FAIL').length, warn = findings.filter((x) => x.level === 'WARN').length, evidence = findings.filter((x) => x.level === 'EVIDENCE').length;
  const order = { FAIL: 0, WARN: 1, EVIDENCE: 2 };
  findings.sort((a, b) => order[a.level] - order[b.level] || a.id.localeCompare(b.id, undefined, { numeric: true }) || a.line - b.line);
  return { file: rel, url, title: f.title ?? null, lines: total, type: { declared, via, line: markerLine }, nav: pos ? { section: pos.section, index: pos.index + 1, last: pos.last, next: pos.next } : null, counts, findings, fail, warn, evidence, verdict: fail ? 'FIX' : 'PASS' };
}

const pages = files.map(checkPage);
const fail = pages.reduce((n, p) => n + p.fail, 0), warn = pages.reduce((n, p) => n + p.warn, 0), evidence = pages.reduce((n, p) => n + p.evidence, 0);
const result = { root: ROOT, dist: WANT_DIST && fs.existsSync(DIST), pages, fail, warn, evidence, verdict: fail ? 'FIX' : 'PASS' };

if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
else {
  for (const p of pages) {
    console.log(`\n${p.file}  (type: ${p.type.declared ?? '?'}${p.type.via === 'PageMeta' ? ' via PageMeta' : ''} · ${p.lines} lines · nav: ${p.nav ? `${p.nav.section} #${p.nav.index}${p.nav.last ? ' (last)' : ''}` : 'not in nav'})`);
    for (const x of p.findings) console.log(`  ${x.id.padEnd(4)}${x.level.padEnd(9)}${(x.line ? ':' + x.line : '').padEnd(6)} ${x.msg}`);
    console.log(`  verdict: ${p.verdict} (${p.fail} fail, ${p.warn} warn, ${p.evidence} evidence)`);
  }
  console.log(`\n${fail ? '✗ FIX' : '✓ PASS'} · ${pages.length} page(s) · ${fail} fail · ${warn} warn · ${evidence} evidence${WANT_DIST && !fs.existsSync(DIST) ? ' · (--dist asked but dist/ is missing: D9 leak check skipped)' : ''}`);
}
// exitCode, not process.exit(): a large --json report piped to another process is cut off otherwise.
process.exitCode = fail ? 1 : 0;
