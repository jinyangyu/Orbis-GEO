import assert from "node:assert/strict";
import test from "node:test";
import { rowsOf } from "../lib/db/rows.ts";

test("rowsOf unwraps mysql2 [rows, fields] tuples", () => {
  const rows = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(rowsOf([rows, { fieldCount: 1 }]), rows);
});

test("rowsOf accepts a plain row array", () => {
  const rows = [{ id: "a" }];
  assert.deepEqual(rowsOf(rows), rows);
});

test("rowsOf reads { rows } objects", () => {
  assert.deepEqual(rowsOf({ rows: [{ n: 3 }] }), [{ n: 3 }]);
});

test("rowsOf is empty for nullish or unknown shapes", () => {
  assert.deepEqual(rowsOf(null), []);
  assert.deepEqual(rowsOf(undefined), []);
  assert.deepEqual(rowsOf(1), []);
});
