import * as React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
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

/**
 * The flat copy of the screen.
 *
 * It is a 2D overlay on the canvas, not an object in the scene, so it is
 * rendered as an ordinary DOM sibling of the <Canvas> rather than through
 * drei's Html. That is not tidiness: Html mounts its own ReactDOM root, and
 * two of them per widget raced each other on unmount — React's "attempted to
 * synchronously unmount a root while React was already rendering", loudest
 * under StrictMode on a machine fast enough to interleave them.
 *
 * The scene writes to these refs every frame; nothing here re-renders.
 */
export type FlatHandle = {
  frame: React.RefObject<HTMLDivElement | null>;
  content: React.RefObject<HTMLDivElement | null>;
};

export function useFlatHandle(): FlatHandle {
  const frame = React.useRef<HTMLDivElement>(null);
  const content = React.useRef<HTMLDivElement>(null);
  return React.useMemo(() => ({ frame, content }), [frame, content]);
}

/**
 * Rendered next to the <Canvas>, inside the wrapper the widget provides. It
 * starts hidden and stays hidden unless the camera pushes far enough in for
 * the hand-off.
 */
export function FlatScreen({
  handle,
  aspect,
  children,
}: {
  handle: FlatHandle;
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
        display: 'none',
        overflow: 'hidden',
        background: '#05070c',
        pointerEvents: 'none',
        willChange: 'transform, width, height, opacity',
      }}
    >
      <div
        ref={handle.content}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: SCREEN_PX,
          height: Math.round(SCREEN_PX / aspect),
          transformOrigin: 'center',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {children}
      </div>
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
  /** The display's projected rectangle, in CSS pixels, relative to the canvas. */
  x: number;
  y: number;
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
      // NDC -1 → 1 with y up, to CSS pixels from the canvas's top left.
      x: ((minX + maxX) / 2 + 1) * 0.5 * size.width,
      y: (1 - ((minY + maxY) / 2 + 1) * 0.5) * size.height,
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
  flat: flatHandle,
}: {
  children: React.ReactNode;
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  opacity: ScreenOpacity;
  flat?: FlatHandle;
}) {
  const contentHeight = Math.round(SCREEN_PX / (rect.width / rect.height));

  const matRef = React.useRef<THREE.MeshBasicMaterial>(null);
  const projectedLayer = React.useRef<HTMLDivElement>(null);
  /** Which of the two layers is currently drawing the screen. */
  const handedOff = React.useRef(false);

  useProjection(meshRef, rect, ({ coverage, squareness, x, y, width, height }) => {
    const lit = opacity.current ?? 0;

    // Both conditions, multiplied: a big panel seen at an angle is still a
    // device and wants its perspective, and a square-on panel that is small on
    // screen is still a device too. Only when it is both does a flat copy read
    // as the same picture.
    const frame = flatHandle?.frame.current;
    const content = flatHandle?.content.current;

    // A switch, not a cross-fade.
    //
    // Fading between the two put both on screen at once, and by the time the
    // fade had started the perspective layer was already coming unstuck — so
    // what you saw was a sharp panel on the device with a large ghost of
    // itself sliding off to one side. There is no window in which blending
    // them is right, because the whole reason to hand over is that one of them
    // has stopped being trustworthy.
    //
    // They draw the same content at the same projected rectangle once the
    // display is square on and large in frame, so swapping outright is
    // invisible. The thresholds sit well before the projection degenerates,
    // and are split going in and coming out so a camera hovering near the
    // boundary cannot flap between them.
    if (frame && content) {
      handedOff.current = handedOff.current
        ? coverage > 0.42 && squareness > 0.88
        : coverage > 0.52 && squareness > 0.93;
    } else {
      handedOff.current = false;
    }
    const flat = handedOff.current ? 1 : 0;

    if (matRef.current) matRef.current.opacity = Math.max(lit, 0.001);

    if (projectedLayer.current) {
      // display, not just opacity: a degenerate CSS 3D layer still costs
      // layout at opacity 0, and can still paint a stray edge.
      projectedLayer.current.style.display = flat ? 'none' : 'block';
      projectedLayer.current.style.opacity = String(lit);
    }

    if (frame && content) {
      const showing = flat === 1 && lit > 0.001;
      frame.style.display = showing ? 'block' : 'none';
      if (showing) {
        const w = Math.round(width);
        const h = Math.round(height);
        frame.style.width = `${w}px`;
        frame.style.height = `${h}px`;
        // Placed from the display's own projected rectangle, so it lands
        // exactly where the perspective layer was.
        frame.style.transform = `translate(${Math.round(x) - w / 2}px, ${Math.round(y) - h / 2}px)`;
        frame.style.opacity = String(lit);
        // Cover, not contain: the display covers the viewport at the hand-off,
        // cropping on whichever axis is not the limiting one.
        const scale = Math.max(w / SCREEN_PX, h / contentHeight);
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

      {/* The display as a surface in the scene. The flat copy it hands off to
          is a DOM sibling of the Canvas — see <FlatScreen>. */}
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

    </mesh>
  );
}

/** Picks the right screen for whatever the caller passed. */
export function Screen({
  screen,
  rect,
  meshRef,
  opacity,
  flat,
}: {
  screen?: string | React.ReactNode;
  rect: ScreenRect;
  meshRef: React.RefObject<THREE.Mesh | null>;
  opacity: ScreenOpacity;
  flat?: FlatHandle;
}) {
  if (typeof screen === 'string') {
    return <TextureScreen src={screen} rect={rect} meshRef={meshRef} opacity={opacity} />;
  }
  return (
    <HtmlScreen rect={rect} meshRef={meshRef} opacity={opacity} flat={flat}>
      {screen}
    </HtmlScreen>
  );
}
