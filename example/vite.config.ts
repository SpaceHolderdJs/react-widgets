import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Serve the package's own model, rather than keeping a second copy here.
  publicDir: fileURLToPath(new URL('../assets', import.meta.url)),
  resolve: {
    alias: {
      // Run the example straight off src, so a change shows up without a build.
      '@space_holder/react-widgets': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },
  define: {
    __PKG_NAME__: JSON.stringify('@space_holder/react-widgets'),
    __PKG_VERSION__: JSON.stringify('0.2.4'),
  },
});
