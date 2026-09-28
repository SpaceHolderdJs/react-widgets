/*
 * The finish model, checked against the package's own source.
 *
 * Two properties have to hold, and one of them is easy to get wrong. Matte
 * must never come back BRIGHTER than glossy anywhere the sheen is visible —
 * a wide lobe keeps returning light long after a tight one has fallen away,
 * so without energy normalisation an anti-glare panel ends up looking
 * glossier than a polished one. And glossy must stay out of the way head on,
 * or every screen in the package is permanently behind a veil.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';

const dir = mkdtempSync(join(process.cwd(), '.finish-'));
const out = join(dir, 'finish.mjs');
execFileSync('npx', ['esbuild', 'src/shared/finish.ts', '--bundle', '--format=esm',
  '--external:three', `--outfile=${out}`], { stdio: 'ignore' });

try {
  const { GLOSSY, MATTE, specularAt } = await import(out);

  let fail = 0;
  const CAM = new THREE.Vector3(0, 0.3, 1.4);
  console.log(' yaw   glossy    matte   ratio');
  for (let yaw = 0; yaw <= 80; yaw += 10) {
    const n = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), (yaw * Math.PI) / 180);
    const g = specularAt(n, CAM, GLOSSY);
    const m = specularAt(n, CAM, MATTE);
    // Below this nothing is on screen either way, and a ratio between two
    // invisible numbers is not a defect.
    const visible = Math.max(g, m) > 0.012;
    const ratio = m > 1e-6 ? g / m : Infinity;
    if (visible && ratio < 2.5) fail++;
    console.log(String(yaw).padStart(4), g.toFixed(3).padStart(8), m.toFixed(3).padStart(8),
      (visible ? ratio.toFixed(1) : '·').padStart(7));
  }

  const headOn = specularAt(new THREE.Vector3(0, 0, 1), CAM, GLOSSY);
  if (headOn > 0.05) {
    console.log('FAIL: glossy veils the content head on:', headOn.toFixed(3));
    fail++;
  }

  console.log(fail ? `\n${fail} FAILURES` : '\nok — matte is never brighter, and glass is clear head on');
  process.exitCode = fail ? 1 : 0;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
