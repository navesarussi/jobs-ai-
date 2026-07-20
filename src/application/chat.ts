import { randomUUID } from "crypto";
import { NotFoundError } from "@/domain/errors";
import { createAiUsageRecord } from "@/domain/admin";
import {
  getActiveJob,
  normalizeEmployerRecord,
  updateJobSlot,
  withActiveJob,
} from "@/domain/employer-jobs";
import {
  mergeAnswerIntoCard,
  unansweredQuestionsForCandidate,
} from "@/domain/field-questions";
import type {
  AiUsageRecord,
  CandidateCard,
  ChatMessage,
  FieldQuestion,
  JobCard,
  StoreData,
} from "@/domain/types";
import { runEmployeeIntake, runEmployerIntake } from "@/infrastructure/ai/intake";
import { resolveAdminSettings } from "@/infrastructure/ai/prompts";
import type { AiTokenUsage, CandidatePatch, JobPatch } from "@/infrastructure/ai/schemas";

function applyCandidatePatch(card: CandidateCard, patch?: CandidatePatch): CandidateCard {
  if (!patch) return card;
  return {
    ...card,
    ...patch,
    skills: patch.skills ?? card.skills,
    softSkills: patch.softSkills ?? card.softSkills,
    languages: patch.languages ?? card.languages,
    extras: { ...card.extras, ...(patch.extras ?? {}) },
    flexibility: patch.flexibility ?? card.flexibility,
    experienceYears:
      patch.experienceYears !== undefined ? patch.experienceYears : card.experienceYears,
  };
}

function applyJobPatch(card: JobCard, patch?: JobPatch): JobCard {
  if (!patch) return card;
  return {
    ...card,
    ...patch,
    mustHaves: patch.mustHaves ?? card.mustHaves,
    niceToHaves: patch.niceToHaves ?? card.niceToHaves,
    requiredLanguages: patch.requiredLanguages ?? card.requiredLanguages,
    interviewSlots: patch.interviewSlots ?? card.interviewSlots,
    extras: { ...card.extras, ...(patch.extras ?? {}) },
  };
}

function pushChat(
  chat: ChatMessage[],
  role: "user" | "assistant",
  content: string,
): ChatMessage[] {
  return [
    ...chat,
    {
      id: randomUUID(),
      role,
      content,
      createdAt: new Date().toISOString(),
    },
  ];
}

function recordAiUsage(
  store: StoreData,
  type: AiUsageRecord["type"],
  usage?: AiTokenUsage,
): StoreData {
  if (!usage) return store;
  const record = createAiUsageRecord({
    id: randomUUID(),
    type,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    createdAt: new Date().toISOString(),
  });
  const nextUsage = [...(store.aiUsage ?? []), record].slice(-200);
  return { ...store, aiUsage: nextUsage };
}

export type ChatTurnResult = {
  store: StoreData;
  reply: string;
  provider: string;
  card: CandidateCard | JobCard;
  chat: ChatMessage[];
  pendingQuestions: { id: string; question: string }[];
  jobId?: string;
};

/**
 * Gather the inputs an AI turn needs (card, recent chat, pending questions,
 * system prompt) without calling the model. Lets the streaming route drive the
 * reply stream + structured extraction separately from persistence.
 */
export function prepareEmployeeTurn(
  store: StoreData,
  userId: string,
): { card: CandidateCard; chat: ChatMessage[]; pendingQuestions: FieldQuestion[]; systemPrompt: string } {
  const emp = store.employees.find((e) => e.userId === userId);
  if (!emp) throw new NotFoundError("Employee");
  const pendingQuestions = unansweredQuestionsForCandidate(
    emp.card,
    store.fieldQuestions,
    store.fieldAnswers,
    userId,
  );
  const prompts = resolveAdminSettings(store.adminSettings);
  return {
    card: emp.card,
    chat: emp.chat,
    pendingQuestions,
    systemPrompt: prompts.candidatePrompt,
  };
}

export function prepareEmployerTurn(
  store: StoreData,
  userId: string,
  jobId?: string,
): { card: JobCard; chat: ChatMessage[]; systemPrompt: string; jobId: string } {
  const raw = store.employers.find((e) => e.userId === userId);
  if (!raw) throw new NotFoundError("Employer");
  let employer = normalizeEmployerRecord(raw);
  if (jobId) employer = withActiveJob(employer, jobId);
  const active = getActiveJob(employer);
  const prompts = resolveAdminSettings(store.adminSettings);
  return {
    card: active.card,
    chat: active.chat,
    systemPrompt: prompts.employerPrompt,
    jobId: active.id,
  };
}

/**
 * Apply a completed reply + structured patch to the store (pure). Used by both
 * the streaming route (after the reply has streamed) and the non-streaming
 * `handleEmployeeChat` convenience wrapper below.
 */
export function applyEmployeeTurn(params: {
  store: StoreData;
  userId: string;
  message: string;
  reply: string;
  candidatePatch?: CandidatePatch;
  fieldAnswers?: { questionId: string; answer: string }[];
  usage?: AiTokenUsage;
  provider: string;
}): ChatTurnResult {
  const { store, userId, message, reply } = params;
  const emp = store.employees.find((e) => e.userId === userId);
  if (!emp) throw new NotFoundError("Employee");

  let card = applyCandidatePatch(emp.card, params.candidatePatch);
  let answers = store.fieldAnswers;
  let pendingIds = emp.pendingFieldQuestionIds;

  for (const fa of params.fieldAnswers ?? []) {
    const q = store.fieldQuestions.find((x) => x.id === fa.questionId);
    if (!q) continue;
    card = mergeAnswerIntoCard(card, q, fa.answer);
    answers = [
      ...answers.filter(
        (a) => !(a.questionId === fa.questionId && a.candidateId === userId),
      ),
      {
        questionId: fa.questionId,
        candidateId: userId,
        answer: fa.answer,
        answeredAt: new Date().toISOString(),
      },
    ];
    pendingIds = pendingIds.filter((id) => id !== fa.questionId);
  }

  let next: StoreData = {
    ...store,
    fieldAnswers: answers,
    employees: store.employees.map((e) =>
      e.userId === userId
        ? {
            ...e,
            card,
            pendingFieldQuestionIds: pendingIds,
            chat: pushChat(pushChat(e.chat, "user", message), "assistant", reply),
          }
        : e,
    ),
  };
  next = recordAiUsage(next, "employee_intake", params.usage);
  const empNext = next.employees.find((e) => e.userId === userId)!;
  const pendingOut = next.fieldQuestions.filter((q) =>
    empNext.pendingFieldQuestionIds.includes(q.id),
  );
  return {
    store: next,
    reply,
    provider: params.provider,
    card: empNext.card,
    chat: empNext.chat,
    pendingQuestions: pendingOut.map((q) => ({ id: q.id, question: q.question })),
  };
}

export function applyEmployerTurn(params: {
  store: StoreData;
  userId: string;
  message: string;
  reply: string;
  jobPatch?: JobPatch;
  usage?: AiTokenUsage;
  provider: string;
  jobId?: string;
}): ChatTurnResult {
  const { store, userId, message, reply } = params;
  const raw = store.employers.find((e) => e.userId === userId);
  if (!raw) throw new NotFoundError("Employer");

  let employer = normalizeEmployerRecord(raw);
  if (params.jobId) employer = withActiveJob(employer, params.jobId);
  const active = getActiveJob(employer);

  const card = applyJobPatch(active.card, params.jobPatch);
  const chat = pushChat(pushChat(active.chat, "user", message), "assistant", reply);
  const updated = updateJobSlot(employer, active.id, { card, chat });
  const mirrored = withActiveJob(updated, active.id);

  let next: StoreData = {
    ...store,
    employers: store.employers.map((e) => (e.userId === userId ? mirrored : e)),
  };
  next = recordAiUsage(next, "employer_intake", params.usage);
  return {
    store: next,
    reply,
    provider: params.provider,
    card,
    chat,
    pendingQuestions: [],
    jobId: active.id,
  };
}

/** Non-streaming full turn — kept for callers/tests that want one call. */
export async function handleEmployeeChat(
  store: StoreData,
  userId: string,
  message: string,
): Promise<ChatTurnResult> {
  const prep = prepareEmployeeTurn(store, userId);
  const intake = await runEmployeeIntake({
    message,
    card: prep.card,
    chat: prep.chat,
    pendingQuestions: prep.pendingQuestions,
    systemPrompt: prep.systemPrompt,
  });
  return applyEmployeeTurn({
    store,
    userId,
    message,
    reply: intake.reply,
    candidatePatch: intake.candidatePatch,
    fieldAnswers: intake.fieldAnswers,
    usage: intake.usage,
    provider: intake.provider,
  });
}

export async function handleEmployerChat(
  store: StoreData,
  userId: string,
  message: string,
  jobId?: string,
): Promise<ChatTurnResult> {
  const prep = prepareEmployerTurn(store, userId, jobId);
  const intake = await runEmployerIntake({
    message,
    card: prep.card,
    chat: prep.chat,
    systemPrompt: prep.systemPrompt,
  });
  return applyEmployerTurn({
    store,
    userId,
    message,
    reply: intake.reply,
    jobPatch: intake.jobPatch,
    usage: intake.usage,
    provider: intake.provider,
    jobId: prep.jobId,
  });
}

/** Apply a CV extraction to the candidate card and capture the raw text in the narrative. */
export function applyCvExtraction(
  store: StoreData,
  userId: string,
  patch: CandidatePatch,
  sourceText: string,
): { store: StoreData; card: CandidateCard } {
  const emp = store.employees.find((e) => e.userId === userId);
  if (!emp) throw new NotFoundError("Employee");

  const patched = applyCandidatePatch(emp.card, patch);
  const snippet = sourceText.trim().slice(0, 3000);
  const narrative = [patched.narrative, snippet ? `קורות חיים שהועלו:\n${snippet}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const card: CandidateCard = { ...patched, narrative };

  return {
    store: {
      ...store,
      employees: store.employees.map((e) => (e.userId === userId ? { ...e, card } : e)),
    },
    card,
  };
}

/** Apply a job-description extraction to the active job slot's card. */
export function applyJobDescriptionExtraction(
  store: StoreData,
  userId: string,
  patch: JobPatch,
  sourceText: string,
  jobId?: string,
): { store: StoreData; card: JobCard; jobId: string } {
  const raw = store.employers.find((e) => e.userId === userId);
  if (!raw) throw new NotFoundError("Employer");

  let employer = normalizeEmployerRecord(raw);
  if (jobId) employer = withActiveJob(employer, jobId);
  const active = getActiveJob(employer);

  const patched = applyJobPatch(active.card, patch);
  const snippet = sourceText.trim().slice(0, 3000);
  const narrative = [patched.narrative, snippet ? `תיאור משרה שהועלה:\n${snippet}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const card: JobCard = { ...patched, narrative };

  const updated = updateJobSlot(employer, active.id, { card });
  const mirrored = withActiveJob(updated, active.id);

  return {
    store: {
      ...store,
      employers: store.employers.map((e) => (e.userId === userId ? mirrored : e)),
    },
    card,
    jobId: active.id,
  };
}

export function resetChat(
  store: StoreData,
  userId: string,
  role: "employee" | "employer",
  jobId?: string,
): StoreData {
  if (role === "employee") {
    return {
      ...store,
      employees: store.employees.map((e) =>
        e.userId === userId ? { ...e, chat: [] } : e,
      ),
    };
  }
  return {
    ...store,
    employers: store.employers.map((e) => {
      if (e.userId !== userId) return e;
      const employer = normalizeEmployerRecord(e);
      const targetId = jobId ?? employer.activeJobId;
      return updateJobSlot(employer, targetId, { chat: [] });
    }),
  };
}
