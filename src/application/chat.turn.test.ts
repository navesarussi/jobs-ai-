import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleEmployeeChat, handleEmployerChat } from "./chat";
import {
  emptyCandidateCard,
  emptyCvProfile,
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
      {
        userId: "e1",
        card: emptyCandidateCard(),
        chat: [],
        pendingFieldQuestionIds: [],
        cv: {
          ...emptyCvProfile(),
          documents: [
            {
              id: "d1",
              kind: "cv",
              fileName: "cv.pdf",
              mimeType: "application/pdf",
              byteSize: 10,
              storageKey: "d1",
              uploadedAt: "",
              textCharCount: 20,
              extractedText: "resume text here",
              extractionStatus: "ok",
            },
          ],
        },
      },
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

describe("chat turn deltas", () => {
  it("employee turn emits scoped persistence deltas", async () => {
    const result = await handleEmployeeChat(seed(), "e1", "אני מלצר בתל אביב");
    assert.ok(result.reply.length > 0);
    assert.equal(result.newMessages.length, 2);
    assert.equal(result.newMessages[0]!.role, "user");
    assert.equal(result.newMessages[1]!.role, "assistant");
    assert.equal(result.chat.length, 2);
    assert.ok((result.card as CandidateCard).desiredRole || result.reply);
  });

  it("employer turn emits scoped persistence deltas", async () => {
    const result = await handleEmployerChat(seed(), "b1", "מגייס מלצר");
    assert.ok(result.reply.length > 0);
    assert.equal(result.newMessages.length, 2);
    assert.equal(result.newFieldAnswers.length, 0);
    assert.ok(result.jobId);
  });
});
