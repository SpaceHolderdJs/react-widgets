import * as React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

import { quadTransform, type Corner } from './homography';

/** HTML content is authored at this width, then mapped onto the panel. */
export const SCREEN_PX = 1440;

export type ScreenRect = {
  width: number;
  height: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

/**
 * How lit the display is, 0 → 1, written by the widget's timeline every frame.
 *
 * A ref rather than a prop: it changes every frame, and a re-render per frame
 * would cost more than the animation it drives.
 */
export type ScreenOpacity = React.RefObject<number>;

/**
 * The DOM layer that carries the screen's content.
 *
 * It is an ordinary sibling of the <Canvas>, not a child of the scene — see
 * <HtmlScreen> for why the content is mapped onto the display with a
 * homography rather than handed to CSS 3D.
 */
export type ScreenHandle = {
  frame: React.RefObject<HTMLDivElement | null>;
};

export function useScreenHandle(): ScreenHandle {
  const frame = React.useRef<HTMLDivElement>(null);
  return React.useMemo(() => ({ frame }), [frame]);
}

/**
 * Rendered next to the <Canvas>, inside the wrapper the widget provides.
 *
 * `transform-origin: 0 0` is load bearing: the homography maps the element's
 * own top-left corner onto the display's top-left corner, and any other origin
 * puts it somewhere else entirely.
 */
export function ScreenSurface({
  handle,
  aspect,
  children,
}: {
  handle: ScreenHandle;
  /** width / height of the display, so the content is authored to match. */
  aspect: number;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={handle.frame}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: SCREEN_PX,
        height: Math.round(SCREEN_PX / aspect),
        transformOrigin: '0 0',
        display: 'none',
        overflow: 'hidden',
        background: '#05070c',
        // Live, not a picture of live. The homography is invertible, so the
        // browser hit tests through it: text on the panel selects, links on
        // it click, and they do it at whatever angle the device is holding.
        pointerEvents: 'auto',
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  );
}

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

/* ------------------------------------------------------------ live HTML */

/*
 * How the DOM gets onto the display.
 *
 * The obvious tool is drei's <Html transform>, and it is the wrong one here.
 * That builds a CSS 3D scene: a `perspective` on a wrapper, the camera and
 * object matrices as CSS transforms, and the browser's own projection doing
 * the rest. CSS 3D has no near plane — a WebGL renderer clips geometry closer
 * than `camera.near`, CSS just keeps dividing — and its perspective distance
 * is in PIXELS while the scene is in WORLD UNITS. The magnification works out
 * at roughly the one over the other, so it grows with the height of the
 * canvas, and every reveal here ends by pushing the camera close enough to
 * make that number very large. The panel comes unstuck from the device and
 * overshoots, worse on a tall canvas than a short one — the sort of bug that
 * looks fine on the machine it was written on and wrong on everyone else's.
 *
 * So the projection is done here instead. The display is a flat rectangle, so
 * its image under any camera is a planar projective transform of that
 * rectangle — a homography, fixed entirely by the four projected corners, and
 * expressible as one CSS matrix3d. There is no perspective property, so
 * nothing to approach and nothing to divide by zero; the element stays the
 * size it was authored at however close the camera gets; and the same numbers
 * come out on any canvas, at any device pixel ratio, at any field of view.
 *
 * It costs four matrix multiplies a frame. It buys correctness that does not
 * depend on the screen it happens to be running on.
 */

const CORNERS: [number, number][] = [
  [-0.5, 0.5], // top left, in the plane's own space, y up
  [0.5, 0.5], // top right
  [0.5, -0.5], // bottom right
  [-0.5, -0.5], // bottom left
];

export function HtmlScreen({
  rect,
  meshRef,
  opacity,
  handle,
}: {
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  opacity: ScreenOpacity;
  handle?: ScreenHandle;
}) {
  const matRef = React.useRef<THREE.MeshBasicMaterial>(null);
  const { camera, size, gl } = useThree();

  const contentHeight = Math.round(SCREEN_PX / (rect.width / rect.height));

  const scratch = React.useMemo(
    () => ({
      v: new THREE.Vector3(),
      centre: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      toCamera: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      quad: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ] as [Corner, Corner, Corner, Corner],
    }),
    [],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    const lit = opacity.current ?? 0;
    if (matRef.current) matRef.current.opacity = Math.max(lit, 0.001);

    const frame = handle?.frame.current;
    if (!mesh || !frame) return;

    if (lit <= 0.001) {
      frame.style.display = 'none';
      return;
    }

    mesh.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();

    // Facing away? A real screen is not readable from behind, and a folded
    // device should not show its content through its own back.
    mesh.getWorldQuaternion(scratch.quat);
    scratch.normal.set(0, 0, 1).applyQuaternion(scratch.quat);
    scratch.centre.setFromMatrixPosition(mesh.matrixWorld);
    scratch.toCamera.setFromMatrixPosition(camera.matrixWorld).sub(scratch.centre);
    if (scratch.normal.dot(scratch.toCamera) <= 0) {
      frame.style.display = 'none';
      return;
    }

    // The DOM layer is placed against the wrapper; the canvas may not start
    // at the wrapper's own corner, if whoever mounted the widget gave it a
    // border or some padding. Both are laid out against the same positioned
    // ancestor, so one offset reconciles them.
    const ox = gl.domElement.offsetLeft;
    const oy = gl.domElement.offsetTop;

    for (let k = 0; k < 4; k++) {
      const [cx, cy] = CORNERS[k];
      scratch.v
        .set(cx * rect.width, cy * rect.height, 0)
        .applyMatrix4(mesh.matrixWorld)
        .project(camera);
      // Normalised device coordinates, y up, to CSS pixels from the canvas's
      // top left.
      scratch.quad[k].x = ox + (scratch.v.x + 1) * 0.5 * size.width;
      scratch.quad[k].y = oy + (1 - (scratch.v.y + 1) * 0.5) * size.height;
    }

    const matrix = quadTransform(scratch.quad, SCREEN_PX, contentHeight);
    if (!matrix) {
      // Edge on, folded over, or through the camera: nothing honest to draw.
      frame.style.display = 'none';
      return;
    }

    frame.style.display = 'block';
    frame.style.opacity = String(lit);
    frame.style.transform = matrix;
  });

  return (
    <mesh ref={meshRef} position={rect.position} rotation={rect.rotation}>
      <planeGeometry args={[rect.width, rect.height]} />
      {/* A backing plane, so the panel is never see-through while the content
          fades in over it, and so the display reads as glass when unlit. */}
      <meshBasicMaterial ref={matRef} color="#05070c" toneMapped={false} transparent opacity={0} />
    </mesh>
  );
}

/** Picks the right screen for whatever the caller passed. */
export function Screen({
  screen,
  rect,
  meshRef,
  opacity,
  handle,
}: {
  screen?: string | React.ReactNode;
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  opacity: ScreenOpacity;
  handle?: ScreenHandle;
}) {
  if (typeof screen === 'string') {
    return <TextureScreen src={screen} rect={rect} meshRef={meshRef} opacity={opacity} />;
  }
  return <HtmlScreen rect={rect} meshRef={meshRef} opacity={opacity} handle={handle} />;
}
