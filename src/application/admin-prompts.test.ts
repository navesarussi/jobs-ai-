import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAdminDashboard,
  resetAdminPrompts,
  updateAdminPrompts,
} from "./admin";
import type { StoreData } from "@/domain/types";
import { emptyCandidateCard, emptyJobCard, PROMPT_BUNDLE_VERSION } from "@/domain/types";
import { hasCustomAdminPrompts, resolveAdminSettings } from "@/infrastructure/ai/prompts";

function emptyStore(): StoreData {
  return {
    users: [],
    employees: [{ userId: "u1", card: emptyCandidateCard(), chat: [], pendingFieldQuestionIds: [] }],
    employers: [{ userId: "u2", card: emptyJobCard(), chat: [], jobs: [{ id: "u2", card: emptyJobCard(), chat: [] }], activeJobId: "u2" }],
    fieldQuestions: [],
    fieldAnswers: [],
    matches: [],
    aiUsage: [],
  };
}

describe("admin prompts live override", () => {
  it("marks custom prompts and resets to file defaults", () => {
    let store = emptyStore();
    store = updateAdminPrompts(store, {
      candidatePrompt: "CUSTOM CANDIDATE {{known_facts}}",
      employerPrompt: "CUSTOM EMPLOYER {{known_facts}}",
      updatedBy: "admin@test.com",
    });
    const dash = getAdminDashboard(store);
    assert.equal(dash.prompts.isCustom, true);
    assert.match(dash.prompts.candidatePrompt, /CUSTOM CANDIDATE/);

    store = resetAdminPrompts(store);
    const after = getAdminDashboard(store);
    assert.equal(after.prompts.isCustom, false);
    assert.equal(/CUSTOM CANDIDATE/.test(after.prompts.candidatePrompt), false);
    assert.match(after.prompts.candidatePrompt, /FR-CHAT|מראיין|יועץ/);
  });

  it("ignores stale admin overrides without current prompt bundle version", () => {
    const stale = resolveAdminSettings({
      candidatePrompt: "OLD CUSTOM",
      employerPrompt: "OLD EMPLOYER",
      promptBundleVersion: "ancient",
    });
    assert.equal(/OLD CUSTOM/.test(stale.candidatePrompt), false);
    assert.equal(stale.promptBundleVersion, PROMPT_BUNDLE_VERSION);
  });

  it("keeps legacy DB overrides saved before prompt_bundle_version column", () => {
    const legacy = resolveAdminSettings({
      candidatePrompt: "LEGACY CUSTOM",
      employerPrompt: "LEGACY EMPLOYER",
    });
    assert.match(legacy.candidatePrompt, /LEGACY CUSTOM/);
    assert.equal(hasCustomAdminPrompts({ candidatePrompt: "LEGACY CUSTOM", employerPrompt: "LEGACY EMPLOYER" }), true);
  });
});
