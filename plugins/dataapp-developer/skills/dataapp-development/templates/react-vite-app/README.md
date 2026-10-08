# React + Vite App Template (Python/JS default)

The default stack for a Keboola Python/JS app — **React 19 + Vite + Tailwind 4 + TanStack Query** on the client, **Express 5** on the server, one Node container. Everything the browser loads is bundled at build time; nothing comes from a CDN at runtime.

Copy the whole directory into the app's repo root as its first commit, then replace `src/App.tsx` and add routes to `server/index.ts`. The first `deploy_data_app(mode='dev')` comes up green before any custom code exists.

## Layout

```
.
├── index.html                    # Vite entry
├── preview-signal.js             # tells Keboola's app preview "rendered" / "crashed" — keep it
├── vite.config.ts                # dev server :3000, HMR over wss, /api proxy → :3100, injects preview-signal.js
├── tsconfig.json                 # one config for src/, server/ and vite.config.ts; Node runs server/ as-is
├── package.json                  # ESM ("type": "module"), Node >= 24; lockfile committed
├── public/keboola-logo.svg       # "Powered by Keboola" footer
├── src/
│   ├── main.tsx                  # root, ErrorBoundary, QueryClientProvider
│   ├── App.tsx                   # replace with your dashboard
│   ├── index.css                 # Tailwind + Keboola palette (@theme)
│   └── lib/api.ts                # fetchJson + QueryClient
├── server/
│   ├── index.ts                  # Express: /api/*, JSON errors, the built client in prod
│   └── kbcQuery.ts               # runQuery(sql) on @keboola/api-client — every row, Snowflake or BigQuery
└── keboola-config/
    ├── nginx/sites/default.conf  # 8888 → :3000, answers the platform's POST / health check, gzip
    ├── setup.sh / setup-dev.sh   # prod: npm install + vite build · dev: npm install
    ├── supervisord/services/app.conf             # prod: node server/index.ts on :3000
    └── supervisord-dev/services/{vite,api}.conf  # dev: vite on :3000, node --watch on :3100
```

## Dev and prod

`deploy_data_app(mode='dev')` selects `setup-dev.sh` + `supervisord-dev/`; a plain deploy selects `setup.sh` + `supervisord/`.

| | Dev | Prod |
|---|---|---|
| `:3000` | Vite: client with HMR, `/api` proxied to `:3100` | Express: `dist/client/` + `/api/*` |
| `:3100` | Express under `node --watch` | — |
| Build | none | `vite build` |

In dev, push and watch: client edits hot-reload, server edits restart Express in about a second (the client retries meanwhile), a `package.json` change re-installs. Call `deploy_data_app` again only to switch branch or revive a stopped container.

## Node 24

- The app needs the Node 24 image; the platform default is still Node 20. Pin it with `image_version` (`references/python-js-prod-and-drafts.md` §The image: Node 24).
- Node runs `server/*.ts` directly, without a build step: types are stripped, nothing else is compiled.
  - Relative imports name the file: `./kbcQuery.ts`, not `./kbcQuery` or `./kbcQuery.js`.
  - No `enum`, `namespace` or constructor parameter properties; type-only imports use `import type`.
  - `npm run typecheck` enforces both.

## Data and errors

- **Server:** `runQuery(sql)` in `server/kbcQuery.ts` runs SQL in the app's workspace through `@keboola/api-client`'s Query Service SDK and returns every row. Write the SQL in the project's dialect (`references/storage-access.md`).
- **Client:** `useQuery({ queryKey, queryFn: ({ signal }) => fetchJson(url, { signal }) })`. Results stay fresh for 5 minutes — every refetch is a warehouse query.
- **Errors:** the API answers `{ error }` as JSON and the client shows it at once. Only "API not up" (network error, 502–504) is retried, with backoff up to ~15 s.

## Dependencies

- Add one by editing `package.json` — the setup scripts run `npm install`, never `npm ci`, so a lagging lockfile still boots. Commit the regenerated lockfile.
- Generate the lockfile with the image's npm (11.12.1), or the container rewrites it on first install and every push looks like a dependency change: `npx -y npm@11.12.1 install --package-lock-only`.
- npm, not bun: the dev-mode watcher looks for the legacy `bun.lockb`.

## Local development

```bash
npm install
# .env with KBC_URL, KBC_TOKEN, BRANCH_ID, WORKSPACE_ID — see references/storage-access.md
PORT=3100 node --watch --env-file=.env server/index.ts   # terminal 1
npm run dev                                            # terminal 2
```

Open http://127.0.0.1:3000. HMR is wired for the Keboola ingress (`wss`, port 443), so locally reload the page by hand.
