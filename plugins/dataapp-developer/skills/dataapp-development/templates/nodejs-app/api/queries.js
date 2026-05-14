import { runQuery } from './keboola-client.js';

/**
 * Example summary query. Replace with app-specific SQL.
 * The placeholder query expects a table 'in.c-bucket.table' in your workspace.
 */
export async function getSummary() {
  const rows = await runQuery(`
    SELECT COUNT(*) AS row_count
    FROM "in.c-bucket"."table"
  `);
  return rows[0] || { row_count: 0 };
}
