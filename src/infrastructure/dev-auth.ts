import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { isAdminEmail } from "@/infrastructure/admin-config";
import { allowOpenAuth, isTestLoginEnabled } from "@/infrastructure/auth-flags";

export const DEV_SESSION_COOKIE = "citov_dev_session";
export const DEV_ADMIN_EMAIL = "dev-admin@local.dev";

export type DevSession = {
  kind: "admin" | "user";
  email: string;
  userId?: string;
};

export function isDevAuthEnabled(): boolean {
  if (isTestLoginEnabled()) return true;
  return process.env.NODE_ENV === "development" && allowOpenAuth();
}

function devSecret(): string {
  return process.env.AUTH_SECRET?.trim() || "citov-local-dev-secret";
}

export function signDevSession(session: DevSession): string {
  const data = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = createHmac("sha256", devSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyDevSession(token: string | undefined | null): DevSession | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", devSecret()).update(data).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as DevSession;
  } catch {
    return null;
  }
}

export async function getDevSession(): Promise<DevSession | null> {
  if (!isDevAuthEnabled()) return null;
  const jar = await cookies();
  return verifyDevSession(jar.get(DEV_SESSION_COOKIE)?.value);
}

export function devSessionIsAdmin(session: DevSession | null): boolean {
  if (!session) return false;
  return session.kind === "admin" || isAdminEmail(session.email);
}

export function devSessionCookieHeader(session: DevSession): string {
  const value = signDevSession(session);
  return `${DEV_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
}

export function clearDevSessionCookieHeader(): string {
  return `${DEV_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
