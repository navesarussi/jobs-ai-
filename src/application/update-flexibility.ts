import { NotFoundError } from "@/domain/errors";
import {
  normalizeEmployerRecord,
  updateJobSlot,
  withActiveJob,
} from "@/domain/employer-jobs";
import type { CandidateCard, JobCard, JobSlot, StoreData } from "@/domain/types";
import { refreshStoreMatches } from "@/application/employer-actions";

function clampFlexibility(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

export type FlexibilityChange = {
  store: StoreData;
  role: "employee" | "employer";
  card: CandidateCard | JobCard;
  jobs?: JobSlot[];
  activeJobId?: string;
};

/**
 * Set flexibility without recomputing matches so the caller can persist one row
 * and defer the (expensive) match rebuild off the response path.
 */
export function applyFlexibility(
  store: StoreData,
  userId: string,
  value: number,
): FlexibilityChange {
  const flex = clampFlexibility(value);
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new NotFoundError("User");

  if (user.role === "employee") {
    const emp = store.employees.find((e) => e.userId === userId);
    if (!emp) throw new NotFoundError("Employee");
    const card: CandidateCard = { ...emp.card, flexibility: flex };
    const next: StoreData = {
      ...store,
      employees: store.employees.map((e) => (e.userId === userId ? { ...e, card } : e)),
    };
    return { store: next, role: "employee", card };
  }

  const raw = store.employers.find((e) => e.userId === userId);
  if (!raw) throw new NotFoundError("Employer");
  const employer = normalizeEmployerRecord(raw);
  const updated = updateJobSlot(employer, employer.activeJobId, {
    card: { ...employer.card, flexibility: flex },
  });
  const mirrored = withActiveJob(updated, employer.activeJobId);
  const next: StoreData = {
    ...store,
    employers: store.employers.map((e) => (e.userId === userId ? mirrored : e)),
  };
  return {
    store: next,
    role: "employer",
    card: mirrored.card,
    jobs: mirrored.jobs,
    activeJobId: mirrored.activeJobId,
  };
}

export function updateFlexibility(
  store: StoreData,
  userId: string,
  value: number,
): StoreData {
  return refreshStoreMatches(applyFlexibility(store, userId, value).store);
}
