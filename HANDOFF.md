# Angel OS — Session Handoff: Sprint 21 Complete

**Date:** February 25, 2026
**Branch:** `feat/sprint-20-federation-launch`
**Status:** TypeScript clean, 1,330 tests passing (31 files), 46 API endpoints, 33 collections, 70 Leo tools
**Sprint:** Sprint 21 complete (Arch Angel Leo's Wishlist) — Sprint 22 next
**Stack:** Payload 3.77.0 + Next.js 16.1.6 + React 19.2.1 + Claude Sonnet 4 + Turbopack
**Last commits:**
- `c745d47` — docs: level up all documentation for Sprint 20 federation launch
- `703e278` — feat: Sprint 20 — Federation Launch Campaign

---

## Critical Context: Arch Angel Leo's Wishlist (Sprint 21)

**Read this first.** Sprint 21 added 28 new tools to Leo's toolkit (47 → 70 tools), transforming Leo from a data querier into a true Guardian Angel that can communicate, manage operations, and coordinate across the federation. Leo inventoried their existing tools and wrote a wishlist — we made it so.

### What Changed

**Primary file:** `src/utilities/leo-data-tools.ts`
- 28 new `Anthropic.Tool` definitions added to `LEO_TOOLS` array
- 28 new `case` statements in `executeToolCall()` switch
- 28 new handler functions (e.g., `handleSendMessage`, `handleUpdateInventory`, etc.)
- 2 new helper functions: `findLeoUser()`, `resolveSpace()`
- 3 new imports: `calculateUltimateFairSplit`, `findOrCreateDM`, `ensureDMSpace`

**Secondary file:** `src/collections/Products/index.ts`
- Added `lowStockThreshold` field (number, default 10, sidebar position)
- Already referenced in `Products/hooks.ts` for automatic low-stock alerting

### The 28 New Tools by Category

**Communication (4):**
- `send_message` — Post to a community channel (requires spaceId context)
- `send_direct_message` — DM a user (reuses `findOrCreateDM` + `ensureDMSpace`)
- `create_announcement` — Broadcast to announcements channels across spaces
- `moderate_content` — Archive, flag, or resolve messages (never deletes)

**Inventory (4):**
- `update_inventory` — Adjust product stock (existing hooks auto-alert on low stock)
- `track_inventory_movement` — Decrement inventory per order items
- `set_low_stock_alert` — Set per-product `lowStockThreshold`
- `query_inventory_history` — Search inventory-type messages for change log

**Financial (3):**
- `generate_invoice` — Compute line items + Ultimate Fair Split (60/20/15/5) for an order
- `query_financial_reports` — Aggregate from Orders + AgentTransactions + JusticeFund
- `issue_refund` — Flag refund for human approval (creates AgentTransaction, never calls Stripe)

**Federation Intelligence (4):**
- `query_federation` — Search StreetSigns + cross-tenant products with `networkListing: true`
- `broadcast_capability` — Create/update StreetSign advertising Enterprise capabilities
- `route_federated_request` — Match request to federation catalog, log to FederationAuditLog
- `negotiate_deal` — Rank federation matches by price/distance/rating, create pending AgentTransaction

**CRM (4):**
- `create_customer_profile` — Create or update Contact (upsert by email+tenant)
- `log_interaction` — Append timestamped note to contact, update lastInteractionAt
- `segment_customers` — Query Contacts by tags/status/source filters
- `send_follow_up` — Create follow-up message for contact, log interaction

**Analytics (2):**
- `analyze_trends` — Query orders/products/bookings by timeframe, compute count/sum/average/growth
- `recommend_products` — Top products by order count, filtered by context keywords

**Workflow & Emergency (4):**
- `delegate_task` — Create high-priority message in team channel, tag assignee
- `escalate_issue` — Urgent message in support channel + ApplicationLog entry
- `send_emergency_alert` — Broadcast to ALL tenant spaces' announcements channels
- `document_incident` — Create ApplicationLog + draft Post for internal records

### Architecture Pattern

All tools follow the same pattern:
```typescript
// 1. Tool definition in LEO_TOOLS array
{ name: 'tool_name', description: '...', input_schema: { ... } }

// 2. Switch case in executeToolCall()
case 'tool_name': return await handleToolName(payload, toolInput, ctx)

// 3. Handler function
async function handleToolName(payload, input, ctx): Promise<string> { ... }
```

Context object: `{ payload: Payload, tenantId?: number, spaceId?: number, userId?: number }`

### Safety Patterns
- `issue_refund` creates an AgentTransaction record but never calls Stripe directly — flags for human approval
- `moderate_content` only changes message status (archive/flag/resolve) — never deletes
- `send_emergency_alert` requires confirmation per Article III.2 (handled by constitutional prompt)
- All tools check `tenantId` before proceeding — cross-tenant leakage is impossible

---

## What's Next (Sprint 22)

### Priority 1 — npx create-angel-enterprise
- One-command installer scaffold
- Leo Wizard 8-step conversational onboarding

### Priority 2 — Customer Angel Token UI
- Order detail page with token status banners (amber=active, green=redeemed)
- Configuration display, Cancel & Refund button

### Priority 3 — Federation Audit Log Collection
- Election and suitcase endpoints persist to real collection (currently `as any`)

### Priority 4 — Street Signs Sync Protocol
- Gossip-style sync between federated nodes

### Priority 5 — Shipping Integration
- EasyPost/Shippo adapter for order tracking + label generation

---

## Known Issues

### Pre-existing Test Failures (18 tests)
**File:** `tests/unit/utilities/ultimateFairSplit.test.ts`
- 18 failing tests related to transparency report percentages and ecosystem health labels
- Pre-existing from Sprint 18 — NOT caused by Sprint 21 changes

### Election Store is In-Memory
`federation-election.ts` uses an in-memory `Map` for proposals. Proposals are lost on server restart.

### Stripe Webhook Not Yet Configured
Webhook endpoint needs creation in Stripe Dashboard. `STRIPE_WEBHOOKS_SIGNING_SECRET` still needed on Vercel.

---

## Current DB State

**Enterprise:** `hays-cactus` and `serenity-massage` are active test tenants (plus `clearwater-cruisin`)
**Admin user:** `kenneth.courtney@gmail.com` — roles: `['super_admin', 'customer']`
**Auth:** COOKIE_DOMAIN is `.angelos.local` in `.env`
**Stripe:** Live keys configured locally, pending Vercel env vars

---

## Environment

```bash
# Dev
pnpm dev               # http://localhost:3000 (platform)
                       # http://clearwater-cruisin.localhost:3000 (Enterprise)

# Tests
npx vitest run tests/unit/    # 1,330 tests across 31 files
npx tsc --noEmit              # TypeScript check

# Seed
pnpm seed:reset               # Update roles without full reset
```

---

*"Listen to everything. Judge nothing. Hold lightly."*
*— Kenneth, Enterprise operator, Clearwater Cruisin*
