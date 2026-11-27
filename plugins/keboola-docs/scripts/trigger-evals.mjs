#!/usr/bin/env node
// trigger-evals.mjs: routing precision and recall of every skill's `description:`.
// Node port of keboola/ai-kit evals/activation/run_activation.py (same prompt, grading, thresholds).
//
// For each case in evals/<skill>/trigger-evals.json a cheap model sees ALL skill descriptions (as the
// harness does when it routes) and names the skills it would invoke. Correct when the skill under test
// is in the answer iff should_trigger. Calls go through `claude -p` on the logged-in CLI (no API key),
// isolated from plugins, MCP servers, settings and tools.
//
//   node <plugin>/scripts/trigger-evals.mjs [--skill <name> ...] [--ci] [--votes 3] [--json <file>] [--model haiku] [-j 8] [--dry-run]
// --ci exits 1 below 85 % overall accuracy, or any skill below 60 % accuracy or 60 % recall.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const all = (n) => args.flatMap((a, i) => (a === n ? [args[i + 1]] : []));
const val = (n, d) => all(n).pop() ?? d;
const has = (n) => args.includes(n);
const MODEL = val('--model', 'haiku');
const CONC = Number(val('-j', '8'));
const ONLY = new Set(all('--skill'));
const VOTES = Number(val('--votes', '1'));   // >1: run each case that many times, majority decides (claude -p has no temperature 0)

const ROUTER_PROMPT = (skillList, query) => `You are the skill router of a coding agent. The agent has these skills installed. Each line is \`name: description\`.

<skills>
${skillList}
</skills>

A user sent this message:

<message>
${query}
</message>

Which skills (zero or more) should be invoked for this message? Choose a skill only when its description clearly covers the message. Prefer the most specific skill; do not invoke skills for messages they merely relate to.

Reply with ONLY a JSON array of skill names, e.g. ["get-started"] or [].`;

const frontmatter = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/); if (!m) return {};
  const out = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z_-]+):\s*(.*)$/); if (!kv) continue;
    let v = kv[2];
    if (/^[>|][+-]?$/.test(v)) { const buf = []; while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) buf.push(lines[++i].trim()); v = buf.join(' '); }
    else if (/^"/.test(v)) { try { v = JSON.parse(v); } catch { v = v.replace(/^"|"$/g, ''); } }
    else v = v.replace(/^'|'$/g, '').replace(/''/g, "'");
    out[kv[1]] = v;
  }
  return out;
};

const skills = fs.readdirSync(path.join(PLUGIN, 'skills')).sort().map((d) => {
  const f = path.join(PLUGIN, 'skills', d, 'SKILL.md');
  if (!fs.existsSync(f)) return null;
  const fm = frontmatter(fs.readFileSync(f, 'utf8'));
  return { name: fm.name ?? d, dir: d, description: fm.description ?? '' };
}).filter(Boolean);
const skillList = skills.map((s) => `${s.name}: ${s.description}`).join('\n');

const cases = [];
for (const s of skills) {
  if (ONLY.size && !ONLY.has(s.dir) && !ONLY.has(s.name)) continue;
  const f = path.join(PLUGIN, 'evals', s.dir, 'trigger-evals.json');
  if (!fs.existsSync(f)) { console.error(`! no ${path.relative(PLUGIN, f)}`); continue; }
  for (const c of JSON.parse(fs.readFileSync(f, 'utf8'))) cases.push({ skill: s.name, ...c });
}
if (has('--dry-run')) { for (const c of cases) console.log(`${c.should_trigger ? '+' : '-'} ${c.skill}: ${c.query}`); console.log(`${cases.length} cases, ${skills.length} skills`); process.exit(0); }

export function parseAnswer(text) {
  const fenced = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  const cands = fenced ? [fenced[1]] : [...text.matchAll(/\[[\s\S]*?\]/g)].map((m) => m[0]);
  for (const c of cands.reverse()) { try { const d = JSON.parse(c); if (Array.isArray(d)) return { skills: d.map(String), error: null }; } catch { /* next */ } }
  return { skills: [], error: text.trim().slice(0, 200) };
}

const classify = (query) => new Promise((resolve) => {
  const p = spawn('claude', ['-p', '--model', MODEL, '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--no-session-persistence', ROUTER_PROMPT(skillList, query)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', (d) => { out += d; });
  const t = setTimeout(() => p.kill('SIGKILL'), 120000);
  p.on('close', () => { clearTimeout(t); resolve(parseAnswer(out)); });
});

const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(CONC, cases.length) }, async () => {
  while (next < cases.length) {
    const c = cases[next++];
    const answers = [];
    for (let v = 0; v < VOTES; v++) answers.push(await classify(c.query));
    const names = new Set(skills.map((s) => s.name));
    // the router sometimes answers a namespaced or shortened name: keboola-docs:docs-page, stage-strip
    const norm = (n) => { const b = String(n).replace(/^[\w-]+:/, ''); return names.has(b) ? b : (skills.find((s) => s.name.endsWith('-' + b))?.name ?? b); };
    const yes = answers.filter((a) => a.skills.map(norm).includes(c.skill)).length;
    const triggered = yes * 2 > answers.length;
    const invoked = [...new Set(answers.flatMap((a) => a.skills.map(norm)))];
    const error = answers.every((a) => a.error) ? answers[0].error : null;
    results.push({ ...c, invoked, triggered, correct: triggered === c.should_trigger, ...(error ? { parse_error: error } : {}) });
    process.stderr.write('.');
  }
}));
process.stderr.write('\n');

const per = new Map();
for (const r of results) { if (!per.has(r.skill)) per.set(r.skill, []); per.get(r.skill).push(r); }
const perSkill = [...per].sort().map(([skill, rows]) => {
  const tp = rows.filter((r) => r.should_trigger && r.triggered).length, fn = rows.filter((r) => r.should_trigger && !r.triggered).length;
  const fp = rows.filter((r) => !r.should_trigger && r.triggered).length, tn = rows.filter((r) => !r.should_trigger && !r.triggered).length;
  return { skill, cases: rows.length, accuracy: (tp + tn) / rows.length, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null, fp, fn };
});
const correct = results.filter((r) => r.correct).length;
const summary = { run_at: new Date().toISOString(), model: MODEL, total: results.length, correct, accuracy: results.length ? correct / results.length : 0, per_skill: perSkill, failures: results.filter((r) => !r.correct) };

const pct = (x) => (x === null ? '  n/a' : `${(x * 100).toFixed(0).padStart(4)}%`);
console.log(`\nTrigger evals: ${summary.total} cases, model ${MODEL}, overall ${(summary.accuracy * 100).toFixed(1)} %\n`);
console.log(`${'skill'.padEnd(34)} cases   acc  prec   rec  FP  FN`);
for (const s of perSkill) console.log(`${s.skill.padEnd(34)} ${String(s.cases).padStart(5)} ${pct(s.accuracy)} ${pct(s.precision)} ${pct(s.recall)} ${String(s.fp).padStart(3)} ${String(s.fn).padStart(3)}`);
if (summary.failures.length) {
  console.log(`\n${summary.failures.length} misroutes:`);
  for (const f of summary.failures) console.log(`  [${f.skill}] ${f.should_trigger ? 'should trigger' : 'should NOT trigger'}, router chose ${JSON.stringify(f.invoked)}${f.parse_error ? ' [UNPARSEABLE]' : ''}\n    ${f.query.slice(0, 110)}`);
}
const jsonOut = val('--json', null);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(summary, null, 2));
if (has('--ci')) {
  const bad = perSkill.filter((s) => s.accuracy < 0.6 || (s.recall !== null && s.recall < 0.6));
  if (summary.accuracy < 0.85 || bad.length) { console.error(`\n✗ below threshold: overall ${(summary.accuracy * 100).toFixed(1)} % (min 85), skills under 60 %: ${bad.map((s) => s.skill).join(', ') || 'none'}`); process.exit(1); }
  console.log('\n✓ thresholds met');
}
