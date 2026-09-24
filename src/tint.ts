import * as THREE from 'three';

/*
 * Recolouring the chassis and the keys.
 *
 * The model is one material: a single baseColor atlas carries the shell, the
 * keys, the trackpad and the screen glass. So `laptopColor` and
 * `keyboardColor` cannot be two material slots — they have to be separated
 * per texel.
 *
 * They can be, because the atlas is cleanly trimodal in linear space:
 *
 *   ~0.497   anodised shell            (575k texels)
 *   ~0.021   keys, trackpad, dark trim (220k texels)
 *   <0.002   screen glass, pure black  (123k texels)
 *
 * So each texel is classified by its own luminance and then *rescaled*
 * against its band's reference value rather than multiplied. A plain multiply
 * would only ever darken — a white keyboard on a black body would be
 * impossible, because the key texels are already near black. Rescaling keeps
 * the printed legends and the panel lines as relative detail while the band's
 * base value becomes exactly the colour that was asked for.
 *
 * The glass band is left alone: it is behind the screen plane, and tinting it
 * turns the bezel into a coloured frame.
 */

const BODY_REF = 0.497;
const DECK_REF = 0.0212;

/** Luminance window over which a texel stops being deck and becomes shell. */
const BAND_LO = 0.06;
const BAND_HI = 0.3;

/** Below this a texel is screen glass and is not recoloured at all. */
const GLASS_LO = 0.004;
const GLASS_HI = 0.012;

/**
 * Detail headroom. Antialiased texels on a key/shell boundary fall between the
 * two references; without a ceiling they would be rescaled into a bright halo.
 */
const DETAIL_MAX = 1.25;

export type TintUniforms = {
  uBodyColor: { value: THREE.Color };
  uDeckColor: { value: THREE.Color };
};

const FRAGMENT_PATCH = /* glsl */ `
#include <map_fragment>
{
  float texLum = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  float isShell = smoothstep( ${BAND_LO}, ${BAND_HI}, texLum );
  float isGlass = 1.0 - smoothstep( ${GLASS_LO}, ${GLASS_HI}, texLum );

  vec3 asDeck  = uDeckColor * min( diffuseColor.rgb / ${DECK_REF}, vec3( ${DETAIL_MAX} ) );
  vec3 asShell = uBodyColor * min( diffuseColor.rgb / ${BODY_REF}, vec3( ${DETAIL_MAX} ) );

  vec3 recoloured = mix( asDeck, asShell, isShell );
  diffuseColor.rgb = mix( recoloured, diffuseColor.rgb, isGlass );
}
`;

/**
 * Patches a standard material so its albedo is driven by two colours.
 * Returns the uniform object, so the colours can be changed later without
 * recompiling the shader.
 */
export function applyTint(
  material: THREE.MeshStandardMaterial,
  bodyColor: string,
  deckColor: string,
): TintUniforms {
  const uniforms: TintUniforms = {
    uBodyColor: { value: new THREE.Color(bodyColor).convertSRGBToLinear() },
    uDeckColor: { value: new THREE.Color(deckColor).convertSRGBToLinear() },
  };

  // diffuseColor starts as material.color * texture; white keeps it the
  // texture alone, which is what the band references are measured against.
  material.color.setRGB(1, 1, 1);

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBodyColor = uniforms.uBodyColor;
    shader.uniforms.uDeckColor = uniforms.uDeckColor;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform vec3 uBodyColor;\nuniform vec3 uDeckColor;\n\nvoid main() {',
      )
      .replace('#include <map_fragment>', FRAGMENT_PATCH);
  };

  // Materials are cached by program; a distinct key forces our variant to
  // compile rather than reusing an untinted one.
  material.customProgramCacheKey = () => 'react-widgets-tint';
  material.needsUpdate = true;

  return uniforms;
}

export function setTint(uniforms: TintUniforms, bodyColor: string, deckColor: string) {
  uniforms.uBodyColor.value.set(bodyColor).convertSRGBToLinear();
  uniforms.uDeckColor.value.set(deckColor).convertSRGBToLinear();
}
