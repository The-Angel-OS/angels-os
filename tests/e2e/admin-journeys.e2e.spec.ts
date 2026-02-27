/**
 * Admin & Tenant Management E2E Tests
 *
 * Tests the critical admin/super-user journeys:
 * 1. Tenant Admin Hub — /dashboard/admin listing, cards, action links
 * 2. Provision Wizard — /dashboard/admin/provision 5-step UI
 * 3. Tenant Detail & Deprovisioning — /dashboard/admin/tenants/[id]
 * 4. Payments Admin — /dashboard/admin/payments Stripe Connect
 * 5. AI Settings — /dashboard/admin/ai-settings API key mgmt
 * 6. Admin Navigation & Access — sidebar links, route accessibility
 *
 * Prerequisites:
 * 1. Dev server running: `pnpm dev`
 * 2. Dev seed data: `pnpm seed:dev`
 * 3. Auth setup runs automatically via Playwright project dependencies
 *
 * Uses authenticated session from auth.setup.ts (storageState pattern).
 */
import { test, expect } from '@playwright/test'

// ─── Tenant Admin Hub ────────────────────────────────────────────────────────

test.describe('Admin Journey: Tenant Admin Hub', () => {
  test('admin hub renders with heading and tenant count', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.waitForTimeout(3000)

    const heading = page.locator('h1', { hasText: 'Tenant Administration' })
    await expect(heading).toBeVisible()

    // Count text: "X tenant(s) registered"
    const countText = page.locator('text=/\\d+ tenants? registered/')
    await expect(countText).toBeVisible()
  })

  test('admin hub shows tenant cards when tenants exist', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.waitForTimeout(3000)

    // Tenant cards are links to /admin/tenants/[id]
    const tenantCards = page.locator('a[href*="admin/tenants/"]')
    const count = await tenantCards.count()

    if (count > 0) {
      const firstCard = tenantCards.first()

      // Card should have a name (h3)
      const name = firstCard.locator('h3')
      await expect(name).toBeVisible()

      // Card should have a domain
      const domain = firstCard.locator('p').first()
      await expect(domain).toBeVisible()

      // Card should have a status badge
      const badge = firstCard.locator('span.rounded-full')
      await expect(badge).toBeVisible()
    }
  })

  test('tenant card shows stats (spaces count, members count)', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.waitForTimeout(3000)

    const tenantCards = page.locator('a[href*="admin/tenants/"]')
    const count = await tenantCards.count()

    if (count > 0) {
      const firstCard = tenantCards.first()

      // Stats line: "X spaces" and "X members"
      const spacesText = firstCard.locator('text=/\\d+ spaces/')
      await expect(spacesText).toBeVisible()

      const membersText = firstCard.locator('text=/\\d+ members/')
      await expect(membersText).toBeVisible()
    }
  })

  test('action buttons are visible (Error Logs, Suitcase, + New Tenant)', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.waitForTimeout(3000)

    await expect(page.getByRole('link', { name: /Error Logs/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Suitcase Manager/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /New Tenant/i })).toBeVisible()
  })

  test('tenant card links to detail page', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.waitForTimeout(3000)

    const tenantCards = page.locator('a[href*="admin/tenants/"]')
    const count = await tenantCards.count()

    if (count > 0) {
      const href = await tenantCards.first().getAttribute('href')
      expect(href).toMatch(/admin\/tenants\/[a-z0-9]+/)

      await tenantCards.first().click()
      await page.waitForTimeout(2000)
      await expect(page).toHaveURL(/\/dashboard\/admin\/tenants\//)
    }
  })
})

// ─── Provision Wizard ────────────────────────────────────────────────────────

// Use a unique name per run to avoid slug collisions from prior test runs
const provisionTestName = `Test Shop ${Date.now()}`

test.describe('Admin Journey: Provision Wizard', () => {
  test('provision wizard renders with step indicator', async ({ page }) => {
    await page.goto('/dashboard/admin/provision')
    await page.waitForTimeout(2000)

    // Step labels should be visible
    await expect(page.locator('text=Identity')).toBeVisible()
    await expect(page.locator('text=Endeavor')).toBeVisible()
    await expect(page.locator('text=Branding')).toBeVisible()
    await expect(page.locator('text=Nimue')).toBeVisible()
    await expect(page.locator('text=Launch')).toBeVisible()

    // Step 1 heading
    const heading = page.locator('h2', { hasText: "What's your endeavor?" })
    await expect(heading).toBeVisible()
  })

  test('identity step has name, slug, and domain fields', async ({ page }) => {
    await page.goto('/dashboard/admin/provision')
    await page.waitForTimeout(2000)

    // Three input fields with labels
    await expect(page.locator('label', { hasText: 'Name' })).toBeVisible()
    await expect(page.locator('label', { hasText: 'Slug' })).toBeVisible()
    await expect(page.locator('label', { hasText: 'Domain' })).toBeVisible()

    // Name input should be present with placeholder
    const nameInput = page.locator('input[placeholder="Hays Cactus Farm"]')
    await expect(nameInput).toBeVisible()

    // Type a name and verify slug auto-generates
    await nameInput.fill('Test Bakery Shop')
    await page.waitForTimeout(300)

    const slugInput = page.locator('label:has-text("Slug") + input, label:has-text("Slug") ~ input').first()
    // Slug should contain the auto-generated value
    const slugValue = await slugInput.inputValue()
    expect(slugValue).toContain('test-bakery-shop')
  })

  test('endeavor type step shows business type options', async ({ page }) => {
    await page.goto('/dashboard/admin/provision')
    await page.waitForTimeout(2000)

    // Fill identity to enable Next button (unique name to avoid slug conflicts)
    const nameInput = page.locator('input[placeholder="Hays Cactus Farm"]')
    await nameInput.fill(provisionTestName)
    await page.waitForTimeout(500)

    // Click Next to go to Endeavor step
    await page.getByRole('button', { name: /Next/i }).click()
    await page.waitForTimeout(2000)

    // Step 2 heading
    const heading = page.locator('h2', { hasText: 'What kind of business?' })
    await expect(heading).toBeVisible()

    // Business type cards should be visible
    await expect(page.locator('text=Service Provider').first()).toBeVisible()
    await expect(page.locator('text=Retail & Commerce').first()).toBeVisible()
    await expect(page.locator('text=Creator & Content').first()).toBeVisible()
    await expect(page.locator('text=Booking-Based').first()).toBeVisible()
    await expect(page.locator('text=Custom').first()).toBeVisible()
  })

  test('branding step has color pickers and font selectors', async ({ page }) => {
    await page.goto('/dashboard/admin/provision')
    await page.waitForTimeout(2000)

    // Navigate to step 3 (Identity → Endeavor → Branding)
    const nameInput = page.locator('input[placeholder="Hays Cactus Farm"]')
    await nameInput.fill(provisionTestName)
    await page.waitForTimeout(500)

    // Step 1 → Step 2
    await page.getByRole('button', { name: /Next/i }).click()
    await page.waitForTimeout(2000)

    // Step 2 → Step 3
    await page.getByRole('button', { name: /Next/i }).click()
    await page.waitForTimeout(1000)

    // Step 3 heading
    const heading = page.locator('h2', { hasText: 'Make it yours' })
    await expect(heading).toBeVisible()

    // Color pickers (type="color" inputs)
    const colorInputs = page.locator('input[type="color"]')
    const colorCount = await colorInputs.count()
    expect(colorCount).toBe(3) // primary, secondary, accent

    // Font selectors
    const fontSelects = page.locator('select')
    const fontCount = await fontSelects.count()
    expect(fontCount).toBeGreaterThanOrEqual(2) // heading font, body font

    // Labels
    await expect(page.locator('label', { hasText: 'Site Name' })).toBeVisible()
    await expect(page.locator('label', { hasText: 'Tagline' })).toBeVisible()
  })

  test('navigation between steps works (Next/Back)', async ({ page }) => {
    await page.goto('/dashboard/admin/provision')
    await page.waitForTimeout(2000)

    // Start at step 1 — Back should be invisible (disabled:invisible)
    const backBtn = page.getByRole('button', { name: /Back/i })

    // Fill name to enable Next (unique name to avoid slug conflicts)
    const nameInput = page.locator('input[placeholder="Hays Cactus Farm"]')
    await nameInput.fill(provisionTestName)
    await page.waitForTimeout(500)

    // Go to step 2
    await page.getByRole('button', { name: /Next/i }).click()
    await page.waitForTimeout(2000)

    // Should now be on Endeavor step
    await expect(page.locator('h2', { hasText: 'What kind of business?' })).toBeVisible()

    // Back should now work
    await backBtn.click()
    await page.waitForTimeout(500)

    // Should be back on Identity step
    await expect(page.locator('h2', { hasText: "What's your endeavor?" })).toBeVisible()
  })
})

// ─── Tenant Detail & Deprovisioning ─────────────────────────────────────────

test.describe('Admin Journey: Tenant Detail', () => {
  test('tenant detail page loads with tenant info', async ({ page }) => {
    const tenantId = await getFirstTenantId(page)
    if (!tenantId) {
      test.skip()
      return
    }

    await page.goto(`/dashboard/admin/tenants/${tenantId}`)
    await page.waitForTimeout(3000)

    // Back link should exist
    await expect(page.getByRole('link', { name: /Back to Tenants/i })).toBeVisible()

    // Tenant name heading (h1)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()

    // Status badge should be visible
    const badge = page.locator('span.rounded-full').first()
    await expect(badge).toBeVisible()
  })

  test('branding section shows site name, tagline, color', async ({ page }) => {
    const tenantId = await getFirstTenantId(page)
    if (!tenantId) {
      test.skip()
      return
    }

    await page.goto(`/dashboard/admin/tenants/${tenantId}`)
    await page.waitForTimeout(3000)

    // Branding section heading
    const brandingHeading = page.locator('h2', { hasText: 'Branding' })
    await expect(brandingHeading).toBeVisible()

    // Should show labels for branding fields
    await expect(page.locator('text=Site Name').first()).toBeVisible()
    await expect(page.locator('text=Tagline').first()).toBeVisible()
    await expect(page.locator('text=Primary Color').first()).toBeVisible()
  })

  test('edit branding button toggles edit mode', async ({ page }) => {
    const tenantId = await getFirstTenantId(page)
    if (!tenantId) {
      test.skip()
      return
    }

    await page.goto(`/dashboard/admin/tenants/${tenantId}`)
    await page.waitForTimeout(3000)

    // Click Edit button
    const editBtn = page.getByRole('button', { name: /Edit/i }).first()
    if (await editBtn.isVisible()) {
      await editBtn.click()
      await page.waitForTimeout(500)

      // Save and Cancel should now appear
      await expect(page.getByRole('button', { name: /Save/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible()

      // Input fields should be editable
      const inputs = page.locator('input[type="text"]')
      const inputCount = await inputs.count()
      expect(inputCount).toBeGreaterThan(0)
    }
  })

  test('stats section shows member and space counts', async ({ page }) => {
    const tenantId = await getFirstTenantId(page)
    if (!tenantId) {
      test.skip()
      return
    }

    await page.goto(`/dashboard/admin/tenants/${tenantId}`)
    await page.waitForTimeout(3000)

    // Stats labels should be visible
    await expect(page.locator('text=Members').first()).toBeVisible()
    await expect(page.locator('text=Spaces').first()).toBeVisible()
  })

  test('deactivate button shows confirmation dialog', async ({ page }) => {
    const tenantId = await getFirstTenantId(page)
    if (!tenantId) {
      test.skip()
      return
    }

    await page.goto(`/dashboard/admin/tenants/${tenantId}`)
    await page.waitForTimeout(4000)

    // Scroll to bottom to reveal Danger Zone
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    // Danger Zone heading
    const dangerHeading = page.locator('h2', { hasText: 'Danger Zone' })
    await expect(dangerHeading).toBeVisible({ timeout: 5000 })

    // Click Deactivate button
    const deactivateBtn = page.getByRole('button', { name: /Deactivate Tenant/i })
    if (await deactivateBtn.isVisible()) {
      await deactivateBtn.click()
      await page.waitForTimeout(500)

      // Confirmation dialog should appear
      const confirmBtn = page.getByRole('button', { name: /Confirm Deactivation/i })
      await expect(confirmBtn).toBeVisible()

      // Warning text should be visible
      await expect(
        page.locator('text=Deactivating this tenant will prevent all members'),
      ).toBeVisible()

      // Cancel to close the dialog without actually deactivating
      const cancelBtn = page.getByRole('button', { name: /Cancel/i })
      await cancelBtn.click()
      await page.waitForTimeout(300)
    }
  })
})

// ─── Payments Admin ──────────────────────────────────────────────────────────

test.describe('Admin Journey: Payments Admin', () => {
  test('payments page renders with Stripe connection status', async ({ page }) => {
    await page.goto('/dashboard/admin/payments')
    await page.waitForTimeout(3000)

    // Page heading
    const heading = page.locator('h1', { hasText: 'Payments' })
    await expect(heading).toBeVisible()

    // Stripe Connect section
    const stripeHeading = page.locator('h2', { hasText: 'Stripe Connect' })
    await expect(stripeHeading).toBeVisible()

    // Connection status badge should show "Connected" or "Not Connected"
    const statusBadge = page.locator('text=/Connected|Not Connected/')
    await expect(statusBadge.first()).toBeVisible()
  })

  test('Justice Fund stats are displayed', async ({ page }) => {
    await page.goto('/dashboard/admin/payments')
    await page.waitForTimeout(3000)

    // Justice Fund section
    const fundHeading = page.locator('h2', { hasText: 'Justice Fund' })
    await expect(fundHeading).toBeVisible()

    // Should show allocation stats
    await expect(page.locator('text=Total Allocated').first()).toBeVisible()
    await expect(page.locator('text=Transactions').first()).toBeVisible()
  })

  test('Connect Stripe button or Dashboard link visible', async ({ page }) => {
    await page.goto('/dashboard/admin/payments')
    await page.waitForTimeout(3000)

    // Either the Connect button or the Dashboard link should be visible
    const connectBtn = page.locator('text=/Connect Stripe|Continue Stripe Setup/')
    const dashboardLink = page.locator('text=Open Stripe Dashboard')

    const hasConnect = await connectBtn.first().isVisible().catch(() => false)
    const hasDashboard = await dashboardLink.isVisible().catch(() => false)

    expect(hasConnect || hasDashboard).toBeTruthy()
  })
})

// ─── AI Settings ─────────────────────────────────────────────────────────────

test.describe('Admin Journey: AI Settings', () => {
  test('AI settings page renders with heading', async ({ page }) => {
    await page.goto('/dashboard/admin/ai-settings')
    await page.waitForTimeout(3000)

    const heading = page.locator('h1', { hasText: 'AI Settings' })
    await expect(heading).toBeVisible()

    // API key sections
    await expect(page.locator('h2', { hasText: 'Anthropic API Key' })).toBeVisible()
    await expect(page.locator('h2', { hasText: 'OpenRouter API Key' })).toBeVisible()
  })

  test('Anthropic API key status shown', async ({ page }) => {
    await page.goto('/dashboard/admin/ai-settings')
    await page.waitForTimeout(3000)

    // Status indicator: "Active" or "Using platform key"
    const status = page.locator('text=/Active|Using platform key/')
    await expect(status.first()).toBeVisible()
  })

  test('Save buttons are present for key entry', async ({ page }) => {
    await page.goto('/dashboard/admin/ai-settings')
    await page.waitForTimeout(3000)

    // Password input fields for API keys
    const passwordInputs = page.locator('input[type="password"]')
    const inputCount = await passwordInputs.count()
    expect(inputCount).toBeGreaterThanOrEqual(2) // Anthropic + OpenRouter

    // Save buttons
    const saveButtons = page.getByRole('button', { name: /Save/i })
    const saveCount = await saveButtons.count()
    expect(saveCount).toBeGreaterThanOrEqual(2)
  })
})

// ─── Admin Navigation & Access ───────────────────────────────────────────────

test.describe('Admin Journey: Navigation & Access', () => {
  test('admin sidebar section visible for admin user', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(2000)

    // ADMIN section label in sidebar — use paragraph locator with exact text
    // to avoid matching "Payload Admin", "Tenant Admin", etc.
    const adminSection = page.locator('p', { hasText: /^ADMIN$/ })
    await expect(adminSection).toBeVisible()

    // Tenant Admin link
    await expect(page.getByRole('link', { name: /Tenant Admin/i })).toBeVisible()
  })

  test('all admin nav links are present', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(2000)

    // All 8 admin nav links from DashboardSidebar
    const adminLinks = [
      'Tenant Admin',
      'Provision',
      'Suitcase',
      'Payments',
      'Invitations',
      'Contacts',
      'AI Settings',
      'Error Logs',
    ]

    for (const linkName of adminLinks) {
      const link = page.getByRole('link', { name: new RegExp(linkName, 'i') })
      await expect(link).toBeVisible()
    }
  })

  test('admin pages are accessible (no 403/redirect)', async ({ page }) => {
    test.setTimeout(120_000) // Iterates multiple routes; needs extra time
    const adminRoutes = [
      '/dashboard/admin',
      '/dashboard/admin/provision',
      '/dashboard/admin/payments',
      '/dashboard/admin/ai-settings',
      '/dashboard/admin/invitations',
      '/dashboard/admin/contacts',
      '/dashboard/admin/error-logs',
    ]

    for (const route of adminRoutes) {
      await page.goto(route)
      await page.waitForTimeout(3000)

      // Should not be redirected to login or a 403 page
      const url = page.url()
      expect(url).not.toContain('/login')
      expect(url).not.toContain('/403')

      // Page should have content (not an error page)
      await expect(page.locator('body')).not.toBeEmpty()
    }
  })

  test('clicking Tenant Admin nav link navigates to admin hub', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(2000)

    const tenantAdminLink = page.getByRole('link', { name: /Tenant Admin/i })
    await tenantAdminLink.click()
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/dashboard\/admin/)

    // Admin panel should load
    const heading = page.locator('h1', { hasText: 'Tenant Administration' })
    await expect(heading).toBeVisible()
  })
})

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Fetches the first tenant ID from the API.
 * Returns null if no tenants exist.
 */
async function getFirstTenantId(
  page: import('@playwright/test').Page,
): Promise<string | null> {
  const baseURL = 'http://localhost:3000'

  try {
    const res = await page.request.get(`${baseURL}/api/tenants?limit=1&depth=0`)
    if (!res.ok()) return null

    const data = await res.json()
    const tenant = data.docs?.[0]
    return tenant?.id || null
  } catch {
    return null
  }
}
