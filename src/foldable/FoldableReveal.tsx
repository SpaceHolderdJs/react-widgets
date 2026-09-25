'use client';

import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import Scene from './Scene';
import { FOLD_OPEN_DEG } from './geometry';
import { useReveal } from '../shared/reveal';
import { tuneRenderer, useDpr } from '../shared/studio';
import type { FoldableRevealProps } from '../types';

/** Where this package's own copy of the model is served from by default. */
export const DEFAULT_FOLDABLE_MODEL_URL = `https://unpkg.com/${__PKG_NAME__}@${__PKG_VERSION__}/assets/foldable.glb`;

const DEFAULTS = {
  initialPosition: [0, -0.38, 0] as [number, number, number],
  initialRotation: [-54, -72, 16] as [number, number, number],
  bodyColor: '#c6cad0',
  trimColor: '#15171a',
  duration: 5000,
  cameraPosition: [-0.62, 0.38, 0.86] as [number, number, number],
  fov: 38,
  background: '#04050a',
};

/**
 * A book-fold phone that opens itself.
 *
 * It tumbles in shut, unfolds to flat, the display wakes, and the camera
 * pushes in until the screen exactly covers the frame — the same language as
 * <LaptopReveal>, turned on its side.
 */
export default function FoldableReveal({
  screen,
  initialPosition = DEFAULTS.initialPosition,
  initialRotation = DEFAULTS.initialRotation,
  bodyColor = DEFAULTS.bodyColor,
  trimColor = DEFAULTS.trimColor,
  autoPlay = true,
  duration = DEFAULTS.duration,
  foldAngle = FOLD_OPEN_DEG,
  cameraPosition = DEFAULTS.cameraPosition,
  fov = DEFAULTS.fov,
  background = DEFAULTS.background,
  modelUrl = DEFAULT_FOLDABLE_MODEL_URL,
  onReady,
  onComplete,
  respectReducedMotion = true,
  className,
  style,
}: FoldableRevealProps) {
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

  return (
    <Canvas
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', ...style }}
      camera={{ position: cameraPosition, fov, near: 0.01, far: 24 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: background === null, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => tuneRenderer(gl)}
    >
      <React.Suspense fallback={null}>
        <Scene
          progress={progress}
          modelUrl={modelUrl}
          screen={screen}
          bodyColor={bodyColor}
          screenBezelColor={trimColor}
          initialPosition={initialPosition}
          initialRotation={initialRotation}
          autoPlay={autoPlay}
          foldAngle={foldAngle}
          cameraPosition={cameraPosition}
          background={background}
          onReady={handleReady}
        />
      </React.Suspense>
    </Canvas>
  );
}

/** Warms the model cache — call it before the component mounts. */
FoldableReveal.preload = (modelUrl: string = DEFAULT_FOLDABLE_MODEL_URL) => {
  useGLTF.preload(modelUrl);
};
