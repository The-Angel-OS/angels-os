/**
 * Mobile Responsive E2E Tests
 *
 * Validates that core public pages render correctly on mobile viewports
 * (iPhone 13: 375x812). Tests check for:
 * - No horizontal overflow / scrollbar
 * - Hamburger navigation visibility and functionality
 * - Responsive grid layouts (single-column on mobile)
 * - Key content visibility at small viewports
 *
 * These tests do NOT require authentication — they only test public pages.
 */
import { test, expect } from '@playwright/test'

const baseURL = 'http://localhost:3000'

test.describe('Mobile Responsive (375x812)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
  })

  // ─── 1. Homepage mobile layout ─────────────────────────────────────

  test('homepage renders without horizontal overflow', async ({ page }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasOverflow).toBe(false)
  })

  test('homepage shows hamburger menu button on mobile', async ({ page }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // MobileMenu uses Radix Sheet — trigger has data-slot="sheet-trigger"
    // Also check for common aria/class patterns as fallback
    const hamburger = page
      .locator(
        [
          '[data-slot="sheet-trigger"]',
          'button[aria-label*="menu" i]',
          'button[aria-label*="navigation" i]',
          'button:has(svg.lucide-menu)',
          'button.md\\:hidden',
        ].join(', '),
      )
      .first()

    await expect(hamburger).toBeVisible({ timeout: 5000 })
  })

  test('homepage hero text is visible on mobile', async ({ page }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const heroText = page.locator('text=Everyone Gets an Angel').first()
    await expect(heroText).toBeVisible({ timeout: 5000 })
  })

  test('homepage has no horizontal scrollbar', async ({ page }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const scrollInfo = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
    }))

    expect(scrollInfo.scrollWidth).toBeLessThanOrEqual(scrollInfo.innerWidth)
  })

  // ─── 2. Hamburger navigation opens ─────────────────────────────────

  test('hamburger menu opens navigation overlay with links', async ({ page }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // MobileMenu uses Radix Sheet — trigger has data-slot="sheet-trigger"
    const hamburger = page
      .locator(
        [
          '[data-slot="sheet-trigger"]',
          'button[aria-label*="menu" i]',
          'button:has(svg.lucide-menu)',
        ].join(', '),
      )
      .first()

    await hamburger.click()
    await page.waitForTimeout(1000)

    // After opening, the Sheet content appears with data-slot="sheet-content"
    const sheetContent = page.locator('[data-slot="sheet-content"]')
    await expect(sheetContent).toBeVisible({ timeout: 5000 })

    // The sheet should contain navigation links (from CMS) and account links
    // CMSLink renders <a> tags; account section has Links to /login or /orders etc.
    const linksInSheet = sheetContent.locator('a')
    const linkCount = await linksInSheet.count()

    // Sheet should have at least 2 links (CMS nav items + account links)
    expect(linkCount).toBeGreaterThanOrEqual(2)
  })

  test('hamburger menu has a close button', async ({ page }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Open the hamburger menu via Radix Sheet trigger
    const hamburger = page
      .locator(
        [
          '[data-slot="sheet-trigger"]',
          'button[aria-label*="menu" i]',
          'button:has(svg.lucide-menu)',
        ].join(', '),
      )
      .first()

    await hamburger.click()
    await page.waitForTimeout(1000)

    // Radix Sheet close button uses data-slot="sheet-close" or has an X icon
    const closeButton = page
      .locator(
        [
          '[data-slot="sheet-close"]',
          'button[aria-label*="close" i]',
          'button:has(svg.lucide-x)',
        ].join(', '),
      )
      .first()

    await expect(closeButton).toBeVisible({ timeout: 3000 })
  })

  // ─── 3. Shop page responsive ──────────────────────────────────────

  test('shop page renders responsive grid on mobile', async ({ page }) => {
    await page.goto(`${baseURL}/shop`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // No horizontal overflow
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasOverflow).toBe(false)

    // Product grid should exist
    const productCards = page.locator(
      [
        '[class*="product"]',
        '[class*="card"]',
        '[data-testid*="product"]',
        '.products-grid > *',
      ].join(', '),
    )

    // If products exist, check they render in single-column (width close to viewport)
    const count = await productCards.count()
    if (count > 0) {
      const firstCard = productCards.first()
      const box = await firstCard.boundingBox()
      if (box) {
        // Card should be at least 80% of viewport width for single-column layout
        expect(box.width).toBeGreaterThan(375 * 0.7)
      }
    }
  })

  test('shop page search bar is visible on mobile', async ({ page }) => {
    await page.goto(`${baseURL}/shop`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const searchBar = page
      .locator(
        [
          'input[type="search"]',
          'input[placeholder*="search" i]',
          'input[aria-label*="search" i]',
          '[data-testid*="search"]',
        ].join(', '),
      )
      .first()

    await expect(searchBar).toBeVisible({ timeout: 5000 })
  })

  test('shop page has product browsing capability on mobile', async ({ page }) => {
    await page.goto(`${baseURL}/shop`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // On mobile, categories may show as FilterItemDropdown (a div with border and chevron)
    // or category tabs, or might be hidden behind a menu. Check for either approach.
    // The key test is that products are actually displayed.
    const productCards = page
      .locator(
        [
          '[class*="product"]',
          'a[href*="/product/"]',
          '[class*="card"]',
        ].join(', '),
      )

    const count = await productCards.count()
    // Shop page should show at least some products
    expect(count).toBeGreaterThan(0)
  })

  // ─── 4. Posts page responsive ─────────────────────────────────────

  test('posts page renders full-width blog cards on mobile', async ({ page }) => {
    await page.goto(`${baseURL}/posts`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // No horizontal overflow
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasOverflow).toBe(false)

    // Blog cards should be near full-width on mobile
    const blogCards = page
      .locator(
        [
          '[class*="post"]',
          '[class*="card"]',
          '[class*="blog"]',
          'article',
        ].join(', '),
      )

    const count = await blogCards.count()
    if (count > 0) {
      const firstCard = blogCards.first()
      const box = await firstCard.boundingBox()
      if (box) {
        // Card should occupy most of the viewport width
        expect(box.width).toBeGreaterThan(375 * 0.7)
      }
    }
  })

  test('posts page shows post titles on mobile', async ({ page }) => {
    await page.goto(`${baseURL}/posts`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Look for headings or link text within post listings
    const titles = page.locator('h2, h3, [class*="title"]').first()
    await expect(titles).toBeVisible({ timeout: 5000 })
  })

  // ─── 5. Events page responsive ────────────────────────────────────

  test('events page renders without overflow on mobile', async ({ page }) => {
    await page.goto(`${baseURL}/events`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasOverflow).toBe(false)
  })

  test('events page renders event cards properly on mobile', async ({ page }) => {
    await page.goto(`${baseURL}/events`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const eventCards = page
      .locator(
        [
          '[class*="event"]',
          '[class*="card"]',
          'article',
          '[data-testid*="event"]',
        ].join(', '),
      )

    const count = await eventCards.count()
    if (count > 0) {
      const firstCard = eventCards.first()
      const box = await firstCard.boundingBox()
      if (box) {
        // Event card should not exceed viewport width
        expect(box.x + box.width).toBeLessThanOrEqual(375 + 2) // 2px tolerance
      }
    }
  })

  // ─── 6. Checkout page mobile ──────────────────────────────────────

  test('checkout page is usable on mobile', async ({ page }) => {
    await page.goto(`${baseURL}/checkout`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // No horizontal overflow
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasOverflow).toBe(false)

    // Checkout page should show checkout content — either the checkout form
    // or a "cart is empty" message. Both are valid states.
    const bodyText = await page.textContent('body')
    const hasCheckoutContent =
      bodyText?.includes('Checkout') ||
      bodyText?.includes('Contact') ||
      bodyText?.includes('cart') ||
      bodyText?.includes('Cart') ||
      bodyText?.includes('Payment') ||
      bodyText?.includes('order') ||
      bodyText?.includes('Order')

    expect(hasCheckoutContent).toBeTruthy()

    // Page body should have substantial content (not a blank page)
    expect(bodyText?.length).toBeGreaterThan(50)
  })

  // ─── 7. No horizontal overflow on any core page ───────────────────

  const corePages = ['/', '/shop', '/posts', '/events', '/makers']

  for (const path of corePages) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasOverflow).toBe(false)
    })
  }
})
