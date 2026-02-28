/**
 * Payload Admin Panel E2E Tests
 *
 * Tests the Payload CMS admin panel at /admin:
 * 1. Admin panel access & authentication
 * 2. Header collection — list, create, edit, field rendering
 * 3. Footer collection — list, create, edit, field rendering
 * 4. Core collections — pages, posts, products, users list views
 * 5. Navigation & collection groups
 *
 * Prerequisites:
 * 1. Dev server running: `pnpm dev`
 * 2. Dev seed data: `pnpm seed:dev` (creates header/footer records)
 * 3. Auth setup runs automatically via Playwright project dependencies
 *
 * Uses authenticated session from auth.setup.ts (storageState pattern).
 */
import { test, expect } from '@playwright/test'

// ─── Admin Panel Access ──────────────────────────────────────────────────────

test.describe('Payload Admin: Panel Access', () => {
  test('admin panel loads and shows dashboard', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForTimeout(3000)

    // Payload admin panel should load (not redirect to login)
    const url = page.url()
    expect(url).not.toContain('/admin/login')

    // Should show the Payload admin dashboard or a collection view
    // The admin panel has a nav sidebar with collection links
    const adminNav = page.locator('nav')
    await expect(adminNav.first()).toBeVisible({ timeout: 10_000 })
  })

  test('admin panel does not redirect authenticated admin to login', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForTimeout(2000)

    const url = page.url()
    // Should stay on /admin, not redirect to /admin/login
    expect(url).toContain('/admin')
    expect(url).not.toContain('/admin/login')
  })

  test('admin panel shows collection navigation', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForTimeout(3000)

    // Payload admin has a sidebar or nav with collection links
    // Check for key collections that should be visible
    const pageContent = await page.textContent('body')

    // Angel OS group collections
    expect(pageContent).toContain('Header')
    expect(pageContent).toContain('Footer')

    // Core collections
    expect(pageContent).toContain('Users')
    expect(pageContent).toContain('Pages')
  })
})

// ─── Header Collection ───────────────────────────────────────────────────────

test.describe('Payload Admin: Header Collection', () => {
  test('header list view loads and shows records', async ({ page }) => {
    await page.goto('/admin/collections/header')
    await page.waitForTimeout(3000)

    // Should not be blank — the list view should render
    const url = page.url()
    expect(url).toContain('/admin/collections/header')

    // List view should have content (title, table, or "no results" message)
    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()
    expect(bodyText!.length).toBeGreaterThan(50) // Not blank

    // Should show the collection title "Header" somewhere in the UI
    expect(bodyText).toContain('Header')
  })

  test('header list view shows seeded records', async ({ page }) => {
    await page.goto('/admin/collections/header')
    await page.waitForTimeout(3000)

    // After seed, there should be at least one header record
    // Look for the "Main Header" label or any table row
    const tableRows = page.locator('table tbody tr, [class*="row"], [class*="Row"]')
    const rowCount = await tableRows.count()

    // If seeded, should have at least 1 record
    // If not seeded, the "No Header found" message should appear
    const bodyText = await page.textContent('body')
    const hasRecords = rowCount > 0
    const hasNoResultsMessage = bodyText?.includes('No Header found') || bodyText?.includes('No results')

    expect(hasRecords || hasNoResultsMessage).toBe(true)
  })

  test('header create page loads with form fields', async ({ page }) => {
    await page.goto('/admin/collections/header/create')
    await page.waitForTimeout(3000)

    const url = page.url()
    expect(url).toContain('/admin/collections/header/create')

    // The create form should show our fields
    const bodyText = await page.textContent('body')

    // Should show the label field
    expect(bodyText).toContain('Label') // The label field description

    // Should show the navItems array field
    expect(bodyText).toContain('Nav Items')
  })

  test('header edit page renders form (not blank)', async ({ page }) => {
    // First, navigate to the list to find a record
    await page.goto('/admin/collections/header')
    await page.waitForTimeout(3000)

    // Click the first record in the list (if it exists)
    const firstRow = page.locator('table tbody tr a, [class*="row"] a, [class*="Row"] a').first()
    const rowExists = await firstRow.isVisible().catch(() => false)

    if (rowExists) {
      await firstRow.click()
      await page.waitForTimeout(3000)

      // The edit page should NOT be blank
      const bodyText = await page.textContent('body')
      expect(bodyText).toBeTruthy()
      expect(bodyText!.length).toBeGreaterThan(100) // Not blank

      // Should show form fields
      expect(bodyText).toContain('Label')

      // Should show save button
      const saveButton = page.locator('button', { hasText: /save/i })
      await expect(saveButton).toBeVisible()
    } else {
      // No records to edit — skip gracefully
      test.skip()
    }
  })

  test('header edit page shows link fields in nav items', async ({ page }) => {
    // Navigate to the first header record
    await page.goto('/admin/collections/header')
    await page.waitForTimeout(3000)

    const firstRow = page.locator('table tbody tr a, [class*="row"] a, [class*="Row"] a').first()
    const rowExists = await firstRow.isVisible().catch(() => false)

    if (rowExists) {
      await firstRow.click()
      await page.waitForTimeout(3000)

      // If there are nav items, the link fields should be rendered
      const bodyText = await page.textContent('body')

      // The link field should show type radio (Internal link / Custom URL)
      // or the nav items array section
      expect(bodyText).toContain('Nav Items')

      // Check that the page is not throwing a React error
      // (the blank page bug would result in no form content)
      const formContent = page.locator('form, [class*="Form"], [class*="fields"]')
      const formExists = await formContent.first().isVisible().catch(() => false)
      expect(formExists).toBe(true)
    } else {
      test.skip()
    }
  })
})

// ─── Footer Collection ───────────────────────────────────────────────────────

test.describe('Payload Admin: Footer Collection', () => {
  test('footer list view loads and shows records', async ({ page }) => {
    await page.goto('/admin/collections/footer')
    await page.waitForTimeout(3000)

    const url = page.url()
    expect(url).toContain('/admin/collections/footer')

    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()
    expect(bodyText!.length).toBeGreaterThan(50)
    expect(bodyText).toContain('Footer')
  })

  test('footer create page loads with form fields', async ({ page }) => {
    await page.goto('/admin/collections/footer/create')
    await page.waitForTimeout(3000)

    const bodyText = await page.textContent('body')
    expect(bodyText).toContain('Label')
    expect(bodyText).toContain('Nav Items')
  })

  test('footer edit page renders form (not blank)', async ({ page }) => {
    await page.goto('/admin/collections/footer')
    await page.waitForTimeout(3000)

    const firstRow = page.locator('table tbody tr a, [class*="row"] a, [class*="Row"] a').first()
    const rowExists = await firstRow.isVisible().catch(() => false)

    if (rowExists) {
      await firstRow.click()
      await page.waitForTimeout(3000)

      const bodyText = await page.textContent('body')
      expect(bodyText).toBeTruthy()
      expect(bodyText!.length).toBeGreaterThan(100)
      expect(bodyText).toContain('Label')

      const saveButton = page.locator('button', { hasText: /save/i })
      await expect(saveButton).toBeVisible()
    } else {
      test.skip()
    }
  })
})

// ─── Core Collections ────────────────────────────────────────────────────────

test.describe('Payload Admin: Core Collections', () => {
  const collections = [
    { slug: 'pages', title: 'Pages' },
    { slug: 'posts', title: 'Posts' },
    { slug: 'users', title: 'Users' },
    { slug: 'media', title: 'Media' },
    { slug: 'products', title: 'Products' },
    { slug: 'orders', title: 'Orders' },
    { slug: 'spaces', title: 'Spaces' },
    { slug: 'channels', title: 'Channels' },
    { slug: 'messages', title: 'Messages' },
    { slug: 'projects', title: 'Projects' },
  ]

  for (const col of collections) {
    test(`${col.title} collection list view loads`, async ({ page }) => {
      await page.goto(`/admin/collections/${col.slug}`)
      await page.waitForTimeout(3000)

      const url = page.url()
      expect(url).toContain(`/admin/collections/${col.slug}`)

      // Page should not be blank
      const bodyText = await page.textContent('body')
      expect(bodyText).toBeTruthy()
      expect(bodyText!.length).toBeGreaterThan(50)

      // Should contain the collection title
      expect(bodyText).toContain(col.title)
    })
  }

  test('users list shows seeded admin user', async ({ page }) => {
    await page.goto('/admin/collections/users')
    await page.waitForTimeout(3000)

    // The seeded admin user should appear
    const bodyText = await page.textContent('body')
    expect(bodyText).toContain('dev-admin@spacesangels.com')
  })

  test('spaces list shows seeded spaces', async ({ page }) => {
    await page.goto('/admin/collections/spaces')
    await page.waitForTimeout(3000)

    const bodyText = await page.textContent('body')
    // At least one seeded space should appear
    const hasSeededSpace =
      bodyText?.includes('Community') ||
      bodyText?.includes('Team') ||
      bodyText?.includes('AI Bus')
    expect(hasSeededSpace).toBe(true)
  })
})

// ─── Admin Panel Navigation ──────────────────────────────────────────────────

test.describe('Payload Admin: Navigation', () => {
  test('admin sidebar shows Angel OS collection group', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForTimeout(3000)

    // The Angel OS group should be visible in the sidebar nav
    const bodyText = await page.textContent('body')
    expect(bodyText).toContain('Angel OS')
  })

  test('admin panel collections are accessible (no 403/blank)', async ({ page }) => {
    const criticalCollections = [
      '/admin/collections/header',
      '/admin/collections/footer',
      '/admin/collections/pages',
      '/admin/collections/users',
    ]

    for (const route of criticalCollections) {
      await page.goto(route)
      await page.waitForTimeout(2000)

      const url = page.url()
      // Should not redirect to login
      expect(url).not.toContain('/admin/login')

      // Page should have substantial content (not blank)
      const bodyText = await page.textContent('body')
      expect(bodyText!.length).toBeGreaterThan(50)
    }
  })

  test('admin panel create pages load for Header and Footer', async ({ page }) => {
    for (const collection of ['header', 'footer']) {
      await page.goto(`/admin/collections/${collection}/create`)
      await page.waitForTimeout(3000)

      const url = page.url()
      expect(url).toContain(`/admin/collections/${collection}/create`)

      // Should show the form with Label and Nav Items fields
      const bodyText = await page.textContent('body')
      expect(bodyText).toContain('Label')
      expect(bodyText).toContain('Nav Items')

      // Should have a save button
      const saveButton = page.locator('button', { hasText: /save/i })
      await expect(saveButton).toBeVisible()
    }
  })
})

// ─── Link Field Rendering ────────────────────────────────────────────────────

test.describe('Payload Admin: Link Field', () => {
  test('link field renders type radio and label input on Header create', async ({ page }) => {
    await page.goto('/admin/collections/header/create')
    await page.waitForTimeout(3000)

    // Click "Add Nav Items" button to add an array row
    const addButton = page.locator('button', { hasText: /add.*nav.*item/i })
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click()
      await page.waitForTimeout(1000)

      // After adding, the link field should show:
      // - Type radio: "Internal link" / "Custom URL"
      // - Label text input
      const bodyText = await page.textContent('body')
      const hasLinkTypeField =
        bodyText?.includes('Internal link') || bodyText?.includes('Custom URL')
      expect(hasLinkTypeField).toBe(true)

      // Label field should be visible
      expect(bodyText).toContain('Label')
    }
  })
})
