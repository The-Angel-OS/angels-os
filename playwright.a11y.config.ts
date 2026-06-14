import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

/**
 * Self-contained accessibility config — report-only axe pass over public pages.
 *
 * Deliberately SEPARATE from playwright.config.ts: it has NO globalSetup (the main
 * suite's global-setup seeds/writes the database, which points at a prod DB), so
 * this never mutates data — it only navigates + reads public pages with axe-core.
 *
 *   pnpm test:a11y                          # against http://localhost:3000 (reuses a running dev server)
 *   AXE_BASE_URL=https://www.spacesangels.com pnpm test:a11y   # scan a deployed URL (no local server needed)
 *   AXE_STRICT=1 pnpm test:a11y             # fail on serious/critical violations
 */
const BASE_URL = process.env.AXE_BASE_URL || 'http://localhost:3000'
const isRemote = !BASE_URL.includes('localhost')

export default defineConfig({
  testDir: './tests/a11y',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'off',
  },
  projects: [
    {
      name: 'a11y',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  // Only spin up a local dev server when scanning localhost; for a remote URL
  // (deployed/preview) we hit it directly — no server, no DB.
  ...(isRemote
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          reuseExistingServer: true,
          url: 'http://localhost:3000',
          timeout: 120_000,
        },
      }),
})
