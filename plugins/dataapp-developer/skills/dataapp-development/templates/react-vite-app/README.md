# React + Vite App Template (Python/JS default)

The default stack for a Keboola Python/JS app — **React + Vite + Tailwind + Express** in one Node container. Everything the browser loads is bundled at build time; nothing comes from a CDN at runtime.

Copy the whole directory into the app's repo root as its first commit, then replace `src/App.tsx` and add routes to `server/index.ts`.

What the first commit gives you:

- `deploy_data_app(mode='dev')` reaches a green container before any custom code exists — Vite dev server + Express answering `POST /` and `GET /api/health`.
- `setup-dev.sh` runs `npm install` once, so later pushes hot-reload instead of reinstalling.
- The `keboola-config/` tree the platform expects, including the dev/prod split (`setup-dev.sh` + `supervisord-dev/` vs `setup.sh` + `supervisord/`).

## Layout

```
.
├── .gitignore                              # node_modules/ dist/
├── README.md                               # this file — keep or delete
├── public/keboola-logo.svg                 # "Powered by Keboola" footer
├── index.html                              # Vite entry
├── package.json                            # react, react-dom, express + vite, tsx, tailwind devDeps
├── package-lock.json                       # committed — see "Dependencies" below
├── tsconfig.json                           # client / Vite (ESNext)
├── tsconfig.server.json                    # server / Express (CommonJS, dist/server)
├── vite.config.mts                          # :3000, HMR wss, proxies /api → :3100
├── src/                                    # React app (Vite-built to dist/client/)
│   ├── App.tsx
│   ├── lib/api.ts                          # fetchJson + QueryClient (retries only while the dev API restarts)
│   ├── index.css                           # Tailwind v4 + Keboola palette (@theme)
│   └── main.tsx                            # ErrorBoundary
├── server/
│   ├── index.ts                            # Express: /api/* + static dist/client (prod)
│   └── kbcQuery.ts                         # runSnowflakeQuery / runBigQueryQuery over the workspace
└── keboola-config/
    ├── nginx/sites/default.conf            # 8888 → 127.0.0.1:3000 (WebSocket pass-through)
    ├── setup.sh                            # prod: npm install + npm run build
    ├── setup-dev.sh                        # dev:  npm install
    ├── supervisord/services/app.conf       # prod: node dist/server/index.js (PORT=3000)
    └── supervisord-dev/services/
        ├── vite.conf                       # dev:  npx vite (port 3000, HMR)
        └── api.conf                        # dev:  npx tsx watch server/index.ts (PORT=3100)
```

## Dev / prod selection

The Keboola platform reads `mode='dev'` on `deploy_data_app` and selects
`setup-dev.sh` + `supervisord-dev/`. Bare deploys (no `mode`) select
`setup.sh` + `supervisord/`.

| Mode               | nginx       | port 3000                                  | port 3100               | Build step       |
| ------------------ | ----------- | ------------------------------------------ | ----------------------- | ---------------- |
| Dev (`mode='dev'`) | 8888 → 3000 | Vite (HMR + src + proxy `/api` → 3100)     | Express via `tsx watch` | none             |
| Prod               | 8888 → 3000 | Express (serves `dist/client/` + `/api/*`) | unused                  | Vite build + tsc |

## Iterating in dev mode

After the first `deploy_data_app(mode='dev')`:

- **React / client edits** (`src/**`) → push to the dev branch; Vite HMR
  reloads the module in <1 s. No `deploy_data_app` call needed.
- **Express / server edits** (`server/**`) → push; `tsx watch` restarts the
  Express process in ~1 s. Vite re-proxies on the next `/api/*` request.
- **Dependency changes** (`package.json`) → push. The Keboola app runner
  detects the manifest change and re-installs in-place; no
  `deploy_data_app` call needed.
- The only reason to call `deploy_data_app` again is a **branch switch**
  (after changing the pinned branch in the draft config) or to **revive a
  container** that went down and whose auto-resume didn't bring it back.

## Dependencies

- `package-lock.json` is committed: a cold `npm install` skips registry resolution, and the dev-mode watcher, which hashes `package.json` + `package-lock.json`, does not see phantom dependency changes.
- Add a dependency by editing `package.json`. The setup scripts run `npm install`, never `npm ci`, so a lockfile that lags still boots; commit the regenerated lockfile when convenient.
- Regenerate the lockfile with the npm the data-app image ships (Node 20.19.2 / npm 10.8.2) — a newer npm's output is rewritten on first install:

```bash
docker run --rm -v "$PWD:/w" -w /w node:20.19.2-bookworm-slim \
  npm install --package-lock-only --no-audit --no-fund
```

- npm, not bun: the dev-mode watcher looks for the legacy `bun.lockb`, so bun would need a `keboola-config/dev-deps` list.

## Builder preview signals

`index.html` and `vite.config.mts` carry a small script that tells Keboola's app preview whether the page rendered (`kai-preview-healthy`) or crashed (`kai-preview-error`); `src/main.tsx` sets `__kaiPreviewCrashed` from its ErrorBoundary.

- Keep it, whichever agent builds the app — it is how the preview in Keboola tells a working app from a blank page.
- Outside an iframe it posts to its own window and does nothing.

## Local development

```bash
npm install
# .env with KBC_URL, KBC_TOKEN, BRANCH_ID, WORKSPACE_ID — see references/storage-access.md
PORT=3100 node --env-file=.env node_modules/.bin/tsx watch server/index.ts   # terminal 1
npm run dev:vite                                                             # terminal 2
```

Open http://127.0.0.1:3000. HMR is wired for the Keboola ingress (`wss`, port 443), so locally reload the page by hand.

## Customising

Replace `src/App.tsx` with your dashboard, add API routes to
`server/index.ts`, add deps to `package.json`. The dev/prod split,
`keboola-config/` layout, and ports are platform-imposed — don't move
them around.
