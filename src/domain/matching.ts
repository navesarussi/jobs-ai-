import type { CandidateCard, JobCard } from "./types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function overlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b.map(normalize));
  const hits = a.filter((item) => setB.has(normalize(item))).length;
  return hits / Math.max(a.length, b.length);
}

function textScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.7;
  const tokensA = na.split(/\s+/);
  const tokensB = new Set(nb.split(/\s+/));
  const hits = tokensA.filter((t) => tokensB.has(t)).length;
  return hits === 0 ? 0 : hits / Math.max(tokensA.length, tokensB.size);
}

/** Base fit 0–1 before flexibility. */
export function computeBaseFit(candidate: CandidateCard, job: JobCard): number {
  const role = textScore(candidate.desiredRole, job.title);
  const field = textScore(candidate.field, job.field);
  const location = textScore(candidate.location, job.location);
  const skills = overlap(candidate.skills, [...job.mustHaves, ...job.niceToHaves]);
  const soft = overlap(candidate.softSkills, job.niceToHaves);
  const languages = overlap(candidate.languages, job.requiredLanguages);
  const personality = textScore(candidate.personality, job.personalityFit);
  const culture = textScore(candidate.workStyle, job.teamCulture);
  const salary =
    textScore(candidate.salaryExpectation, job.salaryRange) ||
    textScore(candidate.salaryMin, job.salaryMin);

  const mustPenalty =
    job.mustHaves.length === 0
      ? 0
      : 1 -
        overlap(
          job.mustHaves,
          candidate.skills.concat(candidate.desiredRole, candidate.licenses),
        );

  const raw =
    role * 0.24 +
    field * 0.18 +
    location * 0.14 +
    skills * 0.14 +
    soft * 0.04 +
    languages * 0.05 +
    personality * 0.08 +
    culture * 0.04 +
    salary * 0.05 -
    mustPenalty * 0.1;

  return Math.max(0, Math.min(1, raw));
}

/**
 * flexibility 10 = strict (needs high base), 1 = very flexible.
 * Returns adjusted score 0–1 for ranking.
 */
export function applyFlexibility(baseFit: number, flexibility: number): number {
  const f = Math.max(1, Math.min(10, flexibility));
  const strictness = (f - 1) / 9;
  const threshold = 0.25 + strictness * 0.45;
  if (baseFit < threshold * 0.5) return baseFit * 0.4;
  if (baseFit < threshold) return baseFit * (0.55 + (1 - strictness) * 0.35);
  return Math.min(1, baseFit + (1 - strictness) * 0.12);
}

export function explainMatch(
  candidate: CandidateCard,
  job: JobCard,
  score: number,
  messages: {
    similarField: string;
    roleMatch: string;
    locationMatch: string;
    skillsOverlap: string;
    flexibility: string;
    score: string;
  },
): string {
  const parts: string[] = [];
  if (textScore(candidate.field, job.field) > 0.4) {
    parts.push(
      messages.similarField
        .replace("{candidate}", candidate.field || "?")
        .replace("{job}", job.field || "?"),
    );
  }
  if (textScore(candidate.desiredRole, job.title) > 0.4) {
    parts.push(messages.roleMatch);
  }
  if (textScore(candidate.location, job.location) > 0.4) {
    parts.push(messages.locationMatch);
  }
  if (overlap(candidate.skills, job.mustHaves) > 0) {
    parts.push(messages.skillsOverlap);
  }
  parts.push(messages.flexibility.replace("{value}", String(candidate.flexibility)));
  parts.push(messages.score.replace("{value}", (score * 100).toFixed(0)));
  return parts.join(" · ");
}

export function shouldQueueForEmployer(score: number): boolean {
  return score >= 0.28;
}
