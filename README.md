# @space_holder/react-widgets

3D device reveals for React. A device tumbles out of the dark, opens itself,
the screen wakes, and the camera pushes in until the display exactly covers the
frame — so the hand-off reads as a page opening, not a device shrinking away.

Put a screenshot on the screen, or put real HTML on it.

| | |
| --- | --- |
| <img src="https://raw.githubusercontent.com/SpaceHolderdJs/react-widgets/main/docs/media/laptop.gif" width="420" alt="LaptopReveal: the lid opens and the camera pushes into the screen"> | <img src="https://raw.githubusercontent.com/SpaceHolderdJs/react-widgets/main/docs/media/phone.gif" width="420" alt="PhoneReveal: the phone unfolds and the camera pushes into the screen"> |
| **`<LaptopReveal>`** — the lid lifts, the panel wakes. | **`<PhoneReveal>`** — a book-fold opens flat across two screens. |

```bash
npm install @space_holder/react-widgets three @react-three/fiber @react-three/drei
```

`three`, `@react-three/fiber`, `@react-three/drei`, `react` and `react-dom` are
peer dependencies — the package brings none of them, so it cannot give you a
second copy of three.

## Use

```tsx
import { LaptopReveal, PhoneReveal } from '@space_holder/react-widgets';

export default function Hero() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <LaptopReveal screen="/hero-screenshot.webp" onComplete={() => console.log('done')} />
    </div>
  );
}
```

Both widgets fill their parent, so give that parent a size. They take the same
props except for the two colours and the hinge angle, which are named for the
device.

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

Content is authored at **1440 px wide** and scaled onto the panel, so size
things as you would for a 1440px-wide viewport. The height follows the device:
974 px on the laptop (3:2), 1021 px on the unfolded phone (1.41:1). A texture is
cheaper; prefer it when the content never changes.

## Props

Both widgets share this set:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `screen` | `string \| ReactNode` | — | A string is loaded as an image or video texture. Anything else is rendered as HTML on the panel. |
| `initialPosition` | `[x, y, z]` | per widget | Where the device starts, in model units. |
| `initialRotation` | `[x, y, z]` degrees | per widget | How it is turned when it starts. The reveal unwinds this as it settles. |
| `autoPlay` | `boolean` | `true` | Play the reveal on mount. `false` gives you a device you place yourself. |
| `duration` | `number` ms | per widget | Length of the reveal. |
| `cameraPosition` | `[x, y, z]` | per widget | Where the camera starts (and stays, in manual mode). |
| `fov` | `number` | `38` | Vertical field of view. |
| `background` | `string \| null` | `'#04050a'` | `null` leaves the canvas transparent. |
| `modelUrl` | `string` | unpkg | See **Serving the models**. |
| `onReady` | `() => void` | — | Model and screen content have loaded. |
| `onComplete` | `() => void` | — | The reveal finished. Never fires when `autoPlay` is `false`. |
| `respectReducedMotion` | `boolean` | `true` | Show the final frame instead of animating, for visitors who ask for it. |
| `className`, `style` | | | Applied to the canvas. |

`onReady` and `onComplete` are read through refs, so passing them inline does
not restart the animation. The reveal begins when the model and screen content
have loaded, not when the component mounts — otherwise a cold visitor spends
the animation on a download and arrives at the last frame.

### `<LaptopReveal>`

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `laptopColor` | `string` | `'#b8bcc0'` | Chassis, lid shell and palm rest. |
| `keyboardColor` | `string` | `'#26282b'` | Keys, trackpad and the dark trim around them. |
| `lidAngle` | `number` degrees | `103` | `0` shut, `90` upright. Only used when `autoPlay` is `false`. |
| `initialPosition` | | `[0, -0.42, 0]` | The base is ~0.4 wide and sits on `y = 0`. |
| `initialRotation` | | `[-66, 83, -19]` | |
| `duration` | | `5200` | |
| `cameraPosition` | | `[0.5, 0.34, -0.78]` | The open lid faces −Z, so the camera stages there. |

<img src="https://raw.githubusercontent.com/SpaceHolderdJs/react-widgets/main/docs/media/laptop-colours.png" width="820" alt="The laptop in five colour pairs, including a black body with a white keyboard">

The laptop is a single material: one texture carries the shell, the keys, the
trackpad and the screen glass. `laptopColor` and `keyboardColor` are separated
per texel by luminance, then *rescaled* rather than multiplied — which is why a
white keyboard on a black body works, and why the printed legends and panel
lines survive whatever colours you choose.

```tsx
<LaptopReveal laptopColor="#1b1b1e" keyboardColor="#e9ecf1" />
```

The screen glass is deliberately left alone; tinting it turns the bezel into a
coloured frame.

### `<PhoneReveal>`

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `bodyColor` | `string` | `'#c6cad0'` | Chassis, chamfer and frame. |
| `trimColor` | `string` | `'#15171a'` | Bezel, hinge trim and the dark inlays. |
| `foldAngle` | `number` degrees | `180` | `180` flat, `0` shut with the halves face to face. Only used when `autoPlay` is `false`. |
| `initialPosition` | | `[0, -0.38, 0]` | Flat open the device is ~0.78 wide. |
| `initialRotation` | | `[-54, -72, 16]` | |
| `duration` | | `5000` | |
| `cameraPosition` | | `[-0.62, 0.38, 0.86]` | The display faces +Z, so the camera stages there. |

<img src="https://raw.githubusercontent.com/SpaceHolderdJs/react-widgets/main/docs/media/phone-fold.png" width="820" alt="The phone at fold angles 0, 60, 120 and 180 degrees">

This model is the other shape: a handful of flat materials named for the parts
they cover, so the two colours are an assignment rather than a texel trick.
Materials inside a group keep their brightness relative to the brightest one,
so a chassis and its lighter chamfer stay distinct instead of flattening to a
single value.

The screen panel spans both halves. It is faded out until the fold is nearly
flat — folded, a single panel across two wings would hang in the air between
them.

### Manual mode

With `autoPlay={false}` nothing animates. `initialPosition`, `initialRotation`
and the hinge angle place the device and you drive them however you like:

```tsx
const [fold, setFold] = useState(0);

<PhoneReveal
  autoPlay={false}
  screen="/shot.webp"
  initialPosition={[0, 0, 0]}
  initialRotation={[0, -18, 0]}
  foldAngle={fold}
/>
```

Drive the angle from a scroll position, a spring, or a timeline of your own.
The laptop is the same with `lidAngle`.

## Serving the models

Each widget loads a `.glb` — 490 KB for the laptop, 490 KB for the phone. By
default each is fetched from this package's copy on unpkg, so a component works
with no build configuration:

```
https://unpkg.com/@space_holder/react-widgets@<version>/assets/laptop.glb
https://unpkg.com/@space_holder/react-widgets@<version>/assets/phone.glb
```

**For production, serve them yourself.** Either copy them into your public
folder:

```bash
cp node_modules/@space_holder/react-widgets/assets/*.glb public/
```

```tsx
<LaptopReveal modelUrl="/laptop.glb" />
<PhoneReveal modelUrl="/phone.glb" />
```

…or let your bundler fingerprint them (Vite, webpack 5, Next):

```tsx
import laptopUrl from '@space_holder/react-widgets/laptop.glb';
import phoneUrl from '@space_holder/react-widgets/phone.glb';
```

To avoid a blank first frame, warm the cache before the component mounts:

```tsx
LaptopReveal.preload('/laptop.glb');
PhoneReveal.preload('/phone.glb');
```

Only the widgets you import pull in their model; nothing loads a `.glb` you
never render.

### Using your own model

`modelUrl` takes any `.glb`, so the bundled devices are defaults rather than
dependencies. To swap one, the model has to meet the contract in that widget's
`geometry.ts` — the runtime does no fitting of its own, deliberately, so that a
frame costs a rotation or two and nothing else.

**Laptop** (`src/laptop/geometry.ts`):

| | |
| --- | --- |
| Orientation | Levelled and centred. The base sits flat on `y = 0`, the open lid faces **−Z**. |
| `LidPivot` | An empty node on the hinge axis. Its `rotation.x` **is** the opening angle: `0` shut, `PI/2` upright. |
| `Lid` | A child of `LidPivot`, geometry baked closed and hinge-centred. |
| Scale | Roughly 0.4 units wide. |

**Phone** (`src/phone/geometry.ts`):

| | |
| --- | --- |
| Orientation | Baked **flat open**, centred, with the display facing **+Z** — which is why the content plane needs no rotation and therefore no mirrored UVs. |
| `WingA`, `WingB` | Bare pivots on the Y axis through the origin, one per half. Their `rotation.y` **is** the fold. Keep them empty: an asset pipeline that writes a de-quantise translation onto a pivot moves it off the hinge. |
| `Spine` | The hinge block. Never moves. |
| Scale | Roughly 0.78 units wide, flat open. |

Then tell the component where the display is, by editing `SCREEN` in the same
file — width, height and the panel's offset. Record the same numbers in the
model's `asset.extras` so the two can be checked against each other later; both
bundled models carry `extras.screen` and `extras.hinge` for exactly that reason.

`scripts/` is not shipped, but the asset pipeline that produced `phone.glb`
(flatten, re-pose, split the crease, strip, quantise) is worth reading if you
are preparing a model of your own.

**Two things to check before you ship someone else's model.** First, that its
licence allows redistribution inside an npm package *and* commercial use —
"free to download" is not a licence. Second, that its textures carry no
manufacturer's marks: a model of a real product almost always does, and a
trademark is not covered by the asset's own licence however permissive that
licence is. Both bundled models needed work on this count — see
[NOTICE](./NOTICE) for what was removed from each, and the checklist before
adding another.

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
- The laptop is ~11.5k triangles and one material. The phone is ~19k across
  seven materials, welded and quantised (`KHR_mesh_quantization`, which three
  decodes natively — no Draco or meshopt decoder is fetched).
- Materials are cloned once per name, not once per mesh, so the phone's 14
  primitives do not become 14 materials.
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

The models in `assets/` are **not** MIT, and each carries its own terms. Both
are CC-BY-4.0, which permits commercial use and requires attribution:

| | |
| --- | --- |
| `laptop.glb` | based on "MacBook" by [Nicholas-3D](https://sketchfab.com/Nicholas01) |
| `phone.glb` | based on "iPhone Duo 3D Model - By Pikkme Studio" by [PikkmeStudios](https://sketchfab.com/stockpikkme) |

**If you ship a model, ship its credit** — including into bundled output, where
it is easy to lose by accident. [NOTICE](./NOTICE) carries one entry per asset
with the exact wording, the changes made to each original, and what to check
before adding another.

Neither model ships with brand identification. The laptop's maker mark was
removed from its textures; the phone's logo meshes were deleted and the two
screen regions of its texture — which carried a manufacturer's application
icons, UI and wordmark, plus a stock photograph — were blanked. A CC-BY licence
covers the modeller's own work and cannot license any of that. This project is
not affiliated with, endorsed by, or sponsored by any hardware manufacturer.

## Development

```bash
npm install
npm run build          # tsup -> dist (esm + cjs + types)
npm run typecheck
npm --prefix example install && npm --prefix example run dev
```

The example runs against `src/` directly, so changes show up without a build.
It exercises every prop: both widgets, colour presets, autoplay vs manual, and
a hinge slider. `?screen=<url>` swaps the live-HTML panel for a texture.

`node capture.mjs` records the sequences and `python3 makemedia.py` turns them
into `docs/media/`. It drives the page
with a virtual clock that only advances when asked and is frozen the rest of
the time, so a frame is the frame that was requested however long the machine
took to render it — the captures are reproducible rather than a sample of one
machine's frame rate.
