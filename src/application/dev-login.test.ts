import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSeedStore, resetMemoryStore } from "@/infrastructure/db/memory-store";
import { listDevUsers, resolveDevLogin } from "./dev-login";

describe("dev-login", () => {
  it("lists seeded users", () => {
    resetMemoryStore();
    const users = listDevUsers();
    assert.ok(users.some((u) => u.id === "demo-employee"));
  });

  it("resolves admin login", () => {
    const result = resolveDevLogin({ mode: "admin" });
    assert.equal(result.kind, "admin");
    assert.equal(result.redirect, "/admin");
  });

  it("resolves existing user login", () => {
    resetMemoryStore();
    const result = resolveDevLogin({ mode: "existing", userId: "demo-employee" });
    assert.equal(result.kind, "user");
    if (result.kind === "user") {
      assert.equal(result.user.id, "demo-employee");
      assert.equal(result.redirect, "/employee");
    }
  });

  it("resolves new user login", () => {
    const result = resolveDevLogin({ mode: "new", name: "בדיקה" });
    assert.equal(result.kind, "user");
    if (result.kind === "user") {
      assert.equal(result.user.name, "בדיקה");
      assert.equal(result.redirect, "/employee");
    }
  });
});
