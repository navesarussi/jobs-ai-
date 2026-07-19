import { NotFoundError } from "@/domain/errors";
import type { StoreData } from "@/domain/types";
import { refreshStoreMatches } from "@/application/employer-actions";

function clampFlexibility(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

export function updateFlexibility(
  store: StoreData,
  userId: string,
  value: number,
): StoreData {
  const flex = clampFlexibility(value);
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new NotFoundError("User");

  if (user.role === "employee") {
    const emp = store.employees.find((e) => e.userId === userId);
    if (!emp) throw new NotFoundError("Employee");
    const next: StoreData = {
      ...store,
      employees: store.employees.map((e) =>
        e.userId === userId
          ? { ...e, card: { ...e.card, flexibility: flex } }
          : e,
      ),
    };
    return refreshStoreMatches(next);
  }

  const er = store.employers.find((e) => e.userId === userId);
  if (!er) throw new NotFoundError("Employer");
  const next: StoreData = {
    ...store,
    employers: store.employers.map((e) =>
      e.userId === userId ? { ...e, card: { ...e.card, flexibility: flex } } : e,
    ),
  };
  return refreshStoreMatches(next);
}
