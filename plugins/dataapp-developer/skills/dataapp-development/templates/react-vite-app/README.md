# React + Vite App Template (Python/JS default)

The default stack for a Keboola Python/JS app — **React + Vite + Tailwind + Express** in one Node container. Everything the browser loads is bundled at build time; nothing comes from a CDN at runtime.

Copy the whole directory into the app's repo root as its first commit, then replace `src/App.tsx` and add routes to `server/index.ts`. Kai builds on the same stack, so an app keeps one layout whichever agent works on it next.

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
├── vite.config.ts                          # :3000, HMR wss, proxies /api → :3100
├── src/                                    # React app (Vite-built to dist/client/)
│   ├── App.tsx
│   ├── hooks/useFetch.ts                   # fetch with retry while the dev API restarts
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

`package-lock.json` is committed. Two things depend on it:

- **Boot time.** With the lockfile npm skips registry resolution entirely —
  ~11.8 s cold without it, ~2.3 s with it, ~0.25 s on a warm re-install.
- **Re-install churn.** The platform's dev-mode git-watcher hashes the contents
  of `package.json` + `package-lock.json` after every `git reset --hard`. A
  tracked lockfile is restored verbatim on each tick, so the hash is a pure
  function of the pushed commit; an untracked one npm rewrote in place drifts
  and triggers a "deps changed" re-install that installs nothing.

Add or change a dependency by editing `package.json` — `setup.sh` /
`setup-dev.sh` run `npm install`, never `npm ci`, so a lockfile that lags
`package.json` installs correctly instead of aborting the boot. The lockfile is
rewritten in the container on that install; commit the regenerated file when
convenient so the next cold boot gets the fast path back.

While it lags, expect one extra re-install: the install rewrites the lockfile
before the watcher takes its first hash, so the next push — even a code-only one
— looks like a dependency change. It settles after that; it is not a loop.

Regenerate it with the **same npm the data-app image ships** (Node 20.19.2 /
npm 10.8.2). A lockfile written by a newer npm is rewritten byte-for-byte on
first install in the container, which re-introduces exactly the churn above:

```bash
docker run --rm -v "$PWD:/w" -w /w node:20.19.2-bookworm-slim \
  npm install --package-lock-only --no-audit --no-fund
```

### Package manager

npm, even though the container image also ships bun. A bun scaffold would need
a `bun.lock`, and the platform's dev-mode watcher still looks for the legacy
`bun.lockb` — so it would also have to ship a `keboola-config/dev-deps` list or
dependency pushes would stop triggering a re-install. npm is the supported path.

## Builder preview signals

`index.html` and `vite.config.ts` carry a small script that tells Keboola's app preview whether the page rendered (`kai-preview-healthy`) or crashed (`kai-preview-error`); `src/main.tsx` sets `__kaiPreviewCrashed` from its ErrorBoundary.

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

For plain-Express apps (no React), you can delete `src/`, `index.html`, and
`vite.config.ts` — Tailwind is wired through Vite's `@tailwindcss/vite`
plugin, so it drops out with them (no separate Tailwind/PostCSS config to
remove). Then replace the
`supervisord-dev/services/vite.conf` + `api.conf` pair with a single
`app.conf` running `npx tsx watch server/index.ts` on port 3000. The
scaffold ships with React because that's the recommended path for any
user-facing dashboard.
