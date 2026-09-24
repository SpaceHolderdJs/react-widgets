import { useState } from 'react';
import { LaptopReveal } from '@igorsergien/react-widgets';

/** The model is served from the package itself while developing. */
const MODEL_URL = '/laptop.glb';

const PRESETS = [
  { name: 'Silver', laptop: '#b8bcc0', keyboard: '#26282b' },
  { name: 'Midnight', laptop: '#2e3440', keyboard: '#14171d' },
  { name: 'Gold', laptop: '#e3cfa8', keyboard: '#3a3128' },
  { name: 'Lime', laptop: '#c8f042', keyboard: '#1d2409' },
  { name: 'Inverted', laptop: '#1b1b1e', keyboard: '#e9ecf1' },
];

function Page() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 28,
        padding: '0 96px',
        background: 'linear-gradient(140deg, #0b1020, #131a2e 60%, #0b1020)',
        color: '#eef1f8',
      }}
    >
      <p style={{ margin: 0, fontSize: 26, letterSpacing: '0.34em', opacity: 0.55 }}>LIVE HTML</p>
      <h1 style={{ margin: 0, fontSize: 96, lineHeight: 1.02, fontWeight: 700 }}>
        This is a div,
        <br />
        not a screenshot.
      </h1>
      <p style={{ margin: 0, fontSize: 32, lineHeight: 1.45, maxWidth: 1000, opacity: 0.72 }}>
        Pass a string and it is loaded as a texture. Pass React content and it is rendered onto the
        display plane — real DOM, selectable, interactive.
      </p>
    </div>
  );
}

export default function App() {
  const [preset, setPreset] = useState(0);
  const [mode, setMode] = useState<'reveal' | 'manual'>('reveal');
  const [lid, setLid] = useState(103);
  const [run, setRun] = useState(0);
  const colors = PRESETS[preset];

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <LaptopReveal
        key={`${mode}-${run}`}
        modelUrl={MODEL_URL}
        screen={<Page />}
        laptopColor={colors.laptop}
        keyboardColor={colors.keyboard}
        autoPlay={mode === 'reveal'}
        lidAngle={lid}
        initialRotation={mode === 'manual' ? [0, 32, 0] : undefined}
        initialPosition={mode === 'manual' ? [0, 0, 0] : undefined}
        onComplete={() => console.log('reveal complete')}
      />

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
        {PRESETS.map((p, i) => (
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
                background: `linear-gradient(135deg, ${p.laptop} 50%, ${p.keyboard} 50%)`,
              }}
            />
            {p.name}
          </button>
        ))}

        <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.18)' }} />

        <button
          onClick={() => setMode(mode === 'reveal' ? 'manual' : 'reveal')}
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
          {mode === 'reveal' ? 'autoPlay' : 'manual'}
        </button>

        {mode === 'reveal' ? (
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
        ) : (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            lid {lid}°
            <input
              type="range"
              min={0}
              max={125}
              value={lid}
              onChange={(e) => setLid(Number(e.target.value))}
            />
          </label>
        )}
      </div>
    </div>
  );
}
