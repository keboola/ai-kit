import { isApiError } from '@keboola/api-client';
import express from 'express';
import path from 'node:path';
import { RowLevelSecurityError } from './kbcQuery.ts';
import { userTokenScope } from './userToken.ts';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const mode = process.env.KBC_APP_MODE === 'dev' ? 'development' : 'production';
const clientDir = path.join(import.meta.dirname, '..', 'dist', 'client');

app.use(userTokenScope);
app.use(express.json());

// API routes — replace with your real handlers. Express 5 passes a rejected async handler to the error handler below.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: `no route ${req.method} ${req.originalUrl}` });
});

// Prod only: the built client. Vite hashes asset names, so they are cached for good.
app.use('/assets', express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(clientDir));
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Errors answer as JSON, so the client shows the message instead of retrying.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof RowLevelSecurityError) {
    res.status(403).json({ error: err.message });
    return;
  }
  // An `@keboola/api-client` ApiError carries its request, token included: log the call, not the object.
  console.error(isApiError(err) ? `ApiError ${err.response.status} ${err.request.method} ${err.request.url}` : err);
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`server listening on 127.0.0.1:${port} (${mode}, node ${process.version})`);
});
