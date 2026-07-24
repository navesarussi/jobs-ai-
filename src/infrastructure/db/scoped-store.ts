import type { PoolClient } from "pg";
import type {
  AiUsageRecord,
  CandidateCard,
  CandidateCvProfile,
  ChatMessage,
  FieldAnswer,
  JobCard,
  JobSlot,
  StoreData,
} from "@/domain/types";
import { emptyCvProfile } from "@/domain/types";
import type { ChatConversationContext } from "./chat-messages";
import {
  readMemoryStore,
  shouldUseMemoryStore,
  writeMemoryStore,
} from "./memory-store";
import { ensureSchema } from "./schema";
import { getPool } from "./pool";
import { invalidateStoreCache } from "./store-cache";

/**
 * Scoped writes: interactive actions touch ONLY the acting user's rows instead
 * of the whole-store delete-and-reinsert in `persistStore`.
 */

async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const pool = await getPool();
  const client = await pool.connect();
  let began = false;
  try {
    await client.query("begin");
    began = true;
    const result = await fn(client);
    await client.query("commit");
    began = false;
    invalidateStoreCache();
    return result;
  } catch (e) {
    if (began) await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

function writeMemory(store: StoreData): void {
  writeMemoryStore(store);
  invalidateStoreCache();
}

async function insertChatMessages(
  client: PoolClient,
  ownerUserId: string,
  context: ChatConversationContext,
  jobId: string | null,
  messages: ChatMessage[],
): Promise<void> {
  for (const m of messages) {
    await client.query(
      `insert into chat_messages
         (id, owner_user_id, conversation_context, job_id, role, content, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do nothing`,
      [m.id, ownerUserId, context, jobId, m.role, m.content, m.createdAt],
    );
  }
}

async function upsertEmployeeProfile(
  client: PoolClient,
  userId: string,
  card: CandidateCard,
  pendingFieldQuestionIds: string[],
  cv?: CandidateCvProfile,
): Promise<void> {
  if (cv !== undefined) {
    await client.query(
      `insert into employee_profiles (user_id, card, pending_field_question_ids, cv, updated_at)
       values ($1, $2::jsonb, $3::jsonb, $4::jsonb, now())
       on conflict (user_id) do update set
         card = excluded.card,
         pending_field_question_ids = excluded.pending_field_question_ids,
         cv = excluded.cv,
         updated_at = excluded.updated_at`,
      [userId, JSON.stringify(card), JSON.stringify(pendingFieldQuestionIds), JSON.stringify(cv)],
    );
    return;
  }
  await client.query(
    `insert into employee_profiles (user_id, card, pending_field_question_ids, updated_at)
     values ($1, $2::jsonb, $3::jsonb, now())
     on conflict (user_id) do update set
       card = excluded.card,
       pending_field_question_ids = excluded.pending_field_question_ids,
       updated_at = excluded.updated_at`,
    [userId, JSON.stringify(card), JSON.stringify(pendingFieldQuestionIds)],
  );
}

async function upsertEmployerProfile(
  client: PoolClient,
  userId: string,
  card: JobCard,
  jobs: JobSlot[],
  activeJobId: string,
): Promise<void> {
  await client.query(
    `insert into employer_profiles (user_id, card, jobs, active_job_id, updated_at)
     values ($1, $2::jsonb, $3::jsonb, $4, now())
     on conflict (user_id) do update set
       card = excluded.card,
       jobs = excluded.jobs,
       active_job_id = excluded.active_job_id,
       updated_at = excluded.updated_at`,
    [userId, JSON.stringify(card), JSON.stringify(jobs), activeJobId],
  );
}

async function insertAiUsage(client: PoolClient, record: AiUsageRecord): Promise<void> {
  await client.query(
    `insert into ai_usage
       (id, type, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do nothing`,
    [
      record.id,
      record.type,
      record.promptTokens,
      record.completionTokens,
      record.totalTokens,
      record.estimatedCostUsd,
      record.createdAt,
    ],
  );
}

async function upsertFieldAnswers(client: PoolClient, answers: FieldAnswer[]): Promise<void> {
  for (const a of answers) {
    await client.query(
      `insert into field_answers (question_id, candidate_id, answer, answered_at)
       values ($1, $2, $3, $4)
       on conflict (question_id, candidate_id) do update set
         answer = excluded.answer,
         answered_at = excluded.answered_at`,
      [a.questionId, a.candidateId, a.answer, a.answeredAt],
    );
  }
}

/** Persist a candidate chat turn (profile + new messages + answers + usage). */
export async function persistEmployeeTurn(params: {
  store: StoreData;
  userId: string;
  card: CandidateCard;
  pendingFieldQuestionIds: string[];
  cv?: CandidateCvProfile;
  newMessages: ChatMessage[];
  newFieldAnswers: FieldAnswer[];
  usageRecord?: AiUsageRecord;
}): Promise<void> {
  if (shouldUseMemoryStore()) {
    writeMemory(params.store);
    return;
  }
  await withTx(async (client) => {
    await upsertEmployeeProfile(
      client,
      params.userId,
      params.card,
      params.pendingFieldQuestionIds,
      params.cv,
    );
    await insertChatMessages(client, params.userId, "employee", null, params.newMessages);
    if (params.newFieldAnswers.length) await upsertFieldAnswers(client, params.newFieldAnswers);
    if (params.usageRecord) await insertAiUsage(client, params.usageRecord);
  });
}

/** Persist an employer chat turn (jobs blob + new messages + usage). */
export async function persistEmployerTurn(params: {
  store: StoreData;
  userId: string;
  card: JobCard;
  jobs: JobSlot[];
  activeJobId: string;
  jobId: string;
  newMessages: ChatMessage[];
  usageRecord?: AiUsageRecord;
}): Promise<void> {
  if (shouldUseMemoryStore()) {
    writeMemory(params.store);
    return;
  }
  await withTx(async (client) => {
    await upsertEmployerProfile(
      client,
      params.userId,
      params.card,
      params.jobs,
      params.activeJobId,
    );
    await insertChatMessages(client, params.userId, "employer", params.jobId, params.newMessages);
    if (params.usageRecord) await insertAiUsage(client, params.usageRecord);
  });
}

/** Persist candidate profile row only (flexibility / CV save / CV analyze). */
export async function persistEmployeeProfile(params: {
  store: StoreData;
  userId: string;
  card: CandidateCard;
  pendingFieldQuestionIds: string[];
  cv?: CandidateCvProfile;
  usageRecord?: AiUsageRecord;
}): Promise<void> {
  if (shouldUseMemoryStore()) {
    writeMemory(params.store);
    return;
  }
  await withTx(async (client) => {
    await upsertEmployeeProfile(
      client,
      params.userId,
      params.card,
      params.pendingFieldQuestionIds,
      params.cv,
    );
    if (params.usageRecord) await insertAiUsage(client, params.usageRecord);
  });
}

/** Insert employee chat rows (memory store is updated via persistEmployeeProfile). */
export async function insertEmployeeChatMessages(
  userId: string,
  messages: ChatMessage[],
): Promise<void> {
  if (shouldUseMemoryStore() || messages.length === 0) return;
  await withTx(async (client) => {
    await insertChatMessages(client, userId, "employee", null, messages);
  });
}

/** Persist employer profile row only (flexibility / job create-select). */
export async function persistEmployerProfile(params: {
  store: StoreData;
  userId: string;
  card: JobCard;
  jobs: JobSlot[];
  activeJobId: string;
}): Promise<void> {
  if (shouldUseMemoryStore()) {
    writeMemory(params.store);
    return;
  }
  await withTx((client) =>
    upsertEmployerProfile(client, params.userId, params.card, params.jobs, params.activeJobId),
  );
}

/** Clear one conversation's messages without rewriting the rest of the DB. */
export async function clearConversationChat(params: {
  store: StoreData;
  userId: string;
  role: "employee" | "employer";
  jobId?: string;
  employerCard?: JobCard;
  employerJobs?: JobSlot[];
  activeJobId?: string;
}): Promise<void> {
  if (shouldUseMemoryStore()) {
    writeMemory(params.store);
    return;
  }
  await withTx(async (client) => {
    if (params.role === "employee") {
      await client.query(
        `delete from chat_messages
         where owner_user_id = $1 and conversation_context = 'employee'`,
        [params.userId],
      );
      const emp = params.store.employees.find((e) => e.userId === params.userId);
      if (emp) {
        await upsertEmployeeProfile(
          client,
          params.userId,
          emp.card,
          emp.pendingFieldQuestionIds,
          emptyCvProfile(),
        );
      }
      return;
    }
    const jobId = params.jobId ?? params.activeJobId ?? null;
    if (jobId) {
      await client.query(
        `delete from chat_messages
         where owner_user_id = $1 and conversation_context = 'employer' and job_id = $2`,
        [params.userId, jobId],
      );
    } else {
      await client.query(
        `delete from chat_messages
         where owner_user_id = $1 and conversation_context = 'employer'`,
        [params.userId],
      );
    }
    if (params.employerCard && params.employerJobs && params.activeJobId !== undefined) {
      await upsertEmployerProfile(
        client,
        params.userId,
        params.employerCard,
        params.employerJobs,
        params.activeJobId,
      );
    }
  });
}

/** Approve/reject a single match row — no whole-store rewrite. */
export async function updateMatchStatus(params: {
  matchId: string;
  employerId: string;
  status: "approved" | "rejected";
}): Promise<boolean> {
  if (shouldUseMemoryStore()) {
    const data = readMemoryStore();
    const hit = data.matches.find(
      (m) => m.id === params.matchId && m.jobOwnerId === params.employerId,
    );
    if (!hit) return false;
    writeMemory({
      ...data,
      matches: data.matches.map((m) =>
        m.id === params.matchId
          ? { ...m, status: params.status, updatedAt: new Date().toISOString() }
          : m,
      ),
    });
    return true;
  }
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `update matches
     set status = $1, updated_at = now()
     where id = $2 and job_owner_id = $3`,
    [params.status, params.matchId, params.employerId],
  );
  invalidateStoreCache();
  return (result.rowCount ?? 0) > 0;
}

/** Re-export for tests / callers that need the in-memory snapshot after scoped memory writes. */
export function peekMemoryStore(): StoreData {
  return readMemoryStore();
}
