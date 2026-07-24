import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scheduleMatchRebuild } from "./match-scheduler";

describe("match-scheduler", () => {
  it("exposes scheduleMatchRebuild without throwing", () => {
    assert.equal(typeof scheduleMatchRebuild, "function");
    // Do not actually run rebuild (needs DB); just ensure callable.
  });
});
