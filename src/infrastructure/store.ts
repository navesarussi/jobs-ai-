import type { Match, StoreData } from "@/domain/types";
import {
  readNormalizedStore,
  replaceMatches,
  writeNormalizedStore,
} from "./db/normalized-store";
import {
  readActorStore,
  readCandidateQueueStore,
  readCvAccessStore,
  readMatchingStore,
  readOpportunityStore,
} from "./db/slice-store";
import { refreshStoreMatches } from "@/application/employer-actions";

export async function readStore(): Promise<StoreData> {
  return readNormalizedStore();
}

export async function writeStore(store: StoreData): Promise<void> {
  await writeNormalizedStore(store);
}

/** Persist only the matches table (targeted write for the deferred refresh). */
export async function writeMatches(matches: Match[]): Promise<void> {
  await replaceMatches(matches);
}

/**
 * Reload cards+matches from DB and rebuild — used in `after()` so the request
 * path can stay on an actor slice without corrupting the global match set.
 */
export async function rebuildAndWriteMatches(): Promise<void> {
  const snap = await readMatchingStore();
  await writeMatches(refreshStoreMatches(snap).matches);
}

export async function updateStore(
  updater: (store: StoreData) => StoreData,
): Promise<StoreData> {
  const current = await readStore();
  const next = updater(current);
  await writeStore(next);
  return next;
}

export {
  readActorStore,
  readCandidateQueueStore,
  readCvAccessStore,
  readMatchingStore,
  readOpportunityStore,
};
