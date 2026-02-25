# Angel OS — Session Handoff: Sprint 20 Complete

**Date:** February 25, 2026
**Branch:** `feat/sprint-20-federation-launch` → merging to `main`
**Status:** TypeScript clean, 1,330 tests passing (31 files), 46 API endpoints, 33 collections
**Sprint:** Sprint 20 complete (Federation Launch Campaign) — Sprint 21 next
**Stack:** Payload 3.77.0 + Next.js 16.1.6 + React 19.2.1 + Claude Sonnet 4 + Turbopack
**Last commits:**
- `53af43c` — Sidebar chat fixes (default to LEO DM, skip truncation)
- `8bcaa63` — Vapi phone setup endpoint + webhook secret validation

---

## Critical Context: Federation Launch Campaign (Sprint 20)

**Read this first.** Sprint 20 delivered the federation-facing infrastructure for Angel OS:

### StreetSigns Collection (NEW)
- **File:** `src/collections/StreetSigns/index.ts`
- Cross-holon content references for federation marketplace discovery
- Fields: title, description, contentType (product/post/event/endeavor/portfolio/service), source diocese info (name, domain, federationId, contentId, contentUrl, creatorName), tags, holonTypes, region, thumbnail, price/currency, status, impressions, clickThroughs, lastSyncedAt, expiresAt
- Access: public read, authenticated create/update, admin delete
- Registered in multi-tenant plugin for proper tenant scoping

### Federation Election Endpoints (NEW)
- **File:** `src/endpoints/federation-election.ts`
- POST/GET `/api/federation/election`
- Supermajority (⅔) governance: propose amendments to constitution, revenue pool, holon types, membership revocation, coordinator succession
- Ed25519 signature verification on all votes
- Toward-53 floor enforcement: endeavor share must stay ≥ 53%
- In-memory store (production: persist to collection)

### Federation Suitcase Endpoints (NEW)
- **File:** `src/endpoints/federation-suitcase.ts`
- POST `/api/federation/suitcase/export` — Packs full tenant data: spaces, channels, messages, posts, products, media, bookings, orders, users, endeavor. Returns SuitcaseManifest with SHA-256 checksum
- POST `/api/federation/suitcase/import` — Verifies constitutional compliance (isAngel + antiDemonic), imports in dependency order, audit logs
- Implements Article VI constitutional right of data portability

### Federation Admin Dashboard (NEW)
- **File:** `src/app/[locale]/(dashboard)/dashboard/admin/federation/FederationDashboard.tsx`
- 4-tab dashboard: Overview (stats grid, constitution status, Toward-53 visualization), Street Signs (marketplace listing), Governance (active proposals + history), Suitcase (export/import controls)
- Server component wrapper at `page.tsx`

### Endeavors Enhancement
- **File:** `src/collections/Endeavors/index.ts` (modified)
- Added `holonTypes` multi-select: manufacturer, retailer, creator, community, guardian-angel
- Added `missionStatement` textarea

### Config Updates
- **File:** `src/payload.config.ts` (modified)
- StreetSigns registered in collections
- `endeavors` + `street-signs` added to multi-tenant plugin
- 4 new endpoint registrations (election POST/GET, suitcase export/import)

---

## Bug Fixed During Sprint 20

### Suitcase Export: "The following path cannot be queried: tenant"
- **Root cause:** `endeavors` collection was not registered in the multi-tenant plugin's collections config, so it had no auto-added `tenant` field
- **Fix:** Added `endeavors: {}` to multi-tenant plugin collections in `payload.config.ts`
- **Verified:** Suitcase export now successfully packs all tenant data (tested with `hays-cactus` tenant: 3 spaces, 8 channels, 4 messages, 4 posts, 3 products)

---

## What's Next (Sprint 21)

### Priority 1 — Federation Dashboard Auth + Visual Polish
- Dashboard redirects to login — needs auth check or public route
- Visual verification of the 4-tab dashboard UI

### Priority 2 — npx create-angel-enterprise
- One-command installer scaffold (Issue #95, #96)
- Leo Wizard 8-step flow (Issue #94)

### Priority 3 — Customer Angel Token UI
- Order detail page with token status banners (amber=active, green=redeemed)
- Configuration display, Cancel & Refund button

### Priority 4 — Federation Audit Log Collection
- Election and suitcase endpoints write to `federation-audit-log` (currently `as any` — needs real collection)
- Structured logging: action, federationId, details, timestamp

### Priority 5 — Street Signs Sync Protocol
- Gossip-style sync between federated nodes
- Periodic refresh of cross-holon content references

---

## Known Issues

### Pre-existing Test Failures (18 tests)
**File:** `tests/unit/utilities/ultimateFairSplit.test.ts`
- 18 failing tests related to transparency report percentages and ecosystem health labels
- Pre-existing from Sprint 18 — NOT caused by Sprint 20 changes
- All 188 federation tests pass ✓

### LiveKit Voice Tab Not Visible in Production
**NOT a code bug.** The voice applet is correctly filtered out when `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `NEXT_PUBLIC_LIVEKIT_URL` are not set.

### Stripe Webhook Not Yet Configured
Webhook endpoint needs creation in Stripe Dashboard. `STRIPE_WEBHOOKS_SIGNING_SECRET` still needed on Vercel.

### Election Store is In-Memory
`federation-election.ts` uses an in-memory `Map` for proposals. Production needs persistence to a Payload collection or external store. Proposals are lost on server restart.

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

**New API Endpoints (Sprint 20):**
- `POST /api/federation/election` — Propose or vote on governance amendments
- `GET  /api/federation/election` — List proposals (filter by status)
- `POST /api/federation/suitcase/export` — Pack full tenant suitcase
- `POST /api/federation/suitcase/import` — Unpack suitcase into target tenant

---

*"Listen to everything. Judge nothing. Hold lightly."*
*— Kenneth, Enterprise operator, Clearwater Cruisin*
