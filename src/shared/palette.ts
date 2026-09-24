import * as THREE from 'three';

/*
 * Recolouring a model whose parts are separate materials.
 *
 * This is the simpler of the two schemes in this package. The laptop is a
 * single material with one texture atlas, so its colours have to be separated
 * per texel (see tint.ts). The phone is the opposite: a handful of flat
 * materials with names like "chassis" and "trim", so a colour is just an
 * assignment.
 *
 * What it is not is a flat overwrite. Materials inside a group are authored at
 * different brightnesses — a chassis and its lighter chamfer, a black trim and
 * a near-black bezel — and flattening them to one value loses every edge the
 * modeller put there. So each material keeps its brightness relative to the
 * brightest in its group, and the brightest becomes exactly the colour asked
 * for.
 */

export type PaletteGroup = {
  /** Material names this colour applies to. */
  materials: string[];
  color: string;
};

export type PaletteBinding = {
  material: THREE.MeshStandardMaterial;
  /** 0 → 1: this material's brightness relative to the brightest in its group. */
  ratio: number;
  group: number;
};

const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/**
 * Records how each material relates to its group. Call once per model, then
 * setPalette whenever the colours change — no shader recompile, no rebuild of
 * the scene graph.
 */
export function bindPalette(
  materials: THREE.MeshStandardMaterial[],
  groups: PaletteGroup[],
): PaletteBinding[] {
  const bindings: PaletteBinding[] = [];

  groups.forEach((group, gi) => {
    const members = materials.filter((m) => group.materials.includes(m.name));
    if (!members.length) return;
    const peak = Math.max(...members.map((m) => luminance(m.color))) || 1;
    for (const material of members) {
      bindings.push({ material, ratio: luminance(material.color) / peak, group: gi });
    }
  });

  setPalette(bindings, groups);
  return bindings;
}

export function setPalette(bindings: PaletteBinding[], groups: PaletteGroup[]) {
  const base = groups.map((g) => new THREE.Color(g.color));
  for (const b of bindings) {
    const c = base[b.group];
    if (!c) continue;
    // Never fully black: a metal that reflects nothing reads as a hole rather
    // than as a dark finish.
    const k = 0.18 + 0.82 * b.ratio;
    b.material.color.setRGB(c.r * k, c.g * k, c.b * k);
  }
}
