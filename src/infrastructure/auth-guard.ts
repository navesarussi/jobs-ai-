import { auth } from "@/auth";
import { getMessages } from "@/i18n";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/types";
import type { StoreData } from "@/domain/types";
import { allowOpenAuth } from "@/infrastructure/auth-flags";
import { readStore } from "@/infrastructure/store";

export function allowDemo(): boolean {
  return process.env.ALLOW_DEMO === "true";
}

export function isDemoUserId(userId: string): boolean {
  return userId === "demo-employee" || userId === "demo-employer";
}

export async function assertActor(
  userId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<
  { ok: true; store: StoreData } | { ok: false; status: number; error: string }
> {
  const api = getMessages(locale).api;
  const store = await readStore();

  if (allowDemo() && isDemoUserId(userId)) {
    return { ok: true, store };
  }

  // Soft-open mode for chat development (Google OAuth temporarily inactive).
  if (allowOpenAuth()) {
    const user = store.users.find((u) => u.id === userId);
    if (!user) return { ok: false, status: 404, error: api.userNotFound };
    return { ok: true, store };
  }

  const session = await auth();
  const email = session?.user?.email;
  const googleId = session?.user?.googleId ?? session?.user?.id;
  if (!email && !googleId) return { ok: false, status: 401, error: api.googleRequired };

  const user = store.users.find((u) => u.id === userId);
  if (!user) return { ok: false, status: 404, error: api.userNotFound };
  const emailMatch = email && user.email === email;
  const googleMatch = googleId && user.googleId === googleId;
  if (!emailMatch && !googleMatch) {
    return { ok: false, status: 403, error: api.unauthorized };
  }
  return { ok: true, store };
}
