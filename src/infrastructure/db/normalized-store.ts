import type { Pool, PoolClient } from "pg";
import type { AdminSettings, Match, Role, StoreData, User } from "@/domain/types";
import {
  emptyCandidateCard,
  emptyJobCard,
  normalizeCandidateCard,
} from "@/domain/types";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import { applyChatRowsToStore, chatRowsFromStore } from "./chat-messages";
import { ensureSchema, hasNormalizedData } from "./schema";
import { registerFieldQuestionDefinitions } from "./field-definitions";
import { getPool } from "./pool";
import {
  createSeedStore,
  findMemoryUserByEmailOrGoogle,
  readMemoryStore,
  shouldUseMemoryStore,
  upsertMemorySessionRole,
  writeMemoryStore,
} from "./memory-store";

function normalizeStore(raw: StoreData): StoreData {
  return {
    ...raw,
    employees: (raw.employees ?? []).map((e) => ({
      ...e,
      card: normalizeCandidateCard(e.card),
      pendingFieldQuestionIds: e.pendingFieldQuestionIds ?? [],
      chat: e.chat ?? [],
    })),
    employers: (raw.employers ?? []).map((e) => normalizeEmployerRecord(e as never)),
    users: raw.users ?? [],
    fieldQuestions: raw.fieldQuestions ?? [],
    fieldAnswers: raw.fieldAnswers ?? [],
    matches: (raw.matches ?? []).map((m) => ({
      ...m,
      jobId: m.jobId || m.jobOwnerId,
    })),
    adminSettings: raw.adminSettings,
    aiUsage: raw.aiUsage ?? [],
  };
}

/**
 * One multi-row INSERT (chunked) instead of a query per row. `casts[i]` adds a
 * type cast to the i-th column's placeholder (e.g. "jsonb" for JSON payloads).
 */
async function bulkInsert(
  client: PoolClient,
  table: string,
  columns: string[],
  casts: (string | null)[],
  rows: unknown[][],
  conflict = "",
): Promise<void> {
  if (rows.length === 0) return;
  const CHUNK = 500;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value, idx) => {
        params.push(value);
        const cast = casts[idx];
        return cast ? `$${params.length}::${cast}` : `$${params.length}`;
      });
      return `(${placeholders.join(",")})`;
    });
    await client.query(
      `insert into ${table} (${columns.join(",")}) values ${tuples.join(",")} ${conflict}`,
      params,
    );
  }
}

async function deleteNotIn(
  client: PoolClient,
  table: string,
  idColumn: string,
  ids: string[],
): Promise<void> {
  if (ids.length) {
    await client.query(`delete from ${table} where not (${idColumn} = any($1::text[]))`, [ids]);
  } else {
    await client.query(`delete from ${table}`);
  }
}

async function readLegacyBlob(): Promise<StoreData | null> {
  const pool = await getPool();
  const result = await pool.query<{ data: StoreData }>(
    `select data from app_store where id = 'main' limit 1`,
  );
  if (!result.rows[0]?.data) return null;
  return normalizeStore(result.rows[0].data);
}

async function loadFromTables(pool: Pool): Promise<StoreData> {
  // Separate pooled clients → the reads actually run concurrently.
  const [users, employees, employers, chats, questions, answers, matches, admin, usage] =
    await Promise.all([
      pool.query(`select * from app_users order by created_at`),
      pool.query(`select * from employee_profiles`),
      pool.query(`select * from employer_profiles`),
      pool.query(`select * from chat_messages order by created_at`),
      pool.query(`select * from field_questions order by created_at`),
      pool.query(`select * from field_answers`),
      pool.query(`select * from matches order by created_at`),
      pool.query(`select * from admin_settings where id = 'main' limit 1`),
      pool.query(`select * from ai_usage order by created_at`),
    ]);

  const baseStore = normalizeStore({
    users: users.rows.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      email: u.email ?? undefined,
      image: u.image ?? undefined,
      googleId: u.google_id ?? undefined,
      createdAt: new Date(u.created_at).toISOString(),
    })),
    employees: employees.rows.map((e) => ({
      userId: e.user_id,
      card: e.card,
      pendingFieldQuestionIds: e.pending_field_question_ids ?? [],
      cv: e.cv && typeof e.cv === "object" && Object.keys(e.cv).length ? e.cv : undefined,
      chat: [],
    })),
    employers: employers.rows.map((e) =>
      normalizeEmployerRecord({
        userId: e.user_id,
        card: e.card,
        chat: [],
        jobs: e.jobs ?? [],
        activeJobId: e.active_job_id ?? "",
      }),
    ),
    fieldQuestions: questions.rows.map((q) => ({
      id: q.id,
      field: q.field,
      question: q.question,
      sourceJobId: q.source_job_id,
      sourceEmployerId: q.source_employer_id,
      createdAt: new Date(q.created_at).toISOString(),
    })),
    fieldAnswers: answers.rows.map((a) => ({
      questionId: a.question_id,
      candidateId: a.candidate_id,
      answer: a.answer,
      answeredAt: new Date(a.answered_at).toISOString(),
    })),
    matches: matches.rows.map((m) => ({
      id: m.id,
      jobOwnerId: m.job_owner_id,
      jobId: m.job_id || m.job_owner_id,
      candidateId: m.candidate_id,
      score: m.score,
      reason: m.reason,
      status: m.status,
      createdAt: new Date(m.created_at).toISOString(),
      updatedAt: new Date(m.updated_at).toISOString(),
    })),
    adminSettings: admin.rows[0]
      ? {
          candidatePrompt: admin.rows[0].candidate_prompt,
          employerPrompt: admin.rows[0].employer_prompt,
          updatedAt: admin.rows[0].updated_at
            ? new Date(admin.rows[0].updated_at).toISOString()
            : undefined,
          updatedBy: admin.rows[0].updated_by ?? undefined,
          promptBundleVersion: admin.rows[0].prompt_bundle_version ?? undefined,
        }
      : undefined,
    aiUsage: usage.rows.map((r) => ({
      id: r.id,
      type: r.type,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      totalTokens: r.total_tokens,
      estimatedCostUsd: r.estimated_cost_usd,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  });

  return applyChatRowsToStore(baseStore, chats.rows);
}

async function upsertUser(client: PoolClient, user: User): Promise<void> {
  await client.query(
    `insert into app_users (id, name, role, email, image, google_id, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do update set
       name = excluded.name,
       role = excluded.role,
       email = excluded.email,
       image = excluded.image,
       google_id = excluded.google_id`,
    [
      user.id,
      user.name,
      user.role,
      user.email ?? null,
      user.image ?? null,
      user.googleId ?? null,
      user.createdAt,
    ],
  );
}

const MATCH_COLUMNS = [
  "id",
  "job_owner_id",
  "job_id",
  "candidate_id",
  "score",
  "reason",
  "status",
  "created_at",
  "updated_at",
];

function matchRow(m: Match): unknown[] {
  return [
    m.id,
    m.jobOwnerId,
    m.jobId || m.jobOwnerId,
    m.candidateId,
    m.score,
    m.reason,
    m.status,
    m.createdAt,
    m.updatedAt,
  ];
}

async function persistStore(client: PoolClient, store: StoreData): Promise<void> {
  const normalized = normalizeStore(store);
  const now = new Date().toISOString();

  await bulkInsert(
    client,
    "app_users",
    ["id", "name", "role", "email", "image", "google_id", "created_at"],
    [null, null, null, null, null, null, null],
    normalized.users.map((u) => [
      u.id,
      u.name,
      u.role,
      u.email ?? null,
      u.image ?? null,
      u.googleId ?? null,
      u.createdAt,
    ]),
    `on conflict (id) do update set
       name = excluded.name, role = excluded.role, email = excluded.email,
       image = excluded.image, google_id = excluded.google_id`,
  );
  await deleteNotIn(client, "app_users", "id", normalized.users.map((u) => u.id));

  await bulkInsert(
    client,
    "employee_profiles",
    ["user_id", "card", "pending_field_question_ids", "cv", "updated_at"],
    [null, "jsonb", "jsonb", "jsonb", null],
    normalized.employees.map((e) => [
      e.userId,
      JSON.stringify(e.card),
      JSON.stringify(e.pendingFieldQuestionIds),
      JSON.stringify(e.cv ?? {}),
      now,
    ]),
    `on conflict (user_id) do update set
       card = excluded.card,
       pending_field_question_ids = excluded.pending_field_question_ids,
       cv = excluded.cv,
       updated_at = excluded.updated_at`,
  );
  await deleteNotIn(client, "employee_profiles", "user_id", normalized.employees.map((e) => e.userId));

  const employers = normalized.employers.map((er) => normalizeEmployerRecord(er));
  await bulkInsert(
    client,
    "employer_profiles",
    ["user_id", "card", "jobs", "active_job_id", "updated_at"],
    [null, "jsonb", "jsonb", null, null],
    employers.map((e) => [
      e.userId,
      JSON.stringify(e.card),
      JSON.stringify(e.jobs),
      e.activeJobId,
      now,
    ]),
    `on conflict (user_id) do update set
       card = excluded.card, jobs = excluded.jobs,
       active_job_id = excluded.active_job_id, updated_at = excluded.updated_at`,
  );
  await deleteNotIn(client, "employer_profiles", "user_id", employers.map((e) => e.userId));

  // Chat messages (candidate + employer per-job, with conversation context).
  await client.query(`delete from chat_messages`);
  await bulkInsert(
    client,
    "chat_messages",
    ["id", "owner_user_id", "conversation_context", "job_id", "role", "content", "created_at"],
    [null, null, null, null, null, null, null],
    chatRowsFromStore(normalized).map((r) => [
      r.id,
      r.ownerUserId,
      r.conversationContext,
      r.jobId,
      r.role,
      r.content,
      r.createdAt,
    ]),
    `on conflict (id) do nothing`,
  );

  await client.query(`delete from field_answers`);
  await client.query(`delete from field_questions`);
  await bulkInsert(
    client,
    "field_questions",
    ["id", "field", "question", "source_job_id", "source_employer_id", "created_at"],
    [null, null, null, null, null, null],
    normalized.fieldQuestions.map((q) => [
      q.id,
      q.field,
      q.question,
      q.sourceJobId,
      q.sourceEmployerId,
      q.createdAt,
    ]),
  );
  await bulkInsert(
    client,
    "field_answers",
    ["question_id", "candidate_id", "answer", "answered_at"],
    [null, null, null, null],
    normalized.fieldAnswers.map((a) => [a.questionId, a.candidateId, a.answer, a.answeredAt]),
  );
  await registerFieldQuestionDefinitions(client, normalized.fieldQuestions);

  await client.query(`delete from matches`);
  await bulkInsert(
    client,
    "matches",
    MATCH_COLUMNS,
    MATCH_COLUMNS.map(() => null),
    normalized.matches.map(matchRow),
  );

  await client.query(`delete from admin_settings`);
  if (normalized.adminSettings) {
    await client.query(
      `insert into admin_settings (id, candidate_prompt, employer_prompt, updated_at, updated_by, prompt_bundle_version)
       values ('main', $1, $2, $3, $4, $5)`,
      [
        normalized.adminSettings.candidatePrompt,
        normalized.adminSettings.employerPrompt,
        normalized.adminSettings.updatedAt ?? null,
        normalized.adminSettings.updatedBy ?? null,
        normalized.adminSettings.promptBundleVersion ?? null,
      ],
    );
  }

  await client.query(`delete from ai_usage`);
  await bulkInsert(
    client,
    "ai_usage",
    ["id", "type", "prompt_tokens", "completion_tokens", "total_tokens", "estimated_cost_usd", "created_at"],
    [null, null, null, null, null, null, null],
    (normalized.aiUsage ?? []).map((u) => [
      u.id,
      u.type,
      u.promptTokens,
      u.completionTokens,
      u.totalTokens,
      u.estimatedCostUsd,
      u.createdAt,
    ]),
  );
}

function seedStore(): StoreData {
  return createSeedStore();
}

/** Fast path for role start — no full-store rewrite. */
export async function upsertSessionRole(user: User, role: Role): Promise<User> {
  if (shouldUseMemoryStore()) {
    return upsertMemorySessionRole(user, role);
  }
  await ensureSchema();
  const pool = await getPool();
  const client = await pool.connect();
  let began = false;
  try {
    await client.query("begin");
    began = true;
    const nextUser = { ...user, role };
    await upsertUser(client, nextUser);
    if (role === "employee") {
      await client.query(
        `insert into employee_profiles (user_id, card, pending_field_question_ids, updated_at)
         values ($1, $2::jsonb, '[]'::jsonb, now())
         on conflict (user_id) do nothing`,
        [user.id, JSON.stringify(emptyCandidateCard())],
      );
    } else {
      const starter = normalizeEmployerRecord({
        userId: user.id,
        card: emptyJobCard(),
        chat: [],
        jobs: [],
        activeJobId: "",
      });
      await client.query(
        `insert into employer_profiles (user_id, card, jobs, active_job_id, updated_at)
         values ($1, $2::jsonb, $3::jsonb, $4, now())
         on conflict (user_id) do nothing`,
        [
          user.id,
          JSON.stringify(starter.card),
          JSON.stringify(starter.jobs),
          starter.activeJobId,
        ],
      );
    }
    await client.query("commit");
    began = false;
    return nextUser;
  } catch (e) {
    if (began) await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function findUserByEmailOrGoogle(
  email: string,
  googleId?: string,
): Promise<User | null> {
  if (shouldUseMemoryStore()) {
    return findMemoryUserByEmailOrGoogle(email, googleId);
  }
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `select * from app_users
     where email = $1 or ($2::text is not null and google_id = $2)
     order by created_at
     limit 1`,
    [email, googleId ?? null],
  );
  const u = result.rows[0];
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    email: u.email ?? undefined,
    image: u.image ?? undefined,
    googleId: u.google_id ?? undefined,
    createdAt: new Date(u.created_at).toISOString(),
  };
}

export async function readNormalizedStore(): Promise<StoreData> {
  if (shouldUseMemoryStore()) {
    return readMemoryStore();
  }
  await ensureSchema();
  const pool = await getPool();

  if (!(await hasNormalizedData())) {
    const client = await pool.connect();
    let began = false;
    try {
      const legacy = await readLegacyBlob();
      const seed = legacy ?? seedStore();
      await client.query("begin");
      began = true;
      await persistStore(client, seed);
      await client.query("commit");
      began = false;
      return seed;
    } catch (e) {
      if (began) await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  }

  return loadFromTables(pool);
}

export async function writeNormalizedStore(store: StoreData): Promise<void> {
  if (shouldUseMemoryStore()) {
    writeMemoryStore(store);
    return;
  }
  await ensureSchema();
  const pool = await getPool();
  const client = await pool.connect();
  let began = false;
  try {
    await client.query("begin");
    began = true;
    await persistStore(client, store);
    await client.query("commit");
    began = false;
  } catch (e) {
    if (began) await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

/** Replace just the matches table — used by the deferred, off-critical-path refresh. */
export async function replaceMatches(matches: Match[]): Promise<void> {
  if (shouldUseMemoryStore()) {
    const data = readMemoryStore();
    writeMemoryStore({ ...data, matches });
    return;
  }
  await ensureSchema();
  const pool = await getPool();
  const client = await pool.connect();
  let began = false;
  try {
    await client.query("begin");
    began = true;
    await client.query(`delete from matches`);
    await bulkInsert(
      client,
      "matches",
      MATCH_COLUMNS,
      MATCH_COLUMNS.map(() => null),
      matches.map(matchRow),
    );
    await client.query("commit");
    began = false;
  } catch (e) {
    if (began) await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

/** Targeted admin prompt write — avoids rewriting the full store on each save. */
export async function upsertAdminSettings(settings: AdminSettings): Promise<void> {
  if (shouldUseMemoryStore()) {
    const data = readMemoryStore();
    writeMemoryStore({ ...data, adminSettings: settings });
    return;
  }
  await ensureSchema();
  const pool = await getPool();
  await pool.query(
    `insert into admin_settings (id, candidate_prompt, employer_prompt, updated_at, updated_by, prompt_bundle_version)
     values ('main', $1, $2, $3, $4, $5)
     on conflict (id) do update set
       candidate_prompt = excluded.candidate_prompt,
       employer_prompt = excluded.employer_prompt,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by,
       prompt_bundle_version = excluded.prompt_bundle_version`,
    [
      settings.candidatePrompt,
      settings.employerPrompt,
      settings.updatedAt ?? null,
      settings.updatedBy ?? null,
      settings.promptBundleVersion ?? null,
    ],
  );
}

export async function deleteAdminSettings(): Promise<void> {
  if (shouldUseMemoryStore()) {
    const data = readMemoryStore();
    const { adminSettings: _removed, ...rest } = data;
    writeMemoryStore(rest);
    return;
  }
  await ensureSchema();
  const pool = await getPool();
  await pool.query(`delete from admin_settings where id = 'main'`);
}
