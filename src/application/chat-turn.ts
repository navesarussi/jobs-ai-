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
import {
  formatPendingConflictsForPrompt,
  resolveConflictsFromPatch,
} from "@/domain/cv-merge";
import type {
  AiUsageRecord,
  CandidateCard,
  CandidateCvProfile,
  ChatMessage,
  FieldAnswer,
  FieldQuestion,
  JobCard,
  StoreData,
} from "@/domain/types";
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
    flexibility: card.flexibility,
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

function makeMessage(role: "user" | "assistant", content: string): ChatMessage {
  return {
    id: randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function buildUsageRecord(
  type: AiUsageRecord["type"],
  usage?: AiTokenUsage,
): AiUsageRecord | undefined {
  if (!usage) return undefined;
  return createAiUsageRecord({
    id: randomUUID(),
    type,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    createdAt: new Date().toISOString(),
  });
}

export type ChatTurnResult = {
  store: StoreData;
  reply: string;
  provider: string;
  aiDegraded?: boolean;
  card: CandidateCard | JobCard;
  chat: ChatMessage[];
  pendingQuestions: { id: string; question: string }[];
  jobId?: string;
  newMessages: ChatMessage[];
  newFieldAnswers: FieldAnswer[];
  usageRecord?: AiUsageRecord;
  cv?: CandidateCvProfile;
};

export function prepareEmployeeTurn(
  store: StoreData,
  userId: string,
): {
  card: CandidateCard;
  chat: ChatMessage[];
  pendingQuestions: FieldQuestion[];
  systemPrompt: string;
  pendingConflicts: string;
  cv?: CandidateCvProfile;
} {
  const emp = store.employees.find((e) => e.userId === userId);
  if (!emp) throw new NotFoundError("Employee");
  const prompts = resolveAdminSettings(store.adminSettings);
  return {
    card: emp.card,
    chat: emp.chat,
    pendingQuestions: unansweredQuestionsForCandidate(
      emp.card,
      store.fieldQuestions,
      store.fieldAnswers,
      userId,
    ),
    systemPrompt: prompts.candidatePrompt,
    pendingConflicts: formatPendingConflictsForPrompt(emp.cv),
    cv: emp.cv,
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

export function applyEmployeeTurn(params: {
  store: StoreData;
  userId: string;
  message: string;
  reply: string;
  candidatePatch?: CandidatePatch;
  fieldAnswers?: { questionId: string; answer: string }[];
  usage?: AiTokenUsage;
  provider: string;
  aiDegraded?: boolean;
}): ChatTurnResult {
  const { store, userId, message, reply } = params;
  const emp = store.employees.find((e) => e.userId === userId);
  if (!emp) throw new NotFoundError("Employee");

  let card = applyCandidatePatch(emp.card, params.candidatePatch);
  const cv = resolveConflictsFromPatch(emp.cv, params.candidatePatch ?? {});
  let answers = store.fieldAnswers;
  let pendingIds = emp.pendingFieldQuestionIds;
  const newFieldAnswers: FieldAnswer[] = [];

  for (const fa of params.fieldAnswers ?? []) {
    const q = store.fieldQuestions.find((x) => x.id === fa.questionId);
    if (!q) continue;
    card = mergeAnswerIntoCard(card, q, fa.answer);
    const answer: FieldAnswer = {
      questionId: fa.questionId,
      candidateId: userId,
      answer: fa.answer,
      answeredAt: new Date().toISOString(),
    };
    answers = [
      ...answers.filter(
        (a) => !(a.questionId === fa.questionId && a.candidateId === userId),
      ),
      answer,
    ];
    newFieldAnswers.push(answer);
    pendingIds = pendingIds.filter((id) => id !== fa.questionId);
  }

  const newMessages = [makeMessage("user", message), makeMessage("assistant", reply)];
  const usageRecord = buildUsageRecord("employee_intake", params.usage);
  const next: StoreData = {
    ...store,
    fieldAnswers: answers,
    aiUsage: usageRecord
      ? [...(store.aiUsage ?? []), usageRecord].slice(-200)
      : store.aiUsage,
    employees: store.employees.map((e) =>
      e.userId === userId
        ? {
            ...e,
            card,
            cv,
            pendingFieldQuestionIds: pendingIds,
            chat: [...e.chat, ...newMessages],
          }
        : e,
    ),
  };
  const empNext = next.employees.find((e) => e.userId === userId)!;
  const pendingOut = next.fieldQuestions.filter((q) =>
    empNext.pendingFieldQuestionIds.includes(q.id),
  );
  return {
    store: next,
    reply,
    provider: params.provider,
    aiDegraded: params.aiDegraded,
    card: empNext.card,
    chat: empNext.chat,
    pendingQuestions: pendingOut.map((q) => ({ id: q.id, question: q.question })),
    newMessages,
    newFieldAnswers,
    usageRecord,
    cv,
  };
}

/** Append an assistant reply when the triggering user message is already in chat. */
export function appendAssistantReply(params: {
  store: StoreData;
  userId: string;
  reply: string;
  usage?: AiTokenUsage;
  provider: string;
  aiDegraded?: boolean;
}): ChatTurnResult {
  const { store, userId, reply } = params;
  const emp = store.employees.find((e) => e.userId === userId);
  if (!emp) throw new NotFoundError("Employee");

  const assistantMsg = makeMessage("assistant", reply);
  const usageRecord = buildUsageRecord("employee_intake", params.usage);
  const next: StoreData = {
    ...store,
    aiUsage: usageRecord
      ? [...(store.aiUsage ?? []), usageRecord].slice(-200)
      : store.aiUsage,
    employees: store.employees.map((e) =>
      e.userId === userId ? { ...e, chat: [...e.chat, assistantMsg] } : e,
    ),
  };
  const empNext = next.employees.find((e) => e.userId === userId)!;
  const pendingOut = next.fieldQuestions.filter((q) =>
    empNext.pendingFieldQuestionIds.includes(q.id),
  );
  return {
    store: next,
    reply,
    provider: params.provider,
    aiDegraded: params.aiDegraded,
    card: empNext.card,
    chat: empNext.chat,
    pendingQuestions: pendingOut.map((q) => ({ id: q.id, question: q.question })),
    newMessages: [assistantMsg],
    newFieldAnswers: [],
    usageRecord,
    cv: empNext.cv,
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
  aiDegraded?: boolean;
  jobId?: string;
}): ChatTurnResult {
  const { store, userId, message, reply } = params;
  const raw = store.employers.find((e) => e.userId === userId);
  if (!raw) throw new NotFoundError("Employer");

  let employer = normalizeEmployerRecord(raw);
  if (params.jobId) employer = withActiveJob(employer, params.jobId);
  const active = getActiveJob(employer);

  const card = applyJobPatch(active.card, params.jobPatch);
  const newMessages = [makeMessage("user", message), makeMessage("assistant", reply)];
  const chat = [...active.chat, ...newMessages];
  const updated = updateJobSlot(employer, active.id, { card, chat });
  const mirrored = withActiveJob(updated, active.id);
  const usageRecord = buildUsageRecord("employer_intake", params.usage);

  const next: StoreData = {
    ...store,
    aiUsage: usageRecord
      ? [...(store.aiUsage ?? []), usageRecord].slice(-200)
      : store.aiUsage,
    employers: store.employers.map((e) => (e.userId === userId ? mirrored : e)),
  };
  return {
    store: next,
    reply,
    provider: params.provider,
    aiDegraded: params.aiDegraded,
    card,
    chat,
    pendingQuestions: [],
    jobId: active.id,
    newMessages,
    newFieldAnswers: [],
    usageRecord,
  };
}

export { applyCandidatePatch, applyJobPatch };
