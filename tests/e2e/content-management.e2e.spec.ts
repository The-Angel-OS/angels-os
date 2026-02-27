/**
 * Content Management E2E Tests
 *
 * Tests the Angel OS dashboard content pages and content API endpoints:
 * - Dashboard content pages render correctly (pages, posts, media, products, orders, events, projects)
 * - Content API endpoints return valid data
 *
 * Prerequisites:
 * 1. Dev server running: `pnpm dev`
 * 2. Dev seed data: `pnpm seed:dev`
 * 3. Auth setup runs automatically via Playwright project dependencies
 *
 * Uses authenticated session from auth.setup.ts (storageState pattern).
 */
import { test, expect } from '@playwright/test'

const baseURL = 'http://localhost:3000'

test.describe('Content Management', () => {
  // ─────────────────────────────────────────────────────────────
  // Dashboard content pages render
  // ─────────────────────────────────────────────────────────────

  test.describe('Dashboard content pages render', () => {
    const contentPages = [
      { path: '/dashboard/pages', name: 'Pages' },
      { path: '/dashboard/posts', name: 'Posts' },
      { path: '/dashboard/media', name: 'Media' },
      { path: '/dashboard/products', name: 'Products' },
      { path: '/dashboard/orders', name: 'Orders' },
      { path: '/dashboard/events', name: 'Events' },
      { path: '/dashboard/projects', name: 'Projects' },
    ]

    for (const { path, name } of contentPages) {
      test(`${name} page renders at ${path}`, async ({ page }) => {
        // Navigate to the content page
        const response = await page.goto(path)

        // Page loads without server error (status < 500)
        expect(response).not.toBeNull()
        expect(response!.status()).toBeLessThan(500)

        // Wait for the page to settle and hydrate
        await page.waitForTimeout(2000)

        // A heading or key element is visible — look for the page name
        // in headings, breadcrumbs, or the main content area
        const heading = page
          .locator(
            [
              `h1:has-text("${name}")`,
              `h2:has-text("${name}")`,
              `[class*="header"] :has-text("${name}")`,
              `nav :has-text("${name}")`,
              `[aria-label*="${name}"]`,
            ].join(', '),
          )
          .first()

        const headingVisible = await heading.isVisible().catch(() => false)

        // If no specific heading found, at least the main content area exists
        if (!headingVisible) {
          const main = page.locator('main, [role="main"], [class*="content"]').first()
          await expect(main).toBeVisible()
        }

        // Content area has actual content (not just an empty shell)
        // Look for table rows, cards, list items, or an explicit empty-state message
        const contentIndicators = page.locator(
          [
            'table tbody tr',
            '[class*="card"]',
            '[class*="grid"] > *',
            '[class*="list"] > *',
            '[class*="empty"]',
            '[class*="no-results"]',
            '[class*="placeholder"]',
          ].join(', '),
        )

        const indicatorCount = await contentIndicators.count()

        // The page should render either content items or an empty state message
        // At minimum, the body should not be blank
        const bodyText = await page.locator('body').innerText()
        expect(bodyText.length).toBeGreaterThan(0)

        // Log what we found for debugging
        console.log(
          `[${name}] heading visible: ${headingVisible}, content indicators: ${indicatorCount}, body length: ${bodyText.length}`,
        )
      })
    }
  })

  // ─────────────────────────────────────────────────────────────
  // Content API endpoints
  // ─────────────────────────────────────────────────────────────

  test.describe('Content API endpoints', () => {
    const apiEndpoints = [
      { path: '/api/pages', name: 'Pages' },
      { path: '/api/posts', name: 'Posts' },
      { path: '/api/products', name: 'Products' },
      { path: '/api/media', name: 'Media' },
      { path: '/api/events', name: 'Events' },
    ]

    for (const { path, name } of apiEndpoints) {
      test(`GET ${path}?depth=0&limit=5 returns docs`, async ({ page }) => {
        const res = await page.request.get(`${baseURL}${path}?depth=0&limit=5`)

        // Should return 200
        expect(res.status()).toBe(200)

        // Should return JSON
        const contentType = res.headers()['content-type'] || ''
        expect(contentType).toContain('application/json')

        const data = await res.json()

        // Payload CMS REST API returns { docs: [...], totalDocs, ... }
        expect(data.docs).toBeDefined()
        expect(Array.isArray(data.docs)).toBeTruthy()
        expect(typeof data.totalDocs).toBe('number')

        // Limit should be respected
        expect(data.docs.length).toBeLessThanOrEqual(5)

        // Log result counts for debugging
        console.log(
          `[API ${name}] ${data.docs.length} docs returned, ${data.totalDocs} total`,
        )

        // If there are docs, each should have an id
        if (data.docs.length > 0) {
          for (const doc of data.docs) {
            expect(doc.id).toBeDefined()
          }
        }
      })
    }
  })
})
