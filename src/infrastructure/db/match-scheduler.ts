/**
 * Coalesce expensive match rebuilds under bursty concurrent chat traffic.
 * Many turns within the window share one rebuild instead of N full scans.
 */
import { rebuildAndWriteMatches } from "@/infrastructure/store";

declare global {
  // eslint-disable-next-line no-var
  var __shidukhMatchRebuildTimer: ReturnType<typeof setTimeout> | undefined;
  // eslint-disable-next-line no-var
  var __shidukhMatchRebuildRunning: Promise<void> | undefined;
}

const DEBOUNCE_MS = Number(process.env.MATCH_REBUILD_DEBOUNCE_MS ?? 1500);

export function scheduleMatchRebuild(): void {
  if (global.__shidukhMatchRebuildTimer) {
    clearTimeout(global.__shidukhMatchRebuildTimer);
  }
  global.__shidukhMatchRebuildTimer = setTimeout(() => {
    global.__shidukhMatchRebuildTimer = undefined;
    void runMatchRebuild();
  }, Number.isFinite(DEBOUNCE_MS) ? Math.max(250, DEBOUNCE_MS) : 1500);
}

async function runMatchRebuild(): Promise<void> {
  if (global.__shidukhMatchRebuildRunning) {
    await global.__shidukhMatchRebuildRunning;
    scheduleMatchRebuild();
    return;
  }
  global.__shidukhMatchRebuildRunning = rebuildAndWriteMatches()
    .catch((err) => {
      console.error("debounced match refresh failed", err);
    })
    .finally(() => {
      global.__shidukhMatchRebuildRunning = undefined;
    });
  await global.__shidukhMatchRebuildRunning;
}
