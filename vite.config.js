import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: 'assets',
  server: {
    watch: {
      usePolling: true,
      interval: 1000,
      binaryInterval: 2000,
      ignored: ['**/render-work/**', '**/test-results/**', '**/playwright-report/**'],
    },
  },
  build: { assetsDir: 'static' },
});
