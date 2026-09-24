import { defineConfig } from 'tsup';
import pkg from './package.json' with { type: 'json' };

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
  // The component owns a Canvas and browser APIs, so it must not be pulled
  // into a server component graph by accident.
  banner: { js: '"use client";' },
});
