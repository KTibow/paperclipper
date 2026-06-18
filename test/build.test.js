import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyLedger, addBatch } from "../src/ledger.js";
import { produceBatch } from "../src/factory.js";

const root = fileURLToPath(new URL("..", import.meta.url));

function buildInto(ledgerObj) {
  const dir = mkdtempSync(join(tmpdir(), "pc-build-"));
  const out = join(dir, "dist");
  const ledgerPath = join(dir, "ledger.json");
  mkdirSync(out, { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(ledgerObj));
  execFileSync("node", ["build/build-site.js"], {
    cwd: root,
    env: { ...process.env, OUT_DIR: out, LEDGER: ledgerPath },
    stdio: "pipe",
  });
  return out;
}

test("build produces a self-contained site from a populated ledger", () => {
  const ledger = emptyLedger();
  addBatch(ledger, produceBatch(0, 4000), { runId: "build-test" });
  const out = buildInto(ledger);

  assert.ok(existsSync(join(out, "index.html")));
  assert.ok(existsSync(join(out, "data.json")));
  assert.ok(existsSync(join(out, ".nojekyll")));

  const html = readFileSync(join(out, "index.html"), "utf8");
  // contains the verified total and at least one rendered paperclip
  assert.match(html, /Paperclips manufactured/);
  assert.match(html, new RegExp(`data-target="${ledger.totals.produced}"`));
  assert.ok((html.match(/<svg/g) || []).length >= 5, "expected gallery SVGs");
  assert.match(html, /data-target="\d+"/);

  const data = JSON.parse(readFileSync(join(out, "data.json"), "utf8"));
  assert.equal(data.totalProduced, ledger.totals.produced);
  assert.equal(data.chainChecksum, ledger.chainChecksum);
});

test("build works with an empty ledger (no crash, zero count)", () => {
  const out = buildInto(emptyLedger());
  const html = readFileSync(join(out, "index.html"), "utf8");
  assert.match(html, /data-target="0"/);
});
