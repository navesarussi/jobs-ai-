import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeCvIntoEmployee, resolveConflictsFromPatch } from "./cv-merge";
import { candidateRows } from "./card-progress";
import { emptyCandidateCard, emptyCvProfile, type EmployeeRecord } from "./types";

function emp(partial?: Partial<EmployeeRecord>): EmployeeRecord {
  return {
    userId: "e1",
    card: emptyCandidateCard(),
    chat: [],
    pendingFieldQuestionIds: [],
    cv: emptyCvProfile(),
    ...partial,
  };
}

const doc = {
  id: "doc1",
  kind: "cv" as const,
  fileName: "cv.pdf",
  mimeType: "application/pdf",
  byteSize: 100,
  storageKey: "pg:doc1",
  uploadedAt: "2026-07-23T00:00:00.000Z",
  textCharCount: 20,
  extractedText: "raw cv text",
  extractionStatus: "ok" as const,
};

describe("mergeCvIntoEmployee", () => {
  it("fills empty fields and records evidence", () => {
    const { employee, summary } = mergeCvIntoEmployee(
      emp(),
      { patch: { desiredRole: "מלצר", field: "מסעדנות", skills: ["שירות"] } },
      doc,
      "2026-07-23T00:00:00.000Z",
    );
    assert.equal(employee.card.desiredRole, "מלצר");
    assert.deepEqual(employee.card.skills, ["שירות"]);
    assert.ok(summary.fieldsUpdated >= 2);
    assert.equal(employee.cv?.documents[0]?.fileName, "cv.pdf");
    assert.ok(employee.cv?.fieldEvidence.some((e) => e.fieldKey === "desiredRole"));
  });

  it("does not overwrite different values; opens conflict", () => {
    const { employee, summary } = mergeCvIntoEmployee(
      emp({ card: { ...emptyCandidateCard(), desiredRole: "ברמן" } }),
      { patch: { desiredRole: "מלצר" } },
      doc,
    );
    assert.equal(employee.card.desiredRole, "ברמן");
    assert.equal(summary.conflictsPending, 1);
    assert.equal(employee.cv?.conflicts[0]?.status, "pending");
    assert.equal(employee.cv?.conflicts[0]?.values.length, 2);
    assert.ok((employee.cv?.reliability.score ?? 100) < 100);
  });

  it("unions skills without duplicates", () => {
    const { employee } = mergeCvIntoEmployee(
      emp({ card: { ...emptyCandidateCard(), skills: ["שירות", "יין"] } }),
      { patch: { skills: ["שירות", "קופה"] } },
      doc,
    );
    assert.deepEqual(employee.card.skills, ["שירות", "יין", "קופה"]);
  });

  it("appends work history and unmapped facts", () => {
    const { employee, summary } = mergeCvIntoEmployee(
      emp(),
      {
        patch: {},
        workHistory: [{ company: "A", title: "מלצר" }],
        unmappedFacts: [{ label: "צבא", value: "מלא" }],
      },
      doc,
    );
    assert.equal(summary.rolesFound, 1);
    assert.equal(employee.cv?.workHistory.length, 1);
    assert.equal(employee.card.workHistory.length, 1);
    assert.equal(employee.cv?.unmappedFacts.length, 1);
  });

  it("sets narrative summary only when empty; otherwise conflicts", () => {
    const filled = mergeCvIntoEmployee(
      emp(),
      { patch: { narrative: "סיכום מקצועי קצר" } },
      { ...doc, extractedText: "A".repeat(5000) },
    );
    assert.equal(filled.employee.card.narrative, "סיכום מקצועי קצר");
    assert.ok(!filled.employee.card.narrative.includes("AAAA"));

    const conflicted = mergeCvIntoEmployee(
      emp({ card: { ...emptyCandidateCard(), narrative: "סיפור קיים" } }),
      { patch: { narrative: "סיכום מקצועי קצר" } },
      doc,
    );
    assert.equal(conflicted.employee.card.narrative, "סיפור קיים");
    assert.equal(conflicted.summary.conflictsPending, 1);
  });

  it("high inference fills empty field; low becomes pendingInference only", () => {
    const { employee } = mergeCvIntoEmployee(
      emp(),
      {
        patch: {},
        inferences: [
          {
            fieldKey: "managementExperience",
            value: "כן",
            evidence: "led a team of 8",
            confidence: "high",
          },
          {
            fieldKey: "personality",
            value: "יסודי",
            evidence: "detail-oriented wording",
            confidence: "low",
          },
        ],
      },
      doc,
    );
    assert.equal(employee.card.managementExperience, "כן");
    assert.equal(employee.card.personality, "");
    assert.equal(employee.cv?.pendingInferences.length, 1);
    assert.equal(employee.cv?.pendingInferences[0].fieldKey, "personality");
  });

  it("projects workHistory onto card and counts toward knowledge", () => {
    const { employee } = mergeCvIntoEmployee(
      emp(),
      { patch: {}, workHistory: [{ company: "Acme", title: "Dev" }] },
      doc,
    );
    assert.equal(employee.card.workHistory.length, 1);
    const rows = candidateRows(employee.card);
    assert.ok(rows.find((r) => r.key === "workHistory")?.filled);
  });
});

describe("resolveConflictsFromPatch", () => {
  it("resolves when patch matches a conflict value", () => {
    const base = mergeCvIntoEmployee(
      emp({ card: { ...emptyCandidateCard(), desiredRole: "ברמן" } }),
      { patch: { desiredRole: "מלצר" } },
      doc,
    ).employee;
    const cv = resolveConflictsFromPatch(base.cv, { desiredRole: "מלצר" });
    assert.equal(cv?.conflicts[0]?.status, "resolved");
    assert.equal(cv?.conflicts[0]?.resolvedValue, "מלצר");
    assert.equal(cv?.reliability.score, 100);
  });
});

describe("openChatConflictOnCard", () => {
  it("opens chat_internal note and lowers reliability", async () => {
    const { openChatConflictOnCard } = await import("./cv-merge");
    const cv = openChatConflictOnCard(
      emptyCvProfile(),
      "location",
      "תל אביב",
      "חיפה",
      "2026-07-24T00:00:00.000Z",
    );
    assert.equal(cv.conflicts.length, 1);
    assert.equal(cv.conflicts[0]?.status, "pending");
    assert.ok(cv.reliability.score < 100);
    assert.ok(cv.reliability.notes.some((n) => n.kind === "chat_internal"));
  });
});
