import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist/client', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:8080', '/media': 'http://localhost:8080' },
  },
  test: { root: '.', include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'client/src/**/*.test.ts'] },
});
