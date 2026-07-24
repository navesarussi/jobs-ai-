import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCvUploadChatMessage, isCvUploadChatContent } from "./cv-upload-chat";

describe("buildCvUploadChatMessage", () => {
  it("formats Hebrew CV upload chat line", () => {
    const msg = buildCvUploadChatMessage("resume.pdf", "he");
    assert.equal(msg.role, "user");
    assert.equal(msg.content, "קורות חיים: resume.pdf");
  });
});

describe("isCvUploadChatContent", () => {
  it("detects CV upload chat lines", () => {
    assert.equal(isCvUploadChatContent("קורות חיים: resume.pdf"), true);
    assert.equal(isCvUploadChatContent("CV: resume.pdf"), true);
    assert.equal(isCvUploadChatContent("שלום"), false);
  });
});
