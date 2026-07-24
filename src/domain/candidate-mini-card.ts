import { cardValue, formatCardValue } from "@/domain/card-extras";
import type { CandidateCard } from "@/domain/types";

export type MiniCardLine = {
  key: string;
  label: string;
  value: string;
};

const MINI_KEYS = [
  "summary",
  "desiredRole",
  "field",
  "subField",
  "location",
  "experienceYears",
  "experienceLevel",
  "skills",
  "softSkills",
  "languages",
  "education",
  "personality",
  "workStyle",
  "strengths",
  "careerGoals",
] as const;

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "number") return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/** Safe subset for the candidate's own mini preview (not admin/recruiter cards). */
export function candidateMiniCardLines(
  card: CandidateCard,
  labels: Record<string, string>,
): MiniCardLine[] {
  const lines: MiniCardLine[] = [];
  for (const key of MINI_KEYS) {
    const raw = cardValue(card, key);
    if (isEmpty(raw)) continue;
    lines.push({
      key,
      label: labels[key] ?? key,
      value: formatCardValue(raw),
    });
  }
  return lines;
}

export function employeeHasCv(cv?: { documents?: unknown[] }): boolean {
  return (cv?.documents?.length ?? 0) > 0;
}
