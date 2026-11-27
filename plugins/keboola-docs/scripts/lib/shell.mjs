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

// Split into simple commands, each a list of words with quotes removed. Redirections (`<<'EOF'`,
// `< msg.txt`, `2>&1`, `&> log`) and their targets are dropped: they are not arguments, and a
// `git commit -F - <<'EOF'` whose `<<EOF` was read as a pathspec logged no tree, so every such
// commit looked like it had bypassed the gate (found 2026-10-27).
const REDIRECT = /^(?:&>>|&>|<<<|<<-|<<|<>|<&|>&|>>|>\||<|>)/;
export function splitCommands(cmd) {
  const s = stripHeredocs(cmd);
  const cmds = [];
  let words = [], word = '', inWord = false, dropNext = false;
  const endWord = () => { if (inWord) { if (dropNext) dropNext = false; else words.push(word); } word = ''; inWord = false; };
  const endCmd = () => { endWord(); dropNext = false; if (words.length) cmds.push(words); words = []; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const op = (c === '<' || c === '>' || (c === '&' && s[i + 1] === '>')) && s.slice(i).match(REDIRECT);
    if (op) {
      if (inWord && /^\d+$/.test(word)) { word = ''; inWord = false; } else endWord();   // `2>`: the fd is not a word
      i += op[0].length - 1;
      if (op[0].endsWith('&')) { const t = s.slice(i + 1).match(/^(\d+|-)/); if (t) { i += t[0].length; continue; } }
      dropNext = true;
      continue;
    }
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

// Long flags of `git commit` that take the next word as their value (or `--flag=value`).
const COMMIT_VALUE_FLAGS = new Set(['--message', '--file', '--reuse-message', '--reedit-message', '--template',
  '--author', '--date', '--cleanup', '--fixup', '--squash', '--trailer', '--pathspec-from-file']);
// Short flags that take a value: attached (`-mfix`) or the next word (`-m fix`).
const SHORT_VALUE = new Set(['m', 'F', 'C', 'c', 't']);

// What a `git commit` will record, from its arguments:
//   all          -a/--all: tracked working-tree changes are staged first
//   include      -i/--include: pathspecs are added on top of the index (default: --only, HEAD + paths)
//   paths        the pathspecs; values of flags (`-m "msg"`, `-mfix`) are not paths. Taking a message
//                as a path made the gate log HEAD's tree (human test, 2026-10-21)
//   pathspecFile --pathspec-from-file's value ('-' = stdin); the paths are in that file
//   nul          --pathspec-file-nul
export function parseCommit(args) {
  const r = { all: false, include: false, paths: [], pathspecFile: null, nul: false };
  let afterDashDash = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (afterDashDash) { r.paths.push(a); continue; }
    if (a === '--') { afterDashDash = true; continue; }
    if (a === '--all') { r.all = true; continue; }
    if (a === '--include') { r.include = true; continue; }
    if (a === '--pathspec-file-nul') { r.nul = true; continue; }
    const eq = a.match(/^(--[a-z-]+)=([\s\S]*)$/);
    if (eq) { if (eq[1] === '--pathspec-from-file') r.pathspecFile = eq[2]; continue; }
    if (COMMIT_VALUE_FLAGS.has(a)) { if (a === '--pathspec-from-file') r.pathspecFile = args[i + 1] ?? null; i++; continue; }
    if (/^-[A-Za-z]/.test(a) && !a.startsWith('--')) {   // a short cluster: -a, -am "msg", -mfix, -sm msg
      for (let k = 1; k < a.length; k++) {
        const c = a[k];
        if (SHORT_VALUE.has(c)) { if (k === a.length - 1) i++; break; }   // the rest, or the next word, is the value
        if (c === 'a') r.all = true;
        if (c === 'i') r.include = true;
      }
      continue;
    }
    if (a.startsWith('-')) continue;
    r.paths.push(a);
  }
  return r;
}

// -a/--all or pathspecs: the commit takes working-tree content, so the index alone is not what lands.
export function commitScope(args) {
  const c = parseCommit(args);
  return { all: c.all, paths: c.paths.length > 0 || c.pathspecFile !== null };
}

export const STAGING = new Set(['add', 'rm', 'mv', 'stage', 'restore', 'apply', 'update-index']);
