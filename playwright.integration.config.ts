import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/tests/integration',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 120_000 },
  reporter: 'list',
  outputDir: 'test-results/playwright-integration',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    headless: true,
    permissions: ['microphone'],
    launchOptions: {
      args: process.env.HOMEX_PRF04_AUDIO
        ? [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${process.env.HOMEX_PRF04_AUDIO}`,
          ]
        : [],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/login',
    reuseExistingServer: false,
    timeout: 90_000,
    env: { VITE_API_BASE_URL: process.env.HOMEX_INTEGRATION_API_URL ?? 'http://127.0.0.1:8000' },
  },
})
