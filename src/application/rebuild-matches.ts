import { getMessages } from "@/i18n";
import { randomUUID } from "crypto";
import {
  applyFlexibility,
  computeBaseFit,
  explainMatch,
  shouldQueueForEmployer,
} from "@/domain/matching";
import type { Match, StoreData } from "@/domain/types";

/** Rebuild queued matches for all employer/candidate pairs. Keeps approved/rejected. */
export function rebuildMatches(store: StoreData): Match[] {
  const kept = store.matches.filter((m) => m.status !== "queued");
  const keptKeys = new Set(kept.map((m) => `${m.jobOwnerId}:${m.candidateId}`));
  const next: Match[] = [...kept];

  for (const employer of store.employers) {
    if (!employer.card.title && !employer.card.field) continue;
    for (const employee of store.employees) {
      if (!employee.card.desiredRole && !employee.card.field) continue;
      const key = `${employer.userId}:${employee.userId}`;
      if (keptKeys.has(key)) continue;

      const base = computeBaseFit(employee.card, employer.card);
      const score = applyFlexibility(base, employee.card.flexibility);
      if (!shouldQueueForEmployer(score)) continue;

      next.push({
        id: randomUUID(),
        jobOwnerId: employer.userId,
        candidateId: employee.userId,
        score,
        reason: explainMatch(
          employee.card,
          employer.card,
          score,
          getMessages("en").matching,
        ),
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return next.sort((a, b) => b.score - a.score);
}
