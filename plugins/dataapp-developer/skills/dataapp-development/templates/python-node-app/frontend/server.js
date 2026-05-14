import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8050';

app.use(express.json());

// In Keboola, nginx routes /api/* to the backend on :8050 and / to this server.
// In local dev, this proxy makes /api/* work too without running nginx.
app.use('/api', async (req, res) => {
  try {
    const upstream = await fetch(`${BACKEND_URL}/api${req.url}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(text);
  } catch (err) {
    res.status(502).json({ error: `backend unreachable: ${err.message}` });
  }
});

app.all('/', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));
app.use(express.static(join(__dirname, 'public'), { index: false }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend listening on http://localhost:${PORT}`);
});
