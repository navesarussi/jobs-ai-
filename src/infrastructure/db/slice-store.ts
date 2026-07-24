import type {
  AdminSettings,
  EmployeeRecord,
  EmployerRecord,
  FieldAnswer,
  FieldQuestion,
  Match,
  StoreData,
  User,
} from "@/domain/types";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import { applyChatRowsToStore, type RawChatRow } from "./chat-messages";
import { ensureSchema } from "./schema";
import { getPool } from "./pool";
import { readMemoryStore, shouldUseMemoryStore } from "./memory-store";

function mapUser(u: Record<string, unknown>): User {
  return {
    id: String(u.id),
    name: String(u.name),
    role: u.role as User["role"],
    email: (u.email as string | null) ?? undefined,
    image: (u.image as string | null) ?? undefined,
    googleId: (u.google_id as string | null) ?? undefined,
    createdAt: new Date(u.created_at as string | Date).toISOString(),
  };
}

function mapEmployee(e: Record<string, unknown>, includeCv: boolean): EmployeeRecord {
  const cv = e.cv;
  return {
    userId: String(e.user_id),
    card: e.card as EmployeeRecord["card"],
    pendingFieldQuestionIds: (e.pending_field_question_ids as string[]) ?? [],
    cv:
      includeCv && cv && typeof cv === "object" && Object.keys(cv as object).length
        ? (cv as EmployeeRecord["cv"])
        : undefined,
    chat: [],
  };
}

function mapEmployer(e: Record<string, unknown>): EmployerRecord {
  return normalizeEmployerRecord({
    userId: String(e.user_id),
    card: e.card as EmployerRecord["card"],
    chat: [],
    jobs: (e.jobs as EmployerRecord["jobs"]) ?? [],
    activeJobId: (e.active_job_id as string) ?? "",
  });
}

function mapQuestion(q: Record<string, unknown>): FieldQuestion {
  return {
    id: String(q.id),
    field: String(q.field),
    question: String(q.question),
    sourceJobId: String(q.source_job_id),
    sourceEmployerId: String(q.source_employer_id),
    createdAt: new Date(q.created_at as string | Date).toISOString(),
  };
}

function mapAnswer(a: Record<string, unknown>): FieldAnswer {
  return {
    questionId: String(a.question_id),
    candidateId: String(a.candidate_id),
    answer: String(a.answer),
    answeredAt: new Date(a.answered_at as string | Date).toISOString(),
  };
}

function mapMatch(m: Record<string, unknown>): Match {
  return {
    id: String(m.id),
    jobOwnerId: String(m.job_owner_id),
    jobId: String(m.job_id || m.job_owner_id),
    candidateId: String(m.candidate_id),
    score: Number(m.score),
    reason: String(m.reason),
    status: m.status as Match["status"],
    createdAt: new Date(m.created_at as string | Date).toISOString(),
    updatedAt: new Date(m.updated_at as string | Date).toISOString(),
  };
}

function mapAdmin(row: Record<string, unknown> | undefined): AdminSettings | undefined {
  if (!row) return undefined;
  return {
    candidatePrompt: String(row.candidate_prompt),
    employerPrompt: String(row.employer_prompt),
    updatedAt: row.updated_at
      ? new Date(row.updated_at as string | Date).toISOString()
      : undefined,
    updatedBy: (row.updated_by as string | null) ?? undefined,
    promptBundleVersion: (row.prompt_bundle_version as string | null) ?? undefined,
  };
}

function emptyStore(partial: Partial<StoreData>): StoreData {
  return {
    users: partial.users ?? [],
    employees: partial.employees ?? [],
    employers: partial.employers ?? [],
    fieldQuestions: partial.fieldQuestions ?? [],
    fieldAnswers: partial.fieldAnswers ?? [],
    matches: partial.matches ?? [],
    adminSettings: partial.adminSettings,
    aiUsage: [],
  };
}

function filterMemoryActor(userId: string): StoreData {
  const all = readMemoryStore();
  return emptyStore({
    users: all.users.filter((u) => u.id === userId),
    employees: all.employees.filter((e) => e.userId === userId),
    employers: all.employers.filter((e) => e.userId === userId),
    fieldQuestions: all.fieldQuestions,
    fieldAnswers: all.fieldAnswers.filter((a) => a.candidateId === userId),
    adminSettings: all.adminSettings,
  });
}

/** Workspace for one acting user — chats + profile + prompts; no other users' data. */
export async function readActorStore(userId: string): Promise<StoreData> {
  if (shouldUseMemoryStore()) return filterMemoryActor(userId);
  await ensureSchema();
  const pool = await getPool();
  const [users, employees, employers, chats, questions, answers, admin] = await Promise.all([
    pool.query(`select * from app_users where id = $1 limit 1`, [userId]),
    pool.query(`select * from employee_profiles where user_id = $1 limit 1`, [userId]),
    pool.query(`select * from employer_profiles where user_id = $1 limit 1`, [userId]),
    pool.query(
      `select * from chat_messages where owner_user_id = $1 order by created_at`,
      [userId],
    ),
    pool.query(`select * from field_questions order by created_at`),
    pool.query(`select * from field_answers where candidate_id = $1`, [userId]),
    pool.query(`select * from admin_settings where id = 'main' limit 1`),
  ]);

  const base = emptyStore({
    users: users.rows.map((u) => mapUser(u)),
    employees: employees.rows.map((e) => mapEmployee(e, true)),
    employers: employers.rows.map((e) => mapEmployer(e)),
    fieldQuestions: questions.rows.map((q) => mapQuestion(q)),
    fieldAnswers: answers.rows.map((a) => mapAnswer(a)),
    adminSettings: mapAdmin(admin.rows[0]),
  });
  return applyChatRowsToStore(base, chats.rows as RawChatRow[]);
}

/**
 * Cards + matches only (no chats / cv / ai_usage) for deferred match rebuild.
 * Safe under concurrent chat traffic — small payload, parallel queries.
 */
export async function readMatchingStore(): Promise<StoreData> {
  if (shouldUseMemoryStore()) {
    const all = readMemoryStore();
    return emptyStore({
      users: all.users,
      employees: all.employees.map((e) => ({ ...e, chat: [], cv: undefined })),
      employers: all.employers.map((e) => ({
        ...e,
        chat: [],
        jobs: e.jobs.map((j) => ({ ...j, chat: [] })),
      })),
      matches: all.matches,
    });
  }
  await ensureSchema();
  const pool = await getPool();
  const [users, employees, employers, matches] = await Promise.all([
    pool.query(`select id, name, role, email, image, google_id, created_at from app_users`),
    pool.query(
      `select user_id, card, pending_field_question_ids from employee_profiles`,
    ),
    pool.query(`select user_id, card, jobs, active_job_id from employer_profiles`),
    pool.query(`select * from matches`),
  ]);
  return emptyStore({
    users: users.rows.map((u) => mapUser(u)),
    employees: employees.rows.map((e) => mapEmployee(e, false)),
    employers: employers.rows.map((e) => mapEmployer(e)),
    matches: matches.rows.map((m) => mapMatch(m)),
  });
}

/** Approved jobs for a candidate — only related employer rows. */
export async function readOpportunityStore(candidateId: string): Promise<StoreData> {
  if (shouldUseMemoryStore()) {
    const all = readMemoryStore();
    const matches = all.matches.filter(
      (m) => m.candidateId === candidateId && m.status === "approved",
    );
    const ownerIds = new Set(matches.map((m) => m.jobOwnerId));
    return emptyStore({
      users: all.users.filter((u) => u.id === candidateId || ownerIds.has(u.id)),
      employers: all.employers.filter((e) => ownerIds.has(e.userId)),
      matches,
    });
  }
  await ensureSchema();
  const pool = await getPool();
  const matchesRes = await pool.query(
    `select * from matches where candidate_id = $1 and status = 'approved'`,
    [candidateId],
  );
  const matches = matchesRes.rows.map((m) => mapMatch(m));
  const ownerIds = [...new Set(matches.map((m) => m.jobOwnerId))];
  if (ownerIds.length === 0) {
    return emptyStore({ users: [], employers: [], matches: [] });
  }
  const [users, employers] = await Promise.all([
    pool.query(`select * from app_users where id = any($1::text[])`, [
      [candidateId, ...ownerIds],
    ]),
    pool.query(`select * from employer_profiles where user_id = any($1::text[])`, [ownerIds]),
  ]);
  return emptyStore({
    users: users.rows.map((u) => mapUser(u)),
    employers: employers.rows.map((e) => mapEmployer(e)),
    matches,
  });
}

/** Queued candidates for an employer job — only related employee rows. */
export async function readCandidateQueueStore(
  employerId: string,
  jobId?: string | null,
): Promise<StoreData> {
  if (shouldUseMemoryStore()) {
    const all = readMemoryStore();
    const matches = all.matches.filter((m) => {
      if (m.jobOwnerId !== employerId || m.status !== "queued") return false;
      if (!jobId) return true;
      return (m.jobId || m.jobOwnerId) === jobId;
    });
    const candIds = new Set(matches.map((m) => m.candidateId));
    return emptyStore({
      users: all.users.filter((u) => u.id === employerId || candIds.has(u.id)),
      employees: all.employees.filter((e) => candIds.has(e.userId)),
      matches,
    });
  }
  await ensureSchema();
  const pool = await getPool();
  const matchesRes = jobId
    ? await pool.query(
        `select * from matches
         where job_owner_id = $1 and status = 'queued'
           and coalesce(job_id, job_owner_id) = $2
         order by score desc`,
        [employerId, jobId],
      )
    : await pool.query(
        `select * from matches
         where job_owner_id = $1 and status = 'queued'
         order by score desc`,
        [employerId],
      );
  const matches = matchesRes.rows.map((m) => mapMatch(m));
  const candIds = [...new Set(matches.map((m) => m.candidateId))];
  if (candIds.length === 0) {
    return emptyStore({ users: [], employees: [], matches: [] });
  }
  const [users, employees] = await Promise.all([
    pool.query(`select * from app_users where id = any($1::text[])`, [
      [employerId, ...candIds],
    ]),
    pool.query(`select * from employee_profiles where user_id = any($1::text[])`, [candIds]),
  ]);
  return emptyStore({
    users: users.rows.map((u) => mapUser(u)),
    employees: employees.rows.map((e) => mapEmployee(e, true)),
    matches,
  });
}

/** Viewer + candidate + linking matches — for CV download auth (FR-CV-05). */
export async function readCvAccessStore(
  viewerId: string,
  candidateId: string,
): Promise<StoreData> {
  if (shouldUseMemoryStore()) {
    const all = readMemoryStore();
    return emptyStore({
      users: all.users.filter((u) => u.id === viewerId || u.id === candidateId),
      employees: all.employees.filter((e) => e.userId === candidateId),
      matches: all.matches.filter(
        (m) => m.jobOwnerId === viewerId && m.candidateId === candidateId,
      ),
    });
  }
  await ensureSchema();
  const pool = await getPool();
  const [users, employees, matches] = await Promise.all([
    pool.query(`select * from app_users where id = any($1::text[])`, [
      [viewerId, candidateId],
    ]),
    pool.query(`select * from employee_profiles where user_id = $1 limit 1`, [candidateId]),
    pool.query(
      `select * from matches where job_owner_id = $1 and candidate_id = $2`,
      [viewerId, candidateId],
    ),
  ]);
  return emptyStore({
    users: users.rows.map((u) => mapUser(u)),
    employees: employees.rows.map((e) => mapEmployee(e, true)),
    matches: matches.rows.map((m) => mapMatch(m)),
  });
}

export async function findUserById(userId: string): Promise<User | null> {
  if (shouldUseMemoryStore()) {
    return readMemoryStore().users.find((u) => u.id === userId) ?? null;
  }
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(`select * from app_users where id = $1 limit 1`, [userId]);
  const row = result.rows[0];
  return row ? mapUser(row) : null;
}
