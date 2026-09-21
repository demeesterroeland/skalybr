import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './testing/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false, // E2E tests share a single server state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker to avoid auth state collisions
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4099',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Playwright launches a fresh Next.js server with an isolated temp DATA_DIR
  // so the "first user → admin" bootstrap always works and dev data is never touched.
  webServer: {
    command: `DATA_DIR=$(mktemp -d) SKALYBR_TEST_MODE=1 SESSION_SECRET=e2e-test-secret-32-chars-minimum PORT=4099 npm run start`,
    url: 'http://localhost:4099',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});

