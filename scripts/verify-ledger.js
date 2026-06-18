#!/usr/bin/env node
// Independently re-verify the production ledger. Exits non-zero on any
// discrepancy, so CI fails loudly if the count was ever fabricated or the
// factory's output drifted.

import { readFileSync, existsSync } from "node:fs";
import { verifyLedger, emptyLedger } from "../src/ledger.js";

const path = process.argv[2] || "inventory/ledger.json";
const sample = Number(process.env.VERIFY_SAMPLE || 1000);

const ledger = existsSync(path)
  ? JSON.parse(readFileSync(path, "utf8"))
  : emptyLedger();

console.log(`[verify] checking ${path} (nextSeed=${ledger.nextSeed}, sample=${sample})`);
const result = verifyLedger(ledger, { sample });

console.log(`[verify] stats:`, JSON.stringify(result.stats));
if (!result.ok) {
  console.error(`[verify] FAILED with ${result.errors.length} error(s):`);
  for (const e of result.errors) console.error("  - " + e);
  process.exit(1);
}
console.log(
  `[verify] OK — ${ledger.totals.produced.toLocaleString()} paperclips verified ` +
    `(chain ${ledger.chainChecksum}).`,
);
