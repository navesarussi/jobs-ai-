import { getPool } from "./pool";
import { NORMALIZED_SCHEMA_SQL } from "./schema-sql";

const MIGRATION_VERSION = "002_employer_jobs";

const ALTERS = `
alter table employer_profiles add column if not exists jobs jsonb not null default '[]'::jsonb;
alter table employer_profiles add column if not exists active_job_id text;
alter table matches add column if not exists job_id text;
update matches set job_id = job_owner_id where job_id is null;
`;

export async function ensureSchema(): Promise<void> {
  const pool = await getPool();
  await pool.query(NORMALIZED_SCHEMA_SQL);
  await pool.query(ALTERS);
  await pool.query(
    `insert into schema_migrations (version) values ($1) on conflict (version) do nothing`,
    [MIGRATION_VERSION],
  );
}

export async function hasNormalizedData(): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count from app_users`,
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}
