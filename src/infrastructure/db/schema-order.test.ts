import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("schema migration ordering", () => {
  it("does not create conversation_context index in base CREATE TABLE SQL", () => {
    const sql = readFileSync(join(__dirname, "schema-sql.ts"), "utf8");
    assert.equal(
      /create index if not exists chat_messages_context_idx/.test(sql),
      false,
      "context index must live in ALTERS after the column exists",
    );
  });

  it("adds conversation_context column before creating its index", () => {
    const src = readFileSync(join(__dirname, "schema.ts"), "utf8");
    const addCol = src.indexOf(
      "alter table chat_messages add column if not exists conversation_context",
    );
    const createIdx = src.indexOf("chat_messages_context_idx");
    assert.ok(addCol >= 0, "missing add column for conversation_context");
    assert.ok(createIdx >= 0, "missing context index in ALTERS");
    assert.ok(addCol < createIdx, "index must come after add column");
  });
});
