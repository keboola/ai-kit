import { isApiError, type ApiError, type MiddlewareFn } from '@keboola/api-client';
import { createQueryServiceClient } from '@keboola/api-client/queryService';
import { createQueryServiceSdk, type ExecuteQueryOptions } from '@keboola/api-client/sdk/queryService';
import { currentUserToken, USER_TOKEN_HEADER } from './userToken.ts';

const RLS_DENIED = 'Row-level security does not allow this query';

/** Query Service refused the query by row-level security; `message` is fit to show the user. */
export class RowLevelSecurityError extends Error {
  constructor() {
    super('You have no access to this data. Sign in again, or ask the app owner for access.');
    this.name = 'RowLevelSecurityError';
  }
}

/**
 * Runs SQL in the app's Storage workspace through the Query Service SDK and returns every row.
 *
 * - Works on Snowflake and BigQuery; only the SQL dialect differs (`references/storage-access.md`).
 * - Row keys are lower case (`COUNT(*) AS n` is `n` on both backends); `parseCell` types the values.
 * - Env vars are read per call, so a missing one fails that request, not the server start.
 * - Every row, or `[]` for a statement without a result set (INSERT, UPDATE); fewer rows than the service counted is an error.
 * - Logs row counts and a redacted SQL preview, never values.
 * - An HTTP failure is rethrown as a plain `Error`: the SDK's `ApiError` carries the request, token included.
 */
export async function runQuery(sql: string, options?: ExecuteQueryOptions): Promise<Record<string, unknown>[]> {
  const env = readEnv();
  const scope = currentUserToken();
  const sdk = createQueryServiceSdk({
    queryServiceClient: createQueryServiceClient({
      baseUrl: env.QUERY_SERVICE_URL ?? (await queryServiceUrlFromIndex(env.KBC_URL)),
      auth: { type: 'sapi-token', token: env.KBC_TOKEN },
      middlewares: scope?.userToken ? [userTokenMiddleware(scope.userToken)] : [],
    }),
  });
  const [result] = await sdk
    .executeQuery(env.BRANCH_ID, env.WORKSPACE_ID, { statements: [sql], transactional: false }, {
      maxWaitTime: 60_000,
      pageSize: 10_000,
      ...options,
    })
    .catch((err: unknown) => {
      if (!isApiError(err)) throw err;
      if (isRowLevelSecurityRefusal(err)) {
        console.warn(
          scope?.userToken
            ? '[kbcQuery] row-level security refused the query for this user'
            : `[kbcQuery] row-level security refused a query sent without ${USER_TOKEN_HEADER}: ${scope ? 'the request has none' : 'it ran outside a user request (startup, timer, background job)'}`,
        );
        throw new RowLevelSecurityError();
      }
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

function userTokenMiddleware(userToken: string): MiddlewareFn {
  return (next) => (fetchRequest) => {
    fetchRequest.request.headers.set(USER_TOKEN_HEADER, userToken);
    return next(fetchRequest);
  };
}

/** Status, header and text together: a governed workspace sends `X-KBC-RLS-Mode: enforce` on its other 403s too. */
function isRowLevelSecurityRefusal(err: ApiError) {
  return (
    err.response.status === 403 &&
    err.response.headers.get('X-KBC-RLS-Mode') === 'enforce' &&
    (err.data as { exception?: string } | undefined)?.exception === RLS_DENIED
  );
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
 * - `WORKSPACE_ID` and `KBC_TOKEN` come from the platform's workspace manifest and token file.
 * - The image restarts the app when either rotates, so `process.env` is always current.
 */
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
