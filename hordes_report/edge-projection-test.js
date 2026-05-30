"use strict";
// Headless verification of the incoming-warning edge-clamp projection math
// (mirrors projectRuntimePointWithMatrix + projectRuntimeIncomingWarningPoint).
// Proves: on-screen -> unchanged; off-screen-front -> clamped to edge;
// behind-camera -> mirrored then clamped; result always inside the canvas rect.

let assertions = 0;
function assert(cond, msg) { assertions++; if (!cond) throw new Error("FAIL: " + msg); }
function approx(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }

const rect = { left: 100, top: 50, width: 800, height: 600 };

// column-major projectRuntimePointWithMatrix (the path the code tries first)
function projectClip(position, matrix) {
  const [x, y, z] = position;
  const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
  const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
  const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (![clipX, clipY, clipW].every(Number.isFinite) || Math.abs(clipW) < 0.00001) return null;
  return { ndcX: clipX / clipW, ndcY: clipY / clipW, clipW };
}
function isUsable(ndcX, ndcY, clipW) {
  return clipW > 0 && ndcX >= -1.35 && ndcX <= 1.35 && ndcY >= -1.35 && ndcY <= 1.35;
}
function toScreen(ndcX, ndcY, off) {
  return { x: rect.left + (ndcX * 0.5 + 0.5) * rect.width, y: rect.top + (-ndcY * 0.5 + 0.5) * rect.height, offScreen: off };
}
// full pipeline: on-screen first, else edge-clamp
function project(position, matrix) {
  const raw = projectClip(position, matrix);
  if (!raw) return null;
  if (isUsable(raw.ndcX, raw.ndcY, raw.clipW)) return toScreen(raw.ndcX, raw.ndcY, false);
  let { ndcX, ndcY, clipW } = raw;
  if (clipW <= 0) { ndcX = -ndcX; ndcY = -ndcY; }
  const limit = 0.98;
  return toScreen(Math.max(-limit, Math.min(limit, ndcX)), Math.max(-limit, Math.min(limit, ndcY)), true);
}

// A simple perspective: clipX=x, clipY=y, clipW=z (so ndc = x/z, y/z; z = depth in front).
// column-major indices used above: [0]=x->clipX, [5]=y->clipY, [11]=z->clipW.
const M = new Array(16).fill(0);
M[0] = 1;   // clipX = x
M[5] = 1;   // clipY = y
M[11] = 1;  // clipW = z

// Case 1: dead center, in front (z=10) -> on screen, not clamped
let p = project([0, 0, 10], M);
assert(p && p.offScreen === false, "center/front is on-screen (not clamped)");
assert(approx(p.x, rect.left + rect.width / 2), "center x is canvas center");
assert(approx(p.y, rect.top + rect.height / 2), "center y is canvas center");

// Case 2: far to the right but in front (x=100,z=10 -> ndcX=10) -> off-screen front, clamped to right edge
p = project([100, 0, 10], M);
assert(p && p.offScreen === true, "far-right/front is flagged off-screen");
assert(approx(p.x, rect.left + (0.98 * 0.5 + 0.5) * rect.width), "clamped to right edge x");
assert(p.x <= rect.left + rect.width && p.x >= rect.left, "clamped x stays inside canvas");

// Case 3: behind the camera (z negative) with target to my right (x>0).
// Raw ndcX = x/z = positive/negative = negative (mirrored). Code flips sign -> positive -> right edge.
p = project([100, 0, -10], M);
assert(p && p.offScreen === true, "behind-camera is flagged off-screen");
assert(p.x > rect.left + rect.width / 2, "behind-camera threat on the right maps to RIGHT half (mirror corrected): x=" + p.x);
assert(p.x <= rect.left + rect.width && p.x >= rect.left, "behind-camera clamped x inside canvas");
assert(p.y <= rect.top + rect.height && p.y >= rect.top, "behind-camera clamped y inside canvas");

// Case 4: behind-camera threat on the LEFT (x<0) -> left half
p = project([-100, 0, -10], M);
assert(p.x < rect.left + rect.width / 2, "behind-camera threat on the left maps to LEFT half: x=" + p.x);

// Case 5: degenerate clipW ~ 0 -> null (no crash, candidate simply skipped)
p = project([0, 0, 0], M);
assert(p === null, "near-zero clipW returns null safely");

console.log(`ALL ${assertions} ASSERTIONS PASSED`);
