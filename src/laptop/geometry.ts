/*
 * Measurements of the bundled model, in its own local space.
 *
 * assets/laptop.glb was prepared so the runtime maths here stays trivial:
 *   - the laptop is levelled and centred — the base sits flat on y = 0,
 *     spans z = ±0.1408 and x = ±0.1993;
 *   - "LidPivot" is an empty sitting on the hinge axis, so its rotation.x IS
 *     the opening angle: 0 = shut on the keyboard, PI/2 = upright;
 *   - "Lid" hangs beneath it with its geometry baked closed and hinge-centred.
 *
 * The model carries the same numbers in asset.extras, so a replacement model
 * can be checked against these.
 */

export const SCREEN = {
  width: 0.38988,
  height: 0.26361,
  /**
   * The lid's own display face sits at y ≈ 0.0005 and is seen from -Y (the lid
   * folds shut face-down onto the keyboard), so our plane has to sit just
   * BELOW it — above and the lid's own black glass occludes it.
   */
  y: 0.0002,
  z: -0.14376,
} as const;

/** Screen aspect, used to size HTML content so it maps 1:1 onto the panel. */
export const SCREEN_ASPECT = SCREEN.width / SCREEN.height;

/** The plane's orientation inside the lid's local space. */
export const SCREEN_ROTATION: [number, number, number] = [Math.PI / 2, 0, Math.PI];

/** Lid angle at rest — a touch past upright, the way people actually leave one. */
export const LID_OPEN_DEG = 103;
