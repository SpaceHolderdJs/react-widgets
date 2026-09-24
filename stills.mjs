/* Stills for the README: the colour pairs and the fold range. */
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
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
  process.stdout.write('.');
}

const LAPTOP = [['silver','b8bcc0','26282b'],['midnight','2e3440','14171d'],
  ['gold','e3cfa8','3a3128'],['lime','c8f042','1d2409'],['inverted','1b1b1e','e9ecf1']];
for (const [n, body, trim] of LAPTOP)
  await shot(`lc-${n}`, `widget=laptop&angle=103&body=${body}&trim=${trim}`);
for (const deg of [0, 60, 120, 180])
  await shot(`pf-${String(deg).padStart(3,'0')}`, `widget=phone&angle=${deg}&body=c6cad0&trim=15171a`);
console.log(' done');
await b.close();
