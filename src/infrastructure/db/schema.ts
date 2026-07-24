import { getPool } from "./pool";
import { NORMALIZED_SCHEMA_SQL } from "./schema-sql";
import { isNormalizedDataCached, markNormalizedDataPresent } from "./store-cache";

const MIGRATION_VERSION = "004_cv_profile";

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

update chat_messages set conversation_context = 'employee' where conversation_context is null;

alter table chat_messages alter column conversation_context set default 'employee';
alter table chat_messages alter column conversation_context set not null;

create index if not exists chat_messages_context_idx
  on chat_messages (owner_user_id, conversation_context, job_id, created_at);

alter table employee_profiles add column if not exists cv jsonb not null default '{}'::jsonb;

alter table admin_settings add column if not exists prompt_bundle_version text;

create table if not exists candidate_document_blobs (
  id text primary key,
  user_id text not null references app_users (id) on delete cascade,
  content bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists candidate_document_blobs_user_idx on candidate_document_blobs (user_id);
`;

let schemaReady: Promise<void> | undefined;

async function runSchema(): Promise<void> {
  const pool = await getPool();
  // 1) CREATE TABLE IF NOT EXISTS (existing DBs keep old column set)
  // 2) ALTER ADD COLUMN + backfill + indexes that need those columns
  // Never put indexes on new columns inside NORMALIZED_SCHEMA_SQL — they run
  // before ALTERs and break production when the table already exists.
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
  if (isNormalizedDataCached()) return true;
  const pool = await getPool();
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count from app_users`,
  );
  const present = Number(result.rows[0]?.count ?? 0) > 0;
  if (present) markNormalizedDataPresent();
  return present;
}
