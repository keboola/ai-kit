import { runQuery } from './keboola-client.js';

/**
 * Fully qualified table name. Copy from mcp__keboola__get_table's
 * `fully_qualified_name` field — the database prefix is required so
 * Data Catalog (cross-project linked) tables also resolve.
 */
const TABLE_FQN = '"KBC_REGION_PROJID"."in.c-bucket"."table_name"';

/**
 * Example summary query. Replace with app-specific SQL.
 */
export async function getSummary() {
  const rows = await runQuery(`
    SELECT COUNT(*) AS row_count
    FROM ${TABLE_FQN}
  `);
  return rows[0] || { row_count: 0 };
}
