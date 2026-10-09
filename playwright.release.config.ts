import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/tests/release',
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
  outputDir: 'test-results/playwright-release',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-tablet', use: { ...devices['Galaxy Tab S4'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175/login',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_API_BASE_URL: 'http://localhost:8000' },
  },
})
