import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { candidateMiniCardLines, employeeHasCv } from "./candidate-mini-card";
import { emptyCandidateCard } from "./types";

describe("candidate-mini-card", () => {
  it("returns only filled safe fields", () => {
    const card = {
      ...emptyCandidateCard(),
      desiredRole: "מלצר/ית",
      field: "מסעדות",
      skills: ["שירות", "יין"],
      salaryExpectation: "₪40",
      weaknesses: "לא רלוונטי",
    };
    const lines = candidateMiniCardLines(card, { desiredRole: "תפקיד", field: "תחום", skills: "כישורים" });
    assert.deepEqual(
      lines.map((l) => l.key),
      ["desiredRole", "field", "skills"],
    );
    assert.ok(!lines.some((l) => l.key === "salaryExpectation" || l.key === "weaknesses"));
  });

  it("detects uploaded CV from documents", () => {
    assert.equal(employeeHasCv(undefined), false);
    assert.equal(employeeHasCv({ documents: [] }), false);
    assert.equal(employeeHasCv({ documents: [{ id: "1" }] }), true);
  });
});
