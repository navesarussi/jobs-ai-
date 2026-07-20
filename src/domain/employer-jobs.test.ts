import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addEmployerJob,
  getActiveJob,
  normalizeEmployerRecord,
  updateJobSlot,
  withActiveJob,
} from "./employer-jobs";
import { emptyJobCard } from "./types";

describe("employer-jobs", () => {
  it("migrates legacy single-card employers into one job slot", () => {
    const er = normalizeEmployerRecord({
      userId: "e1",
      card: { ...emptyJobCard(), title: "מלצר" },
      chat: [{ id: "m1", role: "user", content: "hi", createdAt: "t" }],
      jobs: [],
      activeJobId: "",
    });
    assert.equal(er.jobs.length, 1);
    assert.equal(er.jobs[0]!.card.title, "מלצר");
    assert.equal(er.activeJobId, er.jobs[0]!.id);
    assert.equal(er.chat.length, 1);
  });

  it("switches active job and mirrors card/chat", () => {
    const base = normalizeEmployerRecord({
      userId: "e1",
      card: emptyJobCard(),
      chat: [],
      jobs: [],
      activeJobId: "",
    });
    const withTwo = addEmployerJob(base);
    assert.equal(withTwo.jobs.length, 2);
    const firstId = withTwo.jobs[0]!.id;
    const secondId = withTwo.jobs[1]!.id;
    assert.equal(withTwo.activeJobId, secondId);

    const updated = updateJobSlot(withTwo, secondId, {
      card: { ...emptyJobCard(), title: "שף" },
      chat: [{ id: "c1", role: "assistant", content: "ok", createdAt: "t" }],
    });
    assert.equal(getActiveJob(updated).card.title, "שף");

    const switched = withActiveJob(updated, firstId);
    assert.equal(switched.activeJobId, firstId);
    assert.equal(switched.card.title, "");
  });
});
