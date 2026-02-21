/**
 * Playwright Authentication Setup
 *
 * Logs in as the dev-admin user (created by `pnpm seed:dev`) and saves
 * the authenticated session to a storageState file. All dashboard E2E
 * tests reuse this session automatically — no per-test login needed.
 *
 * Prerequisite: Run `pnpm seed:dev` to create the dev-admin user.
 */
import { test as setup, expect } from '@playwright/test'

const authFile = 'tests/e2e/.auth/user.json'

setup('authenticate as dev-admin', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login')

  // Fill in credentials from dev seed
  await page.locator('input[name="email"]').fill('dev-admin@angelos.local')
  await page.locator('input[name="password"]').fill('devdev123')

  // Submit login form
  await page.locator('button[type="submit"]').click()

  // Wait for successful redirect (to /account or /dashboard)
  await page.waitForURL(/\/(account|dashboard)/, { timeout: 15000 })

  // Verify we're logged in
  await expect(page).not.toHaveURL(/\/login/)

  // Save authenticated session state
  await page.context().storageState({ path: authFile })
})
