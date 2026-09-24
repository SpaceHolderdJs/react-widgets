'use client';

import * as React from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

import Scene, { type Progress } from './Scene';
import { LID_OPEN_DEG } from './geometry';
import type { LaptopRevealProps } from './types';

/** Where this package's own copy of the model is served from by default. */
export const DEFAULT_MODEL_URL = `https://unpkg.com/${__PKG_NAME__}@${__PKG_VERSION__}/assets/laptop.glb`;

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

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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
  respectReducedMotion = true,
  className,
  style,
}: LaptopRevealProps) {
  const progress = React.useRef<Progress>({ t: 0 });
  const done = React.useRef(false);

  // Callers pass these inline far more often than not, and a new function
  // identity must not restart the reveal — so they are read through refs and
  // kept out of the effect's dependencies.
  const onCompleteRef = React.useRef(onComplete);
  const onReadyRef = React.useRef(onReady);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
    onReadyRef.current = onReady;
  });
  const handleReady = React.useCallback(() => onReadyRef.current?.(), []);

  // Decided on the client only, and read through the ref rather than state, so
  // it can never cause a hydration mismatch or a re-render mid-animation.
  const reduced = React.useRef(false);
  React.useEffect(() => {
    reduced.current = respectReducedMotion && prefersReducedMotion();
  }, [respectReducedMotion]);

  React.useEffect(() => {
    if (!autoPlay) {
      progress.current.t = 0;
      return;
    }

    done.current = false;

    // Reduced motion: show the finished frame, do not animate to it.
    if (respectReducedMotion && prefersReducedMotion()) {
      progress.current.t = 1;
      const id = window.setTimeout(() => onCompleteRef.current?.(), 0);
      return () => window.clearTimeout(id);
    }

    progress.current.t = 0;
    let raf = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min((now - start) / duration, 1);
      progress.current.t = t;
      if (t < 1) {
        raf = window.requestAnimationFrame(tick);
        return;
      }
      if (!done.current) {
        done.current = true;
        onCompleteRef.current?.();
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [autoPlay, duration, respectReducedMotion]);

  // Phones pay for every pixel of a full-screen canvas and the reveal is over
  // in five seconds — a retina-sharp shell is not worth a dropped frame rate on
  // the devices most likely to be short of GPU.
  const dpr = React.useMemo<[number, number]>(
    () => (typeof window !== 'undefined' && window.innerWidth < 768 ? [1, 1.4] : [1, 1.75]),
    [],
  );

  return (
    <Canvas
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', ...style }}
      camera={{ position: cameraPosition, fov, near: 0.01, far: 24 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: background === null, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.85;
      }}
    >
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
        />
      </React.Suspense>
    </Canvas>
  );
}

/** Warms the model cache — call it before the component mounts. */
LaptopReveal.preload = (modelUrl: string = DEFAULT_MODEL_URL) => {
  useGLTF.preload(modelUrl);
};
