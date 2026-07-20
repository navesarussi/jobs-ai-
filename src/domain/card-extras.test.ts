import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extrasRows, mergeCardRows } from "./card-extras";

describe("card-extras", () => {
  it("includes dynamic extras after core rows", () => {
    const core = [{ key: "field", label: "תחום", value: "מכירות", filled: true }];
    const merged = mergeCardRows(core, { "ניסיון ב-B2B": "3 שנים" });
    assert.equal(merged.length, 2);
    assert.equal(merged[1]?.dynamic, true);
    assert.equal(merged[1]?.label, "ניסיון ב-B2B");
  });

  it("skips empty extras", () => {
    const rows = extrasRows({ empty: "", filled: "כן" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.key, "extras.filled");
  });
});
