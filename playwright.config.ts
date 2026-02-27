import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Seed dev database before all tests — creates admin user + test data */
  globalSetup: './tests/e2e/global-setup.ts',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 3 : 1,
  /* Limit workers to avoid overwhelming the dev server */
  workers: process.env.CI ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    // Auth setup project — runs first, saves storageState for dashboard tests
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      timeout: 60_000, // Extra time for auth establishment under load
    },
    // Dashboard E2E tests — use authenticated session from setup
    {
      name: 'dashboard',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /(?:dashboard|launch-journeys|admin-journeys|tenant-isolation|chat-messaging|federation-api|producer-workflow|content-management|setup-wizard)\.e2e\.spec\.ts/,
    },
    // User journey tests — self-contained auth, creates its own users
    {
      name: 'user-journeys',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
      testMatch: /(?:user-journeys|checkout)\.e2e\.spec\.ts/,
    },
    // Legacy frontend tests — unchanged, their own auth handling
    {
      name: 'legacy',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
      testMatch: /frontend\.e2e\.spec\.ts/,
    },
    // Mobile responsive tests — public pages at iPhone 13 viewport, no auth needed
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: /mobile-responsive\.e2e\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: true,
    url: 'http://localhost:3000',
  },
})
