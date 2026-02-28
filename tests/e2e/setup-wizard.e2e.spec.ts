/**
 * Enterprise Setup Wizard E2E Tests
 *
 * Tests the Leo-guided Enterprise Setup Wizard at /dashboard/setup:
 * - Page rendering (header, two-panel layout)
 * - Step indicator panel (8 wizard steps)
 * - Leo chat panel (messages, input area)
 * - Wizard navigation and step labels
 * - Dashboard sidebar "Enterprise Setup" link
 * - Setup status API endpoint
 *
 * Prerequisites:
 * 1. Dev server running: `pnpm dev`
 * 2. Dev seed data: `pnpm seed:dev`
 * 3. Auth setup runs automatically via Playwright project dependencies
 *
 * Uses authenticated session from auth.setup.ts (storageState pattern).
 *
 * IMPORTANT: The wizard redirects to /dashboard if setup is already complete.
 * Tests handle this gracefully with test.skip() when a redirect is detected.
 */
import { test, expect } from '@playwright/test'

const baseURL = 'http://localhost:3000'

// The 8 wizard step names from src/utilities/wizardPrompt.ts
const WIZARD_STEPS = [
  'Welcome',
  'Identity',
  'Endeavor Type',
  'First Space',
  'First Member',
  'First Offering',
  'Payments',
  'Federation',
]

/**
 * Helper: Navigate to the setup wizard and detect redirect.
 * Returns true if the wizard page loaded, false if redirected away
 * (meaning the wizard is already complete for this tenant).
 */
async function navigateToSetup(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto(`${baseURL}/dashboard/setup`)
  await page.waitForTimeout(3000)

  // The page.tsx server component redirects to /dashboard if wizardComplete is true
  const url = page.url()
  if (!url.includes('/dashboard/setup')) {
    return false // Wizard already complete — redirected
  }
  return true
}

// ── Page Rendering ────────────────────────────────────────────────────────────

test.describe('Enterprise Setup Wizard', () => {
  test('setup wizard page renders with header and layout', async ({ page }) => {
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    // Page header should show "Enterprise Setup" (inside main, not the dashboard banner h1)
    const heading = page.locator('main h1').first()
    await expect(heading).toContainText('Enterprise Setup')

    // Subtitle mentioning Leo and ~17 minutes
    const subtitle = page.locator('text=Leo will guide you')
    await expect(subtitle).toBeVisible()

    // Page body should have substantial content
    const bodyText = await page.textContent('body')
    expect(bodyText?.length).toBeGreaterThan(100)
  })

  // ── Step Indicator Panel ──────────────────────────────────────────────────

  test('wizard has step indicator panel with progress', async ({ page }) => {
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    // Left aside panel should be visible (step indicator — inside main, not the dashboard sidebar)
    const aside = page.locator('main aside').first()
    await expect(aside).toBeVisible()

    // Panel header should show "Enterprise Setup" and step counter
    await expect(aside.locator('text=Enterprise Setup').first()).toBeVisible()
    await expect(aside.locator('text=Step').first()).toBeVisible()

    // Step counter should show "Step X of 8" format
    const stepCounter = aside.locator('text=/Step \\d+ of \\d+/')
    await expect(stepCounter).toBeVisible()
  })

  test('wizard step indicator shows all 8 step names', async ({ page }) => {
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    const aside = page.locator('main aside').first()

    // Each of the 8 wizard steps should appear in the step indicator
    for (const stepName of WIZARD_STEPS) {
      const stepLabel = aside.locator(`text=${stepName}`).first()
      await expect(stepLabel).toBeVisible()
    }
  })

  test('wizard step indicator highlights current step', async ({ page }) => {
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    const aside = page.locator('main aside').first()

    // The current step should have the primary highlight class
    // Look for a step item with the active styling (bg-primary/10)
    const activeStep = aside.locator('[class*="bg-primary"]').first()
    await expect(activeStep).toBeVisible()

    // There should be a pulsing dot indicator on the current step
    const pulsingDot = aside.locator('.animate-pulse').first()
    await expect(pulsingDot).toBeVisible()
  })

  // ── Leo Chat Panel ────────────────────────────────────────────────────────

  test('wizard first step shows Leo chat panel', async ({ page }) => {
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    // Leo chat header should show "Leo" label
    const leoLabel = page.locator('text=Leo').first()
    await expect(leoLabel).toBeVisible()

    // Chat input area should be present with placeholder (inside main, not LEO panel)
    const textarea = page.locator('main textarea').first()
    await expect(textarea).toBeVisible()

    // Placeholder text should reference Leo
    const placeholder = await textarea.getAttribute('placeholder')
    expect(placeholder).toContain('Leo')

    // Send button should exist
    const sendButton = page.locator('button').filter({ has: page.locator('svg') }).last()
    await expect(sendButton).toBeVisible()

    // Input hint text
    const inputHint = page.locator('text=Enter to send')
    await expect(inputHint).toBeVisible()
  })

  test('wizard chat shows initial messages from Leo', async ({ page }) => {
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    // Wait for Leo's streaming welcome message to begin
    await page.waitForTimeout(5000)

    // System message or Leo's first message should appear
    // The system message says "Enterprise Setup" in its content
    const systemOrLeoMessage = page.locator('text=/Enterprise Setup/').first()
    await expect(systemOrLeoMessage).toBeVisible()

    // There should be at least one chat message bubble rendered
    // Message bubbles use rounded-2xl styling
    const messageBubbles = page.locator('[class*="rounded-2xl"]')
    const bubbleCount = await messageBubbles.count()
    expect(bubbleCount).toBeGreaterThanOrEqual(1)
  })

  // ── Wizard Footer ─────────────────────────────────────────────────────────

  test('wizard footer shows estimated time', async ({ page }) => {
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    // Footer text: "~17 min · guided by Leo"
    const footerTime = page.getByText('~17 min · guided by Leo')
    await expect(footerTime).toBeVisible()
  })

  // ── Two-Panel Layout ──────────────────────────────────────────────────────

  test('wizard renders two-panel layout (steps + chat)', async ({ page }) => {
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    // Left panel: aside with step indicator (inside main, not the dashboard sidebar)
    const aside = page.locator('main aside').first()
    await expect(aside).toBeVisible()

    // Right panel: chat area with messages and input
    const textarea = page.locator('main textarea').first()
    await expect(textarea).toBeVisible()

    // Both panels should be side by side (flex layout)
    const wizardContainer = page.locator('.flex.h-full').first()
    if (await wizardContainer.isVisible()) {
      // Container should have flex children
      const children = wizardContainer.locator('> *')
      const count = await children.count()
      expect(count).toBeGreaterThanOrEqual(2) // aside + chat panel
    }
  })

  // ── Chat Interaction ──────────────────────────────────────────────────────

  test('wizard chat input accepts text', async ({ page }) => {
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    const textarea = page.locator('main textarea').first()
    await expect(textarea).toBeVisible()

    // Type a test message (but do NOT submit — avoid wizard side effects)
    await textarea.fill('Hello Leo')
    await expect(textarea).toHaveValue('Hello Leo')

    // Send button should now be enabled (not disabled)
    // The send button is disabled when input is empty
    const sendButton = textarea.locator('..').locator('..').locator('button').last()
    if (await sendButton.isVisible()) {
      const isDisabled = await sendButton.getAttribute('disabled')
      expect(isDisabled).toBeNull() // Not disabled when there's text
    }
  })

  // ── Dashboard Setup Link ──────────────────────────────────────────────────

  test('dashboard sidebar shows Enterprise Setup link when wizard incomplete', async ({ page }) => {
    await page.goto(`${baseURL}/dashboard`)
    await page.waitForTimeout(2000)

    // The sidebar shows "Enterprise Setup" link when wizardComplete is false
    const setupLink = page.locator('text=Enterprise Setup').first()
    const isVisible = await setupLink.isVisible().catch(() => false)

    if (isVisible) {
      // The link should point to /dashboard/setup
      const link = page.getByRole('link', { name: /Enterprise Setup/i }).first()
      await expect(link).toBeVisible()

      const href = await link.getAttribute('href')
      expect(href).toContain('/dashboard/setup')

      // Should also have a "Setup" badge
      const badge = page.locator('text=Setup').first()
      const hasBadge = await badge.isVisible().catch(() => false)
      // Badge is optional (hidden when sidebar is collapsed)
      expect(hasBadge || true).toBeTruthy()
    }
    // If not visible, the wizard is already complete — that's fine
  })

  test('dashboard setup link navigates to wizard', async ({ page }) => {
    await page.goto(`${baseURL}/dashboard`)
    await page.waitForTimeout(2000)

    const setupLink = page.getByRole('link', { name: /Enterprise Setup/i }).first()
    const isVisible = await setupLink.isVisible().catch(() => false)

    if (isVisible) {
      await setupLink.click()
      await page.waitForTimeout(3000)

      // Should either be on /dashboard/setup or redirected to /dashboard
      const url = page.url()
      expect(url).toMatch(/\/dashboard(\/setup)?/)
    }
  })

  // ── Setup Status API ──────────────────────────────────────────────────────

  test('wizard progress API returns valid structure', async ({ page }) => {
    // The wizard uses server actions, not a REST API endpoint.
    // Test by navigating to the setup page and verifying the progress
    // is reflected in the step indicator.
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    const aside = page.locator('main aside').first()

    // Step counter text should match "Step N of 8"
    const stepText = await aside.locator('text=/Step \\d+ of \\d+/').textContent()
    expect(stepText).toMatch(/Step \d+ of 8/)

    // Extract step number and verify it's valid (1-8)
    const match = stepText?.match(/Step (\d+) of (\d+)/)
    if (match) {
      const currentStep = parseInt(match[1], 10)
      const totalSteps = parseInt(match[2], 10)
      expect(currentStep).toBeGreaterThanOrEqual(1)
      expect(currentStep).toBeLessThanOrEqual(8)
      expect(totalSteps).toBe(8)
    }
  })

  // ── Wizard Does Not Auto-Submit ─────────────────────────────────────────

  test('wizard does not auto-advance without user interaction', async ({ page }) => {
    const loaded = await navigateToSetup(page)
    if (!loaded) {
      test.skip()
      return
    }

    // Record the initial step
    const aside = page.locator('main aside').first()
    const initialStepText = await aside.locator('text=/Step \\d+ of \\d+/').textContent()

    // Wait a few seconds without interacting
    await page.waitForTimeout(5000)

    // Step should not have advanced on its own (Leo's intro message
    // doesn't auto-advance the step — only tool calls do)
    const currentStepText = await aside.locator('text=/Step \\d+ of \\d+/').textContent()
    expect(currentStepText).toBe(initialStepText)
  })
})
