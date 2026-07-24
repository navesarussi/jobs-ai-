import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyFlexibility, updateFlexibility } from "./update-flexibility";
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
      { id: "b1", name: "Boss", role: "employer", createdAt: "" },
    ],
    employees: [
      { userId: "e1", card: emptyCandidateCard(), chat: [], pendingFieldQuestionIds: [] },
    ],
    employers: [normalizeEmployerRecord({ userId: "b1", card: emptyJobCard(), chat: [], jobs: [], activeJobId: "" })],
    fieldQuestions: [],
    fieldAnswers: [],
    matches: [],
  };
}

describe("updateFlexibility", () => {
  it("updates employee flexibility", () => {
    const next = updateFlexibility(seed(), "e1", 8);
    const card = next.employees.find((e) => e.userId === "e1")!.card;
    assert.equal(card.flexibility, 8);
  });

  it("updates employer flexibility", () => {
    const next = updateFlexibility(seed(), "b1", 3);
    const card = next.employers.find((e) => e.userId === "b1")!.card;
    assert.equal(card.flexibility, 3);
  });

  it("clamps out of range values", () => {
    const next = updateFlexibility(seed(), "e1", 99);
    assert.equal(next.employees[0].card.flexibility, 10);
  });

  it("applyFlexibility skips match rebuild and returns role slice", () => {
    const applied = applyFlexibility(seed(), "e1", 7);
    assert.equal(applied.role, "employee");
    assert.equal(applied.card.flexibility, 7);
    assert.equal(applied.store.matches.length, 0);
  });
});
