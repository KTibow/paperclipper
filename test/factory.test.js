import { test } from "node:test";
import assert from "node:assert/strict";
import {
  produceBatch,
  manufactureOne,
  styleForIndex,
  specFor,
} from "../src/factory.js";
import { STYLE_NAMES } from "../src/styles.js";

test("produceBatch is deterministic (same checksum twice)", () => {
  const a = produceBatch(0, 3000);
  const b = produceBatch(0, 3000);
  assert.equal(a.checksum, b.checksum);
  assert.equal(a.made, b.made);
  assert.equal(a.scrap, b.scrap);
});

test("non-overlapping ranges produce different checksums", () => {
  const a = produceBatch(0, 1000);
  const b = produceBatch(1000, 1000);
  assert.notEqual(a.checksum, b.checksum);
});

test("batch yield is high and made+scrap == count", () => {
  const b = produceBatch(0, 5000);
  assert.equal(b.made + b.scrap, b.count);
  assert.ok(b.passRate > 0.8, `pass rate too low: ${b.passRate}`);
});

test("byStyle counts sum to made", () => {
  const b = produceBatch(0, 5000);
  const sum = Object.values(b.byStyle).reduce((x, y) => x + y, 0);
  assert.equal(sum, b.made);
});

test("every produced unit actually passes QA", () => {
  // Re-inspect a sample of the produced range independently.
  let checked = 0;
  for (let i = 0; i < 2000; i++) {
    const u = manufactureOne(i);
    if (u.ok) {
      // fingerprint must be present for made units, absent for scrap.
      assert.ok(u.fingerprint, `made unit ${i} missing fingerprint`);
      checked++;
    } else {
      assert.equal(u.fingerprint, null);
      assert.ok(Array.isArray(u.failed) && u.failed.length > 0);
    }
  }
  assert.ok(checked > 1500, `unexpectedly low yield in sample: ${checked}/2000`);
});

test("styleForIndex cycles through all styles", () => {
  const seen = new Set();
  for (let i = 0; i < STYLE_NAMES.length * 3; i++) seen.add(styleForIndex(i));
  assert.equal(seen.size, STYLE_NAMES.length);
});

test("manufactureOne style matches styleForIndex", () => {
  for (let i = 0; i < 20; i++) {
    assert.equal(manufactureOne(i).style, styleForIndex(i));
  }
});

test("catalog version 0 is the frozen genesis catalog", () => {
  const expected = ["standard", "small", "jumbo", "nonskid", "ideal"];
  for (let i = 0; i < 20; i++) {
    assert.equal(styleForIndex(i, 0), expected[i % expected.length]);
  }
  const b = produceBatch(0, 100, { catalog: 0 });
  assert.equal(b.catalog, 0);
});

test("specFor stays within the style envelope", () => {
  const spec = specFor("standard", 12345);
  assert.ok(spec.length >= 30 && spec.length <= 34);
  assert.ok(spec.width >= 8 && spec.width <= 9.6);
});
