import * as React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, useTexture } from '@react-three/drei';

import { smoothstep } from '../easing';

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

/**
 * How lit the display is, 0 → 1, written by the widget's timeline every frame.
 *
 * A ref rather than a prop: it changes every frame and a re-render per frame
 * would cost more than the animation it drives. A number rather than a DOM
 * ref, because the screen is drawn by up to three things at once — a mesh, a
 * projected DOM layer and a flat one — and the timeline should not have to
 * know which.
 */
export type ScreenOpacity = React.RefObject<number>;

export function TextureScreen({
  src,
  rect,
  meshRef,
  opacity,
}: {
  src: string;
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  opacity: ScreenOpacity;
}) {
  const matRef = React.useRef<THREE.MeshBasicMaterial>(null);
  const texture = useTexture(src, (loaded) => {
    const map = Array.isArray(loaded) ? loaded[0] : loaded;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  });

  useFrame(() => {
    // Never fully zero: a transparent material with opacity 0 is skipped, and
    // the panel would pop rather than fade in.
    if (matRef.current) matRef.current.opacity = Math.max(opacity.current ?? 0, 0.001);
  });

  return (
    <mesh ref={meshRef} position={rect.position} rotation={rect.rotation}>
      <planeGeometry args={[rect.width, rect.height]} />
      <meshBasicMaterial ref={matRef} map={texture} toneMapped={false} transparent opacity={0} />
    </mesh>
  );
}

/* ------------------------------------------------------------- hand-off */

/*
 * Why there are two DOM layers below.
 *
 * `<Html transform>` is a CSS 3D projection: drei puts `perspective: Npx` on a
 * wrapper and hands the browser the camera and object matrices as CSS
 * transforms. CSS 3D has no near plane. A WebGL renderer clips geometry that
 * comes closer than `camera.near`; CSS just keeps dividing, so as a plane
 * approaches the perspective origin its magnification runs away and the DOM
 * layer comes unstuck from the mesh it is supposed to be painted on.
 *
 * Every reveal here ends by pushing the camera in until the display exactly
 * covers the viewport, which walks the panel straight into that region: it
 * detaches, overshoots, and the device is left looking like it has a dead
 * screen with a giant caption floating beside it. A texture never shows this,
 * because a texture is a mesh and goes through the same projection as the
 * device — which is why it survived every capture made with `?screen=<url>`.
 *
 * So the layer is handed off. While the display is a shape in the scene, the
 * CSS-projected layer draws it. As it grows to fill the frame *and* turns
 * square on to the camera — the two conditions that together mean "this is
 * about to be a full-bleed page, not a device" — a flat, unprojected copy
 * fades in over the top, sized and placed from the display's own projected
 * rectangle. At the hand-off the two are the same picture, which is the point
 * of the move: the reveal ends on the content, not on the hardware.
 */

const CORNERS: [number, number][] = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
];

type Projection = {
  /** 0 → 1: how much of the tighter viewport axis the display spans. */
  coverage: number;
  /** 1 when the display faces the camera dead on. */
  squareness: number;
  /** The display's projected rectangle, in CSS pixels. */
  width: number;
  height: number;
};

/**
 * Where the display lands on the viewport this frame.
 *
 * Projecting the four corners rather than the centre keeps this honest while
 * the panel is still turning: a display seen edge on projects to a sliver, and
 * `coverage` says so.
 */
function useProjection(
  meshRef: React.RefObject<THREE.Mesh | null>,
  rect: ScreenRect,
  onFrame: (p: Projection) => void,
) {
  const { camera, size } = useThree();
  const scratch = React.useMemo(
    () => ({
      v: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
    }),
    [],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const [cx, cy] of CORNERS) {
      scratch.v
        .set(cx * rect.width, cy * rect.height, 0)
        .applyMatrix4(mesh.matrixWorld)
        .project(camera);
      if (scratch.v.x < minX) minX = scratch.v.x;
      if (scratch.v.x > maxX) maxX = scratch.v.x;
      if (scratch.v.y < minY) minY = scratch.v.y;
      if (scratch.v.y > maxY) maxY = scratch.v.y;
    }

    // Normalised device coordinates run -1 → 1, so a span of 2 is the whole
    // viewport on that axis.
    const spanX = maxX - minX;
    const spanY = maxY - minY;

    mesh.getWorldQuaternion(scratch.quat);
    scratch.normal.set(0, 0, 1).applyQuaternion(scratch.quat);
    camera.getWorldDirection(scratch.forward);

    onFrame({
      coverage: Math.min(spanX, spanY) / 2,
      squareness: Math.abs(scratch.normal.dot(scratch.forward)),
      width: (spanX / 2) * size.width,
      height: (spanY / 2) * size.height,
    });
  });
}

export function HtmlScreen({
  children,
  rect,
  meshRef,
  opacity,
}: {
  children: React.ReactNode;
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  opacity: ScreenOpacity;
}) {
  const contentHeight = Math.round(SCREEN_PX / (rect.width / rect.height));

  const matRef = React.useRef<THREE.MeshBasicMaterial>(null);
  const projectedLayer = React.useRef<HTMLDivElement>(null);
  const flatFrame = React.useRef<HTMLDivElement>(null);
  const flatContent = React.useRef<HTMLDivElement>(null);

  useProjection(meshRef, rect, ({ coverage, squareness, width, height }) => {
    const lit = opacity.current ?? 0;

    // Both conditions, multiplied: a big panel seen at an angle is still a
    // device and wants its perspective, and a square-on panel that is small on
    // screen is still a device too. Only when it is both does a flat copy read
    // as the same picture.
    const flat = smoothstep(coverage, 0.6, 0.86) * smoothstep(squareness, 0.965, 0.995);

    if (matRef.current) matRef.current.opacity = Math.max(lit, 0.001);

    if (projectedLayer.current) {
      projectedLayer.current.style.opacity = String(lit * (1 - flat));
    }

    const frame = flatFrame.current;
    const content = flatContent.current;
    if (frame && content) {
      const showing = lit * flat > 0.001;
      frame.style.display = showing ? 'block' : 'none';
      if (showing) {
        frame.style.width = `${Math.round(width)}px`;
        frame.style.height = `${Math.round(height)}px`;
        frame.style.opacity = String(lit * flat);
        // Cover, not contain: the display covers the viewport at the hand-off,
        // cropping on whichever axis is not the limiting one.
        const scale = Math.max(width / SCREEN_PX, height / contentHeight);
        content.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    }
  });

  return (
    <mesh ref={meshRef} position={rect.position} rotation={rect.rotation}>
      <planeGeometry args={[rect.width, rect.height]} />
      {/* A backing plane, so the panel is never see-through while the HTML
          layer fades in over it. */}
      <meshBasicMaterial ref={matRef} color="#05070c" toneMapped={false} transparent opacity={0} />

      {/* 1. The display as a surface in the scene. */}
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
          ref={projectedLayer}
          style={{
            width: SCREEN_PX,
            height: contentHeight,
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

      {/* 2. The same content, flat, for the end of the push. No `transform`,
             so no CSS perspective and nothing to degenerate. */}
      <Html center pointerEvents="none" zIndexRange={[11, 1]}>
        <div
          ref={flatFrame}
          style={{
            display: 'none',
            position: 'relative',
            overflow: 'hidden',
            background: '#05070c',
            willChange: 'width, height, opacity',
          }}
        >
          <div
            ref={flatContent}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: SCREEN_PX,
              height: contentHeight,
              transformOrigin: 'center',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {children}
          </div>
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
  opacity,
}: {
  screen?: string | React.ReactNode;
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  opacity: ScreenOpacity;
}) {
  if (typeof screen === 'string') {
    return <TextureScreen src={screen} rect={rect} meshRef={meshRef} opacity={opacity} />;
  }
  return (
    <HtmlScreen rect={rect} meshRef={meshRef} opacity={opacity}>
      {screen}
    </HtmlScreen>
  );
}
