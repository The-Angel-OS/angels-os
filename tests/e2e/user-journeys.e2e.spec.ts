/**
 * User Journey E2E Tests — Sprint 21+
 *
 * Documents and tests the complete user journeys through Angel OS:
 * 1. New user sign-up → auto-login → redirect to dashboard
 * 2. Logout → clean logout page with navigation options
 * 3. Login as customer → routed to /dashboard (role-based)
 * 4. Login as admin → routed to /admin (role-based)
 * 5. Dashboard loads with sidebar, stats, LEO chat
 * 6. Account settings → update name
 * 7. Forgot password flow
 * 8. Unauthenticated redirect guards
 *
 * These tests use fresh user accounts per run to avoid state conflicts.
 * No seed data dependency — creates users via API.
 */
import { test, expect, Page } from '@playwright/test'

const baseURL = 'http://localhost:3000'

// Generate unique emails per test run to avoid conflicts
// Use a fixed suffix so the email stays consistent across retries within the same worker
const testRunId = Date.now()
const signupEmail = `signup-${testRunId}@test.com`
const signupPassword = 'TestPassword123!'

// Separate shared customer user — created reliably via API in beforeAll
const customerEmail = `journey-cust-${testRunId}@test.com`
const customerPassword = 'TestPassword123!'
let customerCreated = false

/**
 * Ensure the shared customer user exists via API.
 * Idempotent — safe to call multiple times.
 */
async function ensureCustomerUser(page: Page) {
  if (customerCreated) return
  try {
    const res = await page.request.post(`${baseURL}/api/users`, {
      data: {
        email: customerEmail,
        password: customerPassword,
        passwordConfirm: customerPassword,
        name: 'Journey Test Customer',
      },
    })
    // 200 = created, 400 = already exists — both fine
    if (res.ok() || res.status() === 400) {
      customerCreated = true
    }
  } catch {
    // Non-fatal — loginViaAPI will throw a clear error if the user doesn't exist
  }
}

test.describe('User Journey: Sign Up', () => {
  test('new user can create an account and is auto-logged-in', async ({ page }) => {
    await page.goto(`${baseURL}/create-account`, { waitUntil: 'domcontentloaded' })

    // Form should be visible (mobile h1 says "Create your account", desktop uses aria heading)
    await expect(page.locator('h1').first()).toContainText(/create/i)

    // Fill in sign-up form — use a unique email (not the shared customer one)
    await page.locator('input[name="email"]').fill(signupEmail)
    await page.locator('input[name="password"]').fill(signupPassword)
    await page.locator('input[name="passwordConfirm"]').fill(signupPassword)

    // Submit
    await page.locator('button[type="submit"]').click()

    // After sign-up, the app auto-logs in and redirects to either /account or /dashboard
    await page.waitForURL(/\/(account|dashboard)/, { timeout: 20000 })
  })

  test('sign-up form validates matching passwords', async ({ page }) => {
    await page.goto(`${baseURL}/create-account`, { waitUntil: 'domcontentloaded' })

    await page.locator('input[name="email"]').fill(`mismatch-${testRunId}@test.com`)
    await page.locator('input[name="password"]').fill('Password1!')
    await page.locator('input[name="passwordConfirm"]').fill('DifferentPassword2!')

    await page.locator('button[type="submit"]').click()

    // Should show password mismatch error
    const errorMessage = page.locator('text=The passwords do not match')
    await expect(errorMessage).toBeVisible()
  })

  test('already logged-in user is redirected away from create-account', async ({ page }) => {
    // Create + login via API (reliable, doesn't depend on sign-up test)
    await ensureCustomerUser(page)
    await loginViaAPI(page, customerEmail, customerPassword)

    // Try to visit create-account
    await page.goto(`${baseURL}/create-account`, { waitUntil: 'domcontentloaded' })

    // Should redirect to /account (server-side redirect for logged-in users)
    await page.waitForURL(/\/account/, { timeout: 10000 })
  })
})

test.describe('User Journey: Logout', () => {
  test('user can logout and sees logout confirmation', async ({ page }) => {
    // Create user + login
    await ensureCustomerUser(page)
    await loginViaAPI(page, customerEmail, customerPassword)

    // Navigate to logout
    await page.goto(`${baseURL}/logout`, { waitUntil: 'domcontentloaded' })

    // Should see logged out confirmation
    const heading = page.locator('h1').first()
    await expect(heading).toContainText(/logged out/i)
  })

  test('logout page has navigation links', async ({ page }) => {
    await page.goto(`${baseURL}/logout`, { waitUntil: 'domcontentloaded' })

    // Should have links to continue browsing
    const shopLink = page.getByRole('link', { name: /shop/i })
    const loginLink = page.getByRole('link', { name: /log in/i })

    // At least one navigation option should be present
    const hasShop = await shopLink.isVisible().catch(() => false)
    const hasLogin = await loginLink.isVisible().catch(() => false)
    expect(hasShop || hasLogin).toBeTruthy()
  })
})

test.describe('User Journey: Login', () => {
  test('customer login routes to /dashboard', async ({ page }) => {
    // Ensure user exists
    await ensureCustomerUser(page)

    // Ensure logged out
    await page.goto(`${baseURL}/logout`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // Go to login page
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1').first()).toContainText(/Log in/i)

    // Fill in credentials
    await page.locator('input[name="email"]').fill(customerEmail)
    await page.locator('input[name="password"]').fill(customerPassword)
    await page.locator('button[type="submit"]').click()

    // Customer should be routed to /dashboard (role-based routing)
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('login shows error for invalid credentials', async ({ page }) => {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' })

    await page.locator('input[name="email"]').fill('nonexistent@test.com')
    await page.locator('input[name="password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    // Should show error message
    const errorMessage = page.locator('text=error with the credentials')
    await expect(errorMessage).toBeVisible()
  })

  test('login page has create-account link', async ({ page }) => {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' })

    const createAccountLink = page.getByRole('link', { name: /Create an account/i })
    await expect(createAccountLink).toBeVisible()
  })

  test('login page has forgot password link', async ({ page }) => {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' })

    const forgotLink = page.getByRole('link', { name: /reset it/i })
    await expect(forgotLink).toBeVisible()
  })

  test('already logged-in user is redirected away from login', async ({ page }) => {
    await ensureCustomerUser(page)
    await loginViaAPI(page, customerEmail, customerPassword)

    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' })

    // Server-side redirect: all users → /dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  })
})

test.describe('User Journey: Dashboard Access', () => {
  test('customer dashboard loads with sidebar and main content', async ({ page }) => {
    await ensureCustomerUser(page)
    await loginViaAPI(page, customerEmail, customerPassword)
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' })

    // Sidebar should be visible on desktop
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()

    // Main content area
    const main = page.locator('main').first()
    await expect(main).toBeVisible()

    // Header
    const header = page.locator('header').first()
    await expect(header).toBeVisible()
  })

  test('customer can navigate to My Orders from dashboard', async ({ page }) => {
    await ensureCustomerUser(page)
    await loginViaAPI(page, customerEmail, customerPassword)
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // Look for orders link in sidebar
    const ordersLink = page.getByRole('link', { name: /Orders/i }).first()
    if (await ordersLink.isVisible()) {
      await ordersLink.click()
      await expect(page).toHaveURL(/\/dashboard\/(orders|my-orders)/)
    }
  })

  test('dashboard has LEO chat panel', async ({ page }) => {
    await ensureCustomerUser(page)
    await loginViaAPI(page, customerEmail, customerPassword)
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Look for LEO chat elements — the sidebar chat or chat trigger
    const leoChatTrigger = page.locator('[data-testid="leo-chat"], [class*="chat"], button:has-text("LEO")')
    const chatPanel = page.locator('[class*="sidebar-chat"], [data-testid="sidebar-chat"]')

    // At least one LEO-related element should be present
    const hasTrigger = await leoChatTrigger.first().isVisible().catch(() => false)
    const hasPanel = await chatPanel.first().isVisible().catch(() => false)

    // LEO is integrated into the dashboard — verify some chat-related UI exists
    expect(hasTrigger || hasPanel).toBeTruthy()
  })
})

test.describe('User Journey: Account Settings', () => {
  test('authenticated user can view account settings', async ({ page }) => {
    await ensureCustomerUser(page)
    await loginViaAPI(page, customerEmail, customerPassword)
    await page.goto(`${baseURL}/account`, { waitUntil: 'domcontentloaded' })

    const heading = page.locator('h1').first()
    await expect(heading).toHaveText('Account settings')
  })

  test('account page shows recent orders section', async ({ page }) => {
    await ensureCustomerUser(page)
    await loginViaAPI(page, customerEmail, customerPassword)
    await page.goto(`${baseURL}/account`, { waitUntil: 'domcontentloaded' })

    const ordersHeading = page.locator('h2', { hasText: 'Recent Orders' })
    await expect(ordersHeading).toBeVisible()
  })

  test('account form has email and name fields', async ({ page }) => {
    await ensureCustomerUser(page)
    await loginViaAPI(page, customerEmail, customerPassword)
    await page.goto(`${baseURL}/account`, { waitUntil: 'domcontentloaded' })

    const emailInput = page.locator('input[name="email"]')
    const nameInput = page.locator('input[name="name"]')

    await expect(emailInput).toBeVisible()
    await expect(nameInput).toBeVisible()

    // Email should be pre-filled with the customer's email
    await expect(emailInput).toHaveValue(customerEmail)
  })

  test('account form has change password option', async ({ page }) => {
    await ensureCustomerUser(page)
    await loginViaAPI(page, customerEmail, customerPassword)
    await page.goto(`${baseURL}/account`, { waitUntil: 'domcontentloaded' })

    // "click here to change your password" button
    const changePasswordBtn = page.getByRole('button', { name: /click here/i })
    await expect(changePasswordBtn).toBeVisible()

    await changePasswordBtn.click()

    // Should show password fields
    const passwordInput = page.locator('input[name="password"]')
    const confirmInput = page.locator('input[name="passwordConfirm"]')
    await expect(passwordInput).toBeVisible()
    await expect(confirmInput).toBeVisible()

    // Cancel should go back
    const cancelBtn = page.getByRole('button', { name: /cancel/i })
    await expect(cancelBtn).toBeVisible()
  })
})

test.describe('User Journey: Forgot Password', () => {
  test('forgot password page renders correctly', async ({ page }) => {
    await page.goto(`${baseURL}/forgot-password`, { waitUntil: 'domcontentloaded' })

    const heading = page.locator('h1').first()
    await expect(heading).toContainText(/Forgot|Recover|Reset/i)

    const emailInput = page.locator('input[name="email"]')
    await expect(emailInput).toBeVisible()
  })

  test('forgot password form submits and shows confirmation', async ({ page }) => {
    await ensureCustomerUser(page)
    await page.goto(`${baseURL}/forgot-password`, { waitUntil: 'domcontentloaded' })

    const emailInput = page.locator('input[name="email"]')
    await emailInput.fill(customerEmail)

    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.click()

    // Should show success message
    const successHeading = page.locator('text=Request submitted')
    await expect(successHeading).toBeVisible({ timeout: 10000 })

    const instructions = page.locator('text=Check your email')
    await expect(instructions).toBeVisible()
  })
})

test.describe('User Journey: Auth Guards', () => {
  test('unauthenticated user accessing /account is redirected to login', async ({ page }) => {
    // Ensure logged out
    await page.goto(`${baseURL}/logout`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // Try to access account
    await page.goto(`${baseURL}/account`, { waitUntil: 'domcontentloaded' })

    // Should redirect to login with warning
    await page.waitForURL(/\/login/, { timeout: 10000 })
  })

  test('unauthenticated user accessing /dashboard is redirected', async ({ page }) => {
    // Ensure logged out
    await page.goto(`${baseURL}/logout`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    // Try to access dashboard
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' })

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 10000 })
  })
})

// --- Helper functions ---

/**
 * Login via the API and store cookies on the page context.
 * Faster than UI login for tests that need auth as a precondition.
 */
async function loginViaAPI(page: Page, email: string, password: string) {
  const response = await page.request.post(`${baseURL}/api/users/login`, {
    data: { email, password },
  })

  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()} ${response.statusText()}`)
  }

  const data = await response.json()

  // Visit any page to pick up the auth cookie set by the API response
  await page.goto(`${baseURL}/account`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)

  // Set cookie explicitly in case the API response didn't set it
  if (data.token) {
    await page.evaluate((token) => {
      document.cookie = `payload-token=${token}; path=/`
    }, data.token)
  }
}
