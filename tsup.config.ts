import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync } from 'node:fs';
import pkg from './package.json' with { type: 'json' };

const DIRECTIVE = '"use client";';
const OUTPUTS = ['dist/index.js', 'dist/index.cjs'];

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  external: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
  define: {
    __PKG_NAME__: JSON.stringify(pkg.name),
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
  // The components own a Canvas and browser APIs, so the bundle must not be
  // pulled into a server component graph by accident.
  //
  // esbuild drops the per-file "use client" directives when it bundles, and
  // `banner` alone does not survive either: with treeshake on, tsup hands the
  // esbuild output to rollup and rollup writes the file again without it. So
  // the directive is restored here, after everything else has run.
  banner: { js: DIRECTIVE },
  async onSuccess() {
    for (const file of OUTPUTS) {
      const code = readFileSync(file, 'utf8');
      if (code.startsWith(DIRECTIVE)) continue;
      // No newline: line 1 stays line 1, so the source map still lines up.
      writeFileSync(file, DIRECTIVE + code);
    }
  },
});
