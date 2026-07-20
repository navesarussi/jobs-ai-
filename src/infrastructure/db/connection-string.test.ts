import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPoolerConnectionString } from "./connection-string";

describe("toPoolerConnectionString", () => {
  it("rewrites direct supabase db host to pooler", () => {
    const input =
      "postgresql://postgres:secret@db.abc123xyz.supabase.co:5432/postgres";
    const out = toPoolerConnectionString(input, "ap-southeast-2");
    assert.match(out, /postgres\.abc123xyz:secret@aws-0-ap-southeast-2\.pooler\.supabase\.com:6543/);
  });

  it("leaves already-pooled urls unchanged", () => {
    const input =
      "postgresql://postgres.abc:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
    assert.equal(toPoolerConnectionString(input), input);
  });
});
