import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dist,
  polylineLength,
  boundingBox,
  arcPoints,
  segmentDistance,
  segmentsIntersect,
  clamp,
} from "../src/geometry.js";

test("dist computes euclidean distance", () => {
  assert.equal(dist([0, 0], [3, 4]), 5);
});

test("polylineLength sums segments", () => {
  assert.equal(polylineLength([[0, 0], [0, 3], [4, 3]]), 7);
});

test("boundingBox covers all points", () => {
  const b = boundingBox([[1, 2], [-3, 5], [4, -1]]);
  assert.equal(b.minX, -3);
  assert.equal(b.maxX, 4);
  assert.equal(b.minY, -1);
  assert.equal(b.maxY, 5);
  assert.equal(b.width, 7);
  assert.equal(b.height, 6);
});

test("arcPoints traces a semicircle of the right radius", () => {
  const pts = arcPoints(0, 0, 5, 0, Math.PI, 32);
  assert.equal(pts.length, 33);
  for (const [x, y] of pts) {
    assert.ok(Math.abs(Math.hypot(x, y) - 5) < 1e-9);
  }
  // endpoints
  assert.ok(Math.abs(pts[0][0] - 5) < 1e-9);
  assert.ok(Math.abs(pts[32][0] + 5) < 1e-9);
});

test("segmentDistance: parallel segments", () => {
  const d = segmentDistance([0, 0], [10, 0], [0, 2], [10, 2]);
  assert.ok(Math.abs(d - 2) < 1e-9);
});

test("segmentDistance: crossing segments is 0", () => {
  const d = segmentDistance([0, 0], [10, 10], [0, 10], [10, 0]);
  assert.ok(d < 1e-9);
});

test("segmentsIntersect detects crossing", () => {
  assert.equal(segmentsIntersect([0, 0], [10, 10], [0, 10], [10, 0]), true);
  assert.equal(segmentsIntersect([0, 0], [1, 0], [0, 1], [1, 1]), false);
});

test("clamp clamps", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});
