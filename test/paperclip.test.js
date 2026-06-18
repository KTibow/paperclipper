import { test } from "node:test";
import assert from "node:assert/strict";
import { STYLE_NAMES } from "../src/styles.js";
import { specFor } from "../src/factory.js";
import {
  analyze,
  qa,
  buildGeometry,
  renderSVG,
  fingerprint,
  landmarks,
  LIMITS,
} from "../src/paperclip.js";

test("a standard clip passes every QA check", () => {
  const spec = specFor("standard", 7);
  const result = qa(spec);
  for (const c of result.checks) {
    assert.ok(c.ok, `check failed: ${c.name} (${c.detail})`);
  }
  assert.ok(result.passed);
});

test("at least one valid clip exists for every style", () => {
  for (const style of STYLE_NAMES) {
    let found = false;
    for (let s = 0; s < 200 && !found; s++) {
      if (qa(specFor(style, s)).passed) found = true;
    }
    assert.ok(found, `no passing clip found for style ${style}`);
  }
});

test("analytic wire length matches the sampled polyline", () => {
  for (const style of STYLE_NAMES) {
    const spec = specFor(style, 3);
    const a = analyze(spec);
    const g = buildGeometry(spec);
    assert.ok(
      Math.abs(a.wireLength - g.length) < 2,
      `${style}: analytic ${a.wireLength} vs sampled ${g.length}`,
    );
  }
});

test("geometry is deterministic for a given seed", () => {
  assert.equal(fingerprint(specFor("standard", 99)), fingerprint(specFor("standard", 99)));
  assert.notEqual(fingerprint(specFor("standard", 99)), fingerprint(specFor("standard", 100)));
});

test("buildGeometry yields a single continuous wire (no teleports)", () => {
  const spec = specFor("jumbo", 5);
  const g = buildGeometry(spec);
  assert.ok(g.points.length > 8);
  // A straight lane is one long segment; a real discontinuity would jump
  // farther than the clip's own longest dimension.
  const maxLegit = g.bbox.height + 0.01;
  for (let i = 1; i < g.points.length; i++) {
    const step = Math.hypot(
      g.points[i][0] - g.points[i - 1][0],
      g.points[i][1] - g.points[i - 1][1],
    );
    assert.ok(step <= maxLegit, `teleport at ${i}: step ${step} > ${maxLegit}`);
    assert.ok(Number.isFinite(step));
  }
});

test("QA rejects a clip with no clamping channel (lanes too far apart)", () => {
  const spec = { ...specFor("standard", 1), innerFrac: 0.05, innerShift: 0.5, width: 18 };
  const result = qa(spec);
  const clamp = result.checks.find((c) => c.name === "clamping-function");
  assert.equal(clamp.ok, false);
  assert.equal(result.passed, false);
});

test("QA rejects a degenerate (too small) clip", () => {
  const spec = { ...specFor("small", 1), length: 5, width: 3 };
  const result = qa(spec);
  assert.equal(result.passed, false);
  const size = result.checks.find((c) => c.name === "manufacturable-size");
  assert.equal(size.ok, false);
});

test("QA rejects fused lanes (thick wire, tiny gap)", () => {
  // Force inner lanes almost on top of the outer-left lane.
  const base = specFor("standard", 1);
  const spec = { ...base, width: 9, innerFrac: 0.9, innerShift: 0.02, wire: 1.0 };
  const result = qa(spec);
  // either ends up unordered/fused or fails clamp — must not pass.
  assert.equal(result.passed, false);
});

test("QA rejects out-of-order lanes (not well-formed)", () => {
  const spec = { ...specFor("standard", 1), innerFrac: 1.2 };
  const result = qa(spec);
  const wf = result.checks.find((c) => c.name === "well-formed");
  assert.equal(wf.ok, false);
});

test("renderSVG produces a valid-looking <svg> with one path", () => {
  const spec = specFor("ideal", 4);
  const { svg, viewBox } = renderSVG(spec);
  assert.match(svg, /^<svg /);
  assert.match(svg, /<path d="M/);
  assert.equal((svg.match(/<path /g) || []).length, 1);
  assert.match(svg, /stroke-width="/);
  assert.ok(viewBox.split(" ").every((n) => Number.isFinite(Number(n))));
});

test("landmarks keep lanes strictly ordered for sane specs", () => {
  const m = landmarks(specFor("standard", 50));
  assert.ok(m.A < m.B && m.B < m.C && m.C < m.D);
});

test("LIMITS are sane", () => {
  assert.ok(LIMITS.clampGapMin < LIMITS.clampGapMax);
  assert.ok(LIMITS.heightMin < LIMITS.heightMax);
});
