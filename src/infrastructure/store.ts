import type { StoreData } from "@/domain/types";
import { readNormalizedStore, writeNormalizedStore } from "./db/normalized-store";

export async function readStore(): Promise<StoreData> {
  return readNormalizedStore();
}

export async function writeStore(store: StoreData): Promise<void> {
  await writeNormalizedStore(store);
}

export async function updateStore(
  updater: (store: StoreData) => StoreData,
): Promise<StoreData> {
  const current = await readStore();
  const next = updater(current);
  await writeStore(next);
  return next;
}
