'use client';

import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import Scene from './Scene';
import { TURN_FACING_DEG } from './geometry';
import { useReveal } from '../shared/reveal';
import { tuneRenderer, useDpr } from '../shared/studio';
import { cdnModelUrl, ModelBoundary } from '../shared/model';
import type { PhoneRevealProps } from '../types';

/** Where this package's own copy of the model is served from by default. */
export const DEFAULT_HANDSET_MODEL_URL = cdnModelUrl('handset.glb');

/**
 * Finishes in the current flagship idiom: brushed light metal, near black,
 * warm sand, deep blue, and a pale gold. Named for what they look like —
 * a manufacturer's colour names are trademarks, and these are not those
 * colours under another label, just a starting set that suits the model.
 */
export const PHONE_FINISHES = {
  titanium: { bodyColor: '#c3c7cb', trimColor: '#1b1d21' },
  graphite: { bodyColor: '#4b4e54', trimColor: '#121316' },
  sand: { bodyColor: '#cdb190', trimColor: '#2b2319' },
  deepBlue: { bodyColor: '#3f5a7d', trimColor: '#10151d' },
  champagne: { bodyColor: '#dcc79c', trimColor: '#2a2418' },
} as const;

const DEFAULTS = {
  initialPosition: [0, -0.34, -0.22] as [number, number, number],
  initialRotation: [16, 168, -14] as [number, number, number],
  bodyColor: PHONE_FINISHES.titanium.bodyColor,
  trimColor: PHONE_FINISHES.titanium.trimColor,
  duration: 4600,
  cameraPosition: [0.86, 0.44, 1.42] as [number, number, number],
  fov: 38,
  background: '#04050a',
};

/**
 * A phone that turns over to show you its screen.
 *
 * It rises out of the dark back first, rolls round, the display wakes as it
 * comes square on, and the camera pushes in until the screen exactly covers
 * the frame — the same language as <LaptopReveal> and <FoldableReveal>, with
 * the turn standing in for the hinge.
 */
export default function PhoneReveal({
  screen,
  initialPosition = DEFAULTS.initialPosition,
  initialRotation = DEFAULTS.initialRotation,
  bodyColor = DEFAULTS.bodyColor,
  trimColor = DEFAULTS.trimColor,
  autoPlay = true,
  duration = DEFAULTS.duration,
  turnAngle = TURN_FACING_DEG,
  cameraPosition = DEFAULTS.cameraPosition,
  fov = DEFAULTS.fov,
  background = DEFAULTS.background,
  modelUrl = DEFAULT_HANDSET_MODEL_URL,
  onReady,
  onComplete,
  onError,
  respectReducedMotion = true,
  className,
  style,
}: PhoneRevealProps) {
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
      <ModelBoundary modelUrl={modelUrl} onError={onError}>
        <React.Suspense fallback={null}>
        <Scene
          progress={progress}
          modelUrl={modelUrl}
          screen={screen}
          bodyColor={bodyColor}
          trimColor={trimColor}
          initialPosition={initialPosition}
          initialRotation={initialRotation}
          autoPlay={autoPlay}
          turnAngle={turnAngle}
          cameraPosition={cameraPosition}
          background={background}
          onReady={handleReady}
        />
        </React.Suspense>
      </ModelBoundary>
    </Canvas>
  );
}

/** Warms the model cache — call it before the component mounts. */
PhoneReveal.preload = (modelUrl: string = DEFAULT_HANDSET_MODEL_URL) => {
  useGLTF.preload(modelUrl);
};
