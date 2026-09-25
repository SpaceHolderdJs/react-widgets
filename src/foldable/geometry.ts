/*
 * Measurements of assets/phone.glb, in its own local space.
 *
 * The asset was prepared from the Sketchfab original so the runtime maths
 * stays trivial:
 *   - one of the download's four identical copies, baked FLAT OPEN;
 *   - the hinge is the Y axis through the origin;
 *   - "WingA" and "WingB" are bare pivots on that axis, each holding one half
 *     of the device, so their rotation.y IS the fold;
 *   - "Spine" is the hinge block and never moves;
 *   - the display faces +Z when flat, which is why the content plane needs no
 *     rotation and therefore no mirrored UVs. The camera is staged on +Z.
 *
 * The model carries the same numbers in asset.extras, so a replacement can be
 * checked against these.
 */

export const SCREEN = {
  width: 0.74914,
  height: 0.53131,
  x: 0.00441,
  y: -0.00136,
  /** Just proud of the glass, so the panel is never z-fought by it. */
  z: 0.02472,
} as const;

export const SCREEN_ASPECT = SCREEN.width / SCREEN.height;

/** The display faces +Z already, so the plane sits square to it. */
export const SCREEN_ROTATION: [number, number, number] = [0, 0, 0];

/** Flat open. 0 is shut, display against display. */
export const FOLD_OPEN_DEG = 180;

/**
 * Wing rotations for a fold angle in degrees.
 *
 * Baked flat, wing A bears 180 degrees about the hinge and wing B bears 0,
 * where bearing is atan2(z, x). A rotation of phi about Y maps a bearing theta
 * to theta - phi, and closing the book swings both wings towards +Z — towards
 * each other, displays inwards — so theta_A = 90 + f/2 and theta_B = 90 - f/2.
 *
 * KNOWN ASSET DEFECT: this is the correct pair, and the fold is still wrong
 * below about 150 degrees, because one of the two wings is mirrored in
 * assets/foldable.glb — it presents its back where its display should be. Flat
 * open, the content plane covers both halves and hides it, which is why it
 * survived every check. The fix belongs in scripts/build-foldable-asset.py,
 * not here; do not "correct" it by flipping these signs, which only swings the
 * crease towards the viewer instead and leaves the same wing backwards.
 */
export function wingRotations(foldDeg: number): [number, number] {
  const half = foldDeg / 2;
  const DEG = Math.PI / 180;
  return [(90 - half) * DEG, (half - 90) * DEG];
}
