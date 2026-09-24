# @space_holder/react-widgets

A laptop that opens itself.

The lid lifts out of the dark, the screen wakes, and the camera pushes in until
the display exactly covers the frame — so the hand-off reads as a page opening,
not a laptop shrinking away. Put a screenshot on it, or put real HTML on it.

One widget for now. The package name leaves room for more.

```bash
npm install @space_holder/react-widgets three @react-three/fiber @react-three/drei
```

`three`, `@react-three/fiber`, `@react-three/drei`, `react` and `react-dom` are
peer dependencies — the package brings none of them, so it cannot give you a
second copy of three.

## Use

```tsx
import { LaptopReveal } from '@space_holder/react-widgets';

export default function Hero() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <LaptopReveal screen="/hero-screenshot.webp" onComplete={() => console.log('done')} />
    </div>
  );
}
```

The component fills its parent, so give that parent a size.

### Real HTML on the screen

Pass React content instead of a URL and it is rendered onto the display plane
as actual DOM — selectable, styleable, interactive:

```tsx
<LaptopReveal
  screen={
    <div style={{ padding: 96, background: '#0b1020', color: '#fff' }}>
      <h1 style={{ fontSize: 96 }}>Shipping today</h1>
    </div>
  }
/>
```

Content is authored at **1440 × 974 px** and scaled onto the panel, so size
things as you would for a 1440px-wide viewport. A texture is cheaper; prefer it
when the content never changes.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `screen` | `string \| ReactNode` | — | A string is loaded as an image or video texture. Anything else is rendered as HTML on the panel. |
| `initialPosition` | `[x, y, z]` | `[0, -0.42, 0]` | Where the laptop starts, in model units. The base is ~0.4 wide and sits on `y = 0`. |
| `initialRotation` | `[x, y, z]` degrees | `[-66, 83, -19]` | How it is turned when it starts. The reveal unwinds this as it settles. |
| `laptopColor` | `string` | `'#b8bcc0'` | Chassis, lid shell and palm rest. |
| `keyboardColor` | `string` | `'#26282b'` | Keys, trackpad and the dark trim around them. |
| `autoPlay` | `boolean` | `true` | Play the reveal on mount. `false` gives you a laptop you place yourself. |
| `duration` | `number` ms | `5200` | Length of the reveal. |
| `lidAngle` | `number` degrees | `103` | `0` shut, `90` upright. Only used when `autoPlay` is `false`. |
| `cameraPosition` | `[x, y, z]` | `[0.5, 0.34, -0.78]` | Where the camera starts (and stays, in manual mode). |
| `fov` | `number` | `38` | Vertical field of view. |
| `background` | `string \| null` | `'#04050a'` | `null` leaves the canvas transparent. |
| `modelUrl` | `string` | unpkg | See **Serving the model**. |
| `onReady` | `() => void` | — | Model and screen content have loaded. |
| `onComplete` | `() => void` | — | The reveal finished. Never fires when `autoPlay` is `false`. |
| `respectReducedMotion` | `boolean` | `true` | Show the final frame instead of animating, for visitors who ask for it. |
| `className`, `style` | | | Applied to the canvas. |

`onReady` and `onComplete` are read through refs, so passing them inline does
not restart the animation.

### Colours

The model is a single material: one texture carries the shell, the keys, the
trackpad and the screen glass. `laptopColor` and `keyboardColor` are separated
per texel by luminance, then *rescaled* rather than multiplied — which is why a
white keyboard on a black body works, and why the printed legends and panel
lines survive whatever colours you choose.

```tsx
<LaptopReveal laptopColor="#1b1b1e" keyboardColor="#e9ecf1" />
```

The screen glass is deliberately left alone; tinting it turns the bezel into a
coloured frame.

### Manual mode

With `autoPlay={false}` nothing animates. `initialPosition`, `initialRotation`
and `lidAngle` place the laptop and you drive them however you like:

```tsx
const [lid, setLid] = useState(0);

<LaptopReveal
  autoPlay={false}
  screen="/shot.webp"
  initialPosition={[0, 0, 0]}
  initialRotation={[0, 32, 0]}
  lidAngle={lid}
/>
```

Drive `lidAngle` from a scroll position, a spring, or a timeline of your own.

## Serving the model

The laptop is a 490 KB `.glb`. By default it is fetched from this package's
copy on unpkg, so the component works with no build configuration:

```
https://unpkg.com/@space_holder/react-widgets@<version>/assets/laptop.glb
```

**For production, serve it yourself.** Either copy it into your public folder:

```bash
cp node_modules/@space_holder/react-widgets/assets/laptop.glb public/
```

```tsx
<LaptopReveal modelUrl="/laptop.glb" />
```

…or let your bundler fingerprint it (Vite, webpack 5, Next):

```tsx
import modelUrl from '@space_holder/react-widgets/laptop.glb';

<LaptopReveal modelUrl={modelUrl} />;
```

To avoid a blank first frame, warm the cache before the component mounts:

```tsx
LaptopReveal.preload('/laptop.glb');
```

### Using your own model

`modelUrl` takes any `.glb`, so the bundled laptop is a default rather than a
dependency. To swap it, the model has to meet the contract in
`src/geometry.ts` — the runtime does no fitting of its own, deliberately, so
that a frame costs two rotations and nothing else:

| | |
| --- | --- |
| Orientation | Levelled and centred. The base sits flat on `y = 0`, the open lid faces **−Z**. |
| `LidPivot` | An empty node on the hinge axis. Its `rotation.x` **is** the opening angle: `0` shut, `PI/2` upright. |
| `Lid` | A child of `LidPivot`, geometry baked closed and hinge-centred. |
| Scale | Roughly 0.4 units wide. The camera distances and light positions are tuned to that. |

Then tell the component where the display is, by editing `SCREEN` in
`src/geometry.ts` — width, height, and the offset of the panel inside the
lid's local space. Record the same numbers in the model's `asset.extras` so
the two can be checked against each other later; `laptop.glb` carries
`extras.screen` and `extras.hinge` for exactly that reason.

**Two things to check before you ship someone else's model.** First, that its
licence allows redistribution inside an npm package *and* commercial use —
"free to download" is not a licence. Second, that its textures carry no
manufacturer's logo: a model of a real product almost always does, and a
trademark is not covered by the asset's own licence however permissive that
licence is. [NOTICE](./NOTICE) has the full checklist and the shape an entry
takes.

## Next.js

The build carries a `"use client"` banner, so importing it from a server
component is fine — but it still has to render on the client:

```tsx
'use client';
import { LaptopReveal } from '@space_holder/react-widgets';
```

There is no DOM access at module scope, so it will not break a server render.

## Performance

- Device pixel ratio is capped at 1.4 below 768px wide, 1.75 above.
- The studio is built from `Lightformer`s rather than an HDRI, so nothing is
  fetched at runtime and the component works in a fully static export.
- The model is ~11.5k triangles, one material, one draw call per mesh.
- `respectReducedMotion` skips straight to the final frame by default.

## Releasing

From a terminal, nothing else involved:

```bash
npm logout                    # discard whatever credential is cached
npm login --auth-type=web     # opens a browser; approve with your passkey
npm publish
```

`--auth-type=web` hands the second factor to the browser, so a passkey or a
device security key works and there is no code to type. It is the default from
npm 9 onwards; on npm 8.14–8.x pass it explicitly, and below that upgrade.

`npm publish` runs `prepublishOnly` first, so a release that does not
typecheck and build cannot go out.

**If it still refuses**, the cached credential is the problem rather than the
account. A `403 … Two-factor authentication or granular access token with
bypass 2fa enabled is required` means npm is being handed a token that carries
no 2FA assertion — usually a classic token, or one pasted into `~/.npmrc` by
hand. `npm logout` does not always remove a hand-written `_authToken`, so
check that file and delete the line before logging in again.

<details>
<summary>Automating it later</summary>

`.github/workflows/publish.yml` publishes on a GitHub release through trusted
publishing: npm verifies over OIDC that the release came from that workflow in
this repo, so no `NPM_TOKEN` is stored anywhere and provenance is attached
automatically. It needs a one-time setup on npmjs.com — **Package settings →
Trusted Publisher → GitHub Actions**, with this repo and the workflow filename
`publish.yml` — which can only be done once the package exists, so the first
publish is manual either way.

Do not reach for a long-lived publish token instead: granular access tokens
with 2FA bypass lose sensitive account actions in August 2026 and the ability
to publish at all around January 2027.

</details>

### npm v12

npm v12 stopped running dependency install scripts by default. This package
declares **no install scripts of its own** and no git or remote-URL
dependencies, so installing it needs no approval from you. Building it does:
`esbuild` — one package, reached through `tsup` — needs its `postinstall` to
place a platform binary. On npm 12 or later, install it here with
`npm install --allow-scripts=esbuild` rather than allowing the whole tree.

## Licence

MIT for the code — see [LICENSE](./LICENSE).

The assets in `assets/` are **not** MIT, and each carries its own terms. The
laptop is based on "MacBook" by
[Nicholas-3D](https://sketchfab.com/Nicholas01), licensed
[CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/), which permits
commercial use and requires attribution. **If you ship an asset, ship its
credit** — including into bundled output, where it is easy to lose by
accident. [NOTICE](./NOTICE) carries one entry per asset with the exact
wording, the changes made to each original, and what to check before adding
another.

The maker's mark has been removed from the laptop's textures; the model
carries no brand identification and this project is not affiliated with any
hardware manufacturer.

## Development

```bash
npm install
npm run build          # tsup -> dist (esm + cjs + types)
npm run typecheck
npm --prefix example install && npm --prefix example run dev
```

The example runs against `src/` directly, so changes show up without a build.
It exercises every prop: colour presets, autoplay vs manual, and a lid slider.
