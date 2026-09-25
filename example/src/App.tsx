import { useState } from 'react';
import { LaptopReveal, FoldableReveal, PhoneReveal } from '@space_holder/react-widgets';

/** The models are served from the package's own assets/ while developing. */
const MODEL_URL = {
  laptop: '/laptop.glb',
  foldable: '/foldable.glb',
  phone: '/handset.glb',
} as const;

type Widget = keyof typeof MODEL_URL;

const PRESETS: Record<Widget, { name: string; body: string; trim: string }[]> = {
  laptop: [
    { name: 'Silver', body: '#b8bcc0', trim: '#26282b' },
    { name: 'Midnight', body: '#2e3440', trim: '#14171d' },
    { name: 'Gold', body: '#e3cfa8', trim: '#3a3128' },
    { name: 'Lime', body: '#c8f042', trim: '#1d2409' },
    { name: 'Inverted', body: '#1b1b1e', trim: '#e9ecf1' },
  ],
  foldable: [
    { name: 'Titanium', body: '#c6cad0', trim: '#15171a' },
    { name: 'Midnight', body: '#3b4250', trim: '#0d0f13' },
    { name: 'Desert', body: '#d9c3a0', trim: '#2a231a' },
    { name: 'Lime', body: '#c8f042', trim: '#141a06' },
    { name: 'Graphite', body: '#4a4d52', trim: '#c9ced6' },
  ],
  // The exported PHONE_FINISHES, spelled out so the panel can label them.
  phone: [
    { name: 'Titanium', body: '#c3c7cb', trim: '#1b1d21' },
    { name: 'Graphite', body: '#4b4e54', trim: '#121316' },
    { name: 'Sand', body: '#cdb190', trim: '#2b2319' },
    { name: 'Deep blue', body: '#3f5a7d', trim: '#10151d' },
    { name: 'Champagne', body: '#dcc79c', trim: '#2a2418' },
  ],
};

/** The hinge-or-equivalent knob each widget exposes when autoPlay is off. */
const ANGLE: Record<Widget, { label: string; min: number; max: number; rest: number }> = {
  laptop: { label: 'lid', min: 0, max: 125, rest: 103 },
  foldable: { label: 'fold', min: 0, max: 180, rest: 180 },
  phone: { label: 'turn', min: -180, max: 180, rest: 0 },
};

function Page({ kind }: { kind: Widget }) {
  const narrow = kind === 'phone';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: narrow ? 20 : 26,
        padding: narrow ? '0 56px' : '0 90px',
        background: 'linear-gradient(140deg, #0b1020, #131a2e 60%, #0b1020)',
        color: '#eef1f8',
      }}
    >
      <p style={{ margin: 0, fontSize: narrow ? 20 : 24, letterSpacing: '0.34em', opacity: 0.55 }}>
        LIVE HTML
      </p>
      <h1
        style={{
          margin: 0,
          fontSize: narrow ? 62 : kind === 'foldable' ? 84 : 92,
          lineHeight: 1.03,
          fontWeight: 700,
        }}
      >
        This is a div,
        <br />
        not a screenshot.
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: narrow ? 24 : 30,
          lineHeight: 1.45,
          maxWidth: 980,
          opacity: 0.72,
        }}
      >
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
  const asked = q.get('widget') as Widget | null;
  const [widget, setWidget] = useState<Widget>(
    asked && asked in MODEL_URL ? asked : 'phone',
  );
  const [preset, setPreset] = useState(0);
  const [mode, setMode] = useState<'reveal' | 'manual'>('reveal');
  const [angle, setAngle] = useState(ANGLE[asked && asked in MODEL_URL ? asked : 'phone'].rest);
  const [run, setRun] = useState(0);

  const presets = PRESETS[widget];
  const chosen = presets[Math.min(preset, presets.length - 1)];
  const c = {
    body: forcedBody ? `#${forcedBody}` : chosen.body,
    trim: forcedTrim ? `#${forcedTrim}` : chosen.trim,
  };
  const manual = forcedManual || mode === 'manual';
  const hinge = forcedAngle ?? angle;
  const knob = ANGLE[widget];
  const runKey = `${widget}-${mode}-${run}`;
  const common = {
    modelUrl: MODEL_URL[widget],
    screen: textureUrl ?? <Page kind={widget} />,
    autoPlay: !manual,
    onComplete: () => console.log(`${widget} reveal complete`),
  };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {widget === 'laptop' ? (
        <LaptopReveal
          key={runKey}
          {...common}
          laptopColor={c.body}
          keyboardColor={c.trim}
          lidAngle={manual ? Math.min(hinge, 125) : 103}
          initialRotation={manual ? [0, 32, 0] : undefined}
          initialPosition={manual ? [0, 0, 0] : undefined}
        />
      ) : widget === 'foldable' ? (
        <FoldableReveal
          key={runKey}
          {...common}
          bodyColor={c.body}
          trimColor={c.trim}
          foldAngle={hinge}
          initialRotation={manual ? [0, -18, 0] : undefined}
          initialPosition={manual ? [0, 0, 0] : undefined}
        />
      ) : (
        <PhoneReveal
          key={runKey}
          {...common}
          bodyColor={c.body}
          trimColor={c.trim}
          turnAngle={hinge}
          initialRotation={manual ? [0, 0, 0] : undefined}
          initialPosition={manual ? [0, 0, 0] : undefined}
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
          {(['phone', 'foldable', 'laptop'] as const).map((w) => (
            <button
              key={w}
              onClick={() => {
                setWidget(w);
                setPreset(0);
                setAngle(ANGLE[w].rest);
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
              {knob.label} {angle}°
              <input
                type="range"
                min={knob.min}
                max={knob.max}
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
