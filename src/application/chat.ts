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

export async function handleEmployeeChat(
  store: StoreData,
  userId: string,
  message: string,
): Promise<ChatTurnResult> {
  const emp = store.employees.find((e) => e.userId === userId);
  if (!emp) throw new NotFoundError("Employee");

  const pending = unansweredQuestionsForCandidate(
    emp.card,
    store.fieldQuestions,
    store.fieldAnswers,
    userId,
  );

  const prompts = resolveAdminSettings(store.adminSettings);
  const intake = await runEmployeeIntake({
    message,
    card: emp.card,
    chat: emp.chat,
    pendingQuestions: pending,
    systemPrompt: prompts.candidatePrompt,
  });

  let card = applyCandidatePatch(emp.card, intake.candidatePatch);
  let answers = store.fieldAnswers;
  let pendingIds = emp.pendingFieldQuestionIds;

  for (const fa of intake.fieldAnswers ?? []) {
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
            chat: pushChat(pushChat(e.chat, "user", message), "assistant", intake.reply),
          }
        : e,
    ),
  };
  next = recordAiUsage(next, "employee_intake", intake.usage);
  const empNext = next.employees.find((e) => e.userId === userId)!;
  const pendingOut = next.fieldQuestions.filter((q) =>
    empNext.pendingFieldQuestionIds.includes(q.id),
  );
  return {
    store: next,
    reply: intake.reply,
    provider: intake.provider,
    card: empNext.card,
    chat: empNext.chat,
    pendingQuestions: pendingOut.map((q) => ({ id: q.id, question: q.question })),
  };
}

export async function handleEmployerChat(
  store: StoreData,
  userId: string,
  message: string,
  jobId?: string,
): Promise<ChatTurnResult> {
  const raw = store.employers.find((e) => e.userId === userId);
  if (!raw) throw new NotFoundError("Employer");

  let employer = normalizeEmployerRecord(raw);
  if (jobId) employer = withActiveJob(employer, jobId);
  const active = getActiveJob(employer);

  const prompts = resolveAdminSettings(store.adminSettings);
  const intake = await runEmployerIntake({
    message,
    card: active.card,
    chat: active.chat,
    systemPrompt: prompts.employerPrompt,
  });

  const card = applyJobPatch(active.card, intake.jobPatch);
  const chat = pushChat(pushChat(active.chat, "user", message), "assistant", intake.reply);
  const updated = updateJobSlot(employer, active.id, { card, chat });
  const mirrored = withActiveJob(updated, active.id);

  let next: StoreData = {
    ...store,
    employers: store.employers.map((e) => (e.userId === userId ? mirrored : e)),
  };
  next = recordAiUsage(next, "employer_intake", intake.usage);
  return {
    store: next,
    reply: intake.reply,
    provider: intake.provider,
    card,
    chat,
    pendingQuestions: [],
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
