// Geometry primitives for paperclip wire centerlines.
// All units are millimetres. Coordinate system: x -> right (width),
// y -> down (length). This module is dependency-free and deterministic.

/** Euclidean distance between two [x, y] points. */
export function dist(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy);
}

/** Total arc length of a polyline (array of [x, y] points). */
export function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(points[i - 1], points[i]);
  }
  return total;
}

/** Axis-aligned bounding box of a set of points. */
export function boundingBox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Sample points along a circular arc.
 * Angles are in radians. Point = center + r*(cos t, sin t).
 * Because y grows downward, positive sin(t) is "down" on screen.
 */
export function arcPoints(cx, cy, r, thetaStart, thetaEnd, segments) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = thetaStart + ((thetaEnd - thetaStart) * i) / segments;
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return pts;
}

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
export { DEG, TWO_PI };

/**
 * Append points to a path array without duplicating the joining vertex.
 * Keeps the polyline free of zero-length segments at arc/line junctions.
 */
export function appendPoints(path, points, eps = 1e-9) {
  for (const p of points) {
    const last = path[path.length - 1];
    if (!last || dist(last, p) > eps) {
      path.push(p);
    }
  }
  return path;
}

/**
 * Shortest distance between two line segments p1-p2 and p3-p4.
 * Used by QA to ensure wire runs neither fuse nor cross destructively.
 */
export function segmentDistance(p1, p2, p3, p4) {
  const close = closestPointsBetweenSegments(p1, p2, p3, p4);
  return dist(close.a, close.b);
}

function closestPointsBetweenSegments(p1, p2, p3, p4) {
  const d1 = [p2[0] - p1[0], p2[1] - p1[1]];
  const d2 = [p4[0] - p3[0], p4[1] - p3[1]];
  const r = [p1[0] - p3[0], p1[1] - p3[1]];
  const a = d1[0] * d1[0] + d1[1] * d1[1];
  const e = d2[0] * d2[0] + d2[1] * d2[1];
  const f = d2[0] * r[0] + d2[1] * r[1];

  let s;
  let t;
  const EPS = 1e-12;
  if (a <= EPS && e <= EPS) {
    s = 0;
    t = 0;
  } else if (a <= EPS) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = d1[0] * r[0] + d1[1] * r[1];
    if (e <= EPS) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = d1[0] * d2[0] + d1[1] * d2[1];
      const denom = a * e - b * b;
      s = denom > EPS ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  return {
    a: [p1[0] + d1[0] * s, p1[1] + d1[1] * s],
    b: [p3[0] + d2[0] * t, p3[1] + d2[1] * t],
  };
}

/** Do segments p1-p2 and p3-p4 properly intersect (cross)? */
export function segmentsIntersect(p1, p2, p3, p4) {
  const o1 = orient(p1, p2, p3);
  const o2 = orient(p1, p2, p4);
  const o3 = orient(p3, p4, p1);
  const o4 = orient(p3, p4, p2);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function orient(a, b, c) {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(v) < 1e-12) return 0;
  return v > 0 ? 1 : -1;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Round a number to a fixed number of decimals (stable string output). */
export function round(v, decimals = 4) {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
