// Read at call time, not at module load, so a missing env var surfaces on
// the failing request instead of crashing the entire Express process at
// startup (which would mask the cause in the platform's container logs).
function readEnv() {
  const KBC_URL = process.env.KBC_URL;
  const KBC_TOKEN = process.env.KBC_TOKEN;
  const BRANCH_ID = process.env.BRANCH_ID;
  const WORKSPACE_ID = process.env.WORKSPACE_ID;
  if (!KBC_URL || !KBC_TOKEN || !BRANCH_ID || !WORKSPACE_ID) {
    const missing = [
      ['KBC_URL', KBC_URL],
      ['KBC_TOKEN', KBC_TOKEN],
      ['BRANCH_ID', BRANCH_ID],
      ['WORKSPACE_ID', WORKSPACE_ID],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);
    throw new Error(`kbcQuery: missing required env vars: ${missing.join(', ')}`);
  }
  return { KBC_URL, KBC_TOKEN, BRANCH_ID, WORKSPACE_ID };
}

export type SnowflakeQueryOptions = {
  pageSize?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type BigQueryQueryOptions = {
  signal?: AbortSignal;
};

type SnowflakeJob = {
  status: string;
  statements: { id: string; status: string }[];
};

type SnowflakeResults = {
  columns: { name: string }[];
  data: unknown[][];
};

type BigQueryResponse = {
  status: 'ok' | 'error';
  message: string | null;
  data: { columns?: string[]; rows?: Record<string, unknown>[] } | null;
};

const REDACTED_SQL_LITERAL = "'[redacted]'";
const REDACTED_SQL_NUMBER = '<redacted-number>';

function previewSqlForLog(sql: string) {
  return sql
    .replace(/'(?:''|[^'])*'/g, REDACTED_SQL_LITERAL)
    .replace(/\b\d{5,}(?:\.\d+)?\b/g, REDACTED_SQL_NUMBER)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export async function runSnowflakeQuery(
  sql: string,
  options: SnowflakeQueryOptions = {},
): Promise<Record<string, unknown>[]> {
  const { KBC_URL, KBC_TOKEN, BRANCH_ID, WORKSPACE_ID } = readEnv();
  const queryHost = KBC_URL.replace('://connection.', '://query.');
  const headers = { 'Content-Type': 'application/json', 'X-StorageAPI-Token': KBC_TOKEN };
  const { signal } = options;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const pageSize = Math.min(100_000, Math.max(100, options.pageSize ?? 500));

  const submit = await fetch(
    `${queryHost}/api/v1/branches/${BRANCH_ID}/workspaces/${WORKSPACE_ID}/queries`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ statements: [sql], transactional: false }),
      signal,
    },
  );
  if (!submit.ok) {
    throw new Error(`snowflake submit failed: ${submit.status} ${await submit.text()}`);
  }
  const { queryJobId } = (await submit.json()) as { queryJobId: string };

  // Terminal job statuses: "completed" (success), "failed", "canceled".
  // The service never returns "success" — polling for that would hang.
  let statementId = '';
  let lastStatus = 'unknown';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw signal.reason ?? new Error('aborted');
    await new Promise((r) => setTimeout(r, 300));
    const statusRes = await fetch(`${queryHost}/api/v1/queries/${queryJobId}`, {
      headers: { 'X-StorageAPI-Token': KBC_TOKEN },
      signal,
    });
    if (!statusRes.ok) {
      throw new Error(
        `snowflake status poll failed: ${statusRes.status} ${await statusRes.text()}`,
      );
    }
    const job = (await statusRes.json()) as SnowflakeJob;
    lastStatus = job.status;
    if (job.status === 'completed') {
      statementId = job.statements[0].id;
      break;
    }
    if (job.status === 'failed' || job.status === 'canceled') {
      throw new Error(`snowflake query ${job.status}: ${JSON.stringify(job)}`);
    }
  }
  if (!statementId) {
    throw new Error(`snowflake query timed out after ${timeoutMs}ms (last status: ${lastStatus})`);
  }

  const resultsRes = await fetch(
    `${queryHost}/api/v1/queries/${queryJobId}/${statementId}/results?offset=0&pageSize=${pageSize}`,
    { headers: { 'X-StorageAPI-Token': KBC_TOKEN }, signal },
  );
  if (!resultsRes.ok) {
    throw new Error(
      `snowflake results fetch failed: ${resultsRes.status} ${await resultsRes.text()}`,
    );
  }
  const { columns, data } = (await resultsRes.json()) as SnowflakeResults;
  const rows = data.map((row) => Object.fromEntries(columns.map((c, i) => [c.name, row[i]])));
  console.debug(`[kbcQuery] ${rows.length} rows <- ${previewSqlForLog(sql)}`);
  return rows;
}

export async function runBigQueryQuery(
  sql: string,
  options: BigQueryQueryOptions = {},
): Promise<Record<string, unknown>[]> {
  const { KBC_URL, KBC_TOKEN, BRANCH_ID, WORKSPACE_ID } = readEnv();
  const res = await fetch(
    `${KBC_URL}/v2/storage/branch/${BRANCH_ID}/workspaces/${WORKSPACE_ID}/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-StorageApi-Token': KBC_TOKEN },
      body: JSON.stringify({ query: sql }),
      signal: options.signal,
    },
  );
  if (!res.ok) {
    throw new Error(`bigquery query failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as BigQueryResponse;
  if (body.status !== 'ok') {
    throw new Error(body.message ?? 'BigQuery returned status=error');
  }
  if (body.data === null) {
    throw new Error('BigQuery returned status=ok but data was null');
  }
  const rows = body.data.rows ?? [];
  console.debug(`[kbcQuery] ${rows.length} rows <- ${previewSqlForLog(sql)}`);
  return rows;
}
