import { randomUUID } from "crypto";
import type { Role, User } from "@/domain/types";
import { DEV_ADMIN_EMAIL } from "@/infrastructure/dev-auth";
import { createSeedStore } from "@/infrastructure/db/memory-store";

export type DevLoginMode = "admin" | "existing" | "new";

export type DevLoginInput = {
  mode: DevLoginMode;
  role?: Role;
  userId?: string;
  name?: string;
  deviceId?: string;
};

export type DevLoginResult =
  | { kind: "admin"; email: string; redirect: "/admin" }
  | { kind: "user"; user: User; redirect: "/employee" | "/employer" };

const DEMO_USERS = createSeedStore().users;

export function listDevUsers(): { id: string; name: string; role: Role; email?: string }[] {
  return DEMO_USERS.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    email: u.email,
  }));
}

export function resolveDevLogin(input: DevLoginInput, knownUsers: User[] = DEMO_USERS): DevLoginResult {
  const role: Role = input.role === "employer" ? "employer" : "employee";

  if (input.mode === "admin") {
    return { kind: "admin", email: DEV_ADMIN_EMAIL, redirect: "/admin" };
  }

  if (input.mode === "existing") {
    const userId = input.userId?.trim();
    if (!userId) throw new Error("חסר מזהה משתמש");
    const user = knownUsers.find((u) => u.id === userId) ?? DEMO_USERS.find((u) => u.id === userId);
    if (!user) throw new Error("משתמש לא נמצא");
    return {
      kind: "user",
      user,
      redirect: user.role === "employer" ? "/employer" : "/employee",
    };
  }

  const deviceId = input.deviceId?.trim() || randomUUID();
  const now = new Date().toISOString();
  const user: User = {
    id: randomUUID(),
    name: input.name?.trim() || (role === "employee" ? "מועמד/ת חדש/ה" : "מעסיק/ה חדש/ה"),
    role,
    email: `open:${deviceId}@local.dev`,
    googleId: deviceId,
    createdAt: now,
  };
  return {
    kind: "user",
    user,
    redirect: role === "employer" ? "/employer" : "/employee",
  };
}
