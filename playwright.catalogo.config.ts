import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './src/tests/integration',
  testMatch: 'catalogo-real.spec.ts',
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 180_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.HOMEX_CATALOGO_BASE_URL ?? 'http://127.0.0.1:18080',
    headless: true,
    permissions: ['microphone'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
