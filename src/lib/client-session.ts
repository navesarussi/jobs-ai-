import type { Role } from "@/domain/types";

export const USER_STORAGE_KEY = "shidukh_user";
export const ROLE_DEFAULT_KEY = "shidukh_role_default";
export const DEVICE_ID_KEY = "shidukh_device_id";
export const SKIP_AUTO_LOGIN_KEY = "shidukh_skip_auto_login";

export function readStoredUser(): {
  id: string;
  name: string;
  role: Role;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as { id: string; name: string; role: Role };
    if (user.role !== "employee" && user.role !== "employer") return null;
    return user;
  } catch {
    return null;
  }
}

export function writeStoredUser(user: { id: string; name: string; role: Role }): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function markSkipAutoLogin(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SKIP_AUTO_LOGIN_KEY, "1");
}

export function consumeSkipAutoLogin(): boolean {
  if (typeof window === "undefined") return false;
  const skip = sessionStorage.getItem(SKIP_AUTO_LOGIN_KEY) === "1";
  if (skip) sessionStorage.removeItem(SKIP_AUTO_LOGIN_KEY);
  return skip;
}

/** Clears persisted session so the user can pick a different account on next sign-in. */
export function clearSessionOnLogout(): void {
  clearStoredUser();
  writeRoleDefault(null);
  markSkipAutoLogin();
}

export function readRoleDefault(): Role | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ROLE_DEFAULT_KEY);
  return v === "employee" || v === "employer" ? v : null;
}

export function writeRoleDefault(role: Role | null): void {
  if (!role) localStorage.removeItem(ROLE_DEFAULT_KEY);
  else localStorage.setItem(ROLE_DEFAULT_KEY, role);
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}`;
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function roleHomePath(role: Role): string {
  return role === "employee" ? "/employee" : "/employer";
}

export function roleLandingPath(role: Role): string {
  return role === "employee" ? "/" : "/for-employers";
}

export async function startRoleSession(role: Role): Promise<{
  id: string;
  name: string;
  role: Role;
}> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, deviceId: getOrCreateDeviceId() }),
  });
  const data = (await res.json()) as {
    error?: string;
    user?: { id: string; name: string; role: Role };
  };
  if (!res.ok || data.error || !data.user) {
    throw new Error(data.error ?? "Session failed");
  }
  writeStoredUser(data.user);
  writeRoleDefault(role);
  return data.user;
}

export function adminHomePath(): string {
  return "/admin";
}
