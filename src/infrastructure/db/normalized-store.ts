import type { PoolClient } from "pg";
import type { Role, StoreData, User } from "@/domain/types";
import {
  emptyCandidateCard,
  emptyJobCard,
  normalizeCandidateCard,
  normalizeJobCard,
} from "@/domain/types";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import { ensureSchema, hasNormalizedData } from "./schema";
import { registerFieldQuestionDefinition } from "./field-definitions";
import { getPool } from "./pool";

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

async function readLegacyBlob(): Promise<StoreData | null> {
  const pool = await getPool();
  const result = await pool.query<{ data: StoreData }>(
    `select data from app_store where id = 'main' limit 1`,
  );
  if (!result.rows[0]?.data) return null;
  return normalizeStore(result.rows[0].data);
}

async function loadFromTables(client: PoolClient): Promise<StoreData> {
  const [users, employees, employers, chats, questions, answers, matches, admin, usage] =
    await Promise.all([
      client.query(`select * from app_users order by created_at`),
      client.query(`select * from employee_profiles`),
      client.query(`select * from employer_profiles`),
      client.query(`select * from chat_messages order by created_at`),
      client.query(`select * from field_questions order by created_at`),
      client.query(`select * from field_answers`),
      client.query(`select * from matches order by created_at`),
      client.query(`select * from admin_settings where id = 'main' limit 1`),
      client.query(`select * from ai_usage order by created_at`),
    ]);

  const chatByOwner = new Map<string, typeof chats.rows>();
  for (const row of chats.rows) {
    const list = chatByOwner.get(row.owner_user_id) ?? [];
    list.push(row);
    chatByOwner.set(row.owner_user_id, list);
  }

  return normalizeStore({
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
      chat: (chatByOwner.get(e.user_id) ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.created_at).toISOString(),
      })),
    })),
    employers: employers.rows.map((e) => {
      const legacyChat = (chatByOwner.get(e.user_id) ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.created_at).toISOString(),
      }));
      return normalizeEmployerRecord({
        userId: e.user_id,
        card: e.card,
        chat: legacyChat,
        jobs: e.jobs ?? [],
        activeJobId: e.active_job_id ?? "",
      });
    }),
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

async function persistStore(client: PoolClient, store: StoreData): Promise<void> {
  const normalized = normalizeStore(store);
  const userIds = normalized.users.map((u) => u.id);
  const employeeIds = normalized.employees.map((e) => e.userId);
  const employerIds = normalized.employers.map((e) => e.userId);
  const questionIds = normalized.fieldQuestions.map((q) => q.id);
  const matchIds = normalized.matches.map((m) => m.id);
  const usageIds = (normalized.aiUsage ?? []).map((u) => u.id);

  for (const user of normalized.users) await upsertUser(client, user);
  if (userIds.length) {
    await client.query(`delete from app_users where not (id = any($1::text[]))`, [userIds]);
  } else {
    await client.query(`delete from app_users`);
  }

  for (const emp of normalized.employees) {
    await client.query(
      `insert into employee_profiles (user_id, card, pending_field_question_ids, updated_at)
       values ($1, $2::jsonb, $3::jsonb, now())
       on conflict (user_id) do update set
         card = excluded.card,
         pending_field_question_ids = excluded.pending_field_question_ids,
         updated_at = now()`,
      [emp.userId, JSON.stringify(emp.card), JSON.stringify(emp.pendingFieldQuestionIds)],
    );
  }
  if (employeeIds.length) {
    await client.query(
      `delete from employee_profiles where not (user_id = any($1::text[]))`,
      [employeeIds],
    );
  } else {
    await client.query(`delete from employee_profiles`);
  }

  for (const er of normalized.employers) {
    const employer = normalizeEmployerRecord(er);
    await client.query(
      `insert into employer_profiles (user_id, card, jobs, active_job_id, updated_at)
       values ($1, $2::jsonb, $3::jsonb, $4, now())
       on conflict (user_id) do update set
         card = excluded.card,
         jobs = excluded.jobs,
         active_job_id = excluded.active_job_id,
         updated_at = now()`,
      [
        employer.userId,
        JSON.stringify(employer.card),
        JSON.stringify(employer.jobs),
        employer.activeJobId,
      ],
    );
  }
  if (employerIds.length) {
    await client.query(
      `delete from employer_profiles where not (user_id = any($1::text[]))`,
      [employerIds],
    );
  } else {
    await client.query(`delete from employer_profiles`);
  }

  // Replace chats in one pass (avoids dual-role wipe races).
  await client.query(`delete from chat_messages`);
  for (const emp of normalized.employees) {
    for (const msg of emp.chat) {
      await client.query(
        `insert into chat_messages (id, owner_user_id, role, content, created_at)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set
           owner_user_id = excluded.owner_user_id,
           role = excluded.role,
           content = excluded.content`,
        [msg.id, emp.userId, msg.role, msg.content, msg.createdAt],
      );
    }
  }
  for (const er of normalized.employers) {
    const employer = normalizeEmployerRecord(er);
    for (const msg of employer.chat) {
      await client.query(
        `insert into chat_messages (id, owner_user_id, role, content, created_at)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set
           owner_user_id = excluded.owner_user_id,
           role = excluded.role,
           content = excluded.content`,
        [msg.id, employer.userId, msg.role, msg.content, msg.createdAt],
      );
    }
  }

  await client.query(`delete from field_answers`);
  await client.query(`delete from field_questions`);
  for (const q of normalized.fieldQuestions) {
    await client.query(
      `insert into field_questions (id, field, question, source_job_id, source_employer_id, created_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [q.id, q.field, q.question, q.sourceJobId, q.sourceEmployerId, q.createdAt],
    );
    await registerFieldQuestionDefinition(client, q);
  }
  for (const a of normalized.fieldAnswers) {
    await client.query(
      `insert into field_answers (question_id, candidate_id, answer, answered_at)
       values ($1, $2, $3, $4)`,
      [a.questionId, a.candidateId, a.answer, a.answeredAt],
    );
  }
  void questionIds;

  await client.query(`delete from matches`);
  for (const m of normalized.matches) {
    await client.query(
      `insert into matches (id, job_owner_id, job_id, candidate_id, score, reason, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        m.id,
        m.jobOwnerId,
        m.jobId || m.jobOwnerId,
        m.candidateId,
        m.score,
        m.reason,
        m.status,
        m.createdAt,
        m.updatedAt,
      ],
    );
  }
  void matchIds;

  await client.query(`delete from admin_settings`);
  if (normalized.adminSettings) {
    await client.query(
      `insert into admin_settings (id, candidate_prompt, employer_prompt, updated_at, updated_by)
       values ('main', $1, $2, $3, $4)`,
      [
        normalized.adminSettings.candidatePrompt,
        normalized.adminSettings.employerPrompt,
        normalized.adminSettings.updatedAt ?? null,
        normalized.adminSettings.updatedBy ?? null,
      ],
    );
  }

  await client.query(`delete from ai_usage`);
  for (const u of normalized.aiUsage ?? []) {
    await client.query(
      `insert into ai_usage (id, type, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [u.id, u.type, u.promptTokens, u.completionTokens, u.totalTokens, u.estimatedCostUsd, u.createdAt],
    );
  }
  void usageIds;
}

function seedStore(): StoreData {
  const now = new Date().toISOString();
  const empId = "demo-employee";
  const bossId = "demo-employer";
  return {
    users: [
      { id: empId, name: "נועה (דמו עובדת)", role: "employee", createdAt: now },
      { id: bossId, name: "דני (דמו מעסיק)", role: "employer", createdAt: now },
    ],
    employees: [
      { userId: empId, card: emptyCandidateCard(), chat: [], pendingFieldQuestionIds: [] },
    ],
    employers: [
      normalizeEmployerRecord({
        userId: bossId,
        card: emptyJobCard(),
        chat: [],
        jobs: [],
        activeJobId: "",
      }),
    ],
    fieldQuestions: [],
    fieldAnswers: [],
    matches: [],
  };
}

/** Fast path for role start — no full-store rewrite. */
export async function upsertSessionRole(user: User, role: Role): Promise<User> {
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
  await ensureSchema();
  const pool = await getPool();
  const client = await pool.connect();
  let began = false;
  try {
    if (!(await hasNormalizedData())) {
      const legacy = await readLegacyBlob();
      const seed = legacy ?? seedStore();
      await client.query("begin");
      began = true;
      await persistStore(client, seed);
      await client.query("commit");
      began = false;
      return seed;
    }
    return await loadFromTables(client);
  } catch (e) {
    if (began) await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function writeNormalizedStore(store: StoreData): Promise<void> {
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
