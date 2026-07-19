import { auth } from "@/auth";
import { readStore } from "@/infrastructure/store";

export function allowDemo(): boolean {
  return process.env.ALLOW_DEMO === "true";
}

export function isDemoUserId(userId: string): boolean {
  return userId === "demo-employee" || userId === "demo-employer";
}

/** Real users must own the userId via Google session. Demo ids only if ALLOW_DEMO. */
export async function assertActor(userId: string): Promise<
  { ok: true } | { ok: false; status: number; error: string }
> {
  if (allowDemo() && isDemoUserId(userId)) {
    return { ok: true };
  }

  const session = await auth();
  const email = session?.user?.email;
  const googleId = session?.user?.googleId ?? session?.user?.id;
  if (!email && !googleId) {
    return { ok: false, status: 401, error: "נדרשת התחברות עם Google" };
  }

  const store = await readStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) {
    return { ok: false, status: 404, error: "משתמש לא נמצא" };
  }

  const emailMatch = email && user.email === email;
  const googleMatch = googleId && user.googleId === googleId;
  if (!emailMatch && !googleMatch) {
    return { ok: false, status: 403, error: "אין הרשאה למשתמש הזה" };
  }

  return { ok: true };
}
