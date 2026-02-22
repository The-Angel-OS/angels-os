# Angel OS — Playwright & Chrome Extension UX Testing Guide

## Overview

Angel OS has a three-tier testing strategy:

| Tier | Tool | Scope | Speed |
|------|------|-------|-------|
| **Unit** | Vitest + jsdom | Business logic, utilities, components | ~5s for 1,178 tests |
| **E2E** | Playwright | Full browser flows (auth, shop, dashboard) | ~30-90s |
| **Exploratory** | Claude Chrome Extension | Visual inspection, ad-hoc flow verification | Manual / semi-auto |

This document covers tiers 2 and 3: how to use Playwright for automated UX tests and the Claude Chrome Extension for interactive visual testing.

---

## Prerequisites

```bash
# Install Playwright browsers (one-time)
npx playwright install chromium

# Seed the dev database (creates dev-admin user + test data)
pnpm seed:dev

# Start the dev server
pnpm dev
```

**Dev-admin credentials** (set by `seed:dev`):
- Email: `dev-admin@angelos.local`
- Password: `devdev123`

**Production credentials** (set by main seed):
- Email: `kenneth.courtney@gmail.com`
- Password: `angelos`

---

## Part 1: Running Existing Playwright Tests

### Quick Commands

```bash
# Run all E2E tests
pnpm test:e2e

# Run only dashboard tests (authenticated)
npx playwright test --project=dashboard

# Run only legacy frontend tests
npx playwright test --project=legacy

# Run a single test file
npx playwright test tests/e2e/dashboard.e2e.spec.ts

# Run in headed mode (see the browser)
npx playwright test --headed

# Run with Playwright UI (interactive test runner)
npx playwright test --ui

# Debug a specific test
npx playwright test --debug tests/e2e/dashboard.e2e.spec.ts
```

### Test Projects

The `playwright.config.ts` defines three projects:

1. **setup** — Logs in as `dev-admin@angelos.local`, saves session to `tests/e2e/.auth/user.json`
2. **dashboard** — Authenticated tests that reuse the saved session (no per-test login)
3. **legacy** — Frontend tests with their own auth handling

### Viewing Test Reports

```bash
# Open the HTML report after a test run
npx playwright show-report
```

---

## Part 2: Major Flow Paths to Test

### Brochure / Public Routes (no auth required)

| Route | Flow | What to verify |
|-------|------|----------------|
| `/` | Homepage | Hero renders, navigation works, no 500 |
| `/posts` | Blog listing | Posts load (tenant-scoped), pagination works |
| `/posts/[slug]` | Single post | Content renders, related posts show |
| `/posts/page/2` | Paginated posts | Tenant filter active, page range correct |
| `/shop` | Product catalog | Products display, categories filter |
| `/products/[slug]` | Product detail | Price, description, add-to-cart button |
| `/events` | Events listing | Upcoming events show, past events labeled |
| `/events/[slug]` | Event detail | Registration form, location, time |
| `/spaces` | Spaces discovery | Space list renders for anonymous visitors |
| `/login` | Login page | Form renders, login redirects to /account |
| `/create-account` | Registration | Form validates, creates account |
| `/find-order` | Guest order lookup | Order ID input, results display |
| `/contact` | Contact form | Form fields render, submission works |

### Authenticated Routes

| Route | Flow | What to verify |
|-------|------|----------------|
| `/account` | Account settings | User info displays, edit works |
| `/account/addresses` | Address management | CRUD operations on addresses |
| `/orders` | Order history | Past orders list, click-through to detail |
| `/checkout` | Checkout flow | Cart review, Stripe payment form |

### Dashboard Routes (requires auth)

| Route | Flow | What to verify |
|-------|------|----------------|
| `/dashboard` | Overview | Sidebar, header, stats cards render |
| `/dashboard/spaces` | Space chat | Channel list, message area, send message |
| `/dashboard/spaces/settings` | Space settings | 4 tabs (General, Members, Channels, Danger) |
| `/dashboard/products` | Product management | Product list, create/edit form |
| `/dashboard/orders` | Order management | Order list, status updates |
| `/dashboard/posts` | Post management | Post list, editor |
| `/dashboard/events` | Event management | Event list, create flow |
| `/dashboard/leo` | LEO chat | Chat interface, message send/receive |
| `/dashboard/holon` | Network view | Holon visualization renders |
| `/dashboard/admin/provision` | Tenant provisioning | Wizard steps, creates tenant |
| `/dashboard/admin/payments` | Payment settings | Stripe config display |

### Chat Bubble (cross-cutting)

| Context | Expected behavior |
|---------|-------------------|
| Anonymous visitor on any `(app)` page | Teaser bubble (chat icon linking to `/login`) |
| Logged-in user on any `(app)` page | Full minimalist chat (LEO interface) |
| Dashboard pages | No floating bubble (chat is inline) |

---

## Part 3: Writing New Playwright Tests

### File Structure

```
tests/
  e2e/
    .auth/
      user.json          # Auto-generated auth session
    auth.setup.ts        # Login setup (runs first)
    dashboard.e2e.spec.ts  # Authenticated dashboard tests
    frontend.e2e.spec.ts   # Legacy frontend tests
    brochure.e2e.spec.ts   # NEW: Public page tests
    flows.e2e.spec.ts      # NEW: Full user journey tests
```

### Template: Public Page Test

```typescript
// tests/e2e/brochure.e2e.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Brochure Site — Public Pages', () => {
  test('homepage loads without errors', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('posts page shows tenant-scoped posts', async ({ page }) => {
    await page.goto('/posts')
    // Should show "Posts" heading even if no posts for this tenant
    await expect(page.locator('h1')).toContainText('Posts')
    // Should not show a 500 error
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('shop page displays products', async ({ page }) => {
    await page.goto('/shop')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('events page lists upcoming events', async ({ page }) => {
    await page.goto('/events')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('chat bubble appears for anonymous visitors', async ({ page }) => {
    await page.goto('/')
    // Wait for auth check to complete
    await page.waitForTimeout(2000)
    // Guest teaser bubble should be visible (links to /login)
    const bubble = page.locator('a[href="/login"][class*="fixed"]')
    await expect(bubble).toBeVisible()
  })

  test('login flow works', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[name="email"]').fill('kenneth.courtney@gmail.com')
    await page.locator('input[name="password"]').fill('angelos')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/(account|dashboard)/, { timeout: 15000 })
    await expect(page).not.toHaveURL(/\/login/)
  })
})
```

### Template: Authenticated Dashboard Test

```typescript
// tests/e2e/dashboard-flows.e2e.spec.ts
import { test, expect } from '@playwright/test'

// This file uses the 'dashboard' project — auth session is pre-loaded
test.describe('Dashboard — Full Flows', () => {
  test('navigate through all dashboard sections', async ({ page }) => {
    const sections = [
      '/dashboard',
      '/dashboard/spaces',
      '/dashboard/products',
      '/dashboard/orders',
      '/dashboard/posts',
      '/dashboard/events',
      '/dashboard/leo',
    ]

    for (const section of sections) {
      const response = await page.goto(section)
      expect(response?.status()).toBeLessThan(500)
      // Wait for client hydration
      await page.waitForTimeout(1000)
      // Main content area should exist
      await expect(page.locator('main').first()).toBeVisible()
    }
  })

  test('provisioning wizard creates a tenant', async ({ page }) => {
    await page.goto('/dashboard/admin/provision')
    await page.waitForTimeout(2000)
    // Test the provisioning wizard steps
    // ... wizard interaction here
  })
})
```

### Template: Full User Journey Test

```typescript
// tests/e2e/journeys.e2e.spec.ts
import { test, expect } from '@playwright/test'

test.describe('User Journey — Browse to Purchase', () => {
  test('anonymous user browses shop, logs in, adds to cart', async ({ page }) => {
    // 1. Browse products anonymously
    await page.goto('/shop')
    await page.waitForTimeout(1000)

    // 2. Click first product
    const productLink = page.locator('a[href*="/products/"]').first()
    if (await productLink.isVisible()) {
      await productLink.click()
      await page.waitForTimeout(1000)

      // 3. Verify product page
      await expect(page.locator('body')).not.toContainText('Internal Server Error')

      // 4. Try to add to cart
      const addToCart = page.locator('button:has-text("Add to Cart")').first()
      if (await addToCart.isVisible()) {
        await addToCart.click()
        await page.waitForTimeout(500)
      }
    }

    // 5. Go to login
    await page.goto('/login')
    await page.locator('input[name="email"]').fill('kenneth.courtney@gmail.com')
    await page.locator('input[name="password"]').fill('angelos')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/(account|dashboard)/, { timeout: 15000 })
  })
})
```

### Adding New Tests to playwright.config.ts

To add a new test project (e.g., brochure tests that don't need auth):

```typescript
// In playwright.config.ts, add to the projects array:
{
  name: 'brochure',
  use: { ...devices['Desktop Chrome'], channel: 'chromium' },
  testMatch: /brochure\.e2e\.spec\.ts/,
},
```

For authenticated test files, add them to the `dashboard` project's `testMatch`:

```typescript
testMatch: /(dashboard|dashboard-flows)\.e2e\.spec\.ts/,
```

---

## Part 4: Using Claude Chrome Extension for Exploratory Testing

The Claude Chrome Extension provides interactive browser automation through MCP tools. Use it for:

- **Visual regression checks** — screenshot and compare layouts
- **Ad-hoc flow verification** — click through flows interactively
- **Accessibility audits** — read page accessibility trees
- **Network inspection** — check API calls and responses
- **Console error monitoring** — catch client-side errors

### Setup

1. Install the Claude Chrome Extension from the Chrome Web Store
2. Open a new tab group for your testing session
3. Navigate to `http://localhost:3000`

### Common Commands

```
# Get tab context
tabs_context_mcp

# Take a screenshot
computer: screenshot

# Read page accessibility tree
read_page (tabId)

# Find interactive elements
find: "login button" (tabId)

# Click elements
computer: left_click at [x, y]

# Fill forms
form_input: ref="ref_1", value="test@example.com"

# Read console for errors
read_console_messages (tabId, pattern="error")

# Check network requests
read_network_requests (tabId, urlPattern="/api/")

# Navigate
navigate: url="http://localhost:3000/posts"
```

### Exploratory Test Workflow

1. **Start a session**: `tabs_context_mcp` to get the tab group
2. **Navigate to each major route** and screenshot
3. **Check for console errors** after each navigation
4. **Test interactive elements**: forms, buttons, dropdowns
5. **Verify the chat bubble** appears on brochure pages
6. **Test responsive layouts** with `resize_window`
7. **Record GIF walkthroughs** for documentation

### Example: Smoke Test All Routes

Ask Claude to:
> "Navigate to each of these routes, take a screenshot, check for console errors, and report any issues: /, /posts, /shop, /events, /spaces, /login, /dashboard"

### Example: Chat Bubble Verification

Ask Claude to:
> "Go to the homepage, wait 3 seconds for auth to complete, then find the chat bubble element. Screenshot the bottom-right corner. Is it visible?"

---

## Part 5: Running Longer Automated UX Tests

### Approach 1: Playwright Test Suites (Recommended for CI)

Create comprehensive test suites that run in CI:

```bash
# Run full smoke test across all routes
npx playwright test tests/e2e/brochure.e2e.spec.ts --reporter=html

# Run with tracing for failed tests
npx playwright test --trace on-first-retry

# Run in multiple browsers
npx playwright test --project=chromium --project=firefox

# Run with video recording
npx playwright test --video=retain-on-failure
```

### Approach 2: Playwright Test Generator (For writing new tests fast)

```bash
# Record actions in the browser and generate test code
npx playwright codegen http://localhost:3000

# Record with authenticated session
npx playwright codegen --load-storage=tests/e2e/.auth/user.json http://localhost:3000/dashboard
```

This opens a browser where your clicks/types are recorded as Playwright test code.

### Approach 3: Visual Regression with Playwright Screenshots

```typescript
test('homepage visual regression', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000)
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixelRatio: 0.05,
  })
})
```

First run creates baseline screenshots. Subsequent runs compare against them.

### Approach 4: Accessibility Testing

```typescript
import AxeBuilder from '@axe-core/playwright'

test('homepage has no accessibility violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
```

Install: `pnpm add -D @axe-core/playwright`

### Approach 5: Performance Budgets

```typescript
test('homepage loads within performance budget', async ({ page }) => {
  const start = Date.now()
  await page.goto('/', { waitUntil: 'networkidle' })
  const loadTime = Date.now() - start
  expect(loadTime).toBeLessThan(5000) // 5 second budget
})
```

---

## Part 6: CI Integration

Add to your GitHub Actions workflow:

```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps chromium

- name: Seed test database
  run: pnpm seed:dev

- name: Run E2E tests
  run: pnpm test:e2e
  env:
    DATABASE_URI: ${{ secrets.DATABASE_URI }}
```

The `playwright.config.ts` already handles:
- Auto-starting the dev server (`webServer.command: 'pnpm dev'`)
- Reusing existing servers (`reuseExistingServer: true`)
- CI-specific retries (3 retries on CI, 1 locally)
- Single worker on CI to avoid resource contention

---

## Quick Reference

| Task | Command |
|------|---------|
| Run all tests | `pnpm test` |
| Run unit tests only | `pnpm test:unit` |
| Run E2E tests only | `pnpm test:e2e` |
| Run E2E in headed mode | `npx playwright test --headed` |
| Interactive test UI | `npx playwright test --ui` |
| Record new test | `npx playwright codegen http://localhost:3000` |
| View test report | `npx playwright show-report` |
| Debug single test | `npx playwright test --debug <file>` |
| Update snapshots | `npx playwright test --update-snapshots` |
| Kill orphaned dev server | `powershell -Command "Get-Process node -ErrorAction SilentlyContinue \| Stop-Process"` |
