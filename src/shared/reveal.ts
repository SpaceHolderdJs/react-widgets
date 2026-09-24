import * as React from 'react';

export type Progress = { t: number };

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Drives a 0 → 1 timeline for a reveal.
 *
 * The value lives in a ref rather than in state: it changes every frame, and a
 * re-render per frame would cost more than the animation it is driving. The
 * scene reads it inside useFrame.
 *
 * Callbacks are read through a ref too. Callers pass them inline far more
 * often than not, and a new function identity must not restart the reveal.
 */
export function useReveal({
  autoPlay,
  duration,
  startAt = 0,
  ready = true,
  respectReducedMotion,
  onComplete,
}: {
  autoPlay: boolean;
  duration: number;
  startAt?: number;
  /**
   * Whether the model and screen content have loaded. The timeline must not
   * start before they have: a reveal that runs while a megabyte of geometry is
   * still downloading is simply over by the time anything is on screen.
   */
  ready?: boolean;
  respectReducedMotion: boolean;
  onComplete?: () => void;
}) {
  const progress = React.useRef<Progress>({ t: startAt });
  const done = React.useRef(false);
  const onCompleteRef = React.useRef(onComplete);

  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  React.useEffect(() => {
    if (!autoPlay) {
      progress.current.t = startAt;
      return;
    }
    if (!ready) {
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
  }, [autoPlay, duration, startAt, ready, respectReducedMotion]);

  return progress;
}
