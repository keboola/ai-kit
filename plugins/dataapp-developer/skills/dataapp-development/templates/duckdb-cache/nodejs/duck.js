/**
 * Generic DuckDB caching harness — pulls data from Keboola Snowflake workspace
 * into an in-memory DuckDB on a refresh interval, then serves queries against
 * the local cache.
 *
 * Customize: SNOWFLAKE_PULL_SQL, CREATE TABLE schemas, INSERT projection.
 */
import duckdb from 'duckdb';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const db = new duckdb.Database(':memory:');
const conn = db.connect();

const run = (sql) =>
  new Promise((resolve, reject) => conn.run(sql, (err) => (err ? reject(err) : resolve())));

const all = (sql) =>
  new Promise((resolve, reject) =>
    conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows))),
  );

let lastRefresh = null;
let rowCount = 0;
let lastError = null;
let refreshPromise = null;

// EDIT THIS: pull SQL against your Keboola workspace.
// Snowflake quoting shown. On a BigQuery project use backticks and the mangled
// dataset name with no stage prefix (e.g. `in_c_bucket`.`table`) — see
// references/storage-access.md "BigQuery SQL dialect".
const SNOWFLAKE_PULL_SQL = `
  SELECT
    "id" AS id,
    "name" AS name,
    "value" AS value
  FROM "in.c-bucket"."table"
`;

export async function init() {
  // EDIT THIS: define the cached schema.
  await run(`CREATE TABLE IF NOT EXISTS items (
    id VARCHAR,
    name VARCHAR,
    value DOUBLE
  )`);
}

export async function refresh(runSnowflake, { force = false } = {}) {
  if (refreshPromise && !force) return refreshPromise;
  refreshPromise = (async () => {
    const t0 = Date.now();
    let rows;
    try {
      rows = await runSnowflake(SNOWFLAKE_PULL_SQL);
    } catch (err) {
      lastError = err.message;
      throw err;
    }
    const tmpPath = join(tmpdir(), `cache-${Date.now()}.ndjson`);
    await writeFile(tmpPath, rows.map((r) => JSON.stringify(r)).join('\n'));
    try {
      await run('BEGIN');
      await run('DELETE FROM items');
      await run(`
        INSERT INTO items
        SELECT id, name, TRY_CAST(value AS DOUBLE) AS value
        FROM read_json_auto('${tmpPath}', ignore_errors=true)
      `);
      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK').catch(() => {});
      lastError = err.message;
      throw err;
    } finally {
      unlink(tmpPath).catch(() => {});
    }
    const countRow = await all('SELECT COUNT(*) AS n FROM items');
    rowCount = Number(countRow[0]?.n ?? 0);
    lastRefresh = new Date();
    lastError = null;
    console.log(`[duck] refreshed ${rowCount} rows in ${Math.round((Date.now() - t0) / 1000)}s`);
  })();

  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function query(sql) {
  const rows = await all(sql);
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'bigint') out[k] = Number(v);
      else if (v instanceof Date) out[k] = v.toISOString();
      else out[k] = v;
    }
    return out;
  });
}

export function status() {
  return {
    lastRefresh: lastRefresh ? lastRefresh.toISOString() : null,
    rowCount,
    lastError,
    refreshing: Boolean(refreshPromise),
  };
}
