import { randomUUID } from "crypto";
import {
  applyFlexibility,
  computeBaseFit,
  explainMatch,
  shouldQueueForEmployer,
} from "@/domain/matching";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import type { Match, StoreData } from "@/domain/types";

export function rebuildMatches(store: StoreData): Match[] {
  const kept = store.matches.filter((m) => m.status !== "queued");
  const keptKeys = new Set(kept.map((m) => `${m.jobId ?? m.jobOwnerId}:${m.candidateId}`));
  const next: Match[] = kept.map((m) => ({
    ...m,
    jobId: m.jobId || m.jobOwnerId,
  }));

  for (const rawEmployer of store.employers) {
    const employer = normalizeEmployerRecord(rawEmployer);
    for (const job of employer.jobs) {
      if (!job.card.title && !job.card.field) continue;
      for (const employee of store.employees) {
        if (!employee.card.desiredRole && !employee.card.field) continue;
        const key = `${job.id}:${employee.userId}`;
        if (keptKeys.has(key)) continue;

        const base = computeBaseFit(employee.card, job.card);
        const score = applyFlexibility(base, employee.card.flexibility);
        if (!shouldQueueForEmployer(score)) continue;

        next.push({
          id: randomUUID(),
          jobOwnerId: employer.userId,
          jobId: job.id,
          candidateId: employee.userId,
          score,
          reason: explainMatch(employee.card, job.card, score),
          status: "queued",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return next.sort((a, b) => b.score - a.score);
}
