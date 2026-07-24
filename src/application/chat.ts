import { NotFoundError } from "@/domain/errors";
import {
  getActiveJob,
  normalizeEmployerRecord,
  updateJobSlot,
  withActiveJob,
} from "@/domain/employer-jobs";
import {
  mergeCvIntoEmployee,
  type CvImportSummary,
  type CvPatchInput,
} from "@/domain/cv-merge";
import {
  emptyCvProfile,
  type CandidateCard,
  type CandidateDocument,
  type JobCard,
  type StoreData,
} from "@/domain/types";
import { runEmployeeIntake, runEmployerIntake } from "@/infrastructure/ai/intake";
import type { JobPatch } from "@/infrastructure/ai/schemas";
import {
  applyEmployeeTurn,
  applyEmployerTurn,
  applyJobPatch,
  prepareEmployeeTurn,
  prepareEmployerTurn,
  type ChatTurnResult,
} from "./chat-turn";

export type { ChatTurnResult } from "./chat-turn";
export {
  applyEmployeeTurn,
  applyEmployerTurn,
  prepareEmployeeTurn,
  prepareEmployerTurn,
} from "./chat-turn";

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
    pendingConflicts: prep.pendingConflicts,
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
    aiDegraded: intake.degraded,
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
    aiDegraded: intake.degraded,
    jobId: prep.jobId,
  });
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
        e.userId === userId ? { ...e, chat: [], cv: emptyCvProfile() } : e,
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
