import type { Match, StoreData } from "@/domain/types";
import {
  readNormalizedStore,
  replaceMatches,
  writeNormalizedStore,
} from "./db/normalized-store";

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

export async function updateStore(
  updater: (store: StoreData) => StoreData,
): Promise<StoreData> {
  const current = await readStore();
  const next = updater(current);
  await writeStore(next);
  return next;
}
