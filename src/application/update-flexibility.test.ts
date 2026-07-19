import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { updateFlexibility } from "./update-flexibility";
import {
  emptyCandidateCard,
  emptyJobCard,
  type StoreData,
} from "@/domain/types";

function seed(): StoreData {
  return {
    users: [
      { id: "e1", name: "Emp", role: "employee", createdAt: "" },
      { id: "b1", name: "Boss", role: "employer", createdAt: "" },
    ],
    employees: [
      { userId: "e1", card: emptyCandidateCard(), chat: [], pendingFieldQuestionIds: [] },
    ],
    employers: [{ userId: "b1", card: emptyJobCard(), chat: [] }],
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
});
