// The factory: turn a (style, seed) into a concrete paperclip spec by sampling
// deterministically within the style's parameter envelope, then run QA.
//
// Production is gated by QA: a sampled clip that fails inspection is "scrap"
// and does not count toward the manufactured total. This makes the headline
// number meaningful -- every counted paperclip provably functions.

import { getStyle, CATALOGS, LATEST_CATALOG } from "./styles.js";
import { makeRng } from "./rng.js";
import { analyze, qa, fingerprint } from "./paperclip.js";

/** Sample a spec for a given style + seed (deterministic). */
export function specFor(style, seed) {
  const s = getStyle(style);
  const rng = makeRng(`${style}:${seed}`);
  const r = (range) => rng.range(range[0], range[1]);
  return {
    style,
    seed,
    length: r(s.length),
    width: r(s.width),
    innerFrac: r(s.innerFrac),
    innerShift: r(s.innerShift),
    topMargin: r(s.topMargin),
    wire: r(s.wire),
    ripples: s.ripples,
    bottomGapFrac: r(s.bottomGapFrac),
    tongueFrac: r(s.tongueFrac),
    outerEndFrac: r(s.outerEndFrac),
  };
}

/** Pick a style deterministically from a global seed index + catalog version. */
export function styleForIndex(index, catalog = LATEST_CATALOG) {
  const list = CATALOGS[catalog];
  if (!list) throw new Error(`Unknown catalog version: ${catalog}`);
  return list[index % list.length];
}

/**
 * Manufacture and inspect one unit for a global seed index.
 * Returns { ok, style, seed, fingerprint, failed? }.
 */
export function manufactureOne(index, catalog = LATEST_CATALOG) {
  const style = styleForIndex(index, catalog);
  const spec = specFor(style, index);
  const metrics = analyze(spec);
  const result = qa(spec, metrics);
  return {
    ok: result.passed,
    style,
    seed: index,
    fingerprint: result.passed ? fingerprint(spec) : null,
    failed: result.passed ? null : result.checks.filter((c) => !c.ok).map((c) => c.name),
  };
}

/**
 * Produce a batch over seed indices [start, start+count).
 * Runs the full QA on every unit. Accumulates a rolling checksum over the
 * fingerprints of *passing* units, so the batch is independently reproducible
 * and verifiable without storing every clip.
 *
 * Returns aggregate stats only -- no per-unit arrays -- so it scales to
 * millions of units with constant memory.
 */
export function produceBatch(start, count, opts = {}) {
  const onUnit = opts.onUnit;
  const catalog = opts.catalog ?? LATEST_CATALOG;
  let made = 0;
  let scrap = 0;
  const byStyle = {};
  const scrapReasons = {};
  // FNV-1a rolling checksum over passing fingerprints.
  let checksum = 0x811c9dc5;
  const mix = (str) => {
    for (let i = 0; i < str.length; i++) {
      checksum ^= str.charCodeAt(i);
      checksum = Math.imul(checksum, 0x01000193);
    }
  };

  const end = start + count;
  for (let i = start; i < end; i++) {
    const unit = manufactureOne(i, catalog);
    if (unit.ok) {
      made++;
      byStyle[unit.style] = (byStyle[unit.style] || 0) + 1;
      mix(unit.fingerprint);
      mix("|");
    } else {
      scrap++;
      for (const reason of unit.failed) {
        scrapReasons[reason] = (scrapReasons[reason] || 0) + 1;
      }
    }
    if (onUnit) onUnit(unit, i);
  }

  return {
    start,
    count,
    catalog,
    made,
    scrap,
    passRate: count > 0 ? made / count : 0,
    byStyle,
    scrapReasons,
    checksum: (checksum >>> 0).toString(16).padStart(8, "0"),
  };
}
