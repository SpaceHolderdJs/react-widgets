import * as THREE from 'three';

/*
 * Glossy or matte, and what that has to mean in two different places.
 *
 * A display's finish shows up as one thing — how sharply it throws back the
 * light in the room — but this package draws a display in two ways, and they
 * need separate treatment.
 *
 * The device's own front glass is 3D, so it takes the finish the way anything
 * else does: roughen the material and pull the environment back. That covers
 * the bezel, the edges, and the whole panel when the screen is an image
 * texture.
 *
 * Live HTML is not 3D. It is a DOM layer painted over the canvas, and it
 * covers the display exactly — so a reflection rendered in the scene lands
 * *behind* it and is never seen. The sheen on a live panel therefore has to
 * be drawn in the DOM too, which is what `specularAt` is for: a Blinn-Phong
 * highlight evaluated against the same key light the studio uses, at each
 * corner of the panel, so the widget can lay a gradient over the content that
 * moves as the device turns.
 *
 * One exponent drives both. Glossy is a tight, bright highlight; matte is a
 * broad, weak one — which is the whole visible difference between a mirror
 * finish and an anti-glare one.
 */

export type Finish = {
  /** Blinn-Phong exponent: high is a tight highlight, low is a broad one. */
  shininess: number;
  /** Overall gain on the DOM sheen, 0 to 1. */
  gain: number;
  /** Floor applied to the 3D glass material's roughness. */
  roughness: number;
  /** How much of the studio the 3D glass throws back. */
  envMapIntensity: number;
};

export const GLOSSY: Finish = {
  shininess: 28,
  gain: 0.8,
  roughness: 0.04,
  envMapIntensity: 1.9,
};

export const MATTE: Finish = {
  // Anti-glare does not remove the reflection, it scatters it: a wider lobe
  // spreading the same light, so much less of it comes back along any one
  // line of sight. Hence a broader exponent AND a much lower gain — the panel
  // still lifts under a light, it just stops carrying an image of the room.
  shininess: 16,
  gain: 0.14,
  roughness: 0.58,
  envMapIntensity: 0.3,
};

/**
 * Energy normalisation for the Blinn-Phong lobe, relative to GLOSSY.
 *
 * Without it a rough surface reads BRIGHTER than a polished one off-axis,
 * because a wide lobe keeps returning light long after a tight one has
 * fallen to nothing. Spreading the same energy over more directions has to
 * lower the peak, or matte comes out looking glossier than gloss.
 */
const lobeEnergy = (shininess: number) => (shininess + 8) / 8;
const GLOSSY_ENERGY = lobeEnergy(GLOSSY.shininess);

export const finishFor = (matte?: boolean): Finish => (matte ? MATTE : GLOSSY);

/**
 * What the glass has to reflect.
 *
 * Not the studio's key light, which sits behind the device at z -1.6: a
 * display can only mirror what is in front of it, and a light behind the
 * panel produces no highlight on its face at any angle. This is the front
 * fill, and it is the only source in the rig a screen could actually catch.
 *
 * Kept in step with <Studio> by hand — it is one vector, and threading the
 * lighting rig through to the screen layer to recover it would cost more
 * than it is worth. If the fill light in studio.tsx moves, move it here.
 */
export const KEY_LIGHT = new THREE.Vector3(-1.8, 0.7, 1.1).normalize();

/**
 * Applies a finish to a device's own front glass.
 *
 * Only ever dulls: the glossy case leaves the material exactly as the model
 * authored it, so a device that shipped looking a particular way goes on
 * looking that way until someone asks for matte.
 */
export function applyGlassFinish(material: THREE.MeshStandardMaterial, matte?: boolean) {
  if (!matte) return;
  material.roughness = Math.max(material.roughness ?? 0, MATTE.roughness);
  material.envMapIntensity = MATTE.envMapIntensity;
}

/** Is this one of the materials that forms the display's front surface? */
export const isGlass = (name: string) => name === 'glass';

const half = new THREE.Vector3();
const view = new THREE.Vector3();

/**
 * How bright the glass is at one point on the display.
 *
 * Two terms, because a real screen has two things going on and only one of
 * them is the lamp.
 *
 * The specular term is Blinn-Phong against the fill light: a highlight that
 * exists only near the mirror angle, tight and bright on gloss, broad and
 * weak on matte. On its own it would be invisible most of the time, which is
 * accurate and useless.
 *
 * The Fresnel term is the rest of it — the reason a phone on a desk goes
 * pale and unreadable as you tilt it away. Reflectance climbs towards total
 * at grazing angles whatever the surface is, so this is present whenever the
 * display is turned at all, and it is what carries the finish while the
 * device is in motion. Matte scatters it; it does not abolish it.
 *
 * `normal` and `toCamera` are world-space; `toCamera` need not be normalised.
 */
export function specularAt(
  normal: THREE.Vector3,
  toCamera: THREE.Vector3,
  finish: Finish,
): number {
  view.copy(toCamera).normalize();

  half.copy(view).add(KEY_LIGHT).normalize();
  const specular =
    Math.pow(Math.max(normal.dot(half), 0), finish.shininess) *
    (lobeEnergy(finish.shininess) / GLOSSY_ENERGY);

  // Schlick in spirit rather than to the letter: the true fifth power only
  // lifts above about sixty degrees off-axis, which leaves the glass looking
  // inert through the range a device is actually watched at. Squared keeps
  // the shape — nothing face on, climbing towards the edge — while staying
  // legible in motion.
  const grazing = 1 - Math.max(normal.dot(view), 0);
  const fresnel = grazing * grazing;

  return (specular + fresnel * FRESNEL_WEIGHT) * finish.gain;
}

/**
 * How much of the sheen comes from the angle rather than from the lamp.
 *
 * High enough that turning the device visibly changes the glass; low enough
 * that a panel square on to the camera is clean and the content is never
 * fighting a veil. At this weight a glossy display reads as clear glass head
 * on and washes out to about a quarter white at seventy-five degrees.
 */
const FRESNEL_WEIGHT = 0.55;
