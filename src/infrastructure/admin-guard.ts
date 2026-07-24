import { auth } from "@/auth";
import { isAdminEmail } from "@/infrastructure/admin-config";
import {
  devSessionIsAdmin,
  getDevSession,
  isDevAuthEnabled,
} from "@/infrastructure/dev-auth";

export async function assertAdmin(): Promise<
  { ok: true; email: string } | { ok: false; status: number; error: string }
> {
  const dev = await getDevSession();
  if (dev && devSessionIsAdmin(dev)) {
    return { ok: true, email: dev.email };
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, status: 401, error: "נדרשת התחברות עם Google" };
  }
  if (!isAdminEmail(email)) {
    return { ok: false, status: 403, error: "אין הרשאת מנהל" };
  }
  return { ok: true, email };
}
