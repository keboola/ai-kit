#!/usr/bin/env node
// Lint a component_config/-shaped directory against Keboola's own published
// component-copy rules. Every finding cites the rule it came from, so a PR
// comment can quote the source instead of asserting taste.
//
// Sources (all versioned in keboola/connection-docs):
//   extend/publish/index.md            § Component Name and Description
//                                      § Component Configuration
//   extend/publish/checklist/index.md  the checkbox list
//   extend/component/ui-options/configuration-schema/index.md   options.*
//   CLAUDE.md                          voice: active, short, `connector`/`component`
//
// Exit 0 = no errors (warnings may still print), 1 = at least one error,
// 2 = could not run. Dependency-free: this is what PRDCT-590's PR-reviewer bot
// needs to be able to call.

import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The rules as a function, so the fleet audit and other skills reuse them without spawning
// a process per component. `read(name)` returns a file's text or null when it is absent.
//   full       a complete component_config/ (an absent required file is a finding)
//   schemas    schemas are part of this change (their problems are errors, not warnings)
//   name       the component's name ("Money S3 Writer Pro" is not a self-reference)
//   bucket     category-map bucket; source/* and destination/* are connectors
//   connector  connector rules without a bucket (component-ci knows the type, not the bucket)
//   retired    the component is being deprecated: the deprecation line is required and the
//              connector rules are not (house rule agreed 2026-11-12)
//   readme     the component repo's README text; without it `read('README.md')` is used, and with
//              neither the README rule is skipped (the Storage index has no READMEs)
export function lintCopy(read, opts = {}) {
  const FULL = !!opts.full;
  const SCHEMAS = !!opts.schemas;
  const NAME = opts.name || '';
  const RETIRED = !!opts.retired;
  const CONNECTOR = !RETIRED && (!!opts.connector || /^(source|destination)\//.test(opts.bucket || ''));
  const singular = (w) => w.toLowerCase().replace(/s$/, '');
  const inName = (word) => NAME.split(/[^A-Za-z0-9]+/).map(singular).includes(singular(word));

  const findings = [];
  // In a real component_config/ (--full) that this PR does not change the schemas
  // of, existing schema problems are reported as warnings so a markdown-only PR is
  // not failed on them; --schemas makes them errors again.
  const add = (level, file, rule, message) => {
    if (FULL && !SCHEMAS && /Schema\.json$/.test(file) && level === 'error') level = 'warning';
    findings.push({ level, file, rule, message });
  };

  // No images in the copy the Keboola UI shows (owner's rule, 2026-11-12): pictures belong in the
  // README, which keeps them in the repo as it always has. In these fields they rot (private raw
  // URLs answer 404 to customers, README-relative paths mean nothing outside the repo).
  function lintImages(f, t) {
    const urls = [
      ...[...t.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)].map((m) => m[1]),
      ...[...t.matchAll(/!\[[^\]]*\]\[[^\]]*\]/g)].map((m) => m[0]),
      ...[...t.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)/gi)].map((m) => m[1]),
    ];
    for (const u of urls) {
      add('error', f, 'house#images', `Image ${u} in the copy the UI shows. Pictures go in the README; drop it here.`);
    }
  }

  const SELF_REFERENCE = /\b(extractor|writer|application)s?\b/i;

  function lintShort(text) {
    const f = 'component_short_description.md';
    if (text === null) {
      if (FULL) add('error', f, 'publish#component-name-and-description', 'File is missing — the short description is what a user scans the catalog by.');
      return;
    }
    const t = text.trim();
    if (!t) { add('error', f, 'publish#component-name-and-description', 'Short description is empty — it is what a user scans the catalog by.'); return; }
    if (/^this\s+(extractor|writer|component|application)\b/i.test(t)) {
      add('error', f, 'publish#component-name-and-description',
        'Starts by describing the component. The short description must describe the SERVICE — OK: "Native analytic database for Apache Hadoop", WRONG: "This extractor extracts data from Cloudera Impala".');
    }
    const self = [...t.matchAll(new RegExp(SELF_REFERENCE.source, 'gi'))].find((m) => !inName(m[1]));
    if (self) {
      // A warning, not an error: the word can be part of the service's own name.
      add('warning', f, 'publish#component-name-and-description',
        `Contains "${self[0]}"; names and descriptions must not call the component an extractor/writer/application. Ignore if it is part of the service's name (pass --name).`);
    }
    if (t.length > 200) add('warning', f, 'CLAUDE.md#voice', `${t.length} characters — one sentence is the shape a catalog row can show.`);
    const sentences = t.replace(/\b(e\.g|i\.e|etc|Inc|Ltd|Co|vs|approx|No)\./g, '$1').match(/[.!?](\s|$)/g) || [];
    if (sentences.length > 1) add('warning', f, 'CLAUDE.md#voice', 'More than one sentence; the short description is one sentence.');
    if (t.split(/\n\s*\n/).length > 1) add('warning', f, 'CLAUDE.md#voice', 'More than one paragraph; the short description is a single sentence.');
  }

  function lintLong(text) {
    const f = 'component_long_description.md';
    if (text === null) {
      if (FULL) add('warning', f, 'publish#component-name-and-description', 'File is missing — no long description will be published.');
      return;
    }
    const t = text.trim();
    if (!t) {
      add('warning', f, 'publish#component-name-and-description', 'Long description is empty — this is the gap-fill target: what the user gets, what they must provide, whether loading is incremental, links.');
      // An empty long description on a connector has no load line either; say so, or the audit
      // would count the component as passing that rule.
      if (CONNECTOR) add('error', f, 'house#load-behaviour', 'Long description is empty, so there is no load-behaviour line.');
      return;
    }
    if (/^\s*\d+[.)]\s/m.test(t)) {
      // A warning: a numbered list can also be a list of objects the connector reads.
      add('warning', f, 'publish#component-name-and-description',
        'Contains a numbered list. If it is configuration steps, move them out: the long description is shown BEFORE the user starts configuring.');
    }
    if (/\bclick\b|\bgo to the (configuration|settings)\b/i.test(t)) {
      add('warning', f, 'publish#component-name-and-description', 'Reads like configuration instructions ("click", "go to the configuration"), which belong to the documentation, not here.');
    }
    if (/\bplugin\b/i.test(t)) add('error', f, 'CLAUDE.md#voice', 'Uses "plugin"; the terms are `connector` / `component`.');
    // A VERIFY counts only when it is about loading; a VERIFY elsewhere (say in the Network item)
    // does not stand in for the missing line.
    const loadLine = /\bincremental|\bfull load|\bupsert/i.test(t) || /VERIFY\([^)]*\)[^\n]*\b(load|loading|incremental)\b/i.test(t);
    if (CONNECTOR && !loadLine) {
      add('error', f, 'house#load-behaviour', 'A connector states its load behaviour, including the negative ("Incremental loading is not supported; every run is a full load."). Unknown: write VERIFY(owner), never leave it out.');
    }
    // Prerequisites live in the README, not in the copy the UI shows (owner, 2026-11-12).
    if (/^#{1,6}\s*(Before you start|Prerequisites)\b/im.test(t)) {
      add('error', f, 'house#prerequisites-in-readme', 'A prerequisites block in the long description. It belongs in the README\'s "## Prerequisites"; keep here what the user gets and what the component can do.');
    }
    lintImages(f, t);
  }

  // Every connector's README carries the same prerequisites section, all five items in this order
  // (house rule agreed 2026-11-12, moved from the long description to the README on the owner's word
  // the same day), so "not needed" is never confused with "not written".
  const BEFORE_ITEMS = ['Account and plan', 'Access', 'Permissions', 'Network', 'Set up first'];
  function lintReadme(t) {
    const f = 'README.md';
    const head = t.search(/^##\s+(Prerequisites|Before you start)\s*$/im);
    if (head < 0) {
      add('error', f, 'house#before-you-start', `No "## Prerequisites" section. Every connector's README lists ${BEFORE_ITEMS.join(', ')}; write "not needed" out and VERIFY(owner) what is unknown.`);
      return;
    }
    const rest = t.slice(head).split('\n').slice(1);
    const end = rest.findIndex((l, i) => i > 0 && /^#{1,2}\s/.test(l));
    const block = (end < 0 ? rest : rest.slice(0, end)).join('\n');
    let last = -1;
    for (const item of BEFORE_ITEMS) {
      const m = block.match(new RegExp(`^[-*]\\s+(?:\\*\\*)?${item}(?:\\*\\*)?:(?:\\*\\*)?[ \\t]*(\\S.*)?$`, 'm'));
      if (!m) { add('error', f, 'house#before-you-start', `"Before you start" has no "- ${item}:" item.`); continue; }
      if (!m[1]) add('error', f, 'house#before-you-start', `"- ${item}:" is empty. Write the answer, "not needed" in words, or VERIFY(owner).`);
      if (m.index < last) add('error', f, 'house#before-you-start', `"- ${item}:" is out of order; the order is ${BEFORE_ITEMS.join(', ')}.`);
      last = Math.max(last, m.index);
    }
  }

  function lintCfgDesc(text) {
    const f = 'configuration_description.md';
    // Optional, and empty on most components: the owner would rather drop the field from the UI than
    // fill it (2026-11-12). When it has text, the published rules below apply.
    if (text === null) return;
    const t = text.trim();
    if (!t) return;
    lintImages(f, t);
    if (/^#/.test(t)) {
      add('error', f, 'publish#component-configuration',
        'Opens with a header. Verbatim rule: "Your markdown should not start with a header and should use only level 3 and level 4 headers (level 2 header is prepended before the configuration description)." Start with a sentence; a `###` may follow later.');
    }
    const bad = [...t.matchAll(/^(#{1,2})\s+\S/gm)];
    if (bad.length) {
      add('error', f, 'checklist#configuration-description',
        `Uses ${bad.length} level-1/level-2 header(s); only ### and #### are allowed.`);
    }
  }

  function lintDocUrl(text) {
    const f = 'documentationUrl.md';
    if (text === null) {
      if (FULL) add('warning', f, 'template#documentation-url', 'File is missing; the Documentation link in the UI will be empty.');
      return;
    }
    const t = text.trim();
    if (!/^https:\/\/\S+$/.test(t)) {
      add('error', f, 'template#documentation-url', 'Must be exactly one https:// URL and nothing else.');
    }
  }

  function walkProps(node, path, f) {
    if (!node || typeof node !== 'object') return;
    const props = node.properties;
    if (props && typeof props === 'object') {
      for (const [key, p] of Object.entries(props)) {
        const where = `${path}.${key}`;
        if (p == null || typeof p !== 'object') continue;
        if (p.type === undefined && p.$ref === undefined && p.enum === undefined && !p.oneOf && !p.anyOf && !p.allOf) {
          add('error', f, 'configuration-schema#supported-options', `${where}: no \`type\`; the form generator cannot pick an input for it.`);
        }
        if (p.propertyOrder === undefined) {
          add('error', f, 'checklist#configuration-and-row-schema', `${where}: no \`propertyOrder\`. Every property must define one so the form order is explicit.`);
        }
        if (typeof p.title === 'string') {
          if (/[:.,;]\s*$/.test(p.title)) {
            add('error', f, 'checklist#configuration-and-row-schema', `${where}: title "${p.title}" ends with punctuation; titles are short and without a colon, period, etc.`);
          }
          const words = p.title.trim().split(/\s+/);
          if (words.length > 2 && words.slice(1).filter((w) => /^[A-Z][a-z]/.test(w)).length >= words.length - 1) {
            add('warning', f, 'template#field-copy', `${where}: title "${p.title}" is in Title Case; titles are sentence case unless a word is a proper name.`);
          }
          if (p.title.trim().length > 40) {
            add('warning', f, 'checklist#configuration-and-row-schema', `${where}: title is ${p.title.trim().length} characters — detail belongs in \`options.tooltip\`, not the label.`);
          }
        }
        if (Array.isArray(p.enum)) {
          const titles = p.options?.enum_titles;
          if (!titles) {
            add('warning', f, 'configuration-schema#supported-options', `${where}: \`enum\` without \`options.enum_titles\`; the raw values are shown to the user.`);
          } else if (titles.length !== p.enum.length) {
            add('error', f, 'configuration-schema#supported-options', `${where}: \`enum_titles\` has ${titles.length} entries for ${p.enum.length} \`enum\` values.`);
          }
        }
        if (typeof p.description === 'string' && p.description.trim().length > 300) {
          add('warning', f, 'publish#component-configuration', `${where}: description is ${p.description.trim().length} characters. Interface text stays short — move detail to \`options.tooltip\` or a documentation link (decision 2026-07-28).`);
        }
        walkProps(p, where, f);
      }
      if (Array.isArray(node.required)) {
        for (const r of node.required) {
          if (!(r in props)) {
            add('error', f, 'checklist#configuration-and-row-schema', `${path}: \`required\` lists "${r}", which is not under \`properties\`; the form cannot render a required field that does not exist.`);
          }
        }
      }
      if (node.required === undefined && Object.keys(props).length) {
        add('warning', f, 'checklist#configuration-and-row-schema', `${path}: no \`required\` array while it defines ${Object.keys(props).length} propert${Object.keys(props).length === 1 ? 'y' : 'ies'}; required properties must be listed there.`);
      }
    }
    // `[]` steps into an array's item schema, so a property that is itself named `items` stays addressable.
    if (node.items) walkProps(node.items, `${path}[]`, f);
  }

  function lintSchema(name) {
    const raw = read(name);
    if (raw === null) return;
    if (!FULL && !SCHEMAS) {
      add('error', name, 'skill#first-cut', 'A schema file is in the proposal. The first cut changes only the three markdown files; pass --schemas only for a reviewed schema change, and run scripts/schema-diff.mjs on it.');
      return;
    }
    const t = raw.trim();
    if (!t || t === '{}') return; // an empty schema is how "no row config" is expressed
    let parsed;
    try {
      parsed = JSON.parse(t);
    } catch (e) {
      add('error', name, 'checklist#configuration-and-row-schema', `Does not parse as JSON: ${e.message}. This file drives the live configuration UI.`);
      return;
    }
    walkProps(parsed, 'root', name);
  }

    // A deprecated component says so first, on the page a deep-linked reader lands on and on
    // the form an existing configuration opens: "Deprecated: use <successor> instead." or
    // "Deprecated: no replacement."
    function lintRetired() {
      for (const f of ['component_long_description.md', 'configuration_description.md']) {
        const t = (read(f) ?? '').trim();
        if (!t) {
          if (f === 'component_long_description.md') add('error', f, 'house#retired', 'A deprecated component needs a long description that opens with "Deprecated: ...".');
          continue;
        }
        if (!/^Deprecated:\s+\S/.test(t)) {
          add('error', f, 'house#retired', 'Must open with "Deprecated: use <successor> instead." or "Deprecated: no replacement."');
        }
      }
    }


  lintShort(read('component_short_description.md'));
  lintLong(read('component_long_description.md'));
  lintCfgDesc(read('configuration_description.md'));
  const readme = opts.readme ?? read('README.md');
  if (CONNECTOR && readme !== null) lintReadme(readme);
  lintDocUrl(read('documentationUrl.md'));
  lintSchema('configSchema.json');
  lintSchema('configRowSchema.json');
  if (RETIRED) lintRetired();
  return findings;
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();

if (isMain) {
  const argv = process.argv.slice(2);
  const dir = argv[0];
  const val = (name) => { const i = argv.indexOf(name); return i > -1 ? String(argv[i + 1] || '') : ''; };
  if (!dir || dir.startsWith('--')) {
    console.error('usage: lint-copy.mjs <component_config-dir> [--full] [--schemas] [--name "<component name>"] [--bucket <bucket> | --connector] [--readme <README.md>] [--retired] [--json]');
    process.exitCode = 2;
  } else if (!existsSync(dir)) {
    console.error(`RESULT: lint could not run — ${dir} does not exist`);
    process.exitCode = 2;
  } else {
    const read = (name) => {
      const p = join(dir, name);
      return existsSync(p) ? readFileSync(p, 'utf8') : null;
    };
    const findings = lintCopy(read, {
      // A proposal directory holds only the files being changed, so an ABSENT file means
      // "nothing proposed", not "the field is empty". --full says this is a complete
      // component_config/ directory, where an absent required file is a finding.
      full: argv.includes('--full'),
      // Schemas drive the live configuration form, and the portal syncs to every stack in
      // about five minutes, so a proposal may carry them only on purpose.
      schemas: argv.includes('--schemas'),
      name: val('--name'),
      bucket: val('--bucket'),
      connector: argv.includes('--connector'),
      retired: argv.includes('--retired'),
      readme: val('--readme') ? (existsSync(val('--readme')) ? readFileSync(val('--readme'), 'utf8') : '') : undefined,
    });
    const errors = findings.filter((f) => f.level === 'error');
    const warnings = findings.filter((f) => f.level === 'warning');
    if (argv.includes('--json')) {
      console.log(JSON.stringify({ dir, errors: errors.length, warnings: warnings.length, findings }, null, 2));
    } else {
      for (const f of findings) {
        console.log(`${f.level === 'error' ? 'ERROR  ' : 'warning'} ${f.file} [${f.rule}]\n         ${f.message}`);
      }
      console.log(`\nRESULT: ${errors.length} error(s), ${warnings.length} warning(s) in ${dir}`);
    }
    if (errors.length) process.exitCode = 1;
  }
}
