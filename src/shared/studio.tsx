import * as React from 'react';
import * as THREE from 'three';
import { Environment, Lightformer } from '@react-three/drei';

/**
 * The lighting every widget is staged in.
 *
 * A dark studio: narrow strips that read as highlights sliding along a metal
 * chassis, not a room. Anything broader washes the aluminium out to grey and
 * the "starts in the dark" mood goes with it. Built from Lightformers rather
 * than an HDRI, so nothing is fetched at runtime and the components work in a
 * fully static export.
 */
export function Studio({
  background,
  intensity = 1,
}: {
  background: string | null;
  /** Scales the studio. A mirror-polished body needs more to read at all. */
  intensity?: number;
}) {
  return (
    <>
      {background ? (
        <>
          <color attach="background" args={[background]} />
          <fog attach="fog" args={[background, 1.1, 3.4]} />
        </>
      ) : null}

      <ambientLight intensity={0.08 * intensity} />
      <directionalLight position={[1.2, 2, -1.6]} intensity={0.55 * intensity} color="#dfe7ff" />
      <directionalLight position={[-1.8, 0.7, 1.1]} intensity={0.35 * intensity} color="#ffffff" />

      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={1.5 * intensity} position={[0.4, 1.4, -1.4]} scale={[2.6, 0.5, 1]} />
        <Lightformer
          form="rect"
          intensity={0.55 * intensity}
          position={[-2, 0.5, -0.6]}
          scale={[1.4, 1.8, 1]}
          rotation-y={Math.PI / 2}
          color="#93a8ff"
        />
        <Lightformer
          form="rect"
          intensity={0.45 * intensity}
          position={[2, 0.2, 0.4]}
          scale={[1.4, 1.8, 1]}
          rotation-y={-Math.PI / 2}
          color="#ffd7a8"
        />
      </Environment>
    </>
  );
}

/** Fires once the suspended model and screen content have actually resolved. */
export function Ready({ onReady }: { onReady?: () => void }) {
  React.useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}

/** Renderer defaults shared by every widget's Canvas. */
export function tuneRenderer(gl: THREE.WebGLRenderer) {
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 0.85;
}

/**
 * Phones pay for every pixel of a full-screen canvas and a reveal is over in
 * five seconds — a retina-sharp shell is not worth a dropped frame rate on the
 * devices most likely to be short of GPU.
 */
export function useDpr(): [number, number] {
  return React.useMemo<[number, number]>(
    () => (typeof window !== 'undefined' && window.innerWidth < 768 ? [1, 1.4] : [1, 1.75]),
    [],
  );
}
