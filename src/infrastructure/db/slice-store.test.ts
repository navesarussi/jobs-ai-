import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readActorStore,
  readCandidateQueueStore,
  readMatchingStore,
  readOpportunityStore,
} from "./slice-store";
import { resetMemoryStore, writeMemoryStore } from "./memory-store";
import {
  emptyCandidateCard,
  emptyJobCard,
  type StoreData,
} from "@/domain/types";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";

function seed(): StoreData {
  return {
    users: [
      { id: "e1", name: "Emp", role: "employee", createdAt: "" },
      { id: "e2", name: "Emp2", role: "employee", createdAt: "" },
      { id: "b1", name: "Boss", role: "employer", createdAt: "" },
    ],
    employees: [
      {
        userId: "e1",
        card: { ...emptyCandidateCard(), desiredRole: "מלצר", field: "מסעדנות" },
        chat: [{ id: "c1", role: "user", content: "hi", createdAt: "" }],
        pendingFieldQuestionIds: [],
      },
      {
        userId: "e2",
        card: { ...emptyCandidateCard(), desiredRole: "טבח", field: "מסעדנות" },
        chat: [{ id: "c2", role: "user", content: "secret", createdAt: "" }],
        pendingFieldQuestionIds: [],
      },
    ],
    employers: [
      normalizeEmployerRecord({
        userId: "b1",
        card: { ...emptyJobCard(), title: "מלצר", field: "מסעדנות" },
        chat: [],
        jobs: [],
        activeJobId: "",
      }),
    ],
    fieldQuestions: [],
    fieldAnswers: [],
    matches: [
      {
        id: "m1",
        jobOwnerId: "b1",
        jobId: "b1",
        candidateId: "e1",
        score: 0.9,
        reason: "fit",
        status: "queued",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "m2",
        jobOwnerId: "b1",
        jobId: "b1",
        candidateId: "e1",
        score: 0.8,
        reason: "ok",
        status: "approved",
        createdAt: "",
        updatedAt: "",
      },
    ],
  };
}

describe("slice-store (memory)", () => {
  it("readActorStore isolates other users' chats", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    resetMemoryStore();
    writeMemoryStore(seed());

    const slice = await readActorStore("e1");
    assert.equal(slice.users.length, 1);
    assert.equal(slice.employees.length, 1);
    assert.equal(slice.employees[0]!.chat.length, 1);
    assert.equal(slice.employees[0]!.chat[0]!.content, "hi");
    assert.ok(!slice.employees.some((e) => e.userId === "e2"));
  });

  it("readMatchingStore drops chats but keeps cards for rebuild", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    resetMemoryStore();
    writeMemoryStore(seed());

    const snap = await readMatchingStore();
    assert.equal(snap.employees.length, 2);
    assert.equal(snap.employees[0]!.chat.length, 0);
    assert.equal(snap.matches.length, 2);
  });

  it("opportunity and candidate queue slices filter by status", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    resetMemoryStore();
    writeMemoryStore(seed());

    const opps = await readOpportunityStore("e1");
    assert.equal(opps.matches.length, 1);
    assert.equal(opps.matches[0]!.status, "approved");

    const queue = await readCandidateQueueStore("b1");
    assert.equal(queue.matches.length, 1);
    assert.equal(queue.matches[0]!.status, "queued");
    assert.equal(queue.employees[0]!.userId, "e1");
  });
});
