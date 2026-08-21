# Troubleshooting

**Use this when:** a deployed (or local) `mcp-data-app` is erroring, hanging, or failing to connect from a client. Each row is symptom → cause → fix, specific to the MCP wrapper.

| Symptom | Cause | Fix |
|---|---|---|
| `421 Misdirected Request` on `/mcp` | MCP SDK DNS-rebinding protection rejects the Host header | Ensure nginx sends `proxy_set_header Host "127.0.0.1:5000";` on every proxied location (see template nginx conf) |
| Client sees the whole SSE response at once / hangs | nginx buffering the stream | `proxy_buffering off; proxy_cache off;` on `location /mcp` (already in template) |
| Discovery JSON shows `127.0.0.1:5000` instead of the real host | Neither `KBC_APP_PUBLIC_URL` (injected by Keboola) nor the `#MCP_PUBLIC_URL` override reached the container | On Keboola this should not happen; check the deploy actually restarted. Off-platform, set `#MCP_PUBLIC_URL` to the app origin |
| Discovery JSON shows a *different* app's host; claude.ai gets a discovery response from the new app but redirects to the old app's `/authorize` and fails | An `#MCP_PUBLIC_URL` override was copied verbatim from another app — config duplication carries secrets over, and the override wins over the platform's `KBC_APP_PUBLIC_URL`. The app deploys and runs fine; only a fresh client's OAuth handshake breaks | Remove `#MCP_PUBLIC_URL` from the copy (don't reset it — the platform value is already correct) and redeploy, then re-add the connector |
| All `/mcp` calls 401 even with the right key, connector never prompts for creds | App-level OIDC stripped `Authorization` | Set app-level auth to **None**; `#MCP_API_KEY` is the boundary |
| `KeyError: 'MCP_API_KEY'` / `SystemExit: Missing required env vars` at boot | Secrets not set | Add `#MCP_API_KEY`, `#KBC_STORAGE_API_URL`, `#KBC_STORAGE_TOKEN` as data-app secrets |
| claude.ai connector fails at the OAuth step | discovery endpoints unreachable or Host-rewrite missing | Confirm the five OAuth-shape locations are proxied with the Host rewrite; `curl` the two `.well-known/oauth-*` docs |
| Container restart loop | `setup.sh` failed or `uv sync` error | Check the Terminal Log; ensure `pyproject.toml` resolves and the upstream pin exists |

For generic container issues (POST `/`, `uv`/PEP 668, `[program:nginx]`) see `dataapp-development/references/python-js-apps.md` and `dataapp-development/references/troubleshooting.md`.
