import * as React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

import { quadTransform, type Corner } from './homography';
import { finishFor, specularAt } from './finish';
import { roundedPlane } from './rounded';

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** HTML content is authored at this width, then mapped onto the panel. */
export const SCREEN_PX = 1440;

export type ScreenRect = {
  width: number;
  height: number;
  position: [number, number, number];
  rotation: [number, number, number];
  /**
   * Corner radius of the display aperture, in model units. Every device has
   * one; content drawn without it runs past the curve onto the bezel.
   */
  corner?: number;
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
  /** The sheen laid over the content; see <ScreenSurface>. */
  sheen: React.RefObject<HTMLDivElement | null>;
};

export function useScreenHandle(): ScreenHandle {
  const frame = React.useRef<HTMLDivElement>(null);
  const sheen = React.useRef<HTMLDivElement>(null);
  return React.useMemo(() => ({ frame, sheen }), [frame, sheen]);
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
  radius = 0,
  children,
}: {
  handle: ScreenHandle;
  /** width / height of the display, so the content is authored to match. */
  aspect: number;
  /**
   * The display's corner radius, in the same authored pixels as the content.
   * The homography carries a border-radius along with everything else, so
   * the curve lands on the glass correctly at any angle.
   */
  radius?: number;
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
        borderRadius: radius ? `${radius}px` : undefined,
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
      {/*
       * The reflection on the glass.
       *
       * A live panel is DOM painted over the canvas, so it covers the display
       * completely and anything the scene reflects there lands behind it. The
       * sheen has to be drawn here or it is not drawn at all. It is a plain
       * gradient whose direction and strength the widget rewrites each frame
       * from the display's own orientation, so it slides across the glass as
       * the device turns — and it rides along with the content, because the
       * homography on the parent carries it too.
       */}
      <div
        ref={handle.sheen}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          opacity: 0,
          willChange: 'background, opacity',
        }}
      />
    </div>
  );
}


/**
 * The display's own outline, as a geometry.
 *
 * Memoised on the numbers that define it and disposed when they change, since
 * a geometry rebuilt every render would leak a buffer per frame on the GPU.
 */
function useApertureGeometry(rect: ScreenRect) {
  const geometry = React.useMemo(
    () => roundedPlane(rect.width, rect.height, rect.corner ?? 0),
    [rect.width, rect.height, rect.corner],
  );
  React.useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
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
  const geometry = useApertureGeometry(rect);
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
    <mesh
      ref={meshRef}
      position={rect.position}
      rotation={rect.rotation}
      geometry={geometry}
    >
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
  matte,
}: {
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  opacity: ScreenOpacity;
  handle?: ScreenHandle;
  matte?: boolean;
}) {
  const matRef = React.useRef<THREE.MeshBasicMaterial>(null);
  const geometry = useApertureGeometry(rect);
  const { camera, size, gl } = useThree();
  const finish = finishFor(matte);

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
      camPos: new THREE.Vector3(),
      toCorner: new THREE.Vector3(),
      spec: [0, 0, 0, 0],
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

    scratch.camPos.setFromMatrixPosition(camera.matrixWorld);

    for (let k = 0; k < 4; k++) {
      const [cx, cy] = CORNERS[k];
      scratch.v.set(cx * rect.width, cy * rect.height, 0).applyMatrix4(mesh.matrixWorld);

      // The sheen is sampled here, while this corner is still a point in the
      // world: the view direction differs at each corner, which is the only
      // reason a flat panel under a distant light has a highlight that sits
      // somewhere rather than washing the whole surface evenly.
      scratch.toCorner.copy(scratch.camPos).sub(scratch.v);
      scratch.spec[k] = specularAt(scratch.normal, scratch.toCorner, finish);

      scratch.v.project(camera);
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

    const sheen = handle?.sheen.current;
    if (sheen) {
      // Fit a plane through the four corner values, in the panel's own space:
      // u runs left to right, v runs top to bottom. Two differences give the
      // gradient, their average gives the level.
      const [s0, s1, s2, s3] = scratch.spec;
      const du = (s1 + s2 - s0 - s3) * 0.5;
      const dv = (s3 + s2 - s0 - s1) * 0.5;
      const mid = (s0 + s1 + s2 + s3) * 0.25;
      const swing = Math.hypot(du, dv);

      if (mid + swing < 0.002) {
        sheen.style.opacity = '0';
      } else {
        // CSS measures a gradient's angle clockwise from "to top", and v
        // points down, so the direction of increase is atan2(du, -dv).
        const angle = (Math.atan2(du, -dv) * 180) / Math.PI;
        const lo = clamp01(mid - swing);
        const hi = clamp01(mid + swing);
        sheen.style.opacity = '1';
        sheen.style.background =
          `linear-gradient(${angle.toFixed(1)}deg, ` +
          `rgba(255,255,255,${lo.toFixed(3)}) 0%, ` +
          `rgba(255,255,255,${hi.toFixed(3)}) 100%)`;
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={rect.position}
      rotation={rect.rotation}
      geometry={geometry}
    >
      {/* A backing plane, so the panel is never see-through while the content
          fades in over it, and so the display reads as glass when unlit. */}
      <meshBasicMaterial ref={matRef} color="#05070c" toneMapped={false} transparent opacity={0} />
    </mesh>
  );
}

/**
 * Front glass, for a device whose model does not carry any.
 *
 * The phone and the foldable were authored with a glass surface over the
 * display and it takes the finish directly. The laptop has a single material
 * for the whole body and no glass at all, so it gets one here: a sheet a
 * fraction of a millimetre in front of the panel, which is what the finish
 * then has something to act on.
 *
 * It is deliberately faint. A display reflects the room; it is not a mirror,
 * and a pane bright enough to notice on its own would read as haze over the
 * content rather than as a surface in front of it.
 */
export function ScreenGlass({ rect, matte }: { rect: ScreenRect; matte?: boolean }) {
  const finish = finishFor(matte);
  const geometry = useApertureGeometry(rect);
  return (
    <mesh
      position={[rect.position[0], rect.position[1], rect.position[2] + 0.0008]}
      rotation={rect.rotation}
      renderOrder={2}
      geometry={geometry}
    >
      <meshPhysicalMaterial
        color="#ffffff"
        transparent
        opacity={matte ? 0.05 : 0.12}
        roughness={finish.roughness}
        metalness={0}
        envMapIntensity={finish.envMapIntensity}
        depthWrite={false}
      />
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
  matte,
  glass,
}: {
  screen?: string | React.ReactNode;
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  opacity: ScreenOpacity;
  handle?: ScreenHandle;
  matte?: boolean;
  /** Render our own front glass, for a model that has none of its own. */
  glass?: boolean;
}) {
  return (
    <>
      {typeof screen === 'string' ? (
        <TextureScreen src={screen} rect={rect} meshRef={meshRef} opacity={opacity} />
      ) : (
        <HtmlScreen
          rect={rect}
          meshRef={meshRef}
          opacity={opacity}
          handle={handle}
          matte={matte}
        />
      )}
      {glass ? <ScreenGlass rect={rect} matte={matte} /> : null}
    </>
  );
}
