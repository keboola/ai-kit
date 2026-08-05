// Centralized Keboola Query Service client for the Node.js data app.
//
// Uses @keboola/query-service which targets https://query.<stack>.keboola.com/api/v1/...
// Do NOT POST to /v2/storage/.../workspaces/<id>/query — that's the legacy Storage API
// workspace-query endpoint, it 404s on most Snowflake projects.

import { readFileSync, existsSync } from 'node:fs';
import { Client } from '@keboola/query-service';

function normalizeWorkspaceId(raw) {
  if (!raw) return null;
  // Keboola sometimes exposes the Snowflake schema name (WORKSPACE_<id>) — strip the prefix.
  const m = String(raw).match(/^WORKSPACE_(\d+)$/i);
  return m ? m[1] : String(raw);
}

function readTokenFromPath() {
  const path = process.env.STORAGE_API_TOKEN_PATH || process.env.KBC_STORAGE_API_TOKEN_PATH;
  if (!path) return null;
  try {
    return readFileSync(path, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function deriveQueryServiceUrl(kbcUrl) {
  if (!kbcUrl) return null;
  return kbcUrl.replace(/\/$/, '').replace('://connection.', '://query.');
}

function resolveWorkspaceId() {
  const manifestPath = process.env.KBC_WORKSPACE_MANIFEST_PATH;
  if (manifestPath && existsSync(manifestPath)) {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (parsed.workspaceId) return String(parsed.workspaceId);
  }
  return normalizeWorkspaceId(process.env.WORKSPACE_ID);
}

export function resolveKeboolaEnv() {
  const pick = (...names) => {
    for (const n of names) {
      if (process.env[n]) return { value: process.env[n], source: n };
    }
    return { value: null, source: null };
  };
  const url = pick('KBC_URL', 'KBC_STACK_API_URL', 'STORAGE_API_URL');
  let token = pick('KBC_TOKEN', 'KBC_STORAGEAPI_TOKEN', 'STORAGE_API_TOKEN');
  if (!token.value) {
    const fileToken = readTokenFromPath();
    if (fileToken) token = { value: fileToken, source: 'STORAGE_API_TOKEN_PATH (file)' };
  }
  const queryServiceUrl = pick('QUERY_SERVICE_URL');
  const branch = pick('KBC_BRANCH_ID', 'BRANCH_ID');
  return {
    url: url.value,
    token: token.value,
    queryServiceUrl: queryServiceUrl.value || deriveQueryServiceUrl(url.value),
    workspace: resolveWorkspaceId(),
    branch: branch.value,
  };
}

let _client = null;
function getClient() {
  if (_client) return _client;
  const { queryServiceUrl, token } = resolveKeboolaEnv();
  if (!queryServiceUrl || !token) {
    throw new Error(
      'Missing QUERY_SERVICE_URL (or KBC_URL to derive it) and KBC_TOKEN. ' +
        'Ask the user to populate .env or .env.local.',
    );
  }
  _client = new Client({ baseUrl: queryServiceUrl, token });
  return _client;
}

// Returns rows as objects { column_name: value }, lowercased keys, with naive numeric
// coercion. Query Service returns all cell values as strings — if your column types
// matter, use column.type from the raw result instead (see references/storage-access.md
// §Query Service return shape).
export async function runQuery(sql) {
  const { branch, workspace } = resolveKeboolaEnv();
  const missing = [];
  if (!branch) missing.push('BRANCH_ID');
  if (!workspace) missing.push('WORKSPACE_ID (or KBC_WORKSPACE_MANIFEST_PATH)');
  if (missing.length > 0) throw new Error(`Missing env vars: ${missing.join(', ')}`);

  const [result] = await getClient().executeQuery({
    branchId: String(branch),
    workspaceId: String(workspace),
    statements: [sql],
  });
  const cols = result.columns.map((c) => c.name.toLowerCase());
  return result.data.map((row) => {
    const out = {};
    for (let i = 0; i < cols.length; i++) {
      const v = row[i];
      if (v === null || v === undefined) out[cols[i]] = null;
      else if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) out[cols[i]] = Number(v);
      else out[cols[i]] = v;
    }
    return out;
  });
}
