/* Stills for the README: the colour ranges and the hinge-or-turn ranges. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.URL ?? 'http://localhost:4205/';
const OUT = '/tmp/still';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader'] });

async function shot(name, q, { w = 700, h = 520 } = {}) {
  const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(BASE + '?screen=%2Fscreen-demo.webp&manual=1&' + q, { waitUntil: 'networkidle' });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
  process.stdout.write('.');
}

const ONLY = process.env.ONLY;
const want = (k) => !ONLY || ONLY === k;

const LAPTOP = [['silver','b8bcc0','26282b'],['midnight','2e3440','14171d'],
  ['gold','e3cfa8','3a3128'],['lime','c8f042','1d2409'],['inverted','1b1b1e','e9ecf1']];
if (want('laptop'))
  for (const [n, body, trim] of LAPTOP)
    await shot(`lc-${n}`, `widget=laptop&angle=103&body=${body}&trim=${trim}`);

if (want('foldable'))
  for (const deg of [0, 60, 120, 180])
    await shot(`ff-${String(deg).padStart(3,'0')}`, `widget=foldable&angle=${deg}&body=c6cad0&trim=15171a`);

// PHONE_FINISHES, in export order. Shown from behind rather than face on:
// the back panel is by far the largest piece of the finish, and face on all
// five look the same because the screen covers everything.
const PHONE = [['titanium','c3c7cb','1b1d21'],['graphite','4b4e54','121316'],
  ['sand','cdb190','2b2319'],['deepblue','3f5a7d','10151d'],['champagne','dcc79c','2a2418']];
if (want('phone'))
  for (const [n, body, trim] of PHONE)
    await shot(`pc-${n}`, `widget=phone&angle=148&body=${body}&trim=${trim}`, { w: 460, h: 620 });

console.log(' done');
await b.close();
