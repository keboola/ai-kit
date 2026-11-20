#!/usr/bin/env node
// A stand-in for the gh CLI in the component-facts tests: answers `gh api <endpoint>` from
// GH_STUB_ANSWERS (a JSON file mapping an endpoint, or "search:<query>", to its output after
// --jq). An unknown endpoint fails like gh does on a 404.
import { readFileSync } from 'node:fs';
const args = process.argv.slice(2);
const answers = JSON.parse(readFileSync(process.env.GH_STUB_ANSWERS, 'utf8'));
const endpoint = args[1] === '-X' ? args[3] : args[1];
const q = args.find((a) => a.startsWith('q='));
const key = endpoint === 'search/code' ? `search:${q.slice(2)}` : endpoint;
if (!(key in answers)) { process.stderr.write(`gh: Not Found (HTTP 404)\n`); process.exit(1); }
const a = answers[key];
if (a && a.__error) { process.stderr.write(`${a.__error}\n`); process.exit(1); }
process.stdout.write(typeof a === 'string' ? a : JSON.stringify(a));
