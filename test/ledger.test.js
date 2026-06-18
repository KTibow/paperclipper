import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyLedger,
  addBatch,
  verifyLedger,
  foldChecksum,
  MAX_BATCHES,
} from "../src/ledger.js";
import { produceBatch } from "../src/factory.js";

function buildLedger(batches, size = 1000) {
  const ledger = emptyLedger();
  for (let i = 0; i < batches; i++) {
    addBatch(ledger, produceBatch(ledger.nextSeed, size), { runId: `t${i}` });
  }
  return ledger;
}

test("addBatch enforces contiguity", () => {
  const ledger = emptyLedger();
  assert.throws(() => addBatch(ledger, produceBatch(500, 100)));
});

test("addBatch accumulates totals correctly", () => {
  const ledger = buildLedger(3, 1000);
  assert.equal(ledger.nextSeed, 3000);
  assert.equal(ledger.totals.inspected, 3000);
  assert.equal(ledger.totals.produced + ledger.totals.scrap, ledger.totals.inspected);
  const styleSum = Object.values(ledger.byStyle).reduce((a, b) => a + b, 0);
  assert.equal(styleSum, ledger.totals.produced);
});

test("a freshly built ledger verifies", () => {
  const ledger = buildLedger(4, 1500);
  const result = verifyLedger(ledger, { sample: 300 });
  assert.ok(result.ok, JSON.stringify(result.errors));
  assert.ok(result.stats.sampled > 0);
});

test("verify detects a tampered batch checksum", () => {
  const ledger = buildLedger(3, 1000);
  ledger.batches[1].checksum = "deadbeef";
  const result = verifyLedger(ledger, { sample: 50 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("checksum")));
});

test("verify detects an inflated produced count", () => {
  const ledger = buildLedger(2, 1000);
  ledger.totals.produced += 999999;
  const result = verifyLedger(ledger, { sample: 50 });
  assert.equal(result.ok, false);
});

test("archiving keeps totals exact and ledger verifiable", () => {
  // Exceed MAX_BATCHES so the archive path runs.
  const ledger = buildLedger(MAX_BATCHES + 5, 200);
  assert.equal(ledger.batches.length, MAX_BATCHES);
  assert.equal(ledger.archive.batchCount, 5);
  // archive + retained == totals
  const result = verifyLedger(ledger, { sample: 200 });
  assert.ok(result.ok, JSON.stringify(result.errors));
  assert.equal(ledger.archive.produced + retainedMade(ledger), ledger.totals.produced);
});

function retainedMade(ledger) {
  return ledger.batches.reduce((a, b) => a + b.made, 0);
}

test("foldChecksum is order-sensitive and stable", () => {
  const a = foldChecksum("811c9dc5", "aaaa");
  const b = foldChecksum("811c9dc5", "aaaa");
  assert.equal(a, b);
  assert.notEqual(foldChecksum(a, "bbbb"), foldChecksum(a, "cccc"));
});

test("empty ledger verifies trivially", () => {
  const result = verifyLedger(emptyLedger(), { sample: 10 });
  assert.ok(result.ok);
});
