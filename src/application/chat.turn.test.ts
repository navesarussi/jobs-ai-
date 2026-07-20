import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyEmployeeTurn,
  applyEmployerTurn,
  prepareEmployeeTurn,
  prepareEmployerTurn,
} from "./chat";
import { emptyCandidateCard, emptyJobCard, type StoreData } from "@/domain/types";
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

    assert.equal(result.card.desiredRole, "מלצר");
    assert.equal(result.card.location, "תל אביב");
    assert.equal(result.reply, "מעולה, קיבלתי!");
    assert.equal(result.chat.length, 2);
    assert.equal(result.chat[0].role, "user");
    assert.equal(result.chat[0].content, "אני מלצר בתל אביב");
    assert.equal(result.chat[1].role, "assistant");
    assert.equal(result.chat[1].content, "מעולה, קיבלתי!");
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
    store.employees[0].pendingFieldQuestionIds = ["q1"];

    const result = applyEmployeeTurn({
      store,
      userId: "e1",
      message: "כן, יש לי רכב",
      reply: "תודה",
      fieldAnswers: [{ questionId: "q1", answer: "כן, יש לי רכב" }],
      provider: "heuristic",
    });

    assert.equal(result.pendingQuestions.length, 0);
    assert.ok(
      result.store.fieldAnswers.some(
        (a) => a.questionId === "q1" && a.candidateId === "e1",
      ),
    );
  });

  it("throws for an unknown user", () => {
    assert.throws(() =>
      applyEmployeeTurn({
        store: seed(),
        userId: "ghost",
        message: "hi",
        reply: "hi",
        provider: "heuristic",
      }),
    );
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

    assert.equal(result.card.title, "מלצר");
    assert.equal(result.chat.length, 2);
    assert.ok(result.jobId);
  });
});

describe("prepare*Turn", () => {
  it("prepares employee inputs and throws for unknown user", () => {
    const prep = prepareEmployeeTurn(seed(), "e1");
    assert.equal(prep.chat.length, 0);
    assert.ok(prep.systemPrompt.length > 0);
    assert.throws(() => prepareEmployeeTurn(seed(), "nope"));
  });

  it("prepares employer inputs with an active job id", () => {
    const prep = prepareEmployerTurn(seed(), "b1");
    assert.ok(prep.systemPrompt.length > 0);
    assert.ok(typeof prep.jobId === "string");
  });
});
