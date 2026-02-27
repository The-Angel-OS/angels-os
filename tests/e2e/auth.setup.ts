/**
 * Playwright Authentication Setup
 *
 * Logs in as an admin user and saves the authenticated session to a
 * storageState file. All dashboard E2E tests reuse this session
 * automatically — no per-test login needed.
 *
 * Supports two credential sets:
 * 1. Dev seed user (pnpm seed:dev): dev-admin@angelos.local / devdev123
 * 2. Fallback live admin: PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD env vars
 *    or kenneth.courtney@gmail.com / angelos (hardcoded fallback for local dev)
 */
import { test as setup, expect } from '@playwright/test'

const authFile = 'tests/e2e/.auth/user.json'

// Credential sets to try in order
const credentialSets = [
  {
    email: 'dev-admin@angelos.local',
    password: 'devdev123',
    label: 'dev-seed',
  },
  {
    email: process.env.PLAYWRIGHT_ADMIN_EMAIL || 'kenneth.courtney@gmail.com',
    password: process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'angelos',
    label: 'env/fallback',
  },
]

setup('authenticate as admin', async ({ page }) => {
  let authenticated = false

  for (const creds of credentialSets) {
    try {
      // Try API login first (faster, more reliable)
      const response = await page.request.post('http://localhost:3000/api/users/login', {
        data: { email: creds.email, password: creds.password },
      })

      if (!response.ok()) {
        console.log(`[auth.setup] ${creds.label} login failed: ${response.status()}`)
        continue
      }

      const data = await response.json()
      if (!data.token) {
        console.log(`[auth.setup] ${creds.label} login returned no token`)
        continue
      }

      // Navigate to account page to establish cookies in browser context
      await page.goto('http://localhost:3000/account')
      await page.waitForTimeout(1000)

      // Set cookie explicitly in case the API response didn't set it
      await page.evaluate((token) => {
        document.cookie = `payload-token=${token}; path=/`
      }, data.token)

      // Verify we can access a protected page
      await page.goto('http://localhost:3000/account')
      await page.waitForTimeout(1000)

      // Check we're not on the login page
      const url = page.url()
      if (url.includes('/login')) {
        console.log(`[auth.setup] ${creds.label} redirected back to login`)
        continue
      }

      console.log(`[auth.setup] Authenticated as ${creds.email} (${creds.label})`)
      authenticated = true
      break
    } catch (err) {
      console.log(`[auth.setup] ${creds.label} error: ${err}`)
      continue
    }
  }

  if (!authenticated) {
    throw new Error(
      'Auth setup failed: Could not authenticate with any credential set. ' +
        'Run `pnpm seed:dev` or set PLAYWRIGHT_ADMIN_EMAIL/PLAYWRIGHT_ADMIN_PASSWORD env vars.',
    )
  }

  // Save authenticated session state
  await page.context().storageState({ path: authFile })
})
