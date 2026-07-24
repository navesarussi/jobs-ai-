import type { AiUsageRecord, StoreData } from "./types";

const DEMO_USER_IDS = new Set(["demo-employee", "demo-employer"]);

/** Gemini 2.5 Flash list pricing (USD per token) — POC estimate */
export const GEMINI_FLASH_INPUT_USD = 0.075 / 1_000_000;
export const GEMINI_FLASH_OUTPUT_USD = 0.3 / 1_000_000;

export type AdminStats = {
  employers: number;
  candidates: number;
  matches: {
    total: number;
    queued: number;
    approved: number;
    rejected: number;
  };
  aiUsage: {
    totalCalls: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  users: number;
  reliability: {
    averageScore: number;
    openNotes: number;
    lowScoreCandidates: { userId: string; name: string; score: number; openNotes: number }[];
  };
};

export function isDemoUserId(userId: string): boolean {
  return DEMO_USER_IDS.has(userId);
}

export function estimateAiCostUsd(promptTokens: number, completionTokens: number): number {
  return promptTokens * GEMINI_FLASH_INPUT_USD + completionTokens * GEMINI_FLASH_OUTPUT_USD;
}

export function renderPromptTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function computeAdminStats(store: StoreData): AdminStats {
  const realEmployees = store.employees.filter((e) => !isDemoUserId(e.userId));
  const realEmployers = store.employers.filter((e) => !isDemoUserId(e.userId));
  const realUsers = store.users.filter((u) => !isDemoUserId(u.id));
  const usage = store.aiUsage ?? [];

  const reliabilityRows = realEmployees.map((e) => {
    const score = e.cv?.reliability?.score ?? 100;
    const openNotes = (e.cv?.reliability?.notes ?? []).filter((n) => n.status === "open").length;
    const name = store.users.find((u) => u.id === e.userId)?.name ?? e.userId;
    return { userId: e.userId, name, score, openNotes };
  });
  const averageScore =
    reliabilityRows.length === 0
      ? 100
      : Math.round(
          reliabilityRows.reduce((sum, r) => sum + r.score, 0) / reliabilityRows.length,
        );
  const openNotes = reliabilityRows.reduce((sum, r) => sum + r.openNotes, 0);
  const lowScoreCandidates = [...reliabilityRows]
    .filter((r) => r.score < 100 || r.openNotes > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 8);

  return {
    employers: realEmployers.length,
    candidates: realEmployees.length,
    matches: {
      total: store.matches.length,
      queued: store.matches.filter((m) => m.status === "queued").length,
      approved: store.matches.filter((m) => m.status === "approved").length,
      rejected: store.matches.filter((m) => m.status === "rejected").length,
    },
    aiUsage: {
      totalCalls: usage.length,
      totalTokens: usage.reduce((sum, r) => sum + r.totalTokens, 0),
      estimatedCostUsd: usage.reduce((sum, r) => sum + r.estimatedCostUsd, 0),
    },
    users: realUsers.length,
    reliability: {
      averageScore,
      openNotes,
      lowScoreCandidates,
    },
  };
}

export function createAiUsageRecord(params: {
  id: string;
  type: AiUsageRecord["type"];
  promptTokens: number;
  completionTokens: number;
  createdAt: string;
}): AiUsageRecord {
  const totalTokens = params.promptTokens + params.completionTokens;
  return {
    id: params.id,
    type: params.type,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    totalTokens,
    estimatedCostUsd: estimateAiCostUsd(params.promptTokens, params.completionTokens),
    createdAt: params.createdAt,
  };
}
