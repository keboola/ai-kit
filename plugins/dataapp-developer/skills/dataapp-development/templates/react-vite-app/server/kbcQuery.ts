import { readFile } from 'node:fs/promises';
import { isApiError, isRowLevelSecurityError } from '@keboola/api-client';
import { createQueryServiceClient, type QueryServiceCredential } from '@keboola/api-client/queryService';
import { createQueryServiceSdk, type ExecuteQueryOptions } from '@keboola/api-client/sdk/queryService';
import { currentUserToken, USER_TOKEN_HEADER } from './userToken.ts';

const queryService = createQueryServiceSdk({
  queryServiceClient: createQueryServiceClient({
    baseUrl: async () => process.env.QUERY_SERVICE_URL ?? queryServiceUrlFromIndex(readEnv().KBC_URL),
    auth: (): QueryServiceCredential => {
      const userToken = currentUserToken()?.userToken;
      return userToken
        ? { type: 'app-user-token', token: userToken, storageToken }
        : { type: 'sapi-token', token: storageToken };
    },
  }),
});

/**
 * Runs SQL in the app's Storage workspace through the Query Service SDK and returns every row.
 *
 * - Works on Snowflake and BigQuery; only the SQL dialect differs (`references/storage-access.md`).
 * - Row keys are lower case (`COUNT(*) AS n` is `n` on both backends); `parseCell` types the values.
 * - Env vars are read per call, so a missing one fails that request, not the server start.
 * - Every row, or `[]` for a statement without a result set (INSERT, UPDATE); fewer rows than the service counted is an error.
 * - Logs row counts and a redacted SQL preview, never values.
 * - A row-level security refusal is rethrown as `RowLevelSecurityError`; any other HTTP failure as a plain `Error`.
 */
export async function runQuery(sql: string, options?: ExecuteQueryOptions): Promise<Record<string, unknown>[]> {
  const env = readEnv();
  const scope = currentUserToken();
  const [result] = await queryService
    .executeQuery(env.BRANCH_ID, env.WORKSPACE_ID, { statements: [sql], transactional: false }, {
      timeout: 60_000,
      pageSize: 10_000,
      ...options,
    })
    .catch((err: unknown) => {
      if (isRowLevelSecurityError(err)) {
        console.warn(
          scope?.userToken
            ? '[kbcQuery] row-level security refused the query for this user'
            : `[kbcQuery] row-level security refused a query sent without ${USER_TOKEN_HEADER}: ${scope ? 'the request has none' : 'it ran outside a user request (startup, timer, background job)'}`,
        );
        throw err;
      }
      if (!isApiError(err)) throw err;
      const data = err.data as { exception?: string; message?: string } | undefined;
      throw new Error(`query service ${err.response.status}: ${data?.exception ?? data?.message ?? err.message}`);
    });
  const columns = (result.columns ?? []).map((c) => ({ key: c.name.toLowerCase(), type: c.type }));
  const rows = (result.data ?? []).map((row) =>
    Object.fromEntries(columns.map((c, i) => [c.key, parseCell(row[i] ?? null, c.type)])),
  );
  if (options?.maxRows === undefined && result.numberOfRows !== undefined && rows.length < result.numberOfRows) {
    throw new Error(`kbcQuery: got ${rows.length} of ${result.numberOfRows} rows`);
  }
  console.debug(`[kbcQuery] ${rows.length} rows <- ${previewSql(sql)}`);
  return rows;
}

/**
 * The app's Storage token, read again before every Query Service request.
 *
 * - `STORAGE_API_TOKEN_PATH` is the file the platform mounts and rotates; `KBC_TOKEN` (local runs) only without it.
 * - An unreadable file fails the request instead of falling back to a `KBC_TOKEN` that may be stale.
 */
async function storageToken(): Promise<string> {
  const file = process.env.STORAGE_API_TOKEN_PATH;
  if (file) {
    const token = await readFile(file, 'utf8').catch((err: NodeJS.ErrnoException) => {
      throw new Error(`kbcQuery: cannot read the Storage token file STORAGE_API_TOKEN_PATH=${file}: ${err.code ?? err.message}`);
    });
    return token.trim();
  }
  if (process.env.KBC_TOKEN) return process.env.KBC_TOKEN;
  throw new Error('kbcQuery: no Storage token: set STORAGE_API_TOKEN_PATH or KBC_TOKEN');
}

const NUMBER_TYPE = /^(fixed|real|integer|int64|float|float64|numeric|bignumeric)$/i;
const EPOCH = /^-?\d+(\.\d+)?( \d+)?$/;
const BIGQUERY_TIMESTAMP = /^(\S+) (\S+) \+0000 UTC$/;

/**
 * Types a Query Service cell (always a string or null) by its column type.
 *
 * 1. Numbers become numbers; an integer past 2^53 stays a string, so IDs keep every digit.
 * 2. Booleans become `true`/`false`.
 * 3. Snowflake `date` (epoch days) becomes `YYYY-MM-DD`.
 * 4. Timestamps become ISO: Snowflake sends epoch seconds, BigQuery `2026-10-12 04:05:13 +0000 UTC`.
 * 5. Anything else stays the string the warehouse sent.
 */
function parseCell(cell: string | null, type: string): unknown {
  if (cell === null) return null;
  if (NUMBER_TYPE.test(type)) {
    const n = Number(cell);
    return Number.isSafeInteger(n) || (Number.isFinite(n) && !Number.isInteger(n)) ? n : cell;
  }
  if (/^bool(ean)?$/i.test(type)) return cell === 'true';
  if (/^date$/i.test(type) && EPOCH.test(cell)) {
    return new Date(Number(cell) * 86_400_000).toISOString().slice(0, 10);
  }
  if (/^timestamp/i.test(type)) {
    if (EPOCH.test(cell)) return new Date(parseFloat(cell) * 1000).toISOString();
    return cell.replace(BIGQUERY_TIMESTAMP, '$1T$2Z');
  }
  return cell;
}

let indexedQueryServiceUrl: Promise<string> | undefined;

/**
 * The stack's Query Service URL from the Storage API index, fetched once per process.
 *
 * - Keboola injects `QUERY_SERVICE_URL` with Storage access; this covers local runs and apps without it.
 * - A failed lookup is not cached, so the next request tries again.
 */
function queryServiceUrlFromIndex(kbcUrl: string): Promise<string> {
  indexedQueryServiceUrl ??= fetch(new URL('/v2/storage/?exclude=components', kbcUrl))
    .then(async (res) => {
      if (!res.ok) throw new Error(`Storage API index ${res.status}`);
      const { services } = (await res.json()) as { services: { id: string; url: string }[] };
      const url = services.find((service) => service.id === 'query')?.url;
      if (!url) throw new Error('the stack lists no query service');
      return url;
    })
    .catch((err: unknown) => {
      indexedQueryServiceUrl = undefined;
      throw new Error(`kbcQuery: cannot find the Query Service URL: ${err instanceof Error ? err.message : String(err)}`);
    });
  return indexedQueryServiceUrl;
}

/**
 * The Storage access env vars, as the data-app image provides them.
 *
 * - `WORKSPACE_ID` comes from the platform's workspace manifest; the image restarts the app when it changes.
 * - The Storage token is not here: `storageToken()` reads it before every request.
 */
function readEnv() {
  const env = {
    KBC_URL: process.env.KBC_URL,
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
