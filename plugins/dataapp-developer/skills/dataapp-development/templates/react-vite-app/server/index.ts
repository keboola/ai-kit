import express from 'express';
import path from 'node:path';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
const clientDir = path.join(__dirname, '..', 'client');

app.use(express.json());

// API routes — replace with your real handlers.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode });
});

// Prod: serve the built Vite client.
// Dev: Vite serves the client on :3000 and proxies /api here on :3100, so this
// branch is unused but harmless to keep.
app.use(express.static(clientDir));

// Keboola startup health check.
app.all('/', (_req, res, next) => {
  if (_req.method === 'POST') {
    res.status(200).send('ok');
    return;
  }
  // GET in prod falls through to index.html for SPA routing.
  res.sendFile(path.join(clientDir, 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`server listening on 127.0.0.1:${port} (${mode})`);
});
