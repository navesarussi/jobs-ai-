import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCachedStore,
  invalidateStoreCache,
  isNormalizedDataCached,
  markNormalizedDataPresent,
  setCachedStore,
} from "./store-cache";
import { emptyCandidateCard, type StoreData } from "@/domain/types";

function sample(): StoreData {
  return {
    users: [{ id: "u1", name: "A", role: "employee", createdAt: "" }],
    employees: [
      { userId: "u1", card: emptyCandidateCard(), chat: [], pendingFieldQuestionIds: [] },
    ],
    employers: [],
    fieldQuestions: [],
    fieldAnswers: [],
    matches: [],
  };
}

describe("store-cache", () => {
  it("stores and invalidates the in-process cache", () => {
    invalidateStoreCache();
    assert.equal(getCachedStore(), null);
    setCachedStore(sample());
    assert.equal(getCachedStore()?.users[0]?.id, "u1");
    assert.equal(isNormalizedDataCached(), true);
    invalidateStoreCache();
    assert.equal(getCachedStore(), null);
  });

  it("marks normalized data present independently of store payload", () => {
    invalidateStoreCache();
    markNormalizedDataPresent();
    assert.equal(isNormalizedDataCached(), true);
  });
});
