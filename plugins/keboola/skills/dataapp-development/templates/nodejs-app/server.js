import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { runQuery, resolveKeboolaEnv } from './api/keboola-client.js';
import { getSummary } from './api/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mirror Keboola "#"-prefixed env vars into un-prefixed names for downstream code.
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('#') && value && !process.env[key.slice(1)]) {
    process.env[key.slice(1)] = value;
  }
}

// Local dev fallback: load .streamlit/secrets.toml if present.
const localSecrets = join(__dirname, '.streamlit', 'secrets.toml');
if (fs.existsSync(localSecrets)) {
  const raw = fs.readFileSync(localSecrets, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_#][A-Z0-9_]*)\s*=\s*"([^"]+)"\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.all('/', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));
app.use(express.static(join(__dirname, 'public'), { index: false }));

app.get('/api/health', (_req, res) => {
  const env = resolveKeboolaEnv();
  res.json({
    ok: Boolean(env.url && env.token && env.workspace),
    url: env.url,
    branch: env.branch,
    workspace: env.workspace,
    hasToken: Boolean(env.token),
  });
});

app.get('/api/summary', async (_req, res) => {
  try {
    const data = await getSummary();
    res.json({ ok: true, data, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`App listening on http://localhost:${PORT}`);
});
