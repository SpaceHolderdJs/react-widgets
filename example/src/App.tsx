import { useState } from 'react';
import { LaptopReveal, PhoneReveal } from '@space_holder/react-widgets';

/** The models are served from the package's own assets/ while developing. */
const LAPTOP_URL = '/laptop.glb';
const PHONE_URL = '/phone.glb';

const LAPTOP_PRESETS = [
  { name: 'Silver', body: '#b8bcc0', trim: '#26282b' },
  { name: 'Midnight', body: '#2e3440', trim: '#14171d' },
  { name: 'Gold', body: '#e3cfa8', trim: '#3a3128' },
  { name: 'Lime', body: '#c8f042', trim: '#1d2409' },
  { name: 'Inverted', body: '#1b1b1e', trim: '#e9ecf1' },
];

const PHONE_PRESETS = [
  { name: 'Titanium', body: '#c6cad0', trim: '#15171a' },
  { name: 'Midnight', body: '#3b4250', trim: '#0d0f13' },
  { name: 'Desert', body: '#d9c3a0', trim: '#2a231a' },
  { name: 'Lime', body: '#c8f042', trim: '#141a06' },
  { name: 'Graphite', body: '#4a4d52', trim: '#c9ced6' },
];

function Page({ kind }: { kind: 'laptop' | 'phone' }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 26,
        padding: '0 90px',
        background: 'linear-gradient(140deg, #0b1020, #131a2e 60%, #0b1020)',
        color: '#eef1f8',
      }}
    >
      <p style={{ margin: 0, fontSize: 24, letterSpacing: '0.34em', opacity: 0.55 }}>LIVE HTML</p>
      <h1 style={{ margin: 0, fontSize: kind === 'phone' ? 84 : 92, lineHeight: 1.03, fontWeight: 700 }}>
        This is a div,
        <br />
        not a screenshot.
      </h1>
      <p style={{ margin: 0, fontSize: 30, lineHeight: 1.45, maxWidth: 980, opacity: 0.72 }}>
        Pass a string and it is loaded as a texture. Pass React content and it is rendered onto the
        display plane — real DOM, selectable, interactive.
      </p>
    </div>
  );
}

/**
 * `?screen=<url>` swaps the live-HTML panel for a texture. The docs capture
 * uses it: drei's Html layer is positioned in useFrame, so a screenshot can
 * catch a paint before that frame's transform lands and record the div at
 * full size. A texture has no DOM layer and cannot do that.
 */
function params() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export default function App() {
  const q = params();
  const textureUrl = q.get('screen');
  // Query overrides, so the docs capture can drive the example without the
  // control panel in shot.
  const forcedManual = q.get('manual') === '1';
  const forcedAngle = q.get('angle') ? Number(q.get('angle')) : null;
  const forcedBody = q.get('body');
  const forcedTrim = q.get('trim');
  const [widget, setWidget] = useState<'laptop' | 'phone'>(
    q.get('widget') === 'laptop' ? 'laptop' : 'phone',
  );
  const [preset, setPreset] = useState(0);
  const [mode, setMode] = useState<'reveal' | 'manual'>('reveal');
  const [angle, setAngle] = useState(180);
  const [run, setRun] = useState(0);

  const presets = widget === 'laptop' ? LAPTOP_PRESETS : PHONE_PRESETS;
  const chosen = presets[Math.min(preset, presets.length - 1)];
  const c = {
    body: forcedBody ? `#${forcedBody}` : chosen.body,
    trim: forcedTrim ? `#${forcedTrim}` : chosen.trim,
  };
  const manual = forcedManual || mode === 'manual';
  const hinge = forcedAngle ?? angle;

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {widget === 'laptop' ? (
        <LaptopReveal
          key={`l-${mode}-${run}`}
          modelUrl={LAPTOP_URL}
          screen={textureUrl ?? <Page kind="laptop" />}
          laptopColor={c.body}
          keyboardColor={c.trim}
          autoPlay={!manual}
          lidAngle={manual ? Math.min(hinge, 125) : 103}
          initialRotation={manual ? [0, 32, 0] : undefined}
          initialPosition={manual ? [0, 0, 0] : undefined}
          onComplete={() => console.log('laptop reveal complete')}
        />
      ) : (
        <PhoneReveal
          key={`p-${mode}-${run}`}
          modelUrl={PHONE_URL}
          screen={textureUrl ?? <Page kind="phone" />}
          bodyColor={c.body}
          trimColor={c.trim}
          autoPlay={!manual}
          foldAngle={hinge}
          initialRotation={manual ? [0, -18, 0] : undefined}
          initialPosition={manual ? [0, 0, 0] : undefined}
          onComplete={() => console.log('phone reveal complete')}
        />
      )}

      {textureUrl ? null : (
      <div
        style={{
          position: 'absolute',
          left: 24,
          bottom: 24,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: 14,
          background: 'rgba(10, 12, 20, 0.72)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 14,
          backdropFilter: 'blur(10px)',
          fontSize: 13,
        }}
      >
        {(['phone', 'laptop'] as const).map((w) => (
          <button
            key={w}
            onClick={() => {
              setWidget(w);
              setPreset(0);
              setAngle(w === 'phone' ? 180 : 103);
            }}
            style={{
              padding: '7px 13px',
              background: widget === w ? 'rgba(255,255,255,0.16)' : 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 999,
              color: 'inherit',
              font: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {w}
          </button>
        ))}

        <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.18)' }} />

        {presets.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setPreset(i)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 12px',
              background: i === preset ? 'rgba(255,255,255,0.16)' : 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 999,
              color: 'inherit',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 4,
                background: `linear-gradient(135deg, ${p.body} 50%, ${p.trim} 50%)`,
              }}
            />
            {p.name}
          </button>
        ))}

        <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.18)' }} />

        <button
          onClick={() => setMode(manual ? 'reveal' : 'manual')}
          style={{
            padding: '7px 12px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 999,
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          {manual ? 'manual' : 'autoPlay'}
        </button>

        {manual ? (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {widget === 'phone' ? 'fold' : 'lid'} {angle}°
            <input
              type="range"
              min={0}
              max={widget === 'phone' ? 180 : 125}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
            />
          </label>
        ) : (
          <button
            onClick={() => setRun((n) => n + 1)}
            style={{
              padding: '7px 12px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 999,
              color: 'inherit',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            replay
          </button>
        )}
      </div>
      )}
    </div>
  );
}
