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
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 3 : 1,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
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
      testMatch: /(?:dashboard|launch-journeys|admin-journeys)\.e2e\.spec\.ts/,
    },
    // User journey tests — self-contained auth, creates its own users
    {
      name: 'user-journeys',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
      testMatch: /user-journeys\.e2e\.spec\.ts/,
    },
    // Legacy frontend tests — unchanged, their own auth handling
    {
      name: 'legacy',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
      testMatch: /frontend\.e2e\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: true,
    url: 'http://localhost:3000',
  },
})
