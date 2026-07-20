import type { Role } from "@/domain/types";

export const USER_STORAGE_KEY = "shidukh_user";
export const ROLE_DEFAULT_KEY = "shidukh_role_default";
export const DEVICE_ID_KEY = "shidukh_device_id";

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
