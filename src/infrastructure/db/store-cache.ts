import type { StoreData } from "@/domain/types";

/**
 * Per-process store cache. Warm serverless instances reuse the last successful
 * full read until any write invalidates it — avoids reloading every table on
 * consecutive button clicks from the same instance.
 */
let cachedStore: StoreData | null = null;
let normalizedDataPresent = false;

export function getCachedStore(): StoreData | null {
  return cachedStore;
}

export function setCachedStore(store: StoreData): void {
  cachedStore = store;
  normalizedDataPresent = true;
}

export function invalidateStoreCache(): void {
  cachedStore = null;
}

export function isNormalizedDataCached(): boolean {
  return normalizedDataPresent;
}

export function markNormalizedDataPresent(): void {
  normalizedDataPresent = true;
}
