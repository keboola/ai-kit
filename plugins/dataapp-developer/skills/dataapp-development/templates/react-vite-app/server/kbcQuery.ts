import { isApiError } from '@keboola/api-client';
import { createQueryServiceClient } from '@keboola/api-client/queryService';
import { createQueryServiceSdk, type ExecuteQueryOptions } from '@keboola/api-client/sdk/queryService';

/**
 * Runs SQL in the app's Storage workspace through the Query Service SDK and returns every row.
 *
 * - Works on Snowflake and BigQuery; only the SQL dialect differs (`references/storage-access.md`).
 * - Env vars are read per call, so a missing one fails that request, not the server start.
 * - Logs row counts and a redacted SQL preview, never values.
 * - An HTTP failure is rethrown as a plain `Error`: the SDK's `ApiError` carries the request, token included.
 */
export async function runQuery(sql: string, options?: ExecuteQueryOptions): Promise<Record<string, unknown>[]> {
  const env = readEnv();
  const sdk = createQueryServiceSdk({
    queryServiceClient: createQueryServiceClient({
      baseUrl: env.QUERY_SERVICE_URL ?? env.KBC_URL.replace('://connection.', '://query.'),
      auth: { type: 'sapi-token', token: env.KBC_TOKEN },
      middlewares: [],
    }),
  });
  const [result] = await sdk
    .executeQuery(env.BRANCH_ID, env.WORKSPACE_ID, { statements: [sql], transactional: false }, {
      maxWaitTime: 60_000,
      ...options,
    })
    .catch((err: unknown) => {
      if (!isApiError(err)) throw err;
      const data = err.data as { exception?: string; message?: string } | undefined;
      throw new Error(`query service ${err.response.status}: ${data?.exception ?? data?.message ?? err.message}`);
    });
  const columns = result.columns?.map((c) => c.name) ?? [];
  const rows = (result.data ?? []).map((row) => Object.fromEntries(columns.map((name, i) => [name, row[i]])));
  console.debug(`[kbcQuery] ${rows.length} rows <- ${previewSql(sql)}`);
  return rows;
}

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
