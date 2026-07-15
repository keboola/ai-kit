# Troubleshooting

**Use this when:** a deployed (or local) `mcp-data-app` is erroring, hanging, or failing to connect from a client. Each row is symptom → cause → fix, specific to the MCP wrapper.

| Symptom | Cause | Fix |
|---|---|---|
| `421 Misdirected Request` on `/mcp` | MCP SDK DNS-rebinding protection rejects the Host header | Ensure nginx sends `proxy_set_header Host "127.0.0.1:5000";` on every proxied location (see template nginx conf) |
| Client sees the whole SSE response at once / hangs | nginx buffering the stream | `proxy_buffering off; proxy_cache off;` on `location /mcp` (already in template) |
| Discovery JSON shows `127.0.0.1:5000` instead of the real host | `#MCP_PUBLIC_URL` not set | Set `#MCP_PUBLIC_URL` to the app origin and redeploy (two-pass dance) |
| All `/mcp` calls 401 even with the right key, connector never prompts for creds | App-level OIDC stripped `Authorization` | Set app-level auth to **None**; `#MCP_API_KEY` is the boundary |
| `KeyError: 'MCP_API_KEY'` / `SystemExit: Missing required env vars` at boot | Secrets not set | Add `#MCP_API_KEY`, `#KBC_STORAGE_API_URL`, `#KBC_STORAGE_TOKEN` as data-app secrets |
| claude.ai connector fails at the OAuth step | discovery endpoints unreachable or Host-rewrite missing | Confirm the five OAuth-shape locations are proxied with the Host rewrite; `curl` the two `.well-known/oauth-*` docs |
| Container restart loop | `setup.sh` failed or `uv sync` error | Check the Terminal Log; ensure `pyproject.toml` resolves and the upstream pin exists |

For generic container issues (POST `/`, `uv`/PEP 668, `[program:nginx]`) see `dataapp-development/references/python-js-apps.md` and `dataapp-development/references/troubleshooting.md`.
