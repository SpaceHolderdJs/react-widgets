'use client';

import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import Scene from './Scene';
import { LID_OPEN_DEG, SCREEN } from './geometry';
import { useReveal } from '../shared/reveal';
import { tuneRenderer, useDpr } from '../shared/studio';
import { FlatScreen, useFlatHandle } from '../shared/screen';
import { cdnModelUrl, ModelBoundary } from '../shared/model';
import type { LaptopRevealProps } from '../types';

/** Where this package's own copy of the model is served from by default. */
export const DEFAULT_MODEL_URL = cdnModelUrl('laptop.glb');

const DEFAULTS = {
  initialPosition: [0, -0.42, 0] as [number, number, number],
  initialRotation: [-66, 83, -19] as [number, number, number],
  laptopColor: '#b8bcc0',
  keyboardColor: '#26282b',
  duration: 5200,
  cameraPosition: [0.5, 0.34, -0.78] as [number, number, number],
  fov: 38,
  background: '#04050a',
};

/**
 * A laptop that opens itself.
 *
 * The lid lifts out of the dark, the screen wakes, and the camera pushes in
 * until the display exactly covers the frame — which is what makes it read as
 * a page opening rather than a laptop shrinking away.
 */
export default function LaptopReveal({
  screen,
  initialPosition = DEFAULTS.initialPosition,
  initialRotation = DEFAULTS.initialRotation,
  laptopColor = DEFAULTS.laptopColor,
  keyboardColor = DEFAULTS.keyboardColor,
  autoPlay = true,
  duration = DEFAULTS.duration,
  lidAngle = LID_OPEN_DEG,
  cameraPosition = DEFAULTS.cameraPosition,
  fov = DEFAULTS.fov,
  background = DEFAULTS.background,
  modelUrl = DEFAULT_MODEL_URL,
  onReady,
  onComplete,
  onError,
  respectReducedMotion = true,
  className,
  style,
}: LaptopRevealProps) {
  // The timeline starts when the model and screen content have resolved, not
  // when the component mounts. Otherwise a cold load spends the reveal on a
  // download and the visitor arrives at the final frame.
  const [ready, setReady] = React.useState(false);
  const progress = useReveal({ autoPlay, duration, ready, respectReducedMotion, onComplete });

  const onReadyRef = React.useRef(onReady);
  React.useEffect(() => {
    onReadyRef.current = onReady;
  });
  const handleReady = React.useCallback(() => {
    setReady(true);
    onReadyRef.current?.();
  }, []);

  const dpr = useDpr();
  // The flat copy the reveal hands off to. It is a DOM sibling of the
  // canvas rather than a layer inside the scene — see <FlatScreen>.
  const flat = useFlatHandle();

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
    >
    <Canvas
      style={{ width: '100%', height: '100%', display: 'block' }}
      camera={{ position: cameraPosition, fov, near: 0.01, far: 24 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: background === null, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => tuneRenderer(gl)}
    >
      <ModelBoundary modelUrl={modelUrl} onError={onError}>
        <React.Suspense fallback={null}>
        <Scene
          progress={progress}
          modelUrl={modelUrl}
          screen={screen}
          laptopColor={laptopColor}
          keyboardColor={keyboardColor}
          initialPosition={initialPosition}
          initialRotation={initialRotation}
          autoPlay={autoPlay}
          lidAngle={lidAngle}
          cameraPosition={cameraPosition}
          background={background}
          onReady={handleReady}
          flat={flat}
        />
        </React.Suspense>
      </ModelBoundary>
    </Canvas>

      {typeof screen === 'string' ? null : (
        <FlatScreen handle={flat} aspect={SCREEN.width / SCREEN.height}>
          {screen}
        </FlatScreen>
      )}
    </div>
  );
}

/** Warms the model cache — call it before the component mounts. */
LaptopReveal.preload = (modelUrl: string = DEFAULT_MODEL_URL) => {
  useGLTF.preload(modelUrl);
};
