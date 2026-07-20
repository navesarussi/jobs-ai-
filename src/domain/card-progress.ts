import { cardValue, formatCardValue, mergeCardRows } from "@/domain/card-extras";
import { CANDIDATE_FIELD_META, JOB_FIELD_META } from "@/domain/card-fields";
import type { CandidateCard, JobCard } from "@/domain/types";

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "number") return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

export { formatCardValue };

export function candidateRows(card: CandidateCard, labels: Record<string, string> = {}) {
  const core = CANDIDATE_FIELD_META.map((m) => ({
    key: m.key,
    label: labels[m.key] ?? m.key,
    value: formatCardValue(cardValue(card, m.key)),
    filled: !isEmpty(cardValue(card, m.key)),
  }));
  return mergeCardRows(core, card.extras);
}

export function jobRows(card: JobCard, labels: Record<string, string> = {}) {
  const core = JOB_FIELD_META.map((m) => ({
    key: m.key,
    label: labels[m.key] ?? m.key,
    value: formatCardValue(cardValue(card, m.key)),
    filled: !isEmpty(cardValue(card, m.key)),
  }));
  return mergeCardRows(core, card.extras);
}

export function nextMissingCandidateField(card: CandidateCard) {
  const sorted = [...CANDIDATE_FIELD_META].sort((a, b) => a.priority - b.priority);
  for (const m of sorted) {
    if (m.key === "summary" || m.key === "flexibility" || m.key === "narrative") {
      continue;
    }
    if (isEmpty(cardValue(card, m.key))) return m;
  }
  if (card.flexibility === 5) {
    return CANDIDATE_FIELD_META.find((m) => m.key === "flexibility")!;
  }
  return null;
}

export function nextMissingJobField(card: JobCard) {
  const sorted = [...JOB_FIELD_META].sort((a, b) => a.priority - b.priority);
  for (const m of sorted) {
    if (m.key === "summary" || m.key === "flexibility" || m.key === "narrative") {
      continue;
    }
    if (isEmpty(cardValue(card, m.key))) return m;
  }
  if (card.flexibility === 5) {
    return JOB_FIELD_META.find((m) => m.key === "flexibility")!;
  }
  return null;
}

export function filledCount(rows: { filled: boolean }[]): number {
  return rows.filter((r) => r.filled).length;
}
