import { randomUUID } from "crypto";
import { NotFoundError, ValidationError } from "@/domain/errors";
import { getActiveJob, normalizeEmployerRecord } from "@/domain/employer-jobs";
import { normalizeField } from "@/domain/field-questions";
import type { FieldQuestion, Match, StoreData } from "@/domain/types";
import { rebuildMatches } from "./rebuild-matches";

export function approveMatch(store: StoreData, matchId: string): StoreData {
  const match = store.matches.find((m) => m.id === matchId);
  if (!match) throw new NotFoundError("Match");
  const matches = store.matches.map((m) =>
    m.id === matchId
      ? { ...m, status: "approved" as const, updatedAt: new Date().toISOString() }
      : m,
  );
  return { ...store, matches };
}

export function rejectMatch(store: StoreData, matchId: string): StoreData {
  const match = store.matches.find((m) => m.id === matchId);
  if (!match) throw new NotFoundError("Match");
  const matches = store.matches.map((m) =>
    m.id === matchId
      ? { ...m, status: "rejected" as const, updatedAt: new Date().toISOString() }
      : m,
  );
  return { ...store, matches };
}

export function askFieldQuestion(
  store: StoreData,
  params: {
    employerId: string;
    matchId: string;
    question: string;
    jobId?: string;
  },
): StoreData {
  const q = params.question.trim();
  if (q.length < 3) throw new ValidationError("השאלה קצרה מדי");

  const match = store.matches.find((m) => m.id === params.matchId);
  if (!match || match.jobOwnerId !== params.employerId) {
    throw new NotFoundError("Match");
  }

  const raw = store.employers.find((e) => e.userId === params.employerId);
  if (!raw) throw new NotFoundError("Employer");
  const employer = normalizeEmployerRecord(raw);
  const job =
    employer.jobs.find((j) => j.id === (params.jobId ?? match.jobId ?? employer.activeJobId)) ??
    getActiveJob(employer);

  const field = job.card.field.trim();
  if (!field) throw new ValidationError("יש להגדיר תחום במשרה לפני שאלות כלליות");

  const existing = store.fieldQuestions.find(
    (fq) =>
      normalizeField(fq.field) === normalizeField(field) &&
      fq.question.trim() === q,
  );
  if (existing) return store;

  const question: FieldQuestion = {
    id: randomUUID(),
    field,
    question: q,
    sourceJobId: job.id,
    sourceEmployerId: params.employerId,
    createdAt: new Date().toISOString(),
  };

  const employees = store.employees.map((emp) => {
    if (normalizeField(emp.card.field) !== normalizeField(field)) return emp;
    if (emp.pendingFieldQuestionIds.includes(question.id)) return emp;
    return {
      ...emp,
      pendingFieldQuestionIds: [...emp.pendingFieldQuestionIds, question.id],
    };
  });

  return {
    ...store,
    fieldQuestions: [...store.fieldQuestions, question],
    employees,
  };
}

export function refreshStoreMatches(store: StoreData): StoreData {
  return { ...store, matches: rebuildMatches(store) as Match[] };
}
