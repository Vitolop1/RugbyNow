import assert from "node:assert/strict";
import test from "node:test";
import { readAllRows } from "../lib/readAllRows";

test("snapshot export keeps rows beyond Supabase's default 1000-row limit", async () => {
  const source = Array.from({length: 2160}, (_, id) => ({id}));
  const result = await readAllRows(async (offset, size) => ({data: source.slice(offset, offset + size), error: null}));
  assert.deepEqual(result, source);
});

test("a failed later page rejects the snapshot instead of publishing a partial backup", async () => {
  await assert.rejects(readAllRows(async (offset) => offset === 0
    ? {data: Array.from({length:1000}, (_, id) => ({id})), error: null}
    : {data:null, error:{message:"Database unavailable"}}), /Database unavailable/);
});
