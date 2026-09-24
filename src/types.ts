import type { CSSProperties, ReactNode } from 'react';

export interface LaptopRevealProps {
  /**
   * What is on the screen.
   *
   * A string is treated as an image or video URL and used as a texture —
   * cheapest, and what you want for a screenshot.
   *
   * Anything else is rendered as real HTML mapped onto the display plane:
   * live, selectable, interactive. It costs a DOM overlay, so prefer a
   * texture when the content never changes.
   */
  screen?: string | ReactNode;

  /**
   * Where the laptop starts, in model units — the base is roughly 0.4 wide
   * and sits on y = 0. During the reveal it animates from here to the origin;
   * with `autoPlay={false}` it simply stays here.
   *
   * @default [0, -0.42, 0]
   */
  initialPosition?: [number, number, number];

  /**
   * How the laptop is turned when it starts, in degrees. The reveal unwinds
   * this as it settles.
   *
   * @default [-66, 83, -19]
   */
  initialRotation?: [number, number, number];

  /** Chassis, lid shell and palm rest. @default '#b8bcc0' */
  laptopColor?: string;

  /** Keys, trackpad and the dark trim around them. @default '#26282b' */
  keyboardColor?: string;

  /**
   * Play the reveal on mount: the laptop drops in, the lid opens, and the
   * camera pushes into the screen until it fills the frame.
   *
   * With `false` nothing animates — `initialPosition`, `initialRotation` and
   * `lidAngle` place the laptop and you drive it yourself.
   *
   * @default true
   */
  autoPlay?: boolean;

  /** Length of the reveal in milliseconds. @default 5200 */
  duration?: number;

  /**
   * Lid opening angle in degrees: 0 is shut, 90 upright, 103 the resting
   * angle the reveal ends on. Only used when `autoPlay` is false.
   * @default 103
   */
  lidAngle?: number;

  /**
   * Camera position in model units. Only used when `autoPlay` is false — the
   * reveal derives its own path, ending at whatever distance makes the screen
   * exactly cover the viewport.
   * @default [0.5, 0.34, -0.78]
   */
  cameraPosition?: [number, number, number];

  /** Vertical field of view in degrees. @default 38 */
  fov?: number;

  /**
   * Scene background. `null` leaves the canvas transparent, so whatever is
   * behind it shows through.
   * @default '#04050a'
   */
  background?: string | null;

  /**
   * Where to load the model from. Defaults to this package's copy on unpkg so
   * it works with no build configuration; for production, serve your own —
   * see the README.
   */
  modelUrl?: string;

  /** Fires once the model and screen content have loaded. */
  onReady?: () => void;

  /** Fires when the reveal finishes. Never fires when `autoPlay` is false. */
  onComplete?: () => void;

  /**
   * Skip the reveal for visitors who ask for reduced motion, showing the
   * final frame instead. @default true
   */
  respectReducedMotion?: boolean;

  className?: string;
  style?: CSSProperties;
}
