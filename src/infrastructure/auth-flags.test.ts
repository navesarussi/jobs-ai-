import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  allowOpenAuth,
  hasGoogleAuth,
  isGoogleAuthEnabled,
  isTestLoginEnabled,
} from "./auth-flags";

describe("auth-flags", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.GOOGLE_AUTH_ENABLED;
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    delete process.env.ALLOW_TEST_LOGIN;
  });

  afterEach(() => {
    process.env = env;
  });

  it("treats Google as disabled by default", () => {
    assert.equal(isGoogleAuthEnabled(), false);
    assert.equal(allowOpenAuth(), true);
    assert.equal(hasGoogleAuth(), false);
  });

  it("enables Google only with flag and credentials", () => {
    process.env.GOOGLE_AUTH_ENABLED = "true";
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";
    assert.equal(hasGoogleAuth(), true);
    assert.equal(allowOpenAuth(), false);
  });

  it("enables test login via ALLOW_TEST_LOGIN", () => {
    assert.equal(isTestLoginEnabled(), false);
    process.env.ALLOW_TEST_LOGIN = "true";
    assert.equal(isTestLoginEnabled(), true);
  });
});
