import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import type { Role, StoreData, User } from "@/domain/types";
import { emptyCandidateCard, emptyJobCard } from "@/domain/types";
import { normalizeStore } from "./memory-store-normalize";

let memoryStore: StoreData | null = null;

export function shouldUseMemoryStore(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.DATABASE_URL?.trim();
}

export function createSeedStore(): StoreData {
  const now = new Date().toISOString();
  const empId = "demo-employee";
  const bossId = "demo-employer";
  return normalizeStore({
    users: [
      {
        id: empId,
        name: "נועה (דמו עובדת)",
        role: "employee",
        email: "demo-employee@local.dev",
        createdAt: now,
      },
      {
        id: bossId,
        name: "דני (דמו מעסיק)",
        role: "employer",
        email: "demo-employer@local.dev",
        createdAt: now,
      },
    ],
    employees: [
      { userId: empId, card: emptyCandidateCard(), chat: [], pendingFieldQuestionIds: [] },
    ],
    employers: [
      normalizeEmployerRecord({
        userId: bossId,
        card: emptyJobCard(),
        chat: [],
        jobs: [],
        activeJobId: "",
      }),
    ],
    fieldQuestions: [],
    fieldAnswers: [],
    matches: [],
  });
}

function store(): StoreData {
  if (!memoryStore) memoryStore = createSeedStore();
  return memoryStore;
}

export function readMemoryStore(): StoreData {
  return store();
}

export function writeMemoryStore(next: StoreData): void {
  memoryStore = normalizeStore(next);
}

export function resetMemoryStore(): void {
  memoryStore = createSeedStore();
}

export function findMemoryUserByEmailOrGoogle(
  email: string,
  googleId?: string,
): User | null {
  const hit = store().users.find(
    (u) => u.email === email || (googleId && u.googleId === googleId),
  );
  return hit ?? null;
}

export function upsertMemorySessionRole(user: User, role: Role): User {
  const nextUser = { ...user, role };
  const data = store();
  const users = data.users.filter((u) => u.id !== user.id);
  users.push(nextUser);
  data.users = users;

  if (role === "employee") {
    if (!data.employees.some((e) => e.userId === user.id)) {
      data.employees.push({
        userId: user.id,
        card: emptyCandidateCard(),
        chat: [],
        pendingFieldQuestionIds: [],
      });
    }
  } else if (!data.employers.some((e) => e.userId === user.id)) {
    data.employers.push(
      normalizeEmployerRecord({
        userId: user.id,
        card: emptyJobCard(),
        chat: [],
        jobs: [],
        activeJobId: "",
      }),
    );
  }

  memoryStore = data;
  return nextUser;
}
