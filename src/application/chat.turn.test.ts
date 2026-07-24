import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyEmployeeTurn, applyEmployerTurn } from "./chat-turn";
import {
  emptyCandidateCard,
  emptyJobCard,
  type CandidateCard,
  type StoreData,
} from "@/domain/types";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";

function seed(): StoreData {
  return {
    users: [
      { id: "e1", name: "Emp", role: "employee", createdAt: "" },
      { id: "b1", name: "Boss", role: "employer", createdAt: "" },
    ],
    employees: [
      { userId: "e1", card: emptyCandidateCard(), chat: [], pendingFieldQuestionIds: [] },
    ],
    employers: [
      normalizeEmployerRecord({
        userId: "b1",
        card: emptyJobCard(),
        chat: [],
        jobs: [],
        activeJobId: "",
      }),
    ],
    fieldQuestions: [],
    fieldAnswers: [],
    matches: [],
  };
}

describe("applyEmployeeTurn", () => {
  it("applies the patch and appends user + assistant messages", () => {
    const result = applyEmployeeTurn({
      store: seed(),
      userId: "e1",
      message: "אני מלצר בתל אביב",
      reply: "מעולה, קיבלתי!",
      candidatePatch: { desiredRole: "מלצר", location: "תל אביב" },
      provider: "heuristic",
    });

    assert.equal((result.card as CandidateCard).desiredRole, "מלצר");
    assert.equal((result.card as CandidateCard).location, "תל אביב");
    assert.equal(result.reply, "מעולה, קיבלתי!");
    assert.equal(result.chat.length, 2);
    assert.equal(result.newMessages.length, 2);
  });

  it("merges a field answer and clears the pending question", () => {
    const store = seed();
    store.fieldQuestions = [
      {
        id: "q1",
        field: "מכירות",
        question: "יש לך רכב?",
        sourceJobId: "",
        sourceEmployerId: "b1",
        createdAt: "",
      },
    ];
    store.employees[0]!.pendingFieldQuestionIds = ["q1"];

    const result = applyEmployeeTurn({
      store,
      userId: "e1",
      message: "כן, יש לי רכב",
      reply: "תודה",
      fieldAnswers: [{ questionId: "q1", answer: "כן, יש לי רכב" }],
      provider: "heuristic",
    });

    assert.equal(result.pendingQuestions.length, 0);
    assert.equal(result.newFieldAnswers.length, 1);
  });
});

describe("applyEmployerTurn", () => {
  it("applies the job patch and appends chat", () => {
    const result = applyEmployerTurn({
      store: seed(),
      userId: "b1",
      message: "מגייס מלצר",
      reply: "מעולה",
      jobPatch: { title: "מלצר" },
      provider: "heuristic",
    });
    assert.equal(result.chat.length, 2);
    assert.ok(result.jobId);
    assert.equal(result.newMessages.length, 2);
  });
});
