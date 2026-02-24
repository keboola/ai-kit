---
name: dataapp-deployment
description: Use when deploying any web app to Keboola Data Apps, setting up keboola-config directory, configuring Nginx/Supervisord for Docker, handling SSE or WebSocket streaming through Nginx, mapping secrets to environment variables, or debugging Keboola Data App deployment issues like POST to root errors, 500s from missing env vars, or buffered streams.
---

# Deploying Web Apps to Keboola Data Apps

Guide for deploying web apps (Node.js, Python, or any language) to Keboola Data Apps using the `keboola/data-app-python-js` Docker base image.

## Architecture

Keboola Data Apps run in Docker containers:

```
Internet → Keboola proxy → Docker container
                              ├── Nginx (port 8888, public-facing)
                              │     └── reverse proxy → localhost:<app-port>
                              ├── Supervisord (process manager)
                              │     └── manages your app process(es)
                              └── Your app (any internal port)
```

**Key facts:**
- Base image: `keboola/data-app-python-js` (supports Python, Node.js, and any language the image has runtimes for)
- Nginx listens on **port 8888** (required, hardcoded by platform)
- Your app runs on any internal port (convention: 8050 for Streamlit/Dash, 3000 for Node.js, 5000 for Flask)
- App code is cloned from Git to `/app/`
- `keboola-config/setup.sh` runs on container startup before your app
- Secrets from `dataApp.secrets` are exported as env vars
- **Keboola platform sends a POST to `/` on startup** — your app must handle this (not just GET)

## Required Directory Structure

```
your-repo/
├── keboola-config/
│   ├── nginx/
│   │   └── sites/
│   │       └── default.conf        # Nginx reverse proxy config
│   ├── supervisord/
│   │   └── services/
│   │       └── app.conf            # Process manager config
│   └── setup.sh                    # Startup script (install deps)
├── <your app files>                # Any language/framework
└── <dependency file>               # package.json, requirements.txt, etc.
```

## keboola-config Files

### nginx/sites/default.conf

Basic reverse proxy (works for any backend):

```nginx
server {
    listen 8888;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Change `3000` to whatever port your app listens on.

**For streaming endpoints (SSE, WebSockets, long-polling)**, add a separate location block with buffering disabled:

```nginx
    location /api/stream {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_request_buffering off;
        client_max_body_size 5m;
        proxy_read_timeout 120s;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
    }
```

Without `proxy_buffering off`, Nginx buffers the entire response before forwarding — the client sees nothing until the stream ends.

### supervisord/services/app.conf

**Node.js:**
```ini
[program:app]
command=node /app/server.js
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

**Python (Flask/FastAPI):**
```ini
[program:app]
command=python /app/app.py
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

**Python (Streamlit):**
```ini
[program:app]
command=streamlit run /app/streamlit_app.py --server.port 8050 --server.headless true
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

**Python (Gunicorn):**
```ini
[program:app]
command=gunicorn --bind 0.0.0.0:5000 app:app
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

Use absolute paths (`/app/...`). Relative paths cause startup failures.

### setup.sh

```bash
#!/bin/bash
set -Eeuo pipefail

cd /app

# Node.js
npm install

# Python
# pip install -r requirements.txt
```

Must be executable (`chmod +x`). Runs once on container startup before Supervisord starts your app. Uncomment/adjust for your language.

## Environment Variables / Secrets

Keboola `dataApp.secrets` entries are exported as environment variables:
1. Leading `#` is stripped (e.g., `#KBC_TOKEN` becomes `KBC_TOKEN`)
2. Names are uppercased

| dataApp.secrets key | Env var in container |
|---|---|
| `#KBC_TOKEN` | `KBC_TOKEN` |
| `#KBC_URL` | `KBC_URL` |
| `#KBC_DATABASE_NAME` | `KBC_DATABASE_NAME` |
| `#ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` |
| `#MY_CUSTOM_VAR` | `MY_CUSTOM_VAR` |

Access them in your code as normal environment variables:

```javascript
// Node.js
const token = process.env.KBC_TOKEN;
```

```python
# Python
import os
token = os.environ.get("KBC_TOKEN")
```

**If your app already reads env vars locally, it works in Keboola with no code changes** — just add the matching secrets in the data app configuration.

## Language-Specific Patterns

### Node.js with Express

For apps that need a standalone HTTP server (e.g., when migrating from Vercel serverless):

```javascript
import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API routes
import myHandler from './api/my-route.js';
app.all('/api/my-route', myHandler);

// Serve frontend — use app.all(), NOT app.get()
// Keboola POSTs to / on startup
app.all('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.use(express.static(__dirname, { index: false }));

app.listen(PORT, '0.0.0.0');
```

**Vercel dual-deployment tip:** Vercel serverless handlers (`export default function(req, res)`) are directly compatible with Express route handlers. Create an Express `server.js` that imports and mounts the same handler files — no code changes to the handlers themselves.

### Python with Flask

```python
from flask import Flask, send_from_directory
import os

app = Flask(__name__, static_folder="static")
PORT = int(os.environ.get("PORT", 5000))

@app.route("/api/data", methods=["GET", "POST"])
def data():
    # Your API logic
    return {"status": "ok"}

@app.route("/", methods=["GET", "POST"])  # Handle POST too
def index():
    return send_from_directory(".", "index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
```

### Python with Streamlit

Streamlit apps need minimal adaptation — just configure the port in Supervisord:

```ini
command=streamlit run /app/streamlit_app.py --server.port 8050 --server.headless true
```

And point Nginx to that port:
```nginx
proxy_pass http://127.0.0.1:8050;
```

Streamlit handles POST to `/` natively, so no special handling needed.

## Common Errors and Solutions

### "Cannot POST /" or "Method Not Allowed" on root

**Cause:** Keboola platform POSTs to `/` on startup. Your app only handles GET.
**Fix:** Handle all HTTP methods on the root route. In Express: `app.all('/')`. In Flask: `methods=["GET", "POST"]`.

### API route returns 500

**Cause:** Missing environment variable not configured in `dataApp.secrets`.
**Fix:** Add all required env vars as secrets. Check server logs via Keboola UI to identify which variable is missing.

### Streaming (SSE/WebSocket) arrives all at once

**Cause:** Nginx buffers the response by default.
**Fix:** Add `proxy_buffering off; proxy_cache off;` to the Nginx location block for streaming endpoints.

### App won't start / restarts in loop

**Cause:** `setup.sh` failed (dependency install error) or wrong path in Supervisord config.
**Fix:** Ensure `setup.sh` is executable (`chmod +x`), paths in Supervisord are absolute (`/app/...`), and dependency install succeeds.

### App works locally but not in Keboola

**Cause:** Usually a missing env var, a port mismatch between Nginx and your app, or a dependency that fails to install in the Docker environment.
**Fix:** Check that Nginx proxies to the same port your app listens on, all env vars are in `dataApp.secrets`, and `setup.sh` installs everything needed.

## Deployment Checklist

- [ ] `keboola-config/nginx/sites/default.conf` — Nginx listens on 8888, proxies to your app's port
- [ ] `keboola-config/supervisord/services/*.conf` — Process config with absolute paths, correct start command
- [ ] `keboola-config/setup.sh` — Executable, installs all dependencies
- [ ] Root route handles POST (not just GET)
- [ ] All required env vars added as `dataApp.secrets` in Keboola
- [ ] Streaming endpoints (if any) have `proxy_buffering off` in Nginx
- [ ] Tested locally before deploying (run same start command as Supervisord uses)
- [ ] No hardcoded port 8888 in your app (Nginx handles that; your app uses an internal port)

## Tips

- **Authentication is optional** — Keboola platform handles access control for data apps. You don't need to add login/auth unless you want additional restrictions.
- **The base image name is misleading** — `keboola/data-app-python-js` has both Python and Node.js runtimes. Use whichever fits your app.
- **Test with the same command** — Run the exact Supervisord `command` locally to catch issues before deploying.
- **Check logs in Keboola UI** — When debugging, the Keboola data app interface shows stdout/stderr from your app.
- **Git branch matters** — Keboola clones a specific branch. Make sure your deployment branch has the `keboola-config/` directory and standalone server entry point.
