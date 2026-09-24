/*
 * Capture a frame sequence of each widget for the docs.
 *
 * The renderer here is swiftshader — software, and slow enough on a 40k
 * triangle metal model that one frame can take seconds and a screenshot
 * several more. Sampling on wall-clock time therefore records whatever the
 * machine happened to manage, not the timeline.
 *
 * So the page gets a virtual clock that only advances when this script asks it
 * to, and is frozen the rest of the time:
 *
 *   - requestAnimationFrame is queued rather than scheduled directly, and one
 *     underlying frame flushes the whole queue with a single time step.
 *     Stepping inside each callback instead would advance time three or four
 *     times per painted frame, because r3f, drei's Html and the reveal each
 *     ask for their own frame — a five second reveal would be over in one.
 *   - the queue is only flushed while a frame budget is left. Between steps
 *     nothing animates, so a screenshot that takes four seconds still records
 *     exactly the frame that was asked for.
 *
 * The result is deterministic: the same STEP and spacing give the same frames
 * on any machine, however fast or slow it renders.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.URL ?? 'http://localhost:4202/';
const OUT = process.env.OUT ?? '/tmp/cap';
const STEP_MS = Number(process.env.STEP ?? 140);
const EVERY_MS = Number(process.env.EVERY ?? 280);
const UNTIL_MS = Number(process.env.UNTIL ?? 5400);
const TEXTURE = process.env.TEXTURE ?? '/screen-demo.webp';
const GL = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--no-sandbox',
  '--enable-unsafe-swiftshader',
];

mkdirSync(OUT, { recursive: true });

const virtualClock = (stepMs) => {
  const raf = window.requestAnimationFrame.bind(window);
  let nextId = 0;
  const queue = new Map();

  const clock = { now: 0, frames: 0, budget: 0 };
  window.__clock = clock;

  window.requestAnimationFrame = (cb) => {
    const id = ++nextId;
    queue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    queue.delete(id);
  };

  // One persistent real loop. It keeps spinning even while frozen: callbacks
  // re-schedule themselves, so if this stopped pumping there would be nothing
  // left to restart it.
  const pump = () => {
    if (clock.budget > 0 && queue.size) {
      clock.budget -= 1;
      clock.now += stepMs;
      clock.frames += 1;
      const batch = [...queue.values()];
      queue.clear();
      for (const fn of batch) {
        try {
          fn(clock.now);
        } catch (e) {
          console.error(e);
        }
      }
    }
    raf(pump);
  };
  raf(pump);
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: GL,
});
const problems = new Set();

async function open(widget) {
  const page = await browser.newPage({
    viewport: { width: Number(process.env.W ?? 960), height: Number(process.env.H ?? 600) },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => problems.add('PAGEERROR ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) problems.add('CONSOLE ' + m.text());
  });
  await page.addInitScript(virtualClock, STEP_MS);
  const url = URL + (URL.includes('?') ? '&' : '?') + `screen=${encodeURIComponent(TEXTURE)}&widget=${widget}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  return page;
}

/** Runs exactly `frames` animation frames, then freezes again. */
async function step(page, frames) {
  await page.evaluate((n) => {
    window.__clock.budget += n;
  }, frames);
  await page.waitForFunction(() => window.__clock.budget === 0, undefined, { timeout: 240000 });
}

async function timeline(widget, prefix) {
  const page = await open(widget);
  // A few frames so the model resolves and the reveal's ready gate opens.
  await step(page, 3);
  const perMark = Math.max(1, Math.round(EVERY_MS / STEP_MS));
  for (let ms = 0; ms <= UNTIL_MS; ms += EVERY_MS) {
    await page.screenshot({ path: `${OUT}/${prefix}-${String(ms).padStart(5, '0')}.png` });
    process.stdout.write('.');
    await step(page, perMark);
  }
  await page.close();
  process.stdout.write(` ${prefix}\n`);
}

const only = process.env.ONLY;
if (!only || only === 'phone') await timeline('phone', 'phone');
if (!only || only === 'laptop') await timeline('laptop', 'laptop');

console.log(problems.size ? [...problems].slice(0, 6).join('\n') : 'NO JS ERRORS');
await browser.close();
