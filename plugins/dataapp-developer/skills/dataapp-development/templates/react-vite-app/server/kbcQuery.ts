import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Runs SQL in the app's Storage workspace through the Query Service and returns every row.
 *
 * - Works on Snowflake and BigQuery; only the SQL dialect differs (`references/storage-access.md`).
 * - Env vars are read per call, so a missing one fails that request, not the server start.
 * - Logs row counts and a redacted SQL preview, never values.
 */
export async function runQuery(
  sql: string,
  { timeoutMs = 60_000, pageSize = 10_000, signal }: QueryOptions = {},
): Promise<Record<string, unknown>[]> {
  const env = readEnv();
  const base = env.QUERY_SERVICE_URL ?? env.KBC_URL.replace('://connection.', '://query.');
  const headers = { 'Content-Type': 'application/json', 'X-StorageAPI-Token': env.KBC_TOKEN };
  const deadline = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
  const call = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${base}/api/v1/${url}`, { headers, signal: deadline, ...init });
    if (!res.ok) throw new Error(`query service ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  };

  const { queryJobId } = await call<{ queryJobId: string }>(
    `branches/${env.BRANCH_ID}/workspaces/${env.WORKSPACE_ID}/queries`,
    { method: 'POST', body: JSON.stringify({ statements: [sql], transactional: false }) },
  );

  // Terminal statuses: "completed", "failed", "canceled". Poll fast, then back off to 1 s.
  let job: QueryJob;
  for (let wait = 100; ; wait = Math.min(wait * 2, 1000)) {
    job = await call<QueryJob>(`queries/${queryJobId}`);
    if (job.status === 'completed') break;
    if (job.status === 'failed' || job.status === 'canceled') {
      throw new Error(`query ${job.status}: ${job.statements[0]?.error ?? JSON.stringify(job)}`);
    }
    await sleep(wait, undefined, { signal: deadline });
  }

  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await call<QueryPage>(
      `queries/${queryJobId}/${job.statements[0].id}/results?offset=${offset}&pageSize=${pageSize}`,
    );
    for (const row of page.data) {
      rows.push(Object.fromEntries(page.columns.map((c, i) => [c.name, row[i]])));
    }
    if (page.data.length < pageSize) break;
  }
  console.debug(`[kbcQuery] ${rows.length} rows <- ${previewSql(sql)}`);
  return rows;
}

export type QueryOptions = { timeoutMs?: number; pageSize?: number; signal?: AbortSignal };

type QueryJob = { status: string; statements: { id: string; error?: string }[] };
type QueryPage = { columns: { name: string }[]; data: unknown[][] };

function readEnv() {
  const env = {
    KBC_URL: process.env.KBC_URL,
    KBC_TOKEN: process.env.KBC_TOKEN,
    BRANCH_ID: process.env.BRANCH_ID,
    WORKSPACE_ID: process.env.WORKSPACE_ID,
  };
  const missing = Object.keys(env).filter((key) => !env[key as keyof typeof env]);
  if (missing.length) throw new Error(`kbcQuery: missing required env vars: ${missing.join(', ')}`);
  return { ...(env as Record<keyof typeof env, string>), QUERY_SERVICE_URL: process.env.QUERY_SERVICE_URL };
}

function previewSql(sql: string) {
  return sql
    .replace(/'(?:''|[^'])*'/g, "'[redacted]'")
    .replace(/\b\d{5,}(?:\.\d+)?\b/g, '<redacted-number>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}
