// source.mjs: read a docs repo either from the working tree or from the git index (what `git commit`
// will record). The commit gate uses the index so a partly staged page is judged as it will land.
//
//   const src = makeSource(root, { index: true });
//   src.list(dir, keep)  → absolute paths under dir that pass keep(path)
//   src.read(file)       → utf8 text (throws when the file is not in the source)
//   src.exists(file)     → file or directory present
//
// Index mode loads every blob under the requested prefixes with one `git cat-file --batch` call.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const walk = (d, keep, out = []) => {
  if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, keep, out); else if (keep(p)) out.push(p);
  }
  return out;
};

export function makeSource(root, { index = false, prefixes = ['src/content/docs', '_data'] } = {}) {
  root = path.resolve(root);
  if (!index) {
    return {
      index: false,
      list: (dir, keep = () => true) => walk(dir, keep),
      read: (file) => fs.readFileSync(file, 'utf8'),
      exists: (file) => fs.existsSync(file),
    };
  }
  const listed = execFileSync('git', ['ls-files', '-z', '--', ...prefixes], { cwd: root, maxBuffer: 256 * 1024 * 1024 })
    .toString('utf8').split('\0').filter(Boolean);
  const files = new Set(listed.map((f) => path.join(root, f)));
  const blobs = new Map();
  if (listed.length) {
    const r = spawnSync('git', ['cat-file', '--batch'], { cwd: root, input: listed.map((f) => `:${f}`).join('\n') + '\n', maxBuffer: 1024 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`git cat-file failed: ${r.stderr}`);
    const buf = r.stdout; let pos = 0;
    for (const f of listed) {
      const nl = buf.indexOf(10, pos);
      const header = buf.toString('utf8', pos, nl);
      const m = header.match(/^\S+ (\S+) (\d+)$/);
      if (!m) { pos = nl + 1; continue; }            // "<path> missing"
      const size = Number(m[2]);
      if (m[1] === 'blob') blobs.set(path.join(root, f), buf.subarray(nl + 1, nl + 1 + size));
      pos = nl + 1 + size + 1;
    }
  }
  const dirs = new Set();
  for (const f of files) { let d = path.dirname(f); while (d.length > root.length && !dirs.has(d)) { dirs.add(d); d = path.dirname(d); } }
  return {
    index: true,
    list: (dir, keep = () => true) => { const pre = path.resolve(dir) + path.sep; return [...files].filter((f) => f.startsWith(pre) && keep(f)).sort(); },
    read: (file) => { const b = blobs.get(path.resolve(file)); if (!b) throw new Error(`${path.relative(root, file)} is not in the index`); return b.toString('utf8'); },
    exists: (file) => { const p = path.resolve(file); return files.has(p) || dirs.has(p); },
  };
}
