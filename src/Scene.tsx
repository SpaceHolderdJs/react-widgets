import * as React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, useGLTF, useTexture } from '@react-three/drei';

import { SCREEN, SCREEN_ASPECT, SCREEN_ROTATION } from './geometry';
import { easeInOut, easeOut, easeOutBack, lerp, span } from './easing';
import { applyTint, setTint, type TintUniforms } from './tint';

export type Progress = { t: number };

export type SceneProps = {
  progress: React.RefObject<Progress>;
  modelUrl: string;
  screen?: string | React.ReactNode;
  laptopColor: string;
  keyboardColor: string;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number];
  autoPlay: boolean;
  lidAngle: number;
  cameraPosition: [number, number, number];
  background: string | null;
  onReady?: () => void;
};

const DEG = Math.PI / 180;

/** HTML content is authored at this width, then scaled onto the panel. */
const SCREEN_PX = 1440;

/*
 * drei's Html in `transform` mode does not size the element from the camera —
 * it builds a CSS matrix3d and lets the browser's own perspective do the
 * projection. The object's scale is divided by `400 / distanceFactor`, so with
 * the default distanceFactor of 10 one world unit is 40 CSS pixels.
 *
 * distanceFactor is pinned below rather than left to default, so this constant
 * cannot silently drift if drei changes it.
 */
const HTML_DISTANCE_FACTOR = 10;
const HTML_PX_PER_UNIT = 400 / HTML_DISTANCE_FACTOR;
const HTML_SCALE = (SCREEN.width / SCREEN_PX) * HTML_PX_PER_UNIT;

/* ---------------------------------------------------------------- camera */

/**
 * Drives the camera from a wide 3/4 establishing shot to dead-centre of the
 * display. The final pose is derived from the screen's live world transform
 * and the current viewport aspect, so the display ends up exactly covering the
 * viewport — that is what makes the hand-off read as the screen opening
 * fullscreen rather than a laptop shrinking away.
 */
function CameraRig({
  progress,
  screenRef,
  autoPlay,
  cameraPosition,
}: {
  progress: React.RefObject<Progress>;
  screenRef: React.RefObject<THREE.Mesh | null>;
  autoPlay: boolean;
  cameraPosition: [number, number, number];
}) {
  const { camera, size } = useThree();

  const start = React.useMemo(() => new THREE.Vector3(...cameraPosition), [cameraPosition]);
  const mid = React.useMemo(() => new THREE.Vector3(0.15, 0.22, -0.6), []);
  const s = React.useMemo(
    () => ({
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      screenPos: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      up: new THREE.Vector3(),
      end: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      matrix: new THREE.Matrix4(),
    }),
    [],
  );

  useFrame(() => {
    const screen = screenRef.current;
    if (!screen) return;

    // Manual mode: sit where we are told and look at the laptop.
    if (!autoPlay) {
      camera.position.copy(start);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0.11, 0);
      return;
    }

    const t = progress.current.t;

    screen.updateWorldMatrix(true, false);
    s.screenPos.setFromMatrixPosition(screen.matrixWorld);
    s.quat.setFromRotationMatrix(s.matrix.extractRotation(screen.matrixWorld));
    s.normal.set(0, 0, 1).applyQuaternion(s.quat);
    s.up.set(0, 1, 0).applyQuaternion(s.quat);

    // Distance at which the display exactly covers the viewport.
    const cam = camera as THREE.PerspectiveCamera;
    const halfFov = (cam.fov * DEG) / 2;
    const aspect = size.width / size.height;
    const fit = Math.min(
      SCREEN.height / (2 * Math.tan(halfFov)),
      SCREEN.width / (2 * Math.tan(halfFov) * aspect),
    );
    s.end.copy(s.normal).multiplyScalar(fit).add(s.screenPos);

    // 0.00–0.38 hold the establishing shot, 0.38–0.74 swing round to face the
    // screen, 0.70–1.00 push in until it fills the frame.
    const swing = easeInOut(span(t, 0.38, 0.74));
    const push = easeInOut(span(t, 0.7, 1));

    s.pos.copy(start).lerp(mid, swing).lerp(s.end, push);
    s.look.set(0, 0.11, 0).lerp(s.screenPos, Math.max(swing * 0.85, push));

    cam.position.copy(s.pos);
    cam.up.set(0, 1, 0).lerp(s.up, push * 0.9).normalize();
    cam.lookAt(s.look);
  });

  return null;
}

/* ---------------------------------------------------------------- screen */

function TextureScreen({
  src,
  meshRef,
  matRef,
}: {
  src: string;
  meshRef: React.RefObject<THREE.Mesh | null>;
  matRef: React.RefObject<THREE.MeshBasicMaterial | null>;
}) {
  const texture = useTexture(src, (loaded) => {
    const map = Array.isArray(loaded) ? loaded[0] : loaded;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  });

  return (
    <mesh ref={meshRef} position={[0, SCREEN.y, SCREEN.z]} rotation={SCREEN_ROTATION}>
      <planeGeometry args={[SCREEN.width, SCREEN.height]} />
      <meshBasicMaterial ref={matRef} map={texture} toneMapped={false} transparent opacity={0} />
    </mesh>
  );
}

function HtmlScreen({
  children,
  meshRef,
  matRef,
  htmlRef,
}: {
  children: React.ReactNode;
  meshRef: React.RefObject<THREE.Mesh | null>;
  matRef: React.RefObject<THREE.MeshBasicMaterial | null>;
  htmlRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <mesh ref={meshRef} position={[0, SCREEN.y, SCREEN.z]} rotation={SCREEN_ROTATION}>
      <planeGeometry args={[SCREEN.width, SCREEN.height]} />
      {/* A backing plane, so the panel is never see-through while the HTML
          layer fades in over it. */}
      <meshBasicMaterial ref={matRef} color="#05070c" toneMapped={false} transparent opacity={0} />
      <Html
        transform
        center
        pointerEvents="none"
        distanceFactor={HTML_DISTANCE_FACTOR}
        scale={HTML_SCALE}
        position={[0, 0, 0.0004]}
        zIndexRange={[10, 0]}
      >
        <div
          ref={htmlRef}
          style={{
            width: SCREEN_PX,
            height: Math.round(SCREEN_PX / SCREEN_ASPECT),
            overflow: 'hidden',
            opacity: 0,
            background: '#05070c',
            // A real screen is not readable from behind. Without this the DOM
            // layer shows through the closed lid, mirrored.
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

/* ---------------------------------------------------------------- laptop */

function Laptop({
  progress,
  modelUrl,
  screen,
  laptopColor,
  keyboardColor,
  initialPosition,
  initialRotation,
  autoPlay,
  lidAngle,
  screenRef,
}: {
  progress: React.RefObject<Progress>;
  modelUrl: string;
  screen?: string | React.ReactNode;
  laptopColor: string;
  keyboardColor: string;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number];
  autoPlay: boolean;
  lidAngle: number;
  screenRef: React.RefObject<THREE.Mesh | null>;
}) {
  const { scene } = useGLTF(modelUrl);
  const root = React.useRef<THREE.Group>(null);
  const lid = React.useRef<THREE.Group>(null);
  const glow = React.useRef<THREE.PointLight>(null);
  const screenMat = React.useRef<THREE.MeshBasicMaterial>(null);
  const htmlRef = React.useRef<HTMLDivElement>(null);
  const tints = React.useRef<TintUniforms[]>([]);

  // The model's own LidPivot is detached and re-hung under a group this
  // component owns, so the opening angle is driven through a ref of ours
  // rather than by reaching into the loaded scene graph every frame.
  const model = React.useMemo(() => {
    const body = scene.clone(true);
    const uniforms: TintUniforms[] = [];
    body.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = mesh.material as THREE.MeshStandardMaterial;
      // Clone: the loader caches materials across every instance of the model
      // on the page, so patching in place would tint them all.
      const material = source.clone();
      // The source model is authored for a bright studio; darken and polish it
      // so it reads as anodised metal on a dark stage.
      material.envMapIntensity = 0.9;
      material.roughness = Math.min(material.roughness ?? 0.4, 0.34);
      material.metalness = 0.95;
      uniforms.push(applyTint(material, laptopColor, keyboardColor));
      mesh.material = material;
    });

    const pivot = body.getObjectByName('LidPivot') ?? null;
    const hinge = pivot ? (pivot.position.toArray() as [number, number, number]) : [0, 0, 0];
    if (pivot) {
      pivot.removeFromParent();
      pivot.position.set(0, 0, 0);
    }
    tints.current = uniforms;
    return { body, pivot, hinge: hinge as [number, number, number] };
    // laptopColor/keyboardColor are applied through the uniforms below, so
    // changing them must not rebuild the scene graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  React.useEffect(() => {
    for (const u of tints.current) setTint(u, laptopColor, keyboardColor);
  }, [laptopColor, keyboardColor]);

  useFrame(() => {
    // Manual mode: the props are the pose.
    if (!autoPlay) {
      if (root.current) {
        root.current.position.set(...initialPosition);
        root.current.rotation.set(
          initialRotation[0] * DEG,
          initialRotation[1] * DEG,
          initialRotation[2] * DEG,
        );
      }
      if (lid.current) lid.current.rotation.x = lidAngle * DEG;
      if (screenMat.current) screenMat.current.opacity = 1;
      if (htmlRef.current) htmlRef.current.style.opacity = '1';
      if (glow.current) glow.current.intensity = 1.2;
      return;
    }

    const t = progress.current.t;

    // 1. The flip-in: the shut laptop tumbles up out of the dark and settles
    //    into the hero pose.
    if (root.current) {
      const drop = easeOutBack(span(t, 0, 0.36));
      const settle = easeOut(span(t, 0.1, 0.5));
      // Square up to the camera for the final push so the screen sits dead-on.
      const square = easeInOut(span(t, 0.62, 0.96));
      root.current.position.set(
        lerp(initialPosition[0], 0, drop),
        lerp(initialPosition[1], 0, drop),
        lerp(initialPosition[2], 0, drop),
      );
      root.current.rotation.x = lerp(initialRotation[0] * DEG, 0, drop);
      root.current.rotation.y = lerp(
        lerp(initialRotation[1] * DEG, 0.3, settle),
        0,
        square,
      );
      root.current.rotation.z = lerp(initialRotation[2] * DEG, 0, drop);
    }

    // 2. The lid opens.
    if (lid.current) lid.current.rotation.x = easeInOut(span(t, 0.3, 0.66)) * lidAngle * DEG;

    // 3. The panel wakes as it clears the keyboard, then goes to full
    //    brightness just before the hand-off.
    const wake = span(t, 0.42, 0.78);
    if (screenMat.current) screenMat.current.opacity = Math.max(wake, 0.001);
    if (htmlRef.current) htmlRef.current.style.opacity = String(wake);
    if (glow.current) glow.current.intensity = wake * 0.5 + span(t, 0.82, 1) * 0.9;
  });

  const isTexture = typeof screen === 'string';

  return (
    <group ref={root} dispose={null}>
      <primitive object={model.body} />
      <group ref={lid} position={model.hinge}>
        {model.pivot ? <primitive object={model.pivot} /> : null}

        {isTexture ? (
          <TextureScreen src={screen} meshRef={screenRef} matRef={screenMat} />
        ) : (
          <HtmlScreen meshRef={screenRef} matRef={screenMat} htmlRef={htmlRef}>
            {screen}
          </HtmlScreen>
        )}

        {/* Backlight spill, so the open lid actually lights the keyboard. */}
        <pointLight
          ref={glow}
          position={[0, -0.05, SCREEN.z]}
          distance={1.2}
          decay={2}
          intensity={0}
          color="#cfe8ff"
        />
      </group>
    </group>
  );
}

/* ----------------------------------------------------------------- stage */

/** Fires once the suspended model and screen content have actually resolved. */
function Ready({ onReady }: { onReady?: () => void }) {
  React.useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}

export default function Scene({
  progress,
  modelUrl,
  screen,
  laptopColor,
  keyboardColor,
  initialPosition,
  initialRotation,
  autoPlay,
  lidAngle,
  cameraPosition,
  background,
  onReady,
}: SceneProps) {
  const screenRef = React.useRef<THREE.Mesh | null>(null);

  return (
    <>
      {background ? (
        <>
          <color attach="background" args={[background]} />
          <fog attach="fog" args={[background, 1.1, 3.4]} />
        </>
      ) : null}

      <ambientLight intensity={0.08} />
      <directionalLight position={[1.2, 2, -1.6]} intensity={0.55} color="#dfe7ff" />
      <directionalLight position={[-1.8, 0.7, 1.1]} intensity={0.35} color="#ffffff" />

      {/* A dark studio: narrow strips that read as highlights sliding along the
          chassis, not a room. Anything broader washes the aluminium out to grey
          and the "starts in the dark" mood goes with it. Built from
          Lightformers rather than an HDRI so nothing is fetched at runtime and
          the component works in a fully static export. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={1.5} position={[0.4, 1.4, -1.4]} scale={[2.6, 0.5, 1]} />
        <Lightformer
          form="rect"
          intensity={0.55}
          position={[-2, 0.5, -0.6]}
          scale={[1.4, 1.8, 1]}
          rotation-y={Math.PI / 2}
          color="#93a8ff"
        />
        <Lightformer
          form="rect"
          intensity={0.45}
          position={[2, 0.2, 0.4]}
          scale={[1.4, 1.8, 1]}
          rotation-y={-Math.PI / 2}
          color="#ffd7a8"
        />
      </Environment>

      <Laptop
        progress={progress}
        modelUrl={modelUrl}
        screen={screen}
        laptopColor={laptopColor}
        keyboardColor={keyboardColor}
        initialPosition={initialPosition}
        initialRotation={initialRotation}
        autoPlay={autoPlay}
        lidAngle={lidAngle}
        screenRef={screenRef}
      />
      <CameraRig
        progress={progress}
        screenRef={screenRef}
        autoPlay={autoPlay}
        cameraPosition={cameraPosition}
      />
      <Ready onReady={onReady} />
    </>
  );
}
