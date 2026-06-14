import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility (axe) pass — report-only by default.
 *
 * "A Guardian Angel for everyone" means the public surfaces must be usable by
 * everyone. This scans the key brochure + conversion pages with axe-core
 * (WCAG 2.0/2.1 A & AA) and REPORTS violations as test annotations + an attached
 * JSON report + a console summary. It does NOT fail the build unless AXE_STRICT=1,
 * so it can land green and be tightened over time.
 *
 *   pnpm test:a11y                 # report-only against http://localhost:3000
 *   AXE_BASE_URL=https://… pnpm test:a11y          # scan a deployed/preview URL
 *   AXE_STRICT=1 pnpm test:a11y    # fail on serious/critical violations
 *
 * Self-contained: runs under playwright.a11y.config.ts (NO global-setup, so it
 * never writes to the database — it only navigates + reads public pages).
 */

const ROUTES: Array<{ path: string; name: string }> = [
  { path: '/', name: 'Home (brochure)' },
  { path: '/shop', name: 'Shop' },
  { path: '/posts', name: 'Posts' },
  { path: '/events', name: 'Events' },
  { path: '/book', name: 'Booking wizard' },
  { path: '/contact', name: 'Contact (Form Builder)' },
]

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const STRICT = process.env.AXE_STRICT === '1'

for (const route of ROUTES) {
  test(`a11y: ${route.name} (${route.path})`, async ({ page }, testInfo) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    // Let client components (chat, forms, booking wizard) hydrate.
    await page.waitForTimeout(1500)

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()

    const byImpact = results.violations.reduce<Record<string, number>>((acc, v) => {
      const k = v.impact || 'unknown'
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})

    const summary = results.violations
      .map((v) => `  [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`)
      .join('\n')

    // eslint-disable-next-line no-console
    console.log(
      `\n♿ ${route.name} ${route.path} — ${results.violations.length} violation type(s) ` +
        `${JSON.stringify(byImpact)}\n${summary || '  ✓ none'}`,
    )

    await testInfo.attach('axe-results.json', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    })
    testInfo.annotations.push({
      type: 'a11y-violations',
      description: `${results.violations.length} type(s): ${JSON.stringify(byImpact)}`,
    })

    if (STRICT) {
      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )
      expect(
        blocking,
        `serious/critical a11y violations on ${route.path}:\n${blocking.map((v) => v.id).join(', ')}`,
      ).toEqual([])
    }
  })
}
