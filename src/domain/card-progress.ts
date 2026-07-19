import { CANDIDATE_FIELD_META, JOB_FIELD_META } from "@/domain/card-fields";
import type { CandidateCard, JobCard } from "@/domain/types";

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "number") return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function valueOf(card: object, key: string): unknown {
  return (card as Record<string, unknown>)[key];
}

export function formatCardValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return String(value);
  return String(value);
}

export function candidateRows(card: CandidateCard) {
  return CANDIDATE_FIELD_META.map((m) => ({
    key: m.key,
    label: m.label,
    value: formatCardValue(valueOf(card, m.key)),
    filled: !isEmpty(valueOf(card, m.key)),
  }));
}

export function jobRows(card: JobCard) {
  return JOB_FIELD_META.map((m) => ({
    key: m.key,
    label: m.label,
    value: formatCardValue(valueOf(card, m.key)),
    filled: !isEmpty(valueOf(card, m.key)),
  }));
}

export function nextMissingCandidateField(card: CandidateCard) {
  const sorted = [...CANDIDATE_FIELD_META].sort((a, b) => a.priority - b.priority);
  for (const m of sorted) {
    if (m.key === "summary" || m.key === "flexibility" || m.key === "narrative") {
      continue;
    }
    if (isEmpty(valueOf(card, m.key))) return m;
  }
  if (card.flexibility === 5) {
    return CANDIDATE_FIELD_META.find((m) => m.key === "flexibility")!;
  }
  return null;
}

export function nextMissingJobField(card: JobCard) {
  const sorted = [...JOB_FIELD_META].sort((a, b) => a.priority - b.priority);
  for (const m of sorted) {
    if (m.key === "summary" || m.key === "narrative") continue;
    if (isEmpty(valueOf(card, m.key))) return m;
  }
  return null;
}

export function filledCount(rows: { filled: boolean }[]): number {
  return rows.filter((r) => r.filled).length;
}
