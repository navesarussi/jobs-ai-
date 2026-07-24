import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { saveCandidateCv } from "./cv-import";
import { emptyCandidateCard, type StoreData } from "@/domain/types";

function seed(): StoreData {
  return {
    users: [{ id: "e1", name: "C", role: "employee", createdAt: "" }],
    employees: [
      {
        userId: "e1",
        card: emptyCandidateCard(),
        chat: [],
        pendingFieldQuestionIds: [],
      },
    ],
    employers: [],
    fieldQuestions: [],
    fieldAnswers: [],
    matches: [],
  };
}

describe("saveCandidateCv", () => {
  it("persists the document with pending extraction status", () => {
    const { store, document } = saveCandidateCv(seed(), {
      userId: "e1",
      id: "d1",
      fileName: "cv.pdf",
      mimeType: "application/pdf",
      byteSize: 100,
      storageKey: "pg:abc",
      extractedText: "טקסט קורות חיים לדוגמה",
    });
    assert.equal(document.extractionStatus, "pending");
    assert.equal(document.fileName, "cv.pdf");
    assert.equal(store.employees[0].cv?.documents.length, 1);
    assert.equal(store.employees[0].card.desiredRole, "");
  });

  it("throws when employee is missing", () => {
    assert.throws(() =>
      saveCandidateCv(seed(), {
        userId: "missing",
        id: "d2",
        fileName: "cv.pdf",
        mimeType: "application/pdf",
        byteSize: 1,
        storageKey: "pg:x",
        extractedText: "טקסט",
      }),
    );
  });
});
