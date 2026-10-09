import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// El artefacto productivo es estático: sin source maps ni plugins de desarrollo.
export default defineConfig({
  plugins: [vue()],
  build: {
    sourcemap: false,
  },
  test: {
    exclude: [
      'node_modules/**',
      'src/tests/e2e/**',
      'src/tests/integration/**',
      'src/tests/release/**',
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
