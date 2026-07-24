import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyCandidateCard } from "@/domain/types";
import { heuristicCvWelcomeReply } from "@/infrastructure/ai/heuristic";

describe("heuristicCvWelcomeReply", () => {
  it("mentions updated CV when isCvUpdate", () => {
    const reply = heuristicCvWelcomeReply({
      card: { ...emptyCandidateCard(), desiredRole: "פול סטאק", experienceYears: 3 },
      chat: [],
      pendingQuestions: [],
      isCvUpdate: true,
      locale: "he",
      candidateName: "דני",
    });
    assert.match(reply, /קיבלתי את קורות החיים המעודכנים שלך/);
    assert.match(reply, /שלום דני/);
    assert.match(reply, /3/);
  });

  it("uses first-upload wording for new CV", () => {
    const reply = heuristicCvWelcomeReply({
      card: { ...emptyCandidateCard(), desiredRole: "מפתח", experienceYears: 2 },
      chat: [],
      pendingQuestions: [],
      isCvUpdate: false,
      locale: "he",
      candidateName: "נועה",
    });
    assert.match(reply, /קיבלתי את קורות החיים שלך/);
    assert.doesNotMatch(reply, /מעודכנים/);
  });
});
