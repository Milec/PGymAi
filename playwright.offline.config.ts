import { defineConfig, devices } from '@playwright/test';

/**
 * Offline PWA checks, which need the *production* build and its service
 * worker — `pnpm dev` doesn't register one, so these can't run in the main
 * e2e suite. Kept as a separate config (and port) so `pnpm e2e` stays fast.
 */
const PORT = 4199;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/offline.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
