import { readFileSync } from "fs";
import { join } from "path";
import { getPool } from "./pool";

const MIGRATION_VERSION = "001_normalized_schema";

function loadMigrationSql(): string {
  const path = join(process.cwd(), "supabase/migrations/001_normalized_schema.sql");
  return readFileSync(path, "utf8");
}

export async function ensureSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(loadMigrationSql());
  await pool.query(
    `insert into schema_migrations (version) values ($1) on conflict (version) do nothing`,
    [MIGRATION_VERSION],
  );
}

export async function hasNormalizedData(): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count from app_users`,
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}
