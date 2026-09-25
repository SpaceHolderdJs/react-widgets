import * as React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import { easeInOut, easeOut, easeOutBack, lerp, span } from '../easing';
import { Screen, type ScreenRect } from '../shared/screen';
import { Studio, Ready } from '../shared/studio';
import type { Progress } from '../shared/reveal';
import { bindPalette, setPalette, type PaletteBinding, type PaletteGroup } from '../shared/palette';
import { facing, SCREEN, SCREEN_ROTATION, TURN_FACING_DEG } from './geometry';

const DEG = Math.PI / 180;

/**
 * Which of the model's materials each colour prop drives.
 *
 * Deliberately absent: "glass", "lens" and "lens-front" are optical and want
 * to stay near black whatever the finish; "display-panel" sits behind our own
 * content plane; "flash" and "port-contact" are lit or plated parts that read
 * as broken when they take the body colour. "grille" is absent for a duller
 * reason — it is the only member with a texture, so its base colour is white,
 * and inside a group brightness is relative: it would claim the top of the
 * range and push every other dark part down to the floor.
 */
const groupsFor = (body: string, trim: string): PaletteGroup[] => [
  { materials: ['chassis', 'chassis-back', 'chassis-edge'], color: body },
  { materials: ['trim', 'camera-plate', 'grille-frame', 'cutout', 'cutout-inner'], color: trim },
];

export type PhoneSceneProps = {
  progress: React.RefObject<Progress>;
  modelUrl: string;
  screen?: string | React.ReactNode;
  bodyColor: string;
  trimColor: string;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number];
  autoPlay: boolean;
  turnAngle: number;
  cameraPosition: [number, number, number];
  background: string | null;
  onReady?: () => void;
};

/* ---------------------------------------------------------------- camera */

/**
 * Three-quarter establishing shot, then a push to dead centre of the display.
 * The final pose is derived from the screen's live world transform and the
 * current viewport aspect, so the display ends up exactly covering the
 * viewport — the same hand-off the other two widgets do.
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
  const mid = React.useMemo(() => new THREE.Vector3(0.46, 0.14, 1.48), []);
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
    // A portrait display in a landscape viewport is limited by its height, and
    // by its width the other way round; taking the smaller distance of the two
    // means the screen fills the frame without ever cropping.
    const fit = Math.min(
      SCREEN.height / (2 * Math.tan(halfFov)),
      SCREEN.width / (2 * Math.tan(halfFov) * aspect),
    );
    s.end.copy(s.normal).multiplyScalar(fit).add(s.screenPos);

    const swing = easeInOut(span(t, 0.34, 0.7));
    const push = easeInOut(span(t, 0.7, 1));

    s.pos.copy(start).lerp(mid, swing).lerp(s.end, push);
    s.look.set(0, 0, 0).lerp(s.screenPos, Math.max(swing * 0.85, push));

    cam.position.copy(s.pos);
    cam.up.set(0, 1, 0).lerp(s.up, push * 0.9).normalize();
    cam.lookAt(s.look);
  });

  return null;
}

/* ----------------------------------------------------------------- phone */

function Handset({
  progress,
  modelUrl,
  screen,
  bodyColor,
  trimColor,
  initialPosition,
  initialRotation,
  autoPlay,
  turnAngle,
  screenRef,
}: Omit<PhoneSceneProps, 'cameraPosition' | 'background' | 'onReady'> & {
  screenRef: React.RefObject<THREE.Mesh | null>;
}) {
  const { scene } = useGLTF(modelUrl);
  const root = React.useRef<THREE.Group>(null);
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
        // Most of this model is authored at full metalness, where the base
        // colour contributes almost nothing and the body is whatever the
        // environment happens to reflect — in a dark studio, near black. That
        // would make bodyColor a prop that does nothing. Backing the metalness
        // off and lifting the environment lets the colour read while the
        // chassis still looks like metal rather than plastic.
        material.metalness = Math.min(material.metalness ?? 0.5, 0.5);
        // Most of the body is authored glossy as well as metallic, and a
        // glossy metal in a dark studio is a mirror: it shows the room, which
        // here is mostly unlit. Roughening it scatters the few lights there
        // are across the whole panel, which is what makes the finish legible
        // as a colour rather than as two highlights on black.
        material.roughness = Math.max(material.roughness ?? 0.5, 0.42);
        material.envMapIntensity = 2.4;
        seen.set(source.name, material);
      }
      mesh.material = material;
    });
    palette.current = bindPalette([...seen.values()], groupsFor(bodyColor, trimColor));
    return body;
    // Colours are applied through the bindings below, so changing them must
    // not rebuild the scene graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  React.useEffect(() => {
    setPalette(palette.current, groupsFor(bodyColor, trimColor));
  }, [bodyColor, trimColor]);

  const light = (amount: number) => {
    lit.current = amount;
    if (glow.current) glow.current.intensity = amount * 1.2;
  };

  useFrame(() => {
    if (!autoPlay) {
      if (root.current) {
        root.current.position.set(...initialPosition);
        root.current.rotation.set(
          initialRotation[0] * DEG,
          turnAngle * DEG,
          initialRotation[2] * DEG,
        );
      }
      light(facing(turnAngle));
      return;
    }

    const t = progress.current.t;

    // 1. It rises out of the dark, back towards the viewer, and turns over.
    //    The turn runs long and finishes last: it is the move, and the drop is
    //    only there to give it somewhere to arrive.
    const rise = easeOutBack(span(t, 0, 0.42));
    const settle = easeOut(span(t, 0.08, 0.52));
    const turn = easeInOut(span(t, 0.12, 0.64));
    const square = easeInOut(span(t, 0.6, 0.95));
    const deg = lerp(lerp(initialRotation[1], -16, turn), turnAngle, square);

    if (root.current) {
      root.current.position.set(
        lerp(initialPosition[0], 0, rise),
        lerp(initialPosition[1], 0, rise),
        lerp(initialPosition[2], 0, rise),
      );
      root.current.rotation.x = lerp(initialRotation[0] * DEG, 0, settle);
      root.current.rotation.y = deg * DEG;
      root.current.rotation.z = lerp(initialRotation[2] * DEG, 0, settle);
    }

    // 2. The display wakes once the phone is round far enough to show it, then
    //    goes to full brightness for the hand-off to the camera.
    const wake = span(t, 0.4, 0.78) * facing(deg);
    light(wake + span(t, 0.86, 1) * 0.2 * facing(deg));
  });

  const rect: ScreenRect = {
    width: SCREEN.width,
    height: SCREEN.height,
    position: [SCREEN.x, SCREEN.y, SCREEN.z],
    rotation: SCREEN_ROTATION,
  };

  return (
    <group ref={root} dispose={null}>
      <primitive object={model} />

      {/* Edge to edge: the panel covers the display area exactly, which on
          this model runs to within a couple of millimetres of the rails. */}
      <Screen screen={screen} rect={rect} meshRef={screenRef} opacity={lit} />

      <pointLight
        ref={glow}
        position={[SCREEN.x, SCREEN.y, SCREEN.z + 0.1]}
        distance={0.9}
        decay={2}
        intensity={0}
        color="#cfe8ff"
      />
    </group>
  );
}

export default function PhoneScene({
  progress,
  modelUrl,
  screen,
  bodyColor,
  trimColor,
  initialPosition,
  initialRotation,
  autoPlay,
  turnAngle = TURN_FACING_DEG,
  cameraPosition,
  background,
  onReady,
}: PhoneSceneProps) {
  const screenRef = React.useRef<THREE.Mesh | null>(null);

  return (
    <>
      <Studio background={background} intensity={2.35} fog={[2.1, 5.4]} />
      <Handset
        progress={progress}
        modelUrl={modelUrl}
        screen={screen}
        bodyColor={bodyColor}
        trimColor={trimColor}
        initialPosition={initialPosition}
        initialRotation={initialRotation}
        autoPlay={autoPlay}
        turnAngle={turnAngle}
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
