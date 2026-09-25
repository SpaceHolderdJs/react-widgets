# @space_holder/react-widgets

3D device reveals for React. A device tumbles out of the dark, opens itself,
the screen wakes, and the camera pushes in until the display exactly covers the
frame — so the hand-off reads as a page opening, not a device shrinking away.

Put a screenshot on the screen, or put real HTML on it.

| | | |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/SpaceHolderdJs/react-widgets/main/docs/media/laptop.gif" width="280" alt="LaptopReveal: the lid opens and the camera pushes into the screen"> | <img src="https://raw.githubusercontent.com/SpaceHolderdJs/react-widgets/main/docs/media/foldable.gif" width="280" alt="FoldableReveal: the phone unfolds flat and the camera pushes into the screen"> | <img src="https://raw.githubusercontent.com/SpaceHolderdJs/react-widgets/main/docs/media/phone.gif" width="280" alt="PhoneReveal: the phone turns over and the camera pushes into the screen"> |
| **`<LaptopReveal>`** — the lid lifts, the panel wakes. | **`<FoldableReveal>`** — a book-fold opens flat across two screens. | **`<PhoneReveal>`** — a phone turns over to show its screen. |

```bash
npm install @space_holder/react-widgets three @react-three/fiber @react-three/drei
```

`three`, `@react-three/fiber`, `@react-three/drei`, `react` and `react-dom` are
peer dependencies — the package brings none of them, so it cannot give you a
second copy of three.

## Three devices, one API

They are the same component wearing different hardware. Every prop in
**[Props](#props)** is shared; what differs is the two colour names and the one
angle, because a lid, a fold and a turn are not the same thing.

| | `<LaptopReveal>` | `<FoldableReveal>` | `<PhoneReveal>` |
| --- | --- | --- | --- |
| The move | the lid lifts | the book opens flat | the phone turns over |
| Screen, at 1440 px wide | 1440 × 974 (3:2) | 1440 × 1021 (1.41:1) | 1440 × 3117 (19.5:9, portrait) |
| Colours | `laptopColor`, `keyboardColor` | `bodyColor`, `trimColor` | `bodyColor`, `trimColor` |
| Angle, in manual mode | `lidAngle` — 0 shut, 103 resting | `foldAngle` — 0 shut, 180 flat | `turnAngle` — 0 face on, 180 back on |
| Model | `laptop.glb`, 487 KB | `foldable.glb`, 478 KB | `handset.glb`, 523 KB |
| Triangles | ~11.5k | ~19k | ~14k |
| Camera stages on | −Z | +Z | +Z |

Pick by the shape of what goes on the screen, not by the device: the laptop
suits a landscape screenshot, the foldable a near-square one, the phone a tall
one. Nothing stops you putting a portrait page on the laptop — it will just
letterbox, the same as it would on the real thing.

```tsx
import { LaptopReveal, FoldableReveal, PhoneReveal } from '@space_holder/react-widgets';

<LaptopReveal   screen="/desktop.webp"  laptopColor="#b8bcc0" keyboardColor="#26282b" />
<FoldableReveal screen="/tablet.webp"   bodyColor="#c6cad0"   trimColor="#15171a" />
<PhoneReveal    screen="/mobile.webp"   bodyColor="#c3c7cb"   trimColor="#1b1d21" />
```

### More than one on a page

Each widget owns a `<Canvas>`, so two of them are two WebGL contexts. Browsers
cap those somewhere around eight to sixteen per page and silently kill the
oldest when you go over, so a page of six device mockups is a page where the
first one goes black. If you want a row of them, render one at a time — swap
the mounted widget behind a tab, or mount on scroll and unmount on the way out.

What is safe to repeat is the *same* widget: the loader caches a model per URL
and this package clones materials once per material name, so a second
`<PhoneReveal>` costs a canvas and no geometry.

Only the widgets you import pull in their model. Importing all three and
rendering one fetches one `.glb`.

## Use

```tsx
import { LaptopReveal, FoldableReveal, PhoneReveal } from '@space_holder/react-widgets';

export default function Hero() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <LaptopReveal screen="/hero-screenshot.webp" onComplete={() => console.log('done')} />
    </div>
  );
}
```

All three fill their parent, so give that parent a size.

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

Content is authored at **1440 px wide** and mapped onto the panel, so size
things as you would for a 1440px-wide viewport. The height follows the device:
974 px on the laptop (3:2), 1021 px on the unfolded foldable (1.41:1), 3117 px on
the phone (19.5:9 portrait — so for the phone, author at 1440 wide and expect a
tall page). A texture is cheaper; prefer it when the content never changes.

The panel is a sibling of the canvas, not a layer inside the 3D scene, and it
is placed each frame with a **homography** — the four corners of the display
are projected to screen pixels, and the one `matrix3d` that maps the content's
rectangle onto that quadrilateral is applied to it. Two consequences worth
knowing about:

- **It is the same on every screen.** No CSS `perspective` is involved, so
  nothing depends on the pixel height of the canvas. The panel lands in the
  same place, to the last decimal, at 300 px tall and at 1000 px tall, at
  `devicePixelRatio` 1 and 2.
- **It stays the size you authored it.** However close the camera gets, the
  element is still 1440 px wide; the transform does the rest. Nothing is ever
  laid out at a runaway size, and there is no near plane to fall through.

It also means the content is genuinely live at any angle: text on the display
selects, and controls on it click, because the browser hit tests back through
the same transform.

## Props

All three share this set:

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
| `onError` | `(e: Error) => void` | — | The model could not be loaded. Nothing renders; show a static image instead. |
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

### `<FoldableReveal>`

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `bodyColor` | `string` | `'#c6cad0'` | Chassis, chamfer and frame. |
| `trimColor` | `string` | `'#15171a'` | Bezel, hinge trim and the dark inlays. |
| `foldAngle` | `number` degrees | `180` | `180` flat, `0` shut with the halves face to face. Only used when `autoPlay` is `false`. |
| `initialPosition` | | `[0, -0.38, 0]` | Flat open the device is ~0.78 wide. |
| `initialRotation` | | `[-54, -72, 16]` | |
| `duration` | | `5000` | |
| `cameraPosition` | | `[-0.62, 0.38, 0.86]` | The display faces +Z, so the camera stages there. |

<img src="https://raw.githubusercontent.com/SpaceHolderdJs/react-widgets/main/docs/media/foldable-fold.png" width="820" alt="The foldable at fold angles 0, 60, 120 and 180 degrees">

This model is the other shape: a handful of flat materials named for the parts
they cover, so the two colours are an assignment rather than a texel trick.
Materials inside a group keep their brightness relative to the brightest one,
so a chassis and its lighter chamfer stay distinct instead of flattening to a
single value.

The screen panel spans both halves. It is faded out until the fold is nearly
flat — folded, a single panel across two wings would hang in the air between
them.

### `<PhoneReveal>`

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `bodyColor` | `string` | `'#c3c7cb'` | Chassis, back panel and chamfer. |
| `trimColor` | `string` | `'#1b1d21'` | Rails, camera plate and the cutout around the front lens. |
| `turnAngle` | `number` degrees | `0` | `0` faces you, `180` shows the back. Only used when `autoPlay` is `false`. |
| `initialPosition` | | `[0, -0.34, -0.22]` | The body is 0.72 units tall. |
| `initialRotation` | | `[16, 168, -14]` | Starts back-on, so the reveal has something to turn over. |
| `duration` | | `4600` | |
| `cameraPosition` | | `[0.86, 0.44, 1.42]` | The display faces +Z, so the camera stages there. |

<img src="https://raw.githubusercontent.com/SpaceHolderdJs/react-widgets/main/docs/media/phone-finishes.png" width="820" alt="The phone from behind in five finishes: titanium, graphite, sand, deep blue and champagne">

There is no hinge on this one, so the turn does the work the fold does on the
foldable: it rises out of the dark back first, rolls round, and the display
fades up as it comes square on — `facing(turnAngle)` is that fade, exported if
you want to drive your own lighting from it.

Five finishes in the current flagship idiom are exported as `PHONE_FINISHES`,
each a `bodyColor`/`trimColor` pair:

```tsx
import { PhoneReveal, PHONE_FINISHES } from '@space_holder/react-widgets';

<PhoneReveal {...PHONE_FINISHES.deepBlue} screen="/shot.webp" />
```

`titanium`, `graphite`, `sand`, `deepBlue`, `champagne` — named for what they
look like. They are a starting set that suits this model, not any
manufacturer's palette under another label; those names are trademarks. Any hex
pair works, and the two colours are independent, so a light body with a light
trim is as valid as the defaults.

The optical parts — cover glass, both lenses, the flash — are deliberately left
out of both groups. They want to stay near black whatever the finish, and
tinting the glass turns the whole front into a coloured pane.

### Manual mode

With `autoPlay={false}` nothing animates. `initialPosition`, `initialRotation`
and the hinge angle place the device and you drive them however you like:

```tsx
const [fold, setFold] = useState(0);

<FoldableReveal
  autoPlay={false}
  screen="/shot.webp"
  initialPosition={[0, 0, 0]}
  initialRotation={[0, -18, 0]}
  foldAngle={fold}
/>
```

Drive the angle from a scroll position, a spring, or a timeline of your own.
Each widget has one: `lidAngle` on the laptop, `foldAngle` on the foldable,
`turnAngle` on the phone.

## Serving the models

Each widget loads a `.glb` — 487 KB, 478 KB and 523 KB. By default each is
fetched from this package's copy on jsDelivr, so a component works with no
build configuration:

```
https://cdn.jsdelivr.net/npm/@space_holder/react-widgets@<version>/assets/laptop.glb
https://cdn.jsdelivr.net/npm/@space_holder/react-widgets@<version>/assets/foldable.glb
https://cdn.jsdelivr.net/npm/@space_holder/react-widgets@<version>/assets/handset.glb
```

**That default is for getting started, not for shipping.** It puts someone
else's CDN in the critical path of your hero, and a CDN that will not serve
the file is indistinguishable from a broken widget — `useGLTF` suspends, and
a Suspense boundary is as happy with a rejected fetch as a pending one, so you
get an empty canvas and nothing in the console. The package now catches that
and says so by name:

```tsx
<PhoneReveal onError={(e) => setFallbackImage(true)} />
```

The files are named after the hardware rather than the component, so
`<PhoneReveal>` loads `handset.glb`.

**For production, serve them yourself.** Either copy them into your public
folder:

```bash
cp node_modules/@space_holder/react-widgets/assets/*.glb public/
```

```tsx
<LaptopReveal modelUrl="/laptop.glb" />
<FoldableReveal modelUrl="/foldable.glb" />
<PhoneReveal modelUrl="/handset.glb" />
```

…or let your bundler fingerprint them (Vite, webpack 5, Next):

```tsx
import laptopUrl from '@space_holder/react-widgets/laptop.glb';
import foldableUrl from '@space_holder/react-widgets/foldable.glb';
import handsetUrl from '@space_holder/react-widgets/handset.glb';
```

The demo app in this repo copies them on `postinstall`, resolved through the
package's export map rather than a `node_modules` path, which is the shape
worth stealing.

To avoid a blank first frame, warm the cache before the component mounts:

```tsx
LaptopReveal.preload('/laptop.glb');
FoldableReveal.preload('/foldable.glb');
PhoneReveal.preload('/handset.glb');
```

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

**Foldable** (`src/foldable/geometry.ts`):

| | |
| --- | --- |
| Orientation | Baked **flat open**, centred, with the display facing **+Z** — which is why the content plane needs no rotation and therefore no mirrored UVs. |
| `WingA`, `WingB` | Bare pivots on the Y axis through the origin, one per half. Their `rotation.y` **is** the fold. Keep them empty: an asset pipeline that writes a de-quantise translation onto a pivot moves it off the hinge. |
| `Spine` | The hinge block. Never moves. |
| Scale | Roughly 0.78 units wide, flat open. |

**Phone** (`src/phone/geometry.ts`): the least demanding of the three, because
nothing articulates.

| | |
| --- | --- |
| Orientation | Levelled, axis aligned, and centred on its own bounding box — so a turn spins it on the spot rather than swinging it around a point off to one side. Display faces **+Z**. |
| Hierarchy | None required. One node holding the mesh is enough. |
| Materials | Named for the part they cover, and grouped in `src/phone/Scene.tsx`. A textured material must not join a colour group: base colour is white on those, and brightness inside a group is relative, so it would claim the top of the range and flatten every other member. |
| Scale | Body 0.72 units tall. |

Then tell the component where the display is, by editing `SCREEN` in the same
file — width, height and the panel's offset. Record the same numbers in the
model's `asset.extras` so the two can be checked against each other later; both
bundled models carry `extras.screen` and `extras.hinge` for exactly that reason.

`scripts/` is not shipped, but the two asset pipelines in it are worth reading
if you are preparing a model of your own: `build-foldable-asset.py` (flatten a
223-node hierarchy, re-pose flat, split the crease between the wings, strip,
quantise) and `build-handset-asset.py` (level, centre, rescale, erase the
maker's mark, shrink textures by three orders of magnitude).

**Two things to check before you ship someone else's model.** First, that its
licence allows redistribution inside an npm package *and* commercial use —
"free to download" is not a licence. Second, that it carries no manufacturer's
marks: a model of a real product almost always does — in a texture, or as
geometry, or as a shape cut out of a panel so that deleting the insert leaves
the mark behind as a hole — and a trademark is not covered by the asset's own
licence however permissive that licence is. All three bundled models needed
work on this count — see
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
- The laptop is ~11.5k triangles and one material. The foldable is ~19k across
  seven materials and the phone ~14k across sixteen, welded, decimated and
  quantised (`KHR_mesh_quantization`, which three decodes natively — no Draco
  or meshopt decoder is fetched).
- Materials are cloned once per name, not once per mesh, so the phone's sixteen
  primitives do not become sixteen materials per instance on the page.
- The phone's textures were rebuilt at 64–96 px. The original carried 4 MB of
  1024-square maps for a grille weave and a flash lens a few hundredths of a
  unit across; they are 15 KB now and no pixel of the difference survives to
  the screen.
- `respectReducedMotion` skips straight to the final frame by default.
- Placing the HTML panel costs four vector projections and one 3x3 solve per
  frame, and writes a single `transform`. The element itself never resizes, so
  the browser relayouts nothing while the camera moves.

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
| `foldable.glb` | based on "iPhone Duo 3D Model - By Pikkme Studio" by [PikkmeStudios](https://sketchfab.com/stockpikkme) |
| `handset.glb` | based on "iPhone 18 Pro Max – High Quality 3D Model" by [Pro Animator](https://sketchfab.com/Riju.mandal) |

**If you ship a model, ship its credit** — including into bundled output, where
it is easy to lose by accident. [NOTICE](./NOTICE) carries one entry per asset
with the exact wording, the changes made to each original, and what to check
before adding another.

No model ships with brand identification. The laptop's maker mark was removed
from its textures. The foldable's logo meshes were deleted and the two screen
regions of its texture — which carried a manufacturer's application icons, UI
and wordmark, plus a stock photograph — were blanked. The phone's mark was cut
out of the back panel and filled with its own mesh, sharing every boundary
vertex, so deleting it would have left the mark behind as a hole; its triangles
were given the surrounding panel's material instead, which leaves one
continuous unmarked surface. A CC-BY licence covers the modeller's own work and
cannot license any of that. This project is not affiliated with, endorsed by,
or sponsored by any hardware manufacturer.

## Development

```bash
npm install
npm run build          # tsup -> dist (esm + cjs + types)
npm run typecheck
npm --prefix example install && npm --prefix example run dev
```

The example runs against `src/` directly, so changes show up without a build.
It exercises every prop: all three widgets, colour presets, autoplay vs manual,
and the hinge slider. `?screen=<url>` swaps the live-HTML panel for a texture,
and `?widget=`, `?manual=1`, `?angle=`, `?body=` and `?trim=` drive it without
the control panel in shot — which is how the stills below are taken.

`node capture.mjs` records the sequences, `python3 makemedia.py` turns them into
`docs/media/`, and `node stills.mjs` takes the colour and angle strips. The
capture drives the page
with a virtual clock that only advances when asked and is frozen the rest of
the time, so a frame is the frame that was requested however long the machine
took to render it — the captures are reproducible rather than a sample of one
machine's frame rate.
