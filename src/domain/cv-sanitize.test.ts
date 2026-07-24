import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasRepetitiveLoop, isExtractTextUsable, sanitizeCvPatch } from "./cv-sanitize";

describe("cv-sanitize", () => {
  it("detects repeated n-gram loops", () => {
    const loop = "cleanly overall focus pathways ".repeat(12);
    assert.equal(hasRepetitiveLoop(loop), true);
    assert.equal(hasRepetitiveLoop("Senior engineer at Acme, 2019–2024."), false);
  });

  it("rejects unusable extract text", () => {
    assert.equal(isExtractTextUsable("a".repeat(50)), false);
    assert.equal(isExtractTextUsable("Software engineer with 5 years in payments."), true);
  });

  it("strips looping narrative and caps length", () => {
    const out = sanitizeCvPatch({
      patch: { narrative: "focus pathways correctly ".repeat(40), desiredRole: "Engineer" },
      unmappedFacts: [{ label: "x", value: "cleanly overall ".repeat(30) }],
    });
    const narrative = String(out.patch.narrative ?? "");
    assert.ok(narrative.length <= 400);
    assert.ok(!narrative.includes("focus pathways correctly focus pathways"));
    assert.equal(out.patch.desiredRole, "Engineer");
  });
});
