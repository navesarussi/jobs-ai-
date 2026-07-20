/** Canonical DDL — also mirrored in supabase/migrations/001_normalized_schema.sql */
export const NORMALIZED_SCHEMA_SQL = `
create table if not exists app_users (
  id text primary key,
  name text not null,
  role text not null check (role in ('employee', 'employer')),
  email text,
  image text,
  google_id text,
  created_at timestamptz not null default now()
);
create index if not exists app_users_email_idx on app_users (email);
create index if not exists app_users_google_id_idx on app_users (google_id);

create table if not exists employee_profiles (
  user_id text primary key references app_users (id) on delete cascade,
  card jsonb not null default '{}'::jsonb,
  pending_field_question_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists employee_profiles_card_gin on employee_profiles using gin (card);

create table if not exists employer_profiles (
  user_id text primary key references app_users (id) on delete cascade,
  card jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists employer_profiles_card_gin on employer_profiles using gin (card);

create table if not exists chat_messages (
  id text primary key,
  owner_user_id text not null references app_users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_owner_idx on chat_messages (owner_user_id, created_at);

create table if not exists field_questions (
  id text primary key,
  field text not null,
  question text not null,
  source_job_id text not null,
  source_employer_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists field_questions_field_idx on field_questions (field);

create table if not exists field_answers (
  question_id text not null references field_questions (id) on delete cascade,
  candidate_id text not null references app_users (id) on delete cascade,
  answer text not null,
  answered_at timestamptz not null default now(),
  primary key (question_id, candidate_id)
);

create table if not exists matches (
  id text primary key,
  job_owner_id text not null references app_users (id) on delete cascade,
  candidate_id text not null references app_users (id) on delete cascade,
  score double precision not null,
  reason text not null,
  status text not null check (status in ('queued', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists matches_job_owner_idx on matches (job_owner_id);
create index if not exists matches_candidate_idx on matches (candidate_id);

create table if not exists admin_settings (
  id text primary key default 'main',
  candidate_prompt text not null default '',
  employer_prompt text not null default '',
  updated_at timestamptz,
  updated_by text
);

create table if not exists ai_usage (
  id text primary key,
  type text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists card_field_definitions (
  id text primary key,
  card_type text not null check (card_type in ('candidate', 'job')),
  field_key text not null,
  label_he text not null,
  label_en text,
  field_group text,
  priority integer not null default 100,
  source text not null default 'system' check (source in ('system', 'employer', 'ai')),
  created_at timestamptz not null default now(),
  unique (card_type, field_key)
);

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists app_store (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
`;
