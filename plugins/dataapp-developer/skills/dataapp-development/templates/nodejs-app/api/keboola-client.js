import { readFileSync } from 'node:fs';

let queryQueue = Promise.resolve();

function normalizeWorkspaceId(raw) {
  if (!raw) return null;
  // Keboola exposes the Snowflake schema name (WORKSPACE_<id>) in some cases;
  // strip the prefix so the Storage API workspace endpoint accepts it.
  const m = raw.match(/^WORKSPACE_(\d+)$/i);
  return m ? m[1] : raw;
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
  const workspaceRaw = pick('KBC_WORKSPACE_ID', 'WORKSPACE_ID');
  const branch = pick('KBC_BRANCH_ID', 'BRANCH_ID');
  return {
    url: url.value,
    token: token.value,
    workspace: normalizeWorkspaceId(workspaceRaw.value),
    workspaceRaw: workspaceRaw.value,
    branch: branch.value || 'default',
  };
}

async function runQueryNow(sql, retriesLeft = 2) {
  const { url, token, workspace, branch } = resolveKeboolaEnv();
  const missing = [];
  if (!url) missing.push('KBC_URL');
  if (!token) missing.push('KBC_TOKEN');
  if (!workspace) missing.push('KBC_WORKSPACE_ID');
  if (missing.length > 0) throw new Error(`Missing env vars: ${missing.join(', ')}`);

  const endpoint = `${url}/v2/storage/branch/${branch}/workspaces/${workspace}/query`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'X-StorageApi-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });

  if (res.status >= 500 && retriesLeft > 0) {
    await new Promise((r) => setTimeout(r, 800));
    return runQueryNow(sql, retriesLeft - 1);
  }
  if (!res.ok) {
    throw new Error(`Keboola query failed (HTTP ${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
  const result = await res.json();
  if (result.status === 'error') throw new Error(`SQL error: ${result.message || 'unknown'}`);

  return (result.data?.rows || []).map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      const key = k.toLowerCase();
      if (v === null || v === undefined) out[key] = null;
      else if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) out[key] = Number(v);
      else out[key] = v;
    }
    return out;
  });
}

export function runQuery(sql) {
  const next = queryQueue.catch(() => null).then(() => runQueryNow(sql));
  queryQueue = next.catch(() => null);
  return next;
}
