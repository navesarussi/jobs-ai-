import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rebuildMatches } from "./rebuild-matches";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import { emptyCandidateCard, emptyJobCard, type StoreData } from "@/domain/types";

describe("rebuildMatches multi-job", () => {
  it("creates separate queued matches per job slot", () => {
    const employer = normalizeEmployerRecord({
      userId: "boss",
      card: emptyJobCard(),
      chat: [],
      jobs: [
        {
          id: "job-a",
          card: {
            ...emptyJobCard(),
            title: "מלצר",
            field: "מסעדנות",
            location: "תל אביב",
            mustHaves: ["שירות"],
          },
          chat: [],
        },
        {
          id: "job-b",
          card: {
            ...emptyJobCard(),
            title: "שף",
            field: "מסעדנות",
            location: "תל אביב",
            mustHaves: ["שירות"],
          },
          chat: [],
        },
      ],
      activeJobId: "job-a",
    });

    const store: StoreData = {
      users: [],
      employees: [
        {
          userId: "cand",
          card: {
            ...emptyCandidateCard(),
            desiredRole: "מלצר",
            field: "מסעדנות",
            location: "תל אביב",
            skills: ["שירות"],
          },
          chat: [],
          pendingFieldQuestionIds: [],
        },
      ],
      employers: [employer],
      fieldQuestions: [],
      fieldAnswers: [],
      matches: [],
    };

    const matches = rebuildMatches(store);
    const queued = matches.filter((m) => m.status === "queued");
    assert.ok(queued.some((m) => m.jobId === "job-a"));
    assert.ok(queued.some((m) => m.jobId === "job-b"));
  });
});
