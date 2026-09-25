import * as React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import { SCREEN, SCREEN_ROTATION } from './geometry';
import { easeInOut, easeOut, easeOutBack, lerp, span } from '../easing';
import { Screen, type FlatHandle } from '../shared/screen';
import { Studio, Ready } from '../shared/studio';
import type { Progress } from '../shared/reveal';
import { applyTint, setTint, type TintUniforms } from '../tint';

export type LaptopSceneProps = {
  /** Where the flat hand-off copy lives; see <FlatScreen>. */
  flat?: FlatHandle;
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
  flat,
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
  flat?: FlatHandle;
}) {
  const { scene } = useGLTF(modelUrl);
  const root = React.useRef<THREE.Group>(null);
  const lid = React.useRef<THREE.Group>(null);
  const glow = React.useRef<THREE.PointLight>(null);
  // One number for how lit the display is. <Screen> decides which of its
  // layers that has to reach — the mesh, the projected DOM layer, or the flat
  // copy it hands off to as the camera arrives.
  const lit = React.useRef(0);
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
      lit.current = 1;
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
    lit.current = wake;
    if (glow.current) glow.current.intensity = wake * 0.5 + span(t, 0.82, 1) * 0.9;
  });

  return (
    <group ref={root} dispose={null}>
      <primitive object={model.body} />
      <group ref={lid} position={model.hinge}>
        {model.pivot ? <primitive object={model.pivot} /> : null}

        {/* The display: a plane laid into the lid's own local space. */}
        <Screen
          screen={screen}
          rect={{
            width: SCREEN.width,
            height: SCREEN.height,
            position: [0, SCREEN.y, SCREEN.z],
            rotation: SCREEN_ROTATION,
          }}
          meshRef={screenRef}
          opacity={lit}
          flat={flat}
        />

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
  flat,
}: LaptopSceneProps) {
  const screenRef = React.useRef<THREE.Mesh | null>(null);

  return (
    <>
      <Studio background={background} />

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
        flat={flat}
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
