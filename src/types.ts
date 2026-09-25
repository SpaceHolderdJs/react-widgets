import type { CSSProperties, ReactNode } from 'react';

/** What every widget in this package takes. */
export interface RevealProps {
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
   * Where the device starts, in model units. During the reveal it animates
   * from here to the origin; with `autoPlay={false}` it simply stays here.
   */
  initialPosition?: [number, number, number];

  /**
   * How the device is turned when it starts, in degrees. The reveal unwinds
   * this as it settles.
   */
  initialRotation?: [number, number, number];

  /**
   * Play the reveal on mount. With `false` nothing animates and the props
   * place the device, so you can drive it yourself.
   * @default true
   */
  autoPlay?: boolean;

  /** Length of the reveal in milliseconds. */
  duration?: number;

  /** Camera position in model units. Only used when `autoPlay` is false. */
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

export interface LaptopRevealProps extends RevealProps {
  /** @default [0, -0.42, 0] */
  initialPosition?: [number, number, number];
  /** @default [-66, 83, -19] */
  initialRotation?: [number, number, number];
  /** Chassis, lid shell and palm rest. @default '#b8bcc0' */
  laptopColor?: string;
  /** Keys, trackpad and the dark trim around them. @default '#26282b' */
  keyboardColor?: string;
  /**
   * Lid opening angle in degrees: 0 is shut, 90 upright, 103 the resting
   * angle the reveal ends on. Only used when `autoPlay` is false.
   * @default 103
   */
  lidAngle?: number;
  /** @default 5200 */
  duration?: number;
  /** @default [0.5, 0.34, -0.78] */
  cameraPosition?: [number, number, number];
}

export interface FoldableRevealProps extends RevealProps {
  /** @default [0, -0.38, 0] */
  initialPosition?: [number, number, number];
  /** @default [-54, -72, 16] */
  initialRotation?: [number, number, number];
  /** Chassis, chamfer and frame. @default '#c6cad0' */
  bodyColor?: string;
  /** Bezel, hinge trim and the dark inlays. @default '#15171a' */
  trimColor?: string;
  /**
   * How far the book is open, in degrees: 180 is flat, 0 is shut with the two
   * halves face to face. Only used when `autoPlay` is false.
   * @default 180
   */
  foldAngle?: number;
  /** @default 5000 */
  duration?: number;
  /** @default [-0.62, 0.38, 0.86] */
  cameraPosition?: [number, number, number];
}

export interface PhoneRevealProps extends RevealProps {
  /** @default [0, -0.34, -0.22] */
  initialPosition?: [number, number, number];
  /**
   * Starts back-on by default, so the reveal has something to turn over.
   * @default [16, 168, -14]
   */
  initialRotation?: [number, number, number];
  /** Chassis, back panel and chamfer. @default '#c3c7cb' */
  bodyColor?: string;
  /** Rails, camera plate and the cutout around the front lens. @default '#1b1d21' */
  trimColor?: string;
  /**
   * How far the phone is turned about its own vertical axis, in degrees: 0
   * faces the viewer, 180 shows the back, and the display fades out as it
   * goes round. Only used when `autoPlay` is false.
   * @default 0
   */
  turnAngle?: number;
  /** @default 4600 */
  duration?: number;
  /** @default [0.86, 0.44, 1.42] */
  cameraPosition?: [number, number, number];
}
