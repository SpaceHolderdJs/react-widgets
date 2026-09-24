/** Easing and timeline helpers. Kept local so the package has no utility dep. */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

export const easeOutBack = (x: number) => {
  const c1 = 1.20158;
  return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Remaps a global 0→1 timeline onto a local 0→1 window. */
export const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));

/** 0 below `from`, 1 above `to`, eased between. */
export const smoothstep = (x: number, from: number, to: number) => {
  const t = clamp01((x - from) / (to - from));
  return t * t * (3 - 2 * t);
};
