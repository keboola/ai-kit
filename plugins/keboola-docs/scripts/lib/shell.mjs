// shell.mjs: just enough shell parsing for the commit gate to know what a Bash command will run.
//
//   segments(cmd) → [{ argv, env, git: { C, sub, args } | null }]
//
// Heredoc bodies are dropped (their text is data, not commands), quotes are honoured (a quoted
// "; git commit" is one word, not a command), `$(...)` and backticks are kept as one opaque word,
// and the command is cut into simple commands at ; && || | & newlines and parentheses. Leading
// VAR=value words become `env`; `then`, `do`, `else`, `!`, `time`, `exec`, `command` are skipped.
// It is not a shell: no expansion, no aliases, no functions. Good enough to find `git … commit`
// and the `git add` before it in agent-written commands.

const HEREDOC = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g;

// Drop the body lines of every heredoc, keep the line that opens it.
export function stripHeredocs(cmd) {
  const lines = cmd.split('\n');
  const out = [];
  const pending = [];
  for (const line of lines) {
    if (pending.length) {
      const { word, dash } = pending[0];
      if ((dash ? line.replace(/^\t+/, '') : line) === word) pending.shift();
      continue;
    }
    out.push(line);
    for (const m of line.matchAll(HEREDOC)) pending.push({ word: m[2], dash: m[0].startsWith('<<-') });
  }
  return out.join('\n');
}

// Split into simple commands, each a list of words with quotes removed.
export function splitCommands(cmd) {
  const s = stripHeredocs(cmd);
  const cmds = [];
  let words = [], word = '', inWord = false;
  const endWord = () => { if (inWord) words.push(word); word = ''; inWord = false; };
  const endCmd = () => { endWord(); if (words.length) cmds.push(words); words = []; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'") { const j = s.indexOf("'", i + 1); const e = j < 0 ? s.length : j; word += s.slice(i + 1, e); inWord = true; i = e; continue; }
    if (c === '"') {
      let j = i + 1, buf = '';
      while (j < s.length && s[j] !== '"') { if (s[j] === '\\' && j + 1 < s.length) { buf += s[j + 1]; j += 2; } else buf += s[j++]; }
      word += buf; inWord = true; i = j; continue;
    }
    if (c === '\\' && i + 1 < s.length) { if (s[i + 1] !== '\n') { word += s[i + 1]; inWord = true; } i++; continue; }
    if (c === '$' && s[i + 1] === '(') {           // $(...) as one opaque word
      let depth = 0, j = i + 1;
      for (; j < s.length; j++) { if (s[j] === '(') depth++; else if (s[j] === ')' && --depth === 0) break; }
      word += s.slice(i, j + 1); inWord = true; i = j; continue;
    }
    if (c === '`') { const j = s.indexOf('`', i + 1); const e = j < 0 ? s.length : j; word += s.slice(i, e + 1); inWord = true; i = e; continue; }
    if (c === '#' && !inWord) { const j = s.indexOf('\n', i); i = j < 0 ? s.length : j - 1; continue; }
    if (';&|\n()'.includes(c)) { endCmd(); continue; }
    if (/\s/.test(c)) { endWord(); continue; }
    word += c; inWord = true;
  }
  endCmd();
  return cmds;
}

const SKIP = new Set(['then', 'do', 'else', 'elif', 'if', 'while', 'until', '!', 'time', 'exec', 'command', 'builtin', 'nohup', 'env', 'sudo', '{', '}']);
// `/opt/homebrew/bin/git`, `\\git`, `./git` are git too (an agent reached for an absolute path when
// /usr/bin/git failed in a sandbox, and the gate used to miss it).
const cmdName = (w) => (w ?? '').replace(/^\\/, '').split('/').pop();
const GIT_OPT_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);

export function segments(cmd, depth = 0) {
  return splitCommands(cmd).flatMap((argv) => {
    // `bash -c "git add x && git commit"`: the string is a command line of its own.
    const name = cmdName(argv.find((w) => !SKIP.has(w) && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)));
    const ci = argv.indexOf('-c');
    if (depth < 3 && SHELLS.has(name) && ci >= 0 && argv[ci + 1] != null) return segments(argv[ci + 1], depth + 1);
    return [segOf(argv)];
  });
}

function segOf(argv) {
  const env = {};
  let i = 0;
  while (i < argv.length && (SKIP.has(argv[i]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[i]))) {
    const kv = argv[i].match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (kv) env[kv[1]] = kv[2];
    i++;
  }
  const rest = argv.slice(i);
  let git = null;
  if (cmdName(rest[0]) === 'git') {
    let C = null, j = 1;
    while (j < rest.length && rest[j].startsWith('-')) {
      const opt = rest[j];
      if (opt === '-C') C = rest[j + 1] ?? null;
      if (GIT_OPT_WITH_VALUE.has(opt)) j += 2; else j++;
    }
    git = { C, sub: rest[j] ?? null, args: rest.slice(j + 1) };
  }
  return { argv: rest, env, git };
}

// Flags of `git commit` that take the next word as their value.
const COMMIT_VALUE_FLAGS = new Set(['-m', '--message', '-F', '--file', '-C', '--reuse-message', '-c', '--reedit-message',
  '-t', '--template', '--author', '--date', '--cleanup', '--fixup', '--squash', '--trailer', '--pathspec-from-file']);

// What a `git commit` will record: -a/--all stages tracked changes, pathspecs commit those paths
// from the working tree; either way the index alone is not what lands.
export function commitScope(args) {
  let all = false, paths = false, afterDashDash = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (afterDashDash) { paths = true; continue; }
    if (a === '--') { afterDashDash = true; continue; }
    if (a === '--all') { all = true; continue; }
    if (/^--[a-z-]+=/.test(a)) continue;
    if (COMMIT_VALUE_FLAGS.has(a)) { i++; continue; }
    if (/^-[A-Za-z]+$/.test(a)) {                  // short cluster: -am "msg", -sm "msg", -a
      if (a.includes('a')) all = true;
      if (/[mFCct]$/.test(a)) i++;                 // the last short flag takes the next word
      continue;
    }
    if (a.startsWith('-')) continue;
    paths = true;
  }
  return { all, paths };
}

// The pathspecs of a `git commit`: what `commit <paths>` records from the working tree. Values of
// flags (`-m "msg"`) are not paths: taking them as paths made the gate log HEAD's tree for every
// `git commit -m "…" <files>` (human test, 2026-10-21).
export function commitPaths(args) {
  const out = [];
  let afterDashDash = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (afterDashDash) { out.push(a); continue; }
    if (a === '--') { afterDashDash = true; continue; }
    if (/^--[a-z-]+=/.test(a)) continue;
    if (COMMIT_VALUE_FLAGS.has(a)) { i++; continue; }
    if (/^-[A-Za-z]+$/.test(a)) { if (/[mFCct]$/.test(a)) i++; continue; }
    if (a.startsWith('-')) continue;
    out.push(a);
  }
  return out;
}

export const STAGING = new Set(['add', 'rm', 'mv', 'stage', 'restore', 'apply', 'update-index']);
