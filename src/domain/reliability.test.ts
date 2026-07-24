import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recomputeReliability } from "./reliability";
import type { FieldConflict, PendingInference, ReliabilityNote } from "./types";

describe("recomputeReliability", () => {
  it("starts at 100 with no open issues", () => {
    const r = recomputeReliability({
      conflicts: [],
      pendingInferences: [],
      prior: undefined,
    });
    assert.equal(r.score, 100);
  });

  it("penalizes open cv_vs_chat conflicts and recovers on resolve", () => {
    const note: ReliabilityNote = {
      id: "n1",
      kind: "cv_vs_chat",
      fieldKey: "location",
      summary: "CV: TLV vs chat: Haifa",
      status: "open",
      createdAt: "t",
    };
    const conflict: FieldConflict = {
      id: "1",
      fieldKey: "location",
      values: [
        { value: "Haifa", source: "chat", at: "t" },
        { value: "TLV", source: "cv", at: "t" },
      ],
      status: "pending",
    };
    const open = recomputeReliability({
      conflicts: [conflict],
      pendingInferences: [],
      prior: undefined,
      notes: [note],
    });
    assert.equal(open.score, 85);

    const closedNote: ReliabilityNote = { ...note, status: "resolved", resolvedAt: "t2" };
    const closedConflict: FieldConflict = {
      ...conflict,
      status: "resolved",
      resolvedValue: "TLV",
    };
    const closed = recomputeReliability({
      conflicts: [closedConflict],
      pendingInferences: [],
      prior: open,
      notes: [closedNote],
    });
    assert.equal(closed.score, 100);
  });

  it("penalizes pending low inferences", () => {
    const pending: PendingInference[] = [
      {
        id: "p1",
        fieldKey: "personality",
        value: "יסודי",
        evidence: "detail-oriented",
        confidence: "low",
        status: "pending",
        at: "t",
      },
    ];
    const r = recomputeReliability({
      conflicts: [],
      pendingInferences: pending,
      prior: undefined,
    });
    assert.equal(r.score, 95);
  });
});
