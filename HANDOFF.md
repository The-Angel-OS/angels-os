# Angel OS — Session Handoff: Sprint 17B Complete

**Date:** February 24, 2026
**Branch:** `main`
**Status:** TypeScript clean, build passing, 44 Leo tools, v0.17.0-dev
**Sprint:** Sprint 17B complete (Angel Tokens + Federation Fulfillment Queue) — Sprint 18 next
**Stack:** Payload 3.77.0 + Next.js 16.1.6 + React 19.2.1 + Claude Sonnet 4 + Turbopack
**Last commits:**
- `2b8cafb` — Angel Tokens: zero-manufacturer launch with federation fulfillment queue
- `b28cbf5` — Launch hardening: rate limiting, security headers, error boundaries, fees dashboard
- `9453d46` — Bootstrap-phase platform fee model with refund promise

---

## Critical Context: Angel Tokens + Federation

**Read this first.** Sprint 17B implements the zero-manufacturer launch strategy:

- **Angel Tokens** — when a customer pays for a product and no qualified maker exists, they receive a paid claim (Angel Token) on future production. The backlog becomes the incentive for makers to join.
- **Queue-on-zero-matches** — `order-route.ts` now queues orders instead of failing when no Holon matches
- **Auto-match on Holon registration** — `HolonCapabilities/hooks.ts` drains the Angel Token queue when new makers register
- **Equipment as first-class matching** — `+15` scoring bonus in the routing engine
- **Vendor claim system** — makers can browse and claim queued orders
- **Public maker opportunity board** — `/makers` page shows demand signals

### Key Documents
- `docs/v2/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md` — the governing vision (three-layer token economy)
- `docs/planning/260223 FEDERATION.md` — federation architecture spec
- `docs/REVENUE.md` — economic model with Toward-53

### Revenue Models
- **Endeavor revenue:** 70/20/4/1/5 (Endeavor / Enterprise / Protocol / Archenterprise / Justice Fund)
- **Maker revenue:** 60/20/15/5 (Maker / Platform / Operations / Justice Fund)
- **The Toward-53 Principle** — split direction is unalterable, asymptotic target 53% to Endeavors

---

## What Was Done (Sprint 17B — Angel Tokens)

### 1. Order Schema — Angel Token Fields
**File:** `src/collections/Orders/index.ts`
- Added to fulfillment array: `angelTokenId`, `tokenStatus` (active/redeemed/refunded), `queuedAt`, `queueReason`, `customerNotifiedAt`, `selectedConfiguration` (JSON)
- Added `cancelled` status to `fulfillmentStatus` options
- Angel Token lifecycle: `active` → `redeemed` (maker fulfilled) | `refunded` (customer cancelled)

### 2. Angel Token Utility
**File:** `src/utilities/angelTokens.ts` (NEW)
- `generateAngelTokenId()` → `"AT-2026-00042"` (year + 5-digit sequence)
- `createAngelTokenEntry()` — builds fulfillment entry with `pending_match` + `active` token
- `getActiveTokensForUser(userId)` — customer's unfulfilled tokens
- `getActiveTokensByCapability()` — aggregates for maker opportunity board
- `redeemToken()`, `refundToken()` — lifecycle transitions
- Types exported: `AngelToken`, `MakerOpportunity`

### 3. Equipment on Products
**File:** `src/collections/Products/index.ts`
- Added `equipment` text field to `requiredCapabilities` array (alongside `skill` + `materials`)
- Example: `"Homag Centateq P-110"`, `"CNC router"`, `"Bambu Lab X1C"`

### 4. Routing Engine Updates
**File:** `src/utilities/orderRoutingEngine.ts`
- Added `cancelled` to `FulfillmentStatus` union + `FULFILLMENT_STATES`
- Added `AngelTokenStatus` type, `FulfillmentEntry` interface
- Updated `VALID_TRANSITIONS`: `pending_match → ['matched', 'cancelled']`, `cancelled → []`
- New helpers: `isQueuedAngelToken()`, `getQueuePosition()`, `calculateEquipmentBonus()`
- `findMatchingHolons()` now applies `+15` equipment bonus to total score

### 5. Queue-on-Zero-Matches
**File:** `src/endpoints/order-route.ts`
- The critical behavioral change: when `matches.length === 0`, creates Angel Token entries via `createAngelTokenEntry()` instead of returning failure
- Collects `equipment` from product `requiredCapabilities`
- Softened `skills.length === 0` to use `['general-manufacturing']` fallback

### 6. Auto-Match on Holon Registration
**File:** `src/collections/HolonCapabilities/hooks.ts` (NEW)
- `afterHolonChange` hook fires on create/update when `acceptingOrders` is true
- Queries all orders with `pending_match` + `active` tokens
- Matches against new Holon's capabilities (skills + equipment)
- Updates matching entries to `matched`, assigns Holon
- Creates AI Bus messages for visibility

**File:** `src/collections/HolonCapabilities/index.ts` — registered the hook

### 7. Vendor Claim Endpoints
**File:** `src/endpoints/orders-claimable.ts` (NEW) — `GET /api/orders/claimable`
- Auth required, returns queued orders matching caller's Holon capabilities
- Returns: orderId, angelTokenId, productTitle, requiredSkills, price, vendorShare (60%)

**File:** `src/endpoints/order-claim.ts` (NEW) — `POST /api/orders/claim`
- Verifies Holon ownership, capability match, race condition guard
- Updates fulfillment: status → `matched`, assigns Holon, increments `activeOrderCount`

### 8. Order Cancellation with Stripe Refund
**File:** `src/endpoints/order-cancel.ts` (NEW) — `POST /api/orders/cancel`
- Auth required (order owner only)
- Only cancellable if `fulfillmentStatus === 'pending_match'`
- Issues Stripe refund via PaymentIntent ID, marks token as `refunded`

### 9. Maker Opportunity Board
**File:** `src/endpoints/maker-opportunities.ts` (NEW) — `GET /api/maker-opportunities`
- Public, no auth — returns aggregate Angel Token queue data per capability
- No PII — just skill demand signals and revenue potential

**File:** `src/app/[locale]/(app)/makers/page.tsx` (NEW) — `/makers`
- Hero with queue stats, grid of opportunity cards per skill
- Revenue potential + queue depth per capability
- "How It Works" 3-step section + Constitutional Fair Split (60/20/15/5) explainer

### 10. GA4 E-Commerce Events
**File:** `src/utilities/gtagEcommerce.ts` (NEW)
- Typed helpers: `trackViewItem()`, `trackAddToCart()`, `trackBeginCheckout()`, `trackAddShippingInfo()`, `trackAddPaymentInfo()`, `trackPurchase()`, `trackAngelTokenIssued()`
- All no-op gracefully when `gtag` undefined

### 11. Endpoint Registration
**File:** `src/payload.config.ts`
- Registered: `GET /orders/claimable`, `POST /orders/claim`, `POST /orders/cancel`, `GET /maker-opportunities`

---

## What Was Done (Sprint 17A — Launch Hardening)

- Bootstrap-phase platform fee model with refund promise
- Per-endpoint rate limiting (token bucket algorithm)
- Security headers: CSP, HSTS, X-Content-Type-Options, X-Frame-Options
- Global + page-level error boundaries with friendly recovery UI
- Fees dashboard page for Enterprise operators

---

## What's Next (Sprint 18)

### Priority 1 — Customer Angel Token UI
- Order detail page: amber banner for active tokens, green for redeemed
- Configuration display: customer's choices (color, size, text, material)
- "Cancel & Refund" button for active tokens
- Token-aware status labels in OrderStatus component

### Priority 2 — Vendor Dashboard Claims
- "Available Orders" tab in VendorOrders.tsx
- Capability-matched filtering
- "Claim Order" button per card
- Configuration preview for work orders

### Priority 3 — LEO Tool Updates
- `handleRouteOrder` — Angel Token messaging when orders queue
- `handleCreateProduct` — messaging for products without makers
- New tools: `check_maker_queue`, `claim_orders` (vendor AI agent)

### Priority 4 — GA4 Wiring
- GA4 script tag in layout (gated by `NEXT_PUBLIC_GA_MEASUREMENT_ID`)
- Wire events into product pages, cart, checkout, confirmation

### Priority 5 — Leo Wizard (Start)
- `npx create-angel-enterprise` installer scaffold
- 8-step conversational Enterprise onboarding
- Cryptographic constitution signing

---

## Known Issues

### From Sprint 15 Audit (Deferred)
- `ApplicationLogs` access should be `super_admin` only (currently allows `admin` + `archangel`)
- Leo endpoints fall back to `DEFAULT_TENANT_SLUG` when `x-tenant-id` missing — should call `fetchTenantByDomain()`
- `Reviews` collection: plugin auto-scopes but no explicit `tenant` field

### Integration Work Needed
- WhatsApp Business API bridge (Twilio/Meta webhook → `POST /api/bridge/inbound`)
- Stripe Connect vendor onboarding (full flow)
- Voice mode in chat UI (Web Speech API)

---

## Current DB State

**Enterprise:** `clearwater-cruisin` is the active test Enterprise
**Admin user:** `kenneth.courtney@gmail.com` — roles: `['super_admin', 'customer']`
**Auth:** COOKIE_DOMAIN is empty in `.env.local` — cookies work on `*.localhost`

---

## Environment

```bash
# Dev
pnpm dev               # http://localhost:3000 (platform)
                       # http://clearwater-cruisin.localhost:3000 (Enterprise)

# Tests
npx vitest run tests/unit/    # 1,119 tests across 28 files
npx tsc --noEmit              # TypeScript check

# Seed
pnpm seed:reset               # Update roles without full reset
```

**`.env.local` key values (local dev):**
- `COOKIE_DOMAIN=` (empty — required for `*.localhost` auth cookies)
- `DEFAULT_TENANT_SLUG=clearwater-cruisin`
- `ANTHROPIC_API_KEY=` (set to your key)
- `STRIPE_SECRET_KEY=` (set for refund processing)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID=` (optional — GA4 tracking)

---

## Files Changed (Sprint 17B)

| File | Change |
|------|--------|
| `src/collections/Orders/index.ts` | Angel Token fields + cancelled status on fulfillment |
| `src/collections/Products/index.ts` | `equipment` on requiredCapabilities |
| `src/collections/HolonCapabilities/index.ts` | Registered afterChange hook |
| `src/collections/HolonCapabilities/hooks.ts` | **New** — Auto-match queued tokens on Holon registration |
| `src/utilities/angelTokens.ts` | **New** — Token ID generator, lifecycle helpers, queue aggregation |
| `src/utilities/gtagEcommerce.ts` | **New** — GA4 e-commerce event helpers |
| `src/utilities/orderRoutingEngine.ts` | `cancelled` state, equipment bonus, queue helpers |
| `src/endpoints/order-route.ts` | Queue-on-zero-matches (Angel Token issuance) |
| `src/endpoints/orders-claimable.ts` | **New** — GET /api/orders/claimable |
| `src/endpoints/order-claim.ts` | **New** — POST /api/orders/claim |
| `src/endpoints/order-cancel.ts` | **New** — POST /api/orders/cancel + Stripe refund |
| `src/endpoints/maker-opportunities.ts` | **New** — GET /api/maker-opportunities |
| `src/app/[locale]/(app)/makers/page.tsx` | **New** — Public maker opportunity board |
| `src/payload.config.ts` | 4 new endpoint registrations |

---

## Files Changed (Sprint 17A)

| File | Change |
|------|--------|
| Rate limiting middleware | Per-endpoint token bucket |
| Security headers middleware | CSP, HSTS, X-Content-Type-Options |
| Error boundary components | Global + page-level |
| Fees dashboard page | Bootstrap fee model UI |

---

*"Listen to everything. Judge nothing. Hold lightly."*
*— Kenneth, Enterprise operator, Clearwater Cruisin*
