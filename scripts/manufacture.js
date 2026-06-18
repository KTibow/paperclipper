#!/usr/bin/env node
// Production run: manufacture a batch of paperclips (QA-gated) and append the
// results to the ledger. Designed to run in CI on every cron tick.
//
// Usage:
//   node scripts/manufacture.js --count=50000
//   node scripts/manufacture.js --max-seconds=120          (time-budgeted)
//   node scripts/manufacture.js --count=20000 --chunk=20000 --ledger=path

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { produceBatch } from "../src/factory.js";
import { emptyLedger, addBatch } from "../src/ledger.js";

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }
  return args;
}

function loadLedger(path) {
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf8"));
  }
  return emptyLedger();
}

function saveLedger(path, ledger) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(ledger, null, 2) + "\n");
}

function num(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

const args = parseArgs(process.argv);
const ledgerPath = args.ledger || "inventory/ledger.json";
const chunk = Math.max(1, num(args.chunk, 25000));
const maxSeconds = args["max-seconds"] ? num(args["max-seconds"], 0) : 0;
const targetCount = maxSeconds ? Infinity : num(args.count, 50000);

const meta = {
  runId: process.env.GITHUB_RUN_ID || null,
  actor: process.env.GITHUB_ACTOR || process.env.USER || null,
  runUrl:
    process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
      ? `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
};

const ledger = loadLedger(ledgerPath);
const startSeed = ledger.nextSeed;
const startedAt = Date.now();
let producedThisRun = 0;
let madeThisRun = 0;
let scrapThisRun = 0;

console.log(
  `[manufacture] starting at seed ${startSeed}; ` +
    (maxSeconds ? `time budget ${maxSeconds}s` : `target ${targetCount}`) +
    `; chunk ${chunk}`,
);

while (producedThisRun < targetCount) {
  const remaining = targetCount === Infinity ? chunk : Math.min(chunk, targetCount - producedThisRun);
  const batch = produceBatch(ledger.nextSeed, remaining);
  addBatch(ledger, batch, meta);
  producedThisRun += batch.count;
  madeThisRun += batch.made;
  scrapThisRun += batch.scrap;

  const elapsed = (Date.now() - startedAt) / 1000;
  if (maxSeconds && elapsed >= maxSeconds) break;
}

saveLedger(ledgerPath, ledger);

const summary = {
  startSeed,
  producedThisRun,
  madeThisRun,
  scrapThisRun,
  passRate: producedThisRun ? madeThisRun / producedThisRun : 0,
  totalProduced: ledger.totals.produced,
  totalInspected: ledger.totals.inspected,
  nextSeed: ledger.nextSeed,
  chainChecksum: ledger.chainChecksum,
  seconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
};
console.log(`[manufacture] done:`, JSON.stringify(summary, null, 2));

// Emit a machine-readable line for CI summaries.
if (process.env.GITHUB_STEP_SUMMARY) {
  const line =
    `### 🏭 Manufacturing run\n\n` +
    `- Made this run: **${madeThisRun.toLocaleString()}** (${scrapThisRun.toLocaleString()} scrapped, ` +
    `${(summary.passRate * 100).toFixed(2)}% yield)\n` +
    `- **Total paperclips: ${ledger.totals.produced.toLocaleString()}**\n` +
    `- Next seed: ${ledger.nextSeed.toLocaleString()} · chain ${ledger.chainChecksum}\n`;
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, line, { flag: "a" });
}
