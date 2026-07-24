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
  formatOpenReliabilityNotesForPrompt,
  formatPendingConflictsForPrompt,
  formatPendingInferencesForPrompt,
  mergeCvIntoEmployee,
  openChatConflictOnCard,
  resolveConflictsFromPatch,
  resolvePendingInferencesFromPatch,
  type CvImportSummary,
  type CvPatchInput,
} from "@/domain/cv-merge";
import type {
  AiUsageRecord,
  CandidateCard,
  CandidateCvProfile,
  CandidateDocument,
  ChatMessage,
  FieldAnswer,
  JobCard,
  StoreData,
} from "@/domain/types";
import { emptyCvProfile } from "@/domain/types";
import { runEmployeeIntake, runEmployerIntake } from "@/infrastructure/ai/intake";
import { resolveAdminSettings } from "@/infrastructure/ai/prompts";
import type { AiTokenUsage, CandidatePatch, JobPatch } from "@/infrastructure/ai/schemas";

function isEmptyCardValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return false;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function norm(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  return String(v).trim();
}

function ensureCv(cv?: CandidateCvProfile): CandidateCvProfile {
  const base = emptyCvProfile();
  if (!cv) return base;
  return {
    ...base,
    ...cv,
    workHistory: cv.workHistory ?? [],
    educationHistory: cv.educationHistory ?? [],
    unmappedFacts: cv.unmappedFacts ?? [],
    fieldEvidence: cv.fieldEvidence ?? [],
    conflicts: cv.conflicts ?? [],
    documents: cv.documents ?? [],
    pendingInferences: cv.pendingInferences ?? [],
    reliability: cv.reliability ?? base.reliability,
  };
}

/** Fill empty / same values; open chat_internal conflict on differing non-empty values. */
function applyCandidatePatchSafely(
  card: CandidateCard,
  cv: CandidateCvProfile | undefined,
  patch?: CandidatePatch,
  now = new Date().toISOString(),
): { card: CandidateCard; cv: CandidateCvProfile | undefined } {
  if (!patch) return { card, cv: cv ? ensureCv(cv) : cv };
  let nextCard = {
    ...card,
    workHistory: card.workHistory ?? [],
    educationHistory: card.educationHistory ?? [],
  };
  let nextCv = cv ? ensureCv(cv) : undefined;
  const skip = new Set(["flexibility", "workHistory", "educationHistory"]);

  for (const [key, raw] of Object.entries(patch)) {
    if (raw === undefined || skip.has(key)) continue;
    if (key === "skills" || key === "softSkills" || key === "languages") {
      const incoming = raw as string[];
      if (!incoming?.length) continue;
      const prev = (nextCard[key as "skills"] as string[]) ?? [];
      const seen = new Set(prev.map((s) => s.toLowerCase()));
      const merged = [...prev];
      for (const item of incoming) {
        if (!item.trim() || seen.has(item.toLowerCase())) continue;
        seen.add(item.toLowerCase());
        merged.push(item);
      }
      nextCard = { ...nextCard, [key]: merged };
      continue;
    }
    if (key === "extras" && raw && typeof raw === "object") {
      nextCard = {
        ...nextCard,
        extras: { ...nextCard.extras, ...(raw as Record<string, string>) },
      };
      continue;
    }
    const prevVal = (nextCard as Record<string, unknown>)[key];
    if (isEmptyCardValue(prevVal)) {
      nextCard = { ...nextCard, [key]: raw } as CandidateCard;
      continue;
    }
    if (norm(prevVal) === norm(raw)) continue;
    nextCv = openChatConflictOnCard(
      nextCv ?? emptyCvProfile(),
      key,
      norm(prevVal),
      norm(raw),
      now,
    );
  }

  return { card: nextCard, cv: nextCv };
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
  /** Deltas for scoped persistence (avoid whole-DB rewrite). */
  newMessages: ChatMessage[];
  newFieldAnswers: FieldAnswer[];
  usageRecord?: AiUsageRecord;
  cv?: CandidateCvProfile;
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
    pendingConflicts: formatPendingConflictsForPrompt(emp.cv),
    pendingInferences: formatPendingInferencesForPrompt(emp.cv),
    openReliabilityNotes: formatOpenReliabilityNotesForPrompt(emp.cv),
  });

  // Resolve pre-existing conflicts / inferences before opening new ones
  let cv =
    resolvePendingInferencesFromPatch(
      resolveConflictsFromPatch(emp.cv, intake.candidatePatch ?? {}),
      intake.candidatePatch ?? {},
    ) ?? emp.cv;

  let card = { ...emp.card };
  for (const c of cv?.conflicts ?? []) {
    if (c.status === "resolved" && c.resolvedValue) {
      const wasPending = emp.cv?.conflicts.some(
        (x) => x.id === c.id && x.status === "pending",
      );
      if (wasPending) {
        card = { ...card, [c.fieldKey]: c.resolvedValue } as CandidateCard;
      }
    }
  }
  for (const p of cv?.pendingInferences ?? []) {
    if (p.status === "accepted") {
      const wasPending = emp.cv?.pendingInferences.some(
        (x) => x.id === p.id && x.status === "pending",
      );
      if (wasPending && isEmptyCardValue((card as Record<string, unknown>)[p.fieldKey])) {
        card = { ...card, [p.fieldKey]: p.value } as CandidateCard;
      }
    }
  }

  const applied = applyCandidatePatchSafely(card, cv, intake.candidatePatch);
  card = applied.card;
  cv = applied.cv;

  let answers = store.fieldAnswers;
  let pendingIds = emp.pendingFieldQuestionIds;
  const newFieldAnswers: FieldAnswer[] = [];

  for (const fa of intake.fieldAnswers ?? []) {
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

  const newMessages = [makeMessage("user", message), makeMessage("assistant", intake.reply)];
  const usageRecord = buildUsageRecord("employee_intake", intake.usage);

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
    reply: intake.reply,
    provider: intake.provider,
    aiDegraded: intake.degraded,
    card: empNext.card,
    chat: empNext.chat,
    pendingQuestions: pendingOut.map((q) => ({ id: q.id, question: q.question })),
    newMessages,
    newFieldAnswers,
    usageRecord,
    cv,
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
  const newMessages = [makeMessage("user", message), makeMessage("assistant", intake.reply)];
  const chat = [...active.chat, ...newMessages];
  const updated = updateJobSlot(employer, active.id, { card, chat });
  const mirrored = withActiveJob(updated, active.id);
  const usageRecord = buildUsageRecord("employer_intake", intake.usage);

  const next: StoreData = {
    ...store,
    aiUsage: usageRecord
      ? [...(store.aiUsage ?? []), usageRecord].slice(-200)
      : store.aiUsage,
    employers: store.employers.map((e) => (e.userId === userId ? mirrored : e)),
  };
  return {
    store: next,
    reply: intake.reply,
    provider: intake.provider,
    aiDegraded: intake.degraded,
    card,
    chat,
    pendingQuestions: [],
    jobId: active.id,
    newMessages,
    newFieldAnswers: [],
    usageRecord,
  };
}

/** Apply a deep CV extraction: merge into card + provenance; keep raw text on the document. */
export function applyCvExtraction(
  store: StoreData,
  userId: string,
  extraction: CvPatchInput,
  document: CandidateDocument,
): { store: StoreData; card: CandidateCard; summary: CvImportSummary } {
  const emp = store.employees.find((e) => e.userId === userId);
  if (!emp) throw new NotFoundError("Employee");

  const { employee, summary } = mergeCvIntoEmployee(emp, extraction, document);

  return {
    store: {
      ...store,
      employees: store.employees.map((e) => (e.userId === userId ? employee : e)),
    },
    card: employee.card,
    summary,
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
