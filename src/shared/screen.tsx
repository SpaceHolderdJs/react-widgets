import * as React from 'react';
import * as THREE from 'three';
import { Html, useTexture } from '@react-three/drei';

/** HTML content is authored at this width, then scaled onto the panel. */
export const SCREEN_PX = 1440;

/*
 * drei's Html in `transform` mode does not size the element from the camera —
 * it builds a CSS matrix3d and lets the browser's own perspective do the
 * projection. The object's scale is divided by `400 / distanceFactor`, so with
 * the default distanceFactor of 10 one world unit is 40 CSS pixels.
 *
 * distanceFactor is pinned below rather than left to default, so this constant
 * cannot silently drift if drei changes it.
 */
export const HTML_DISTANCE_FACTOR = 10;
const HTML_PX_PER_UNIT = 400 / HTML_DISTANCE_FACTOR;

export const htmlScale = (worldWidth: number) => (worldWidth / SCREEN_PX) * HTML_PX_PER_UNIT;

export type ScreenRect = {
  width: number;
  height: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

export function TextureScreen({
  src,
  rect,
  meshRef,
  matRef,
}: {
  src: string;
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  matRef: React.RefObject<THREE.MeshBasicMaterial | null>;
}) {
  const texture = useTexture(src, (loaded) => {
    const map = Array.isArray(loaded) ? loaded[0] : loaded;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  });

  return (
    <mesh ref={meshRef} position={rect.position} rotation={rect.rotation}>
      <planeGeometry args={[rect.width, rect.height]} />
      <meshBasicMaterial ref={matRef} map={texture} toneMapped={false} transparent opacity={0} />
    </mesh>
  );
}

export function HtmlScreen({
  children,
  rect,
  meshRef,
  matRef,
  htmlRef,
}: {
  children: React.ReactNode;
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  matRef: React.RefObject<THREE.MeshBasicMaterial | null>;
  htmlRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <mesh ref={meshRef} position={rect.position} rotation={rect.rotation}>
      <planeGeometry args={[rect.width, rect.height]} />
      {/* A backing plane, so the panel is never see-through while the HTML
          layer fades in over it. */}
      <meshBasicMaterial ref={matRef} color="#05070c" toneMapped={false} transparent opacity={0} />
      <Html
        transform
        center
        pointerEvents="none"
        distanceFactor={HTML_DISTANCE_FACTOR}
        scale={htmlScale(rect.width)}
        position={[0, 0, 0.0004]}
        zIndexRange={[10, 0]}
      >
        <div
          ref={htmlRef}
          style={{
            width: SCREEN_PX,
            height: Math.round(SCREEN_PX / (rect.width / rect.height)),
            overflow: 'hidden',
            opacity: 0,
            background: '#05070c',
            // A real screen is not readable from behind. Without this the DOM
            // layer shows through the shut device, mirrored.
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {children}
        </div>
      </Html>
    </mesh>
  );
}

/** Picks the right screen for whatever the caller passed. */
export function Screen({
  screen,
  rect,
  meshRef,
  matRef,
  htmlRef,
}: {
  screen?: string | React.ReactNode;
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  matRef: React.RefObject<THREE.MeshBasicMaterial | null>;
  htmlRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (typeof screen === 'string') {
    return <TextureScreen src={screen} rect={rect} meshRef={meshRef} matRef={matRef} />;
  }
  return (
    <HtmlScreen rect={rect} meshRef={meshRef} matRef={matRef} htmlRef={htmlRef}>
      {screen}
    </HtmlScreen>
  );
}
