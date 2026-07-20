import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeAdminStats,
  createAiUsageRecord,
  estimateAiCostUsd,
  renderPromptTemplate,
} from "./admin";
import type { StoreData } from "./types";
import { emptyCandidateCard, emptyJobCard } from "./types";
import { normalizeEmployerRecord } from "./employer-jobs";

function emptyStore(): StoreData {
  return {
    users: [],
    employees: [],
    employers: [],
    fieldQuestions: [],
    fieldAnswers: [],
    matches: [],
    aiUsage: [],
  };
}

describe("admin", () => {
  it("computes stats excluding demo users", () => {
    const store: StoreData = {
      ...emptyStore(),
      users: [
        { id: "demo-employee", name: "Demo", role: "employee", createdAt: "2026-01-01" },
        { id: "u1", name: "Real", role: "employee", createdAt: "2026-01-01" },
      ],
      employees: [
        { userId: "demo-employee", card: emptyCandidateCard(), chat: [], pendingFieldQuestionIds: [] },
        { userId: "u1", card: emptyCandidateCard(), chat: [], pendingFieldQuestionIds: [] },
      ],
      employers: [
        normalizeEmployerRecord({ userId: "demo-employer", card: emptyJobCard(), chat: [], jobs: [], activeJobId: "" }),
        normalizeEmployerRecord({ userId: "u2", card: emptyJobCard(), chat: [], jobs: [], activeJobId: "" }),
      ],
      matches: [
        {
          id: "m1",
          jobOwnerId: "u2",
          jobId: "u2",
          candidateId: "u1",
          score: 0.8,
          reason: "fit",
          status: "queued",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
    };
    const stats = computeAdminStats(store);
    assert.equal(stats.candidates, 1);
    assert.equal(stats.employers, 1);
    assert.equal(stats.users, 1);
    assert.equal(stats.matches.total, 1);
    assert.equal(stats.matches.queued, 1);
  });

  it("estimates AI cost from token counts", () => {
    const cost = estimateAiCostUsd(1_000_000, 1_000_000);
    assert.ok(cost > 0.3);
  });

  it("renders prompt placeholders", () => {
    const out = renderPromptTemplate("Hello {{name}}!", { name: "World" });
    assert.equal(out, "Hello World!");
  });

  it("creates usage records with total tokens", () => {
    const rec = createAiUsageRecord({
      id: "x",
      type: "employee_intake",
      promptTokens: 100,
      completionTokens: 50,
      createdAt: "2026-01-01",
    });
    assert.equal(rec.totalTokens, 150);
    assert.ok(rec.estimatedCostUsd > 0);
  });
});
