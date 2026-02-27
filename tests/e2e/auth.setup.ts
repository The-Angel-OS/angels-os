/**
 * Playwright Authentication Setup
 *
 * Logs in as an admin user and saves the authenticated session to a
 * storageState file. All dashboard E2E tests reuse this session
 * automatically — no per-test login needed.
 *
 * Self-healing: If no admin exists, creates one via the API.
 *
 * Credential priority:
 * 1. Dev seed user (pnpm seed:dev): dev-admin@spacesangels.com / devdev123
 * 2. Env vars: PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD
 * 3. Auto-created test admin: e2e-admin-{timestamp}@test.local / E2eTestAdmin123!
 */
import { test as setup } from '@playwright/test'

const authFile = 'tests/e2e/.auth/user.json'

// Auto-create credentials (deterministic per test run)
const autoCreateEmail = `e2e-admin-${Date.now()}@test.local`
const autoCreatePassword = 'E2eTestAdmin123!'

// Credential sets to try in order
const credentialSets = [
  {
    email: 'dev-admin@spacesangels.com',
    password: 'devdev123',
    label: 'dev-seed',
  },
  ...(process.env.PLAYWRIGHT_ADMIN_EMAIL
    ? [
        {
          email: process.env.PLAYWRIGHT_ADMIN_EMAIL,
          password: process.env.PLAYWRIGHT_ADMIN_PASSWORD || '',
          label: 'env-vars',
        },
      ]
    : []),
]

/**
 * Attempt to login with the given credentials via the Payload REST API.
 * Returns the token on success, or null on failure.
 */
async function tryLogin(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<string | null> {
  try {
    const response = await page.request.post('http://localhost:3000/api/users/login', {
      data: { email, password },
    })
    if (!response.ok()) return null
    const data = await response.json()
    return data.token || null
  } catch {
    return null
  }
}

/**
 * Establish the auth cookie in the browser context from a JWT token.
 * Navigates to a page to pick up cookies, then verifies we're not redirected to /login.
 */
async function establishSession(
  page: import('@playwright/test').Page,
  token: string,
): Promise<boolean> {
  // Navigate to a page to establish browser context
  // Use domcontentloaded to avoid waiting for all resources (faster under load)
  await page.goto('http://localhost:3000/account', { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(500)

  // Set cookie explicitly in case the API response didn't set it
  await page.evaluate((t) => {
    document.cookie = `payload-token=${t}; path=/`
  }, token)

  // Verify session by visiting a protected page
  await page.goto('http://localhost:3000/account', { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(1000)

  // If we're redirected to /login, the session didn't take
  return !page.url().includes('/login')
}

setup('authenticate as admin', async ({ page }) => {
  // ── Try existing credential sets first ──────────────────────────
  for (const creds of credentialSets) {
    const token = await tryLogin(page, creds.email, creds.password)
    if (!token) {
      console.log(`[auth.setup] ${creds.label} login failed`)
      continue
    }

    const sessionOk = await establishSession(page, token)
    if (!sessionOk) {
      console.log(`[auth.setup] ${creds.label} session establishment failed`)
      continue
    }

    console.log(`[auth.setup] Authenticated as ${creds.email} (${creds.label})`)
    await page.context().storageState({ path: authFile })
    return
  }

  // ── Auto-create a test admin ────────────────────────────────────
  // None of the known credentials worked. Create a fresh admin user
  // via the Payload REST API so dashboard tests can proceed.
  console.log('[auth.setup] No existing credentials worked. Creating test admin...')

  try {
    const createResponse = await page.request.post('http://localhost:3000/api/users', {
      data: {
        email: autoCreateEmail,
        password: autoCreatePassword,
        passwordConfirm: autoCreatePassword,
        name: 'E2E Test Admin',
        roles: ['admin'],
      },
    })

    if (!createResponse.ok()) {
      const errorBody = await createResponse.text()
      console.log(`[auth.setup] Failed to create admin: ${createResponse.status()} ${errorBody}`)
      // Fall through — we'll try to login anyway in case the API created but returned an error
    } else {
      console.log(`[auth.setup] Created test admin: ${autoCreateEmail}`)
    }
  } catch (err) {
    console.log(`[auth.setup] Create user error: ${err}`)
  }

  // Login with the newly created admin
  const token = await tryLogin(page, autoCreateEmail, autoCreatePassword)
  if (!token) {
    throw new Error(
      'Auth setup failed: Could not authenticate with any credential set, and auto-creating a test admin also failed. ' +
        'Run `pnpm seed:dev` or set PLAYWRIGHT_ADMIN_EMAIL/PLAYWRIGHT_ADMIN_PASSWORD env vars.',
    )
  }

  const sessionOk = await establishSession(page, token)
  if (!sessionOk) {
    throw new Error(
      'Auth setup failed: Created test admin but session could not be established. ' +
        'Check cookie/auth configuration.',
    )
  }

  console.log(`[auth.setup] Authenticated as ${autoCreateEmail} (auto-created)`)
  await page.context().storageState({ path: authFile })
})
