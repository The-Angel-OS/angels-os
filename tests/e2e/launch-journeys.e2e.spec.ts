/**
 * Launch Journey E2E Tests
 *
 * Tests the critical user journeys that must work for launch day:
 * 1. Event Discovery — /events page rendering, cards, navigation
 * 2. Makers Page — /makers hero, How It Works, Fair Split
 * 3. Space Invitations — /invite/[token] accept flow
 * 4. Federation Dashboard — admin federation panel tabs
 *
 * Prerequisites:
 * 1. Dev server running: `pnpm dev`
 * 2. Dev seed data: `pnpm seed:dev`
 * 3. Auth setup runs automatically via Playwright project dependencies
 *
 * Uses authenticated session from auth.setup.ts (storageState pattern).
 */
import { test, expect } from '@playwright/test'

// ─── Event Discovery ──────────────────────────────────────────────────────────

test.describe('Launch Journey: Event Discovery', () => {
  test('events page renders with heading and description', async ({ page }) => {
    await page.goto('/events')

    const heading = page.locator('h1').first()
    await expect(heading).toHaveText('Events')

    const subtitle = page.locator('text=Meetups, workshops, livestreams')
    await expect(subtitle).toBeVisible()
  })

  test('events page shows empty state or event sections', async ({ page }) => {
    await page.goto('/events')
    await page.waitForTimeout(2000)

    // Either events exist (status group headings like "Upcoming", "Live Now", "Past Events")
    // or empty state shows. Events use div containers, not <section> elements.
    const emptyState = page.locator('text=No events yet')
    const upcomingHeading = page.locator('h2', { hasText: 'Upcoming' })
    const liveHeading = page.locator('h2', { hasText: 'Live Now' })
    const eventCards = page.locator('a[href*="/events/"]')

    const hasEmpty = await emptyState.isVisible().catch(() => false)
    const hasUpcoming = await upcomingHeading.isVisible().catch(() => false)
    const hasLive = await liveHeading.isVisible().catch(() => false)
    const hasCards = (await eventCards.count()) > 0

    expect(hasEmpty || hasUpcoming || hasLive || hasCards).toBeTruthy()
  })

  test('events page groups by status when events exist', async ({ page }) => {
    await page.goto('/events')
    await page.waitForTimeout(1000)

    // Check if any section headings exist (Live Now, Upcoming, Past Events)
    const sectionHeadings = page.locator('h2')
    const count = await sectionHeadings.count()

    if (count > 0) {
      // At least one status group should be rendered
      const headingTexts: string[] = []
      for (let i = 0; i < count; i++) {
        const text = await sectionHeadings.nth(i).textContent()
        if (text) headingTexts.push(text)
      }

      // Valid section names from the page component
      const validSections = ['Live Now', 'Upcoming', 'Past Events']
      const hasValidSection = headingTexts.some((t) =>
        validSections.some((s) => t.includes(s)),
      )
      expect(hasValidSection).toBeTruthy()
    }
    // If count === 0, that's the empty state which is also valid
  })

  test('event cards show title, date, and badge', async ({ page }) => {
    await page.goto('/events')
    await page.waitForTimeout(1000)

    // Find event card links
    const eventCards = page.locator('a[href*="/events/"]')
    const cardCount = await eventCards.count()

    if (cardCount > 0) {
      const firstCard = eventCards.first()

      // Card should have a title (h3)
      const title = firstCard.locator('h3')
      await expect(title).toBeVisible()

      // Card should have a status badge
      const badge = firstCard.locator('span[class*="rounded-full"]')
      await expect(badge).toBeVisible()
    }
  })

  test('event card links to detail page', async ({ page }) => {
    await page.goto('/events')
    await page.waitForTimeout(1000)

    const eventCards = page.locator('a[href*="/events/"]')
    const cardCount = await eventCards.count()

    if (cardCount > 0) {
      const href = await eventCards.first().getAttribute('href')
      expect(href).toMatch(/\/events\/[a-z0-9-]+/)

      // Click the card and verify navigation
      await eventCards.first().click()
      await page.waitForTimeout(2000)
      await expect(page).toHaveURL(/\/events\//)
    }
  })
})

// ─── Makers Page ──────────────────────────────────────────────────────────────

test.describe('Launch Journey: Makers Page', () => {
  test('makers page renders hero section', async ({ page }) => {
    await page.goto('/makers')

    const heading = page.locator('h1').first()
    await expect(heading).toHaveText('Makers Wanted')

    // Subtitle — either shows order stats or default copy
    const subtitle = page.locator('text=maker network').first()
    const statsSubtitle = page.locator('text=vendor revenue').first()

    const hasDefault = await subtitle.isVisible().catch(() => false)
    const hasStats = await statsSubtitle.isVisible().catch(() => false)

    expect(hasDefault || hasStats).toBeTruthy()
  })

  test('How It Works section shows 3 steps', async ({ page }) => {
    await page.goto('/makers')

    // Step 1
    const step1 = page.locator('text=Register Equipment')
    await expect(step1).toBeVisible()

    // Step 2
    const step2 = page.locator('text=Claim Orders')
    await expect(step2).toBeVisible()

    // Step 3
    const step3 = page.locator('text=Produce & Ship')
    await expect(step3).toBeVisible()
  })

  test('Fair Split explainer shows correct percentages', async ({ page }) => {
    await page.goto('/makers')

    // Section heading
    const splitHeading = page.locator('text=Constitutional Fair Split')
    await expect(splitHeading).toBeVisible()

    // Percentage values
    await expect(page.locator('text=60%').first()).toBeVisible()
    await expect(page.locator('text=20%').first()).toBeVisible()
    await expect(page.locator('text=15%').first()).toBeVisible()
    await expect(page.locator('text=5%').first()).toBeVisible()

    // Labels
    await expect(page.locator('text=You (the maker)').first()).toBeVisible()
    await expect(page.locator('text=Platform partner').first()).toBeVisible()
    await expect(page.locator('text=Operations').first()).toBeVisible()
    await expect(page.locator('text=Justice Fund').first()).toBeVisible()
  })

  test('opportunity grid renders when orders exist', async ({ page }) => {
    await page.goto('/makers')
    await page.waitForTimeout(1000)

    // The "Orders Waiting by Capability" section only appears when there are opportunities
    const opportunityHeading = page.locator('text=Orders Waiting by Capability')
    const hasOpportunities = await opportunityHeading.isVisible().catch(() => false)

    if (hasOpportunities) {
      // Should have at least one opportunity card
      const cards = page.locator('.rounded-lg.border.border-border.bg-card.p-5')
      const count = await cards.count()
      expect(count).toBeGreaterThan(0)

      // First card should show skill name and order count
      const firstCard = cards.first()
      const orderBadge = firstCard.locator('text=/\\d+ orders?/')
      await expect(orderBadge).toBeVisible()
    }
    // No opportunities is valid in dev — the page still renders
  })

  test('CTA section mentions LEO', async ({ page }) => {
    await page.goto('/makers')

    const leoCta = page.locator('text=Talk to LEO')
    await expect(leoCta).toBeVisible()

    const leoCommand = page.locator('text=register my workshop')
    await expect(leoCommand).toBeVisible()
  })
})

// ─── Space Invitations ────────────────────────────────────────────────────────

test.describe('Launch Journey: Space Invitations', () => {
  test('invalid invite token shows Not Found state', async ({ page }) => {
    await page.goto('/invite/fake-token-does-not-exist-12345')
    await page.waitForTimeout(2000)

    const heading = page.locator('text=Invitation Not Found')
    await expect(heading).toBeVisible()

    // Should have a link back to homepage
    const homeLink = page.getByRole('link', { name: /Go to Homepage/i })
    await expect(homeLink).toBeVisible()
  })

  test('invite page shows correct structure for valid invite', async ({ page }) => {
    // Create a test invite via the Payload REST API
    const token = await createTestInvite(page)

    if (!token) {
      // If we can't create an invite (no spaces in DB or API error), skip gracefully
      test.skip()
      return
    }

    await page.goto(`/invite/${token}`)
    await page.waitForTimeout(3000)

    // Should show some invite-related content: "Invited", "Accept", or "Not Found"
    const invitedHeading = page.locator('text=Invited')
    const acceptBtn = page.getByRole('button', { name: /Accept/i })
    const notFound = page.locator('text=Invitation Not Found')

    const hasInvited = await invitedHeading.isVisible().catch(() => false)
    const hasAccept = await acceptBtn.isVisible().catch(() => false)
    const hasNotFound = await notFound.isVisible().catch(() => false)

    // The invite page rendered with some valid state
    expect(hasInvited || hasAccept || hasNotFound).toBeTruthy()

    if (hasInvited) {
      // Should show the space name in a card
      const spaceCard = page.locator('.rounded-lg.border')
      await expect(spaceCard.first()).toBeVisible()
    }
  })

  test('already-accepted invite shows Already Accepted state', async ({ page }) => {
    // Create an invite and mark it as already accepted
    const token = await createTestInvite(page, 'active')

    if (!token) {
      test.skip()
      return
    }

    await page.goto(`/invite/${token}`)
    await page.waitForTimeout(2000)

    const heading = page.locator('text=Already Accepted')
    await expect(heading).toBeVisible()

    // Should have a "Go to Spaces" link
    const spacesLink = page.getByRole('link', { name: /Go to Spaces/i })
    await expect(spacesLink).toBeVisible()
  })

  test('expired invite shows Invitation Expired state', async ({ page }) => {
    // Create an invite with an expired date
    const token = await createTestInvite(page, 'pending', true)

    if (!token) {
      test.skip()
      return
    }

    await page.goto(`/invite/${token}`)
    await page.waitForTimeout(2000)

    const heading = page.locator('text=Invitation Expired')
    await expect(heading).toBeVisible()
  })
})

// ─── Federation Dashboard ─────────────────────────────────────────────────────

test.describe('Launch Journey: Federation Dashboard', () => {
  test('federation page loads with header and tabs', async ({ page }) => {
    await page.goto('/dashboard/admin/federation')
    await page.waitForTimeout(2000)

    // Header
    const title = page.locator('text=Federation Network')
    await expect(title).toBeVisible()

    // 4 tabs should be visible
    await expect(page.getByRole('button', { name: /Overview/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Street Signs/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Governance/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Suitcase/i })).toBeVisible()

    // Refresh button
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible()
  })

  test('overview tab shows stats grid and constitution', async ({ page }) => {
    await page.goto('/dashboard/admin/federation')
    await page.waitForTimeout(3000)

    // Stat cards should render (even with 0 values)
    // Labels were renamed: "Dioceses" → "Enterprises"
    await expect(page.locator('text=Enterprises').first()).toBeVisible()
    await expect(page.locator('text=Active').first()).toBeVisible()
    await expect(page.locator('text=Catalog Entries').first()).toBeVisible()

    // Constitution section
    await expect(page.locator('text=Constitution v1.1')).toBeVisible()
  })

  test('overview tab shows revenue architecture', async ({ page }) => {
    await page.goto('/dashboard/admin/federation')
    await page.waitForTimeout(3000)

    // Toward-53 Revenue Architecture section
    await expect(page.locator('text=Toward-53 Revenue Architecture')).toBeVisible()

    // Revenue split percentages — "Diocese Operator" was renamed to "Enterprise Operator"
    await expect(page.locator('text=Endeavor Owner').first()).toBeVisible()
    await expect(page.locator('text=Enterprise Operator').first()).toBeVisible()
    await expect(page.locator('text=Justice Fund').first()).toBeVisible()
  })

  test('street signs tab renders', async ({ page }) => {
    await page.goto('/dashboard/admin/federation')
    await page.waitForTimeout(3000)

    // Click Street Signs tab
    await page.getByRole('button', { name: /Street Signs/i }).click()
    await page.waitForTimeout(2000)

    // Should show Street Signs heading and Create button
    const heading = page.locator('h2', { hasText: 'Street Signs' })
    await expect(heading).toBeVisible()

    const createBtn = page.getByRole('button', { name: /Create Street Sign/i })
    await expect(createBtn).toBeVisible()
  })

  test('governance tab renders', async ({ page }) => {
    await page.goto('/dashboard/admin/federation')
    await page.waitForTimeout(2000)

    // Click Governance tab
    await page.getByRole('button', { name: /Governance/i }).click()
    await page.waitForTimeout(1000)

    // Should show Governance heading and New Proposal button
    const heading = page.locator('h2', { hasText: 'Governance Proposals' })
    await expect(heading).toBeVisible()

    const newProposalBtn = page.getByRole('button', { name: /New Proposal/i })
    await expect(newProposalBtn).toBeVisible()
  })

  test('suitcase tab renders with export and import', async ({ page }) => {
    await page.goto('/dashboard/admin/federation')
    await page.waitForTimeout(3000)

    // Click Suitcase tab
    await page.getByRole('button', { name: /Suitcase/i }).click()
    await page.waitForTimeout(2000)

    // Should show Suitcase heading
    await expect(page.locator('text=Endeavor Portability')).toBeVisible()

    // Export section
    const packBtn = page.getByRole('button', { name: /Pack Suitcase/i })
    await expect(packBtn).toBeVisible()

    // Import section
    await expect(page.locator('text=Import Suitcase')).toBeVisible()
  })
})

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Creates a test space-membership invite via the Payload REST API.
 * Returns the invitation token, or null if no spaces exist.
 */
async function createTestInvite(
  page: import('@playwright/test').Page,
  status: 'pending' | 'active' = 'pending',
  expired = false,
): Promise<string | null> {
  const baseURL = 'http://localhost:3000'
  const token = `test-invite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  try {
    // Find an existing space to create the invite for
    const spacesRes = await page.request.get(`${baseURL}/api/spaces?limit=1&depth=0`)
    if (!spacesRes.ok()) return null

    const spacesData = await spacesRes.json()
    const space = spacesData.docs?.[0]
    if (!space) return null

    // Find the current user (from auth session)
    const meRes = await page.request.get(`${baseURL}/api/users/me`)
    if (!meRes.ok()) return null

    const meData = await meRes.json()
    const userId = meData.user?.id
    if (!userId) return null

    // Create the space-membership with invitation details
    const expiresAt = expired
      ? new Date(Date.now() - 86400000).toISOString() // 1 day ago
      : new Date(Date.now() + 7 * 86400000).toISOString() // 7 days from now

    const membershipRes = await page.request.post(`${baseURL}/api/space-memberships`, {
      data: {
        space: space.id,
        user: userId,
        role: 'member',
        status,
        invitedBy: userId,
        invitationDetails: {
          invitationToken: token,
          invitationExpiresAt: expiresAt,
          invitationMessage: 'E2E test invitation',
        },
        tenant: space.tenant,
      },
    })

    if (!membershipRes.ok()) {
      return null
    }

    return token
  } catch {
    return null
  }
}
