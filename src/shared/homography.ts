/*
 * Mapping a rectangle of DOM onto an arbitrary quadrilateral.
 *
 * This is what lets the screen be real HTML without going anywhere near CSS
 * perspective.
 *
 * The display is a flat rectangle in the scene, so whatever the camera does to
 * it, the result on screen is a planar projective transform — a homography.
 * Four projected corners determine it completely, and CSS can apply one
 * directly: `matrix3d` carries the two perspective terms that a plain
 * `matrix` cannot, and with no `perspective` property anywhere the browser
 * never has to divide by a distance it was not given.
 *
 * Which removes the whole class of bug that CSS 3D brought with it. There is
 * no perspective origin to approach, so nothing runs away as the camera
 * closes in; there is no near plane to miss, because a corner behind the
 * camera is something we detect and hide; and the element stays exactly the
 * size it was authored at, so no browser is ever asked to lay out a div a
 * million pixels wide. The same numbers come out on any canvas, at any device
 * pixel ratio, at any field of view.
 */

/** Screen-space corner, in CSS pixels relative to the canvas. */
export type Corner = { x: number; y: number };

/**
 * The CSS transform that maps a `w` x `h` element onto `quad`.
 *
 * `quad` is top-left, top-right, bottom-right, bottom-left, in that order, and
 * the element must carry `transform-origin: 0 0` for the result to land.
 * Returns null when no such mapping exists — a quad folded over on itself, or
 * one that has passed through the camera — and the caller should hide the
 * element rather than draw a guess.
 */
export function quadTransform(
  quad: [Corner, Corner, Corner, Corner],
  w: number,
  h: number,
): string | null {
  if (w <= 0 || h <= 0) return null;
  for (const p of quad) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  }

  // A projected rectangle stays convex, and its corners keep their winding.
  // If either fails, the plane is edge on or partly behind the camera, and
  // there is nothing honest to draw.
  if (!isConvex(quad)) return null;

  const [p0, p1, p2, p3] = quad;

  // The standard unit-square-to-quad solution. `den` vanishes only for a
  // degenerate quad, which the convexity test above has already rejected,
  // but it is cheap to be sure.
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;

  const den = dx1 * dy2 - dx2 * dy1;
  if (!den) return null;

  const g = (sx * dy2 - dx2 * sy) / den;
  const i = (dx1 * sy - sx * dy1) / den;

  // Columns of the homography, with the element's own size folded in so it can
  // be authored at its natural pixel dimensions rather than as a unit square.
  const a = (p1.x - p0.x + g * p1.x) / w;
  const d = (p1.y - p0.y + g * p1.y) / w;
  const gg = g / w;

  const b = (p3.x - p0.x + i * p3.x) / h;
  const e = (p3.y - p0.y + i * p3.y) / h;
  const ii = i / h;

  const c = p0.x;
  const f = p0.y;

  for (const n of [a, d, gg, b, e, ii, c, f]) {
    if (!Number.isFinite(n)) return null;
  }

  // Column major, with the unused third row and column left as identity.
  return (
    `matrix3d(${a},${d},0,${gg},` +
    `${b},${e},0,${ii},` +
    `0,0,1,0,` +
    `${c},${f},0,1)`
  );
}

/**
 * Convex and consistently wound.
 *
 * Every cross product of consecutive edges has to share a sign. A rectangle
 * whose projection folds over — one corner swinging behind the camera and
 * reappearing on the far side — breaks that, and so does a plane seen exactly
 * edge on.
 */
function isConvex(quad: [Corner, Corner, Corner, Corner]): boolean {
  let sign = 0;
  for (let k = 0; k < 4; k++) {
    const a = quad[k];
    const b = quad[(k + 1) % 4];
    const c = quad[(k + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}
