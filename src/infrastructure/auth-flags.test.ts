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
    process.env = { ...env, NODE_ENV: "test" };
    delete process.env.GOOGLE_AUTH_ENABLED;
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    delete process.env.AUTH_SECRET;
    delete process.env.ALLOW_TEST_LOGIN;
  });

  afterEach(() => {
    process.env = env;
  });

  it("auto-enables Google when credentials and AUTH_SECRET exist", () => {
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";
    process.env.AUTH_SECRET = "secret";
    assert.equal(isGoogleAuthEnabled(), true);
    assert.equal(hasGoogleAuth(), true);
    assert.equal(allowOpenAuth(), false);
  });

  it("respects explicit GOOGLE_AUTH_ENABLED=false", () => {
    process.env.GOOGLE_AUTH_ENABLED = "false";
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";
    process.env.AUTH_SECRET = "secret";
    assert.equal(isGoogleAuthEnabled(), false);
    assert.equal(hasGoogleAuth(), false);
  });

  it("enables test login by default and allows opt-out", () => {
    assert.equal(isTestLoginEnabled(), true);
    process.env.ALLOW_TEST_LOGIN = "false";
    assert.equal(isTestLoginEnabled(), false);
  });

  it("allows open auth only in development without google or test login", () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_TEST_LOGIN = "false";
    assert.equal(allowOpenAuth(), true);

    process.env.ALLOW_TEST_LOGIN = "true";
    assert.equal(allowOpenAuth(), false);
  });
});
