/*
 * Measurements of assets/handset.glb, in its own local space.
 *
 * The asset was prepared from the Sketchfab original so the runtime maths
 * stays trivial:
 *   - the studio lean was undone, so the device is axis aligned and a
 *     rotation prop means exactly what it says;
 *   - it is centred on its own bounding box, so a turn about Y spins it on
 *     the spot rather than swinging it around a point off to one side;
 *   - the body is 0.72 units tall;
 *   - the display faces +Z, which is why the content plane needs no rotation
 *     and therefore no mirrored UVs. The camera is staged on +Z.
 *
 * The model carries the same numbers in asset.extras, so a replacement can be
 * checked against these.
 */

export const SCREEN = {
  width: 0.32231,
  height: 0.69755,
  x: -0.00075,
  y: 0.00011,
  /** Just proud of the cover glass, so the panel is never z-fought by it. */
  z: 0.03092,
} as const;

export const SCREEN_ASPECT = SCREEN.width / SCREEN.height;

/** The display faces +Z already, so the plane sits square to it. */
export const SCREEN_ROTATION: [number, number, number] = [0, 0, 0];

/** Body height in model units — the number every other measurement scales with. */
export const BODY_HEIGHT = 0.72;

/** Facing the camera. 180 shows the back. */
export const TURN_FACING_DEG = 0;

/**
 * How much of the display is pointed at the viewer, 0 to 1, for a turn angle
 * in degrees.
 *
 * A bar phone has no hinge, so what stands in for the foldable's fold is how
 * far round it is: the screen is worth lighting only once it is roughly
 * square on. cos of the turn is +1 face on and −1 back on, and the window
 * below puts the fade over the last 35 degrees or so, where the display
 * flattens out from a sliver into a readable rectangle.
 */
export function facing(turnDeg: number): number {
  const c = Math.cos(turnDeg * (Math.PI / 180));
  return Math.min(1, Math.max(0, (c - 0.55) / (0.96 - 0.55)));
}
