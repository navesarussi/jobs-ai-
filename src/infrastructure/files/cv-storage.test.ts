import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  clearMemoryDocumentBlobs,
  readCandidateDocumentBlob,
  saveCandidateDocumentBlob,
} from "./cv-storage";

describe("cv-storage memory fallback", () => {
  const prevDb = process.env.DATABASE_URL;
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    clearMemoryDocumentBlobs();
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    clearMemoryDocumentBlobs();
    if (prevDb) process.env.DATABASE_URL = prevDb;
    else delete process.env.DATABASE_URL;
    process.env.NODE_ENV = prevEnv;
  });

  it("saves and reads blobs without DATABASE_URL", async () => {
    const content = Buffer.from("sample cv text content");
    const key = await saveCandidateDocumentBlob({
      id: "doc-1",
      userId: "demo-employee",
      content,
    });
    assert.match(key, /^mem:/);
    const read = await readCandidateDocumentBlob(key);
    assert.equal(read?.toString(), content.toString());
  });
});
