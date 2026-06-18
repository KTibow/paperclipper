// Core paperclip model.
//
// A "Gem"-type paperclip is one continuous wire bent into four parallel
// vertical lanes connected by three U-turns:
//
//     A (outer-left)   B (inner-left)   C (inner-right)   D (outer-right)
//
// Traversal (one continuous wire, two free ends near the top):
//   end1 = top of B  (the short inner "tongue")
//   B  --down-->  inner-bottom U-turn  --> C  --up-->
//   top U-turn (C<->D) --> D --down--> outer-bottom U-turn (D<->A) --> A
//   --up--> end2 = top of A
//
// `analyze()` computes all QA-relevant metrics in closed form (fast, used for
// mass production). `buildGeometry()` samples the full polyline (used to render
// SVG for the gallery). Both are deterministic.

import {
  arcPoints,
  appendPoints,
  polylineLength,
  boundingBox,
  round,
} from "./geometry.js";
import { hashString } from "./rng.js";

const ARC_SEGMENTS = 18;

/** Derive all geometric landmarks from a spec (closed form). */
export function landmarks(spec) {
  const { length: L, width: W, innerFrac, innerShift } = spec;
  const innerWidth = innerFrac * W;
  const A = 0;
  const D = W;
  const B = innerShift * (W - innerWidth);
  const C = B + innerWidth;

  const rOB = W / 2; // outer bottom U-turn radius
  const rIB = innerWidth / 2; // inner bottom U-turn radius
  const rT = (D - C) / 2; // top U-turn radius (inner-right <-> outer-right)

  const outerBottomY = L - rOB; // centre of outer bottom turn
  const topY = spec.topMargin + rT; // centre of top turn
  const innerBottomY = outerBottomY - spec.bottomGapFrac * L;

  const e1y = spec.tongueFrac * L; // inner-left free end (tongue)
  const e2y = spec.outerEndFrac * L; // outer-left free end

  const rippleAmp = spec.ripples > 0 ? 0.3 : 0;

  return {
    A, B, C, D,
    rOB, rIB, rT,
    outerBottomY, topY, innerBottomY,
    e1y, e2y, innerWidth, rippleAmp,
  };
}

/** Closed-form metrics used by QA (no large arrays allocated). */
export function analyze(spec) {
  const m = landmarks(spec);
  const { A, B, C, D, rOB, rIB, rT, outerBottomY, topY, innerBottomY, e1y, e2y } = m;

  const laneA = outerBottomY - e2y;
  const laneB = innerBottomY - e1y;
  const laneC = innerBottomY - topY;
  const laneD = outerBottomY - topY;

  const wireLength =
    laneA + laneB + laneC + laneD +
    Math.PI * rIB + Math.PI * rT + Math.PI * rOB;

  const minX = A - m.rippleAmp;
  const maxX = D + m.rippleAmp;
  const minY = Math.min(e1y, e2y, topY - rT, innerBottomY + rIB - laneC);
  const topMost = Math.min(e2y, spec.topMargin); // arcs reach up to topMargin
  const bottomMost = outerBottomY + rOB;
  const bbox = {
    minX,
    maxX,
    minY: Math.min(minY, topMost),
    maxY: bottomMost,
    width: maxX - minX,
    height: bottomMost - Math.min(minY, topMost),
  };

  // Adjacent lane pairs: vertical overlap and horizontal centre gap.
  const lanes = [
    { name: "A", x: A, top: e2y, bot: outerBottomY },
    { name: "B", x: B, top: e1y, bot: innerBottomY },
    { name: "C", x: C, top: topY, bot: innerBottomY },
    { name: "D", x: D, top: topY, bot: outerBottomY },
  ];
  const pairs = [];
  for (let i = 0; i < lanes.length - 1; i++) {
    const l = lanes[i];
    const r = lanes[i + 1];
    const overlap = Math.max(
      0,
      Math.min(l.bot, r.bot) - Math.max(l.top, r.top),
    );
    pairs.push({ a: l.name, b: r.name, gap: r.x - l.x, overlap });
  }

  return { lanes, pairs, bbox, wireLength, landmarks: m, spec };
}

/** Stable content hash of a paperclip (spec + key metrics). */
export function fingerprint(spec) {
  const a = analyze(spec);
  const fields = [
    spec.style,
    spec.seed,
    round(spec.length, 3),
    round(spec.width, 3),
    round(spec.innerFrac, 4),
    round(spec.innerShift, 4),
    round(spec.topMargin, 3),
    round(spec.wire, 3),
    spec.ripples,
    round(spec.bottomGapFrac, 4),
    round(spec.tongueFrac, 4),
    round(spec.outerEndFrac, 4),
    round(a.wireLength, 2),
    round(a.bbox.width, 2),
    round(a.bbox.height, 2),
  ];
  return hashString(fields.join("|")).toString(16).padStart(8, "0");
}

// Manufacturability / functionality thresholds (millimetres).
export const LIMITS = {
  heightMin: 15,
  heightMax: 60,
  widthMin: 5,
  widthMax: 22,
  wireLengthMin: 30,
  wireLengthMax: 260,
  clampGapMin: 0.45,
  clampGapMax: 4.0,
  clampOverlapFrac: 0.45, // fraction of overall length
  clampZonesRequired: 2,
  edgeClearance: 0.15, // min gap between adjacent wire edges
  endMaxYFrac: 0.5, // free ends must sit in the top half
};

/**
 * Quality assurance. Returns { passed, checks: [{name, ok, detail}] }.
 * A clip "functions" only if every check passes.
 */
export function qa(spec, metrics = analyze(spec)) {
  const { lanes, pairs, bbox, wireLength } = metrics;
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });

  // 1. Lane ordering & finiteness (single, well-formed wire).
  const xs = lanes.map((l) => l.x);
  const finite = xs.every(Number.isFinite) &&
    Number.isFinite(wireLength) && Number.isFinite(bbox.width);
  const ordered = xs[0] < xs[1] && xs[1] < xs[2] && xs[2] < xs[3];
  add("well-formed", finite && ordered, `lanes=${xs.map((x) => round(x, 2)).join(",")}`);

  // 2. Manufacturable footprint.
  const sizeOk =
    bbox.height >= LIMITS.heightMin && bbox.height <= LIMITS.heightMax &&
    bbox.width >= LIMITS.widthMin && bbox.width <= LIMITS.widthMax;
  add("manufacturable-size", sizeOk,
    `h=${round(bbox.height, 2)} w=${round(bbox.width, 2)}`);

  // 3. Wire length within sane bounds and proportional to footprint.
  const lenOk =
    wireLength >= LIMITS.wireLengthMin && wireLength <= LIMITS.wireLengthMax &&
    wireLength >= bbox.height * 2 && wireLength <= bbox.height * 9;
  add("wire-length", lenOk, `len=${round(wireLength, 2)}`);

  // 4. Clamping function: >=2 channels that capture & grip paper.
  const clampZones = pairs.filter(
    (p) =>
      p.gap >= LIMITS.clampGapMin &&
      p.gap <= LIMITS.clampGapMax &&
      p.overlap >= LIMITS.clampOverlapFrac * bbox.height,
  );
  add("clamping-function", clampZones.length >= LIMITS.clampZonesRequired,
    `zones=${clampZones.length} (${clampZones.map((z) => `${z.a}${z.b}:${round(z.gap, 2)}`).join(" ")})`);

  // 5. No fusion: adjacent wire edges keep clearance (gap minus wire dia).
  let minEdge = Infinity;
  for (const p of pairs) {
    minEdge = Math.min(minEdge, p.gap - spec.wire);
  }
  add("no-fusion", minEdge >= LIMITS.edgeClearance, `minEdge=${round(minEdge, 3)}`);

  // 6. Free ends tucked safely into the top half (won't snag/scratch).
  const ends = [
    { x: lanes[1].x, y: metrics.landmarks.e1y },
    { x: lanes[0].x, y: metrics.landmarks.e2y },
  ];
  const endsOk = ends.every(
    (e) =>
      Number.isFinite(e.x) && Number.isFinite(e.y) &&
      e.y >= bbox.minY - 1e-6 &&
      e.y <= bbox.minY + LIMITS.endMaxYFrac * bbox.height &&
      e.x >= bbox.minX - 1e-6 && e.x <= bbox.maxX + 1e-6,
  );
  add("ends-tucked", endsOk, `ends=${ends.map((e) => round(e.y, 2)).join(",")}`);

  const passed = checks.every((c) => c.ok);
  return { passed, checks };
}

/** Build the full wire centreline polyline (for rendering). */
export function buildGeometry(spec) {
  const m = landmarks(spec);
  const { A, B, C, D, rOB, rIB, rT, outerBottomY, topY, innerBottomY, e1y, e2y } = m;
  const HALF = Math.PI;

  const path = [];
  // Lane B downward (tongue end -> inner bottom)
  appendPoints(path, rippleLane(B, e1y, innerBottomY, m, "B"));
  // Inner bottom U-turn B -> C (dips down): theta 180 -> 0
  appendPoints(path, arcPoints((B + C) / 2, innerBottomY, rIB, HALF, 0, ARC_SEGMENTS));
  // Lane C upward (inner bottom -> top turn)
  appendPoints(path, rippleLane(C, innerBottomY, topY, m, "C"));
  // Top U-turn C -> D (rises up): theta 180 -> 360
  appendPoints(path, arcPoints((C + D) / 2, topY, rT, HALF, 2 * HALF, ARC_SEGMENTS));
  // Lane D downward (top turn -> outer bottom)
  appendPoints(path, rippleLane(D, topY, outerBottomY, m, "D"));
  // Outer bottom U-turn D -> A (dips down): theta 0 -> 180
  appendPoints(path, arcPoints((A + D) / 2, outerBottomY, rOB, 0, HALF, ARC_SEGMENTS));
  // Lane A upward (outer bottom -> outer-left end)
  appendPoints(path, rippleLane(A, outerBottomY, e2y, m, "A"));

  return {
    points: path,
    length: polylineLength(path),
    bbox: boundingBox(path),
  };
}

// Sample a straight vertical lane from yStart to yEnd. Ripples (non-skid)
// add small *outward* bumps on the outer lanes only, so inter-lane spacing
// is never reduced.
function rippleLane(x, yStart, yEnd, m, name) {
  const dir = yEnd >= yStart ? 1 : -1;
  const span = Math.abs(yEnd - yStart);
  const ripples = (name === "A" || name === "D") ? m.rippleAmp : 0;
  const steps = ripples > 0 ? Math.max(12, Math.round(span / 1.2)) : 1;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const y = yStart + dir * (span * i) / steps;
    let xo = x;
    if (ripples > 0) {
      const phase = (i / steps) * Math.PI * 5;
      const bump = m.rippleAmp * Math.max(0, Math.sin(phase));
      xo = name === "A" ? x - bump : x + bump; // outward only
    }
    pts.push([xo, y]);
  }
  return pts;
}

/** Render the paperclip as an SVG <path>. Returns { svg, viewBox }. */
export function renderSVG(spec, opts = {}) {
  const geo = opts.geometry || buildGeometry(spec);
  const pad = (opts.pad ?? spec.wire) + spec.wire / 2 + 1;
  const b = geo.bbox;
  const minX = b.minX - pad;
  const minY = b.minY - pad;
  const w = b.width + pad * 2;
  const h = b.height + pad * 2;
  const viewBox = `${round(minX, 3)} ${round(minY, 3)} ${round(w, 3)} ${round(h, 3)}`;

  const d = geo.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${round(p[0], 3)},${round(p[1], 3)}`)
    .join(" ");

  const stroke = opts.stroke || "#9aa7b4";
  const bg = opts.background;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
    `width="${opts.size || 120}" role="img" aria-label="${spec.style} paperclip">` +
    (bg ? `<rect x="${round(minX, 3)}" y="${round(minY, 3)}" width="${round(w, 3)}" height="${round(h, 3)}" fill="${bg}"/>` : "") +
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${spec.wire}" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return { svg, viewBox };
}

/** Convenience: full record for one paperclip. */
export function makePaperclip(spec) {
  const metrics = analyze(spec);
  const result = qa(spec, metrics);
  return { spec, metrics, qa: result, fingerprint: fingerprint(spec) };
}
