import { getPool } from "./pool";
import { NORMALIZED_SCHEMA_SQL } from "./schema-sql";

const MIGRATION_VERSION = "003_chat_context";

const ALTERS = `
alter table employer_profiles add column if not exists jobs jsonb not null default '[]'::jsonb;
alter table employer_profiles add column if not exists active_job_id text;
alter table matches add column if not exists job_id text;
update matches set job_id = job_owner_id where job_id is null;

alter table chat_messages add column if not exists conversation_context text;
alter table chat_messages add column if not exists job_id text;

update chat_messages m
set conversation_context = 'employee'
from employee_profiles e
where m.owner_user_id = e.user_id
  and m.conversation_context is null
  and not exists (select 1 from employer_profiles p where p.user_id = m.owner_user_id);

update chat_messages m
set conversation_context = 'employer',
    job_id = coalesce(p.active_job_id, p.user_id)
from employer_profiles p
where m.owner_user_id = p.user_id
  and m.conversation_context is null
  and not exists (select 1 from employee_profiles e where e.user_id = m.owner_user_id);

delete from chat_messages where conversation_context is null;

alter table chat_messages alter column conversation_context set default 'employee';
alter table chat_messages alter column conversation_context set not null;
`;

let schemaReady: Promise<void> | undefined;

async function runSchema(): Promise<void> {
  const pool = await getPool();
  await pool.query(NORMALIZED_SCHEMA_SQL);
  await pool.query(ALTERS);
  await pool.query(
    `insert into schema_migrations (version) values ($1) on conflict (version) do nothing`,
    [MIGRATION_VERSION],
  );
}

/**
 * Run the schema DDL + migrations exactly once per process. Previously this ran
 * on every read and write — including a table-wide `update matches` — adding
 * several round-trips (and a write) to every single request.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = runSchema().catch((err) => {
      schemaReady = undefined; // allow a retry on the next call if bootstrap failed
      throw err;
    });
  }
  return schemaReady;
}

export async function hasNormalizedData(): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count from app_users`,
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}
