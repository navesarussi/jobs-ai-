import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resetChat } from "./chat";
import { normalizeEmployerRecord } from "@/domain/employer-jobs";
import { emptyCandidateCard, emptyJobCard, type StoreData } from "@/domain/types";

describe("resetChat", () => {
  it("clears employee chat only", () => {
    const store: StoreData = {
      users: [],
      employees: [
        {
          userId: "u1",
          card: emptyCandidateCard(),
          chat: [{ id: "1", role: "user", content: "a", createdAt: "t" }],
          pendingFieldQuestionIds: [],
        },
      ],
      employers: [],
      fieldQuestions: [],
      fieldAnswers: [],
      matches: [],
    };
    const next = resetChat(store, "u1", "employee");
    assert.equal(next.employees[0]!.chat.length, 0);
  });

  it("clears only the active employer job chat", () => {
    const employer = normalizeEmployerRecord({
      userId: "boss",
      card: emptyJobCard(),
      chat: [],
      jobs: [
        {
          id: "j1",
          card: emptyJobCard(),
          chat: [{ id: "1", role: "user", content: "a", createdAt: "t" }],
        },
        {
          id: "j2",
          card: emptyJobCard(),
          chat: [{ id: "2", role: "user", content: "b", createdAt: "t" }],
        },
      ],
      activeJobId: "j1",
    });
    const store: StoreData = {
      users: [],
      employees: [],
      employers: [employer],
      fieldQuestions: [],
      fieldAnswers: [],
      matches: [],
    };
    const next = resetChat(store, "boss", "employer", "j1");
    const er = next.employers[0]!;
    assert.equal(er.jobs.find((j) => j.id === "j1")!.chat.length, 0);
    assert.equal(er.jobs.find((j) => j.id === "j2")!.chat.length, 1);
  });
});
