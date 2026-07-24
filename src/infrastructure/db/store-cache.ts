import type { AdminSettings, FieldQuestion, StoreData } from "@/domain/types";

/**
 * Per-process caches. Warm serverless instances reuse these until any write
 * invalidates — critical under concurrent interactive traffic.
 */
let cachedStore: StoreData | null = null;
let normalizedDataPresent = false;
let fieldQuestionsCache: FieldQuestion[] | null = null;
let adminSettingsCache: AdminSettings | null | undefined;

export function getCachedStore(): StoreData | null {
  return cachedStore;
}

export function setCachedStore(store: StoreData): void {
  cachedStore = store;
  normalizedDataPresent = true;
}

export function getCachedFieldQuestions(): FieldQuestion[] | null {
  return fieldQuestionsCache;
}

export function setCachedFieldQuestions(rows: FieldQuestion[]): void {
  fieldQuestionsCache = rows;
}

export function getCachedAdminSettings(): AdminSettings | null | undefined {
  return adminSettingsCache;
}

export function setCachedAdminSettings(settings: AdminSettings | undefined): void {
  adminSettingsCache = settings ?? null;
}

export function invalidateStoreCache(): void {
  cachedStore = null;
  fieldQuestionsCache = null;
  adminSettingsCache = undefined;
}

export function isNormalizedDataCached(): boolean {
  return normalizedDataPresent;
}

export function markNormalizedDataPresent(): void {
  normalizedDataPresent = true;
}
