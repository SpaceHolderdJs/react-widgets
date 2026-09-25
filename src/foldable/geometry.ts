/*
 * Measurements of assets/foldable.glb, in its own local space.
 *
 * The asset was prepared from the Sketchfab original so the runtime maths
 * stays trivial:
 *   - one of the download's four identical copies, baked FLAT OPEN;
 *   - the hinge is the Y axis through the origin;
 *   - "WingA" and "WingB" are bare pivots on that axis, each holding one half
 *     of the device, so their rotation.y IS the fold;
 *   - "Spine" is the hinge block and never moves.
 *
 * ONE THING IT GOT WRONG: the asset is baked back to front. Its display faces
 * -Z, not +Z, so the scene turns the model a half turn about the hinge axis
 * (MODEL_YAW below) before anything else happens. Flat open this is invisible
 * — the content plane covers the whole face either way — and it only shows
 * once the device folds, as a book that opens away from you and presents its
 * back. Which is why it survived every check made at 180 degrees.
 *
 * The half turn belongs in scripts/build-foldable-asset.py really; it lives
 * here so the published asset does not have to be reissued to fix a fold.
 *
 * The model carries the same numbers in asset.extras, so a replacement can be
 * checked against these.
 */

/**
 * The half turn that puts the display on +Z, where the camera is staged.
 *
 * It is applied to the model alone, not to the group the timeline animates,
 * so `initialRotation` still means what it says. The hinge is the Y axis
 * through the origin and this turns about that same axis, so the wings keep
 * pivoting exactly where they did.
 */
export const MODEL_YAW = Math.PI;

export const SCREEN = {
  width: 0.74914,
  height: 0.53131,
  /** Negated against the asset: the half turn above mirrors x. */
  x: -0.00441,
  y: -0.00136,
  /**
   * Just proud of the display glass.
   *
   * The asset pipeline measured this against the wrong face — the device's
   * back sits at 0.0247 and its display at 0.0398, and with the model turned
   * the difference put the panel a centimetre and a half INSIDE the device.
   * Dead on it still looked plausible; from any angle it parallaxed sideways
   * and left a strip of bare display down one edge.
   */
  z: 0.0405,
} as const;

export const SCREEN_ASPECT = SCREEN.width / SCREEN.height;

/** The turned model presents its display on +Z, so the plane sits square. */
export const SCREEN_ROTATION: [number, number, number] = [0, 0, 0];

/** Flat open. 0 is shut, display against display. */
export const FOLD_OPEN_DEG = 180;

/**
 * Wing rotations for a fold angle in degrees.
 *
 * Baked flat, wing A bears 180 degrees about the hinge and wing B bears 0,
 * where bearing is atan2(z, x). A rotation of phi about Y maps a bearing theta
 * to theta - phi. Closing the book has to bring the two displays together, and
 * since the asset's displays start on -Z the wings swing that way: wing A
 * takes phi = f/2 - 90 and wing B takes 90 - f/2. MODEL_YAW then turns the
 * whole thing to face the camera.
 *
 * Both are zero at 180, which is the trap: an inverted pair looks perfectly
 * correct flat open and only goes wrong part way through a fold.
 */
export function wingRotations(foldDeg: number): [number, number] {
  const half = foldDeg / 2;
  const DEG = Math.PI / 180;
  return [(half - 90) * DEG, (90 - half) * DEG];
}
