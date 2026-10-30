import { initializeApp, type RunQueryOptions } from '@keboola/api-client/sdk/dataApp';

/** Keboola access for this server: the app's workspace and each request's signed-in user. */
export const kbc = initializeApp();

/**
 * Runs SQL in the app's Storage workspace and returns every row, typed, with lower-case keys.
 *
 * - Works on Snowflake and BigQuery; only the SQL dialect differs (`references/storage-access.md`).
 * - Inside a request it queries as the signed-in user, so row-level security returns that user's rows.
 * - A refusal rejects with `RowLevelSecurityError`; `kbc.server.expressErrorHandler()` answers it with 403.
 */
export async function runQuery(sql: string, options?: RunQueryOptions): Promise<Record<string, unknown>[]> {
  if (!kbc.workspace) throw new Error('kbcQuery: this app has no Storage workspace; turn on Storage access');
  return kbc.workspace.runQuery(sql, options);
}

/** The signed-in user's key for a per-user cache; `undefined` outside a user request: cache nothing then. */
export const currentUserKey = kbc.server.currentUserKey;
