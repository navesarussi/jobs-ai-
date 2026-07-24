import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAssistantReplyText } from "./chat-reply";

describe("normalizeAssistantReplyText", () => {
  it("extracts reply from JSON object", () => {
    const raw = `{"reply":"שלום, איך אפשר לעזור?","patch":{"location":"תל אביב"},"fieldAnswers":{}}`;
    assert.equal(normalizeAssistantReplyText(raw), "שלום, איך אפשר לעזור?");
  });

  it("extracts reply from fenced JSON", () => {
    const raw = '```json\n{"reply":"היי דני","patch":{}}\n```';
    assert.equal(normalizeAssistantReplyText(raw), "היי דני");
  });

  it("returns plain text unchanged", () => {
    const raw = "מעולה, תל אביב והמרכז זה אזור שופע בהזדמנויות.";
    assert.equal(normalizeAssistantReplyText(raw), raw);
  });
});
