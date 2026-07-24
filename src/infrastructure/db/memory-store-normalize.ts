import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import type { StoreData } from "@/domain/types";
import { normalizeCandidateCard } from "@/domain/types";

export function normalizeStore(raw: StoreData): StoreData {
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
