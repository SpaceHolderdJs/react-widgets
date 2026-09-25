import * as React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import { easeInOut, easeOut, easeOutBack, lerp, smoothstep, span } from '../easing';
import { Screen, type ScreenRect } from '../shared/screen';
import { Studio, Ready } from '../shared/studio';
import type { Progress } from '../shared/reveal';
import { bindPalette, setPalette, type PaletteBinding, type PaletteGroup } from '../shared/palette';
import { FOLD_OPEN_DEG, MODEL_YAW, SCREEN, SCREEN_ROTATION, wingRotations } from './geometry';

const DEG = Math.PI / 180;

/**
 * Which of the model's materials each colour prop drives. "glass" and
 * "display" are deliberately absent: the glass is transmissive and the
 * display is behind our own panel, so tinting either only muddies the screen.
 */
const groupsFor = (body: string, trim: string): PaletteGroup[] => [
  { materials: ['chassis', 'chassis-light', 'chassis-dark', 'frame'], color: body },
  { materials: ['trim', 'black'], color: trim },
];

export type FoldableSceneProps = {
  progress: React.RefObject<Progress>;
  modelUrl: string;
  screen?: string | React.ReactNode;
  bodyColor: string;
  screenBezelColor: string;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number];
  autoPlay: boolean;
  foldAngle: number;
  cameraPosition: [number, number, number];
  background: string | null;
  onReady?: () => void;
};

/* ---------------------------------------------------------------- camera */

/**
 * Wide three-quarter establishing shot, then a push to dead-centre of the
 * display. The final pose is derived from the screen's live world transform
 * and the current viewport aspect, so the display ends up exactly covering the
 * viewport — the same hand-off the laptop does.
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
  const mid = React.useMemo(() => new THREE.Vector3(-0.22, 0.16, 0.92), []);
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

    if (!autoPlay) {
      camera.position.copy(start);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      return;
    }

    const t = progress.current.t;

    screen.updateWorldMatrix(true, false);
    s.screenPos.setFromMatrixPosition(screen.matrixWorld);
    s.quat.setFromRotationMatrix(s.matrix.extractRotation(screen.matrixWorld));
    s.normal.set(0, 0, 1).applyQuaternion(s.quat);
    s.up.set(0, 1, 0).applyQuaternion(s.quat);

    const cam = camera as THREE.PerspectiveCamera;
    const halfFov = (cam.fov * DEG) / 2;
    const aspect = size.width / size.height;
    const fit = Math.min(
      SCREEN.height / (2 * Math.tan(halfFov)),
      SCREEN.width / (2 * Math.tan(halfFov) * aspect),
    );
    s.end.copy(s.normal).multiplyScalar(fit).add(s.screenPos);

    const swing = easeInOut(span(t, 0.36, 0.72));
    const push = easeInOut(span(t, 0.68, 1));

    s.pos.copy(start).lerp(mid, swing).lerp(s.end, push);
    s.look.set(0, 0, 0).lerp(s.screenPos, Math.max(swing * 0.85, push));

    cam.position.copy(s.pos);
    cam.up.set(0, 1, 0).lerp(s.up, push * 0.9).normalize();
    cam.lookAt(s.look);
  });

  return null;
}

/* -------------------------------------------------------------- foldable */

function Foldable({
  progress,
  modelUrl,
  screen,
  bodyColor,
  screenBezelColor,
  initialPosition,
  initialRotation,
  autoPlay,
  foldAngle,
  screenRef,
}: Omit<FoldableSceneProps, 'cameraPosition' | 'background' | 'onReady'> & {
  screenRef: React.RefObject<THREE.Mesh | null>;
}) {
  const { scene } = useGLTF(modelUrl);
  const root = React.useRef<THREE.Group>(null);
  const wingA = React.useRef<THREE.Object3D | null>(null);
  const wingB = React.useRef<THREE.Object3D | null>(null);
  const glow = React.useRef<THREE.PointLight>(null);
  // One number for how lit the display is. <Screen> decides which of its
  // layers that has to reach — the mesh, the projected DOM layer, or the flat
  // copy it hands off to as the camera arrives.
  const lit = React.useRef(0);
  const palette = React.useRef<PaletteBinding[]>([]);

  const model = React.useMemo(() => {
    const body = scene.clone(true);
    const seen = new Map<string, THREE.MeshStandardMaterial>();
    body.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = mesh.material as THREE.MeshStandardMaterial;
      // Clone once per material name: the loader caches materials across every
      // instance of the model on the page, so recolouring in place would
      // repaint them all. Sharing the clone keeps the draw-call count down.
      let material = seen.get(source.name);
      if (!material) {
        material = source.clone();
        // The source is authored near mirror-polished. At metalness 0.97 the
        // base colour contributes almost nothing — the body is whatever the
        // environment happens to reflect, which in a dark studio is close to
        // black — so bodyColor would be a prop that does nothing. Backing the
        // metalness off and lifting the environment lets the colour read while
        // the chassis still looks like metal rather than plastic.
        material.metalness = Math.min(material.metalness ?? 0.5, 0.62);
        material.envMapIntensity = 2.1;
        seen.set(source.name, material);
      }
      mesh.material = material;
    });
    palette.current = bindPalette([...seen.values()], groupsFor(bodyColor, screenBezelColor));
    return body;
    // Colours are applied through the bindings below, so changing them must
    // not rebuild the scene graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  React.useEffect(() => {
    wingA.current = model.getObjectByName('WingA') ?? null;
    wingB.current = model.getObjectByName('WingB') ?? null;
  }, [model]);

  React.useEffect(() => {
    setPalette(palette.current, groupsFor(bodyColor, screenBezelColor));
  }, [bodyColor, screenBezelColor]);

  const setFold = (deg: number) => {
    const [a, b] = wingRotations(deg);
    if (wingA.current) wingA.current.rotation.y = a;
    if (wingB.current) wingB.current.rotation.y = b;
  };

  useFrame(() => {
    if (!autoPlay) {
      if (root.current) {
        root.current.position.set(...initialPosition);
        root.current.rotation.set(
          initialRotation[0] * DEG,
          initialRotation[1] * DEG,
          initialRotation[2] * DEG,
        );
      }
      setFold(foldAngle);
      // The panel spans both halves, so it only makes sense while they are
      // roughly coplanar. Folded, it would hang in the air between them.
      const flat = smoothstep(foldAngle, 148, 178);
      lit.current = flat;
      if (glow.current) glow.current.intensity = 1.2 * flat;
      return;
    }

    const t = progress.current.t;

    // 1. The shut phone tumbles up out of the dark and settles.
    if (root.current) {
      const drop = easeOutBack(span(t, 0, 0.36));
      const settle = easeOut(span(t, 0.1, 0.5));
      const square = easeInOut(span(t, 0.6, 0.94));
      root.current.position.set(
        lerp(initialPosition[0], 0, drop),
        lerp(initialPosition[1], 0, drop),
        lerp(initialPosition[2], 0, drop),
      );
      root.current.rotation.x = lerp(initialRotation[0] * DEG, 0, drop);
      root.current.rotation.y = lerp(lerp(initialRotation[1] * DEG, -0.28, settle), 0, square);
      root.current.rotation.z = lerp(initialRotation[2] * DEG, 0, drop);
    }

    // 2. It unfolds.
    const fold = lerp(12, foldAngle, easeInOut(span(t, 0.28, 0.66)));
    setFold(fold);
    const flat = smoothstep(fold, 148, 178);

    // 3. The panel wakes once the fold is far enough along that the display is
    //    actually facing out, then goes to full brightness for the hand-off.
    const wake = span(t, 0.46, 0.8) * flat;
    lit.current = wake;
    if (glow.current) glow.current.intensity = wake * 0.4 + span(t, 0.84, 1) * 0.8;
  });

  const rect: ScreenRect = {
    width: SCREEN.width,
    height: SCREEN.height,
    position: [SCREEN.x, SCREEN.y, SCREEN.z],
    rotation: SCREEN_ROTATION,
  };

  return (
    <group ref={root} dispose={null}>
      {/* The asset is baked back to front; this is the half turn that puts its
          display on +Z. See MODEL_YAW. */}
      <group rotation={[0, MODEL_YAW, 0]}>
        <primitive object={model} />
      </group>

      {/* One plane across both halves. The two wings are coplanar when flat,
          so a single panel is geometrically right; while the phone is still
          folding it is faded out, which is also when it would clip. */}
      <Screen screen={screen} rect={rect} meshRef={screenRef} opacity={lit} />

      <pointLight
        ref={glow}
        position={[SCREEN.x, SCREEN.y, SCREEN.z + 0.12]}
        distance={1.1}
        decay={2}
        intensity={0}
        color="#cfe8ff"
      />
    </group>
  );
}

export default function FoldableScene({
  progress,
  modelUrl,
  screen,
  bodyColor,
  screenBezelColor,
  initialPosition,
  initialRotation,
  autoPlay,
  foldAngle = FOLD_OPEN_DEG,
  cameraPosition,
  background,
  onReady,
}: FoldableSceneProps) {
  const screenRef = React.useRef<THREE.Mesh | null>(null);

  return (
    <>
      <Studio background={background} intensity={1.9} />
      <Foldable
        progress={progress}
        modelUrl={modelUrl}
        screen={screen}
        bodyColor={bodyColor}
        screenBezelColor={screenBezelColor}
        initialPosition={initialPosition}
        initialRotation={initialRotation}
        autoPlay={autoPlay}
        foldAngle={foldAngle}
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
