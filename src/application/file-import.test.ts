import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCvExtraction, applyJobDescriptionExtraction } from "./chat";
import { emptyCandidateCard, emptyJobCard, type StoreData } from "@/domain/types";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";

function seed(): StoreData {
  return {
    users: [
      { id: "e1", name: "C", role: "employee", createdAt: "" },
      { id: "b1", name: "B", role: "employer", createdAt: "" },
    ],
    employees: [
      {
        userId: "e1",
        card: { ...emptyCandidateCard(), narrative: "קיים" },
        chat: [],
        pendingFieldQuestionIds: [],
      },
    ],
    employers: [
      normalizeEmployerRecord({ userId: "b1", card: emptyJobCard(), chat: [], jobs: [], activeJobId: "" } as never),
    ],
    fieldQuestions: [],
    fieldAnswers: [],
    matches: [],
  };
}

describe("applyCvExtraction", () => {
  it("applies the extracted patch and keeps the raw CV in the narrative", () => {
    const { store, card } = applyCvExtraction(
      seed(),
      "e1",
      { desiredRole: "מלצר", field: "מסעדנות", skills: ["שירות"] },
      "טקסט קורות חיים מלא",
    );
    assert.equal(card.desiredRole, "מלצר");
    assert.equal(card.field, "מסעדנות");
    assert.deepEqual(card.skills, ["שירות"]);
    assert.match(card.narrative, /קיים/);
    assert.match(card.narrative, /קורות חיים שהועלו/);
    assert.equal(store.employees[0].card.desiredRole, "מלצר");
  });

  it("does not mutate the input store", () => {
    const input = seed();
    applyCvExtraction(input, "e1", { desiredRole: "מלצר" }, "x");
    assert.equal(input.employees[0].card.desiredRole, "");
  });
});

describe("applyJobDescriptionExtraction", () => {
  it("applies the extracted patch to the active job card", () => {
    const { card, jobId } = applyJobDescriptionExtraction(
      seed(),
      "b1",
      { title: "מלצר/ית", field: "מסעדנות", mustHaves: ["שירות"] },
      "טקסט תיאור משרה",
    );
    assert.equal(card.title, "מלצר/ית");
    assert.equal(card.field, "מסעדנות");
    assert.deepEqual(card.mustHaves, ["שירות"]);
    assert.match(card.narrative, /תיאור משרה שהועלה/);
    assert.ok(jobId);
  });
});
