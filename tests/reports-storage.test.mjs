import assert from "node:assert/strict";
import test from "node:test";
import {
  isStoredFilePath,
  parseStoredFilePath,
} from "../lib/reports/storage.ts";

test("isStoredFilePath recognizes local/s3 prefixes", () => {
  assert.equal(isStoredFilePath("local:ws/id.pdf"), true);
  assert.equal(isStoredFilePath("s3:ws/id.pdf"), true);
  assert.equal(isStoredFilePath("client-download"), false);
  assert.equal(isStoredFilePath(null), false);
});

test("parseStoredFilePath", () => {
  assert.deepEqual(parseStoredFilePath("local:a/b.pdf"), {
    backend: "local",
    key: "a/b.pdf",
  });
  assert.deepEqual(parseStoredFilePath("s3:a/b.pdf"), {
    backend: "s3",
    key: "a/b.pdf",
  });
  assert.equal(parseStoredFilePath("client-download"), null);
});
