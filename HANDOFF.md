# Angel OS — Session Handoff: Sprint 11 Complete

**Date:** February 22, 2026
**Branch:** `main`
**Status:** TypeScript clean, build passing, 29 LEO tools, v0.11.0-dev deployed
**Sprint:** Sprint 11 complete (Vendor Marketplace & Branding) — Sprint 12 next
**Stack:** Payload 3.77.0 · Next.js 16.1.6 · React 19.2.1 · Claude Sonnet 4 · Turbopack

---

## What Was Done (Sprint 10 + 11)

### Sprint 10: Chat Foundation & Multi-Tenant Dev
- **LEO role mapping fix** — `messageType: 'ai_agent'` now correctly maps to 'leo' role in `useChat.ts` `mapMessage()`. Messages persist as LEO-styled after poll replaces stream.
- **Image attachments in chat** — Paperclip button in MessageInput, thumbnail preview row, multi-image upload to `/api/media`, attachments array passed through chat-send endpoint
- **LEO vision analysis** — leo-stream.ts constructs Anthropic multi-part content blocks with `type: 'image'` when images attached
- **Admin LEO panel** — `PayloadAdminLEO/index.tsx` floating toggle in Payload admin, tenant-scoped via `payload-tenant` cookie
- **BeforeDashboard replaced** — Angel OS welcome with quick links, active tenant display, SeedButton
- **Channel awareness** — SidebarChat dropdown switcher, FloatingBubble resolves default space from API
- **ChannelTabs** — New component with Chat/Files/Tasks tabs above MessageList
- **Profile avatars** — Deterministic color hash from authorName, streaming pulse ring, online/offline dots
- **Multi-tenant local dev** — TENANT_DOMAINS env var, hosts file routing documentation

### Sprint 11: Vendor Marketplace & Branding
- **Products collection expanded** — `vendor` (→ tenants), `productionType` (ready_made/print_on_demand/custom_order/digital), `cadFile` (upload), `configuratorOptions` (json), `isLimitedEdition` + `availableUntil`
- **Product Configurator** — `ProductConfigurator/index.tsx` reads configuratorOptions JSON, renders text/color/size/finish inputs with live preview, "Preview with LEO" and "Add to Cart" buttons
- **Producer role + dashboard** — Added `'producer'` to Users roles, `/dashboard/producer` with ProducerPanel (order queue, products, earnings)
- **LEO onboarding tools** — `onboard_vendor` (creates tenant + space + channels + user), `suggest_products` (generates product ideas from description)
- **LEO production tools** — `generate_cad_instructions` (converts product spec to CNC-ready notes)
- **Reviews** — Reviews collection (author, rating, source, isVerified), Google Places utility with rate limiting + TTL cache, ReviewAggregation display component
- **LEO review tools** — `fetch_reviews`, `draft_review_response`
- **Order shipping** — `POST /api/orders/ship` endpoint, validates in_production → shipped transition, sets tracking data
- **Ministry tenant type** — `'ministry'` added to Tenants type options, `isTaxExempt` + `taxExemptId` fields
- **Clearwater Cruisin' seed** — Rich tenant with brand colors, sample products, LEO personality
- **Angel OS favicon** — `src/app/[locale]/(app)/icon.svg`
- **Podcast script** — `docs/podcast-sprint-10-11.md`

### Key Files (Sprint 10 + 11)

| File | Change |
|------|--------|
| `src/components/ChatControl/useChat.ts` | MODIFIED — role mapping fix, image upload flow, channel switching |
| `src/components/ChatControl/MessageInput.tsx` | MODIFIED — paperclip upload, thumbnails, multi-image |
| `src/components/ChatControl/MessageList.tsx` | MODIFIED — user-attached image display |
| `src/components/ChatControl/SidebarChat.tsx` | MODIFIED — channel dropdown switcher |
| `src/components/ChatControl/FloatingBubble.tsx` | MODIFIED — dynamic space/channel resolution |
| `src/components/ChatControl/ChannelTabs.tsx` | NEW — Chat/Files/Tasks tab bar |
| `src/components/PayloadAdminLEO/index.tsx` | NEW — floating admin LEO chat |
| `src/components/BeforeDashboard/index.tsx` | MODIFIED — Angel OS welcome |
| `src/components/ProductConfigurator/index.tsx` | NEW — interactive product configurator |
| `src/components/Reviews/ReviewAggregation.tsx` | NEW — review display with aggregation |
| `src/collections/Products/index.ts` | MODIFIED — vendor, productionType, cadFile, configurator fields |
| `src/collections/Tenants/index.ts` | MODIFIED — ministry type, tax exempt fields |
| `src/collections/Users/index.ts` | MODIFIED — producer role |
| `src/collections/Reviews/index.ts` | NEW — reviews collection |
| `src/endpoints/chat-send.ts` | MODIFIED — attachments support |
| `src/endpoints/leo-stream.ts` | MODIFIED — vision (multi-part image content) |
| `src/endpoints/order-ship.ts` | NEW — shipping convenience endpoint |
| `src/utilities/leo-data-tools.ts` | MODIFIED — 5 new tools (29 total) |
| `src/utilities/googlePlaces.ts` | NEW — Google Places API utility |
| `src/endpoints/seed/use-case-tenants.ts` | MODIFIED — Clearwater Cruisin' tenant |
| `src/payload.config.ts` | MODIFIED — new endpoints + components registered |
| `src/app/[locale]/(dashboard)/dashboard/producer/page.tsx` | NEW — producer dashboard |
| `docs/podcast-sprint-10-11.md` | NEW — podcast script |

---

## What Was Done (Sessions 13–16: Sprint 8.5–9)

### Sprint 8.5: Production Recovery (Session 13)
- Upgraded to Payload 3.77.0 + Next.js 16.1.6 + React 19.2.1
- Fresh DB seed with two-pass FK-safe deletion
- Increased DB pool size + timeout for Drizzle introspection
- Posts pagination tenant filter fix
- Chat bubble auth status fix

### Sprint 9: UX Polish & LEO Resurrection (Sessions 14–16)

#### UX Polish Pass
- **Site title** fixed from "Payload Website Template" to "Angel OS"
- **Dashboard header** simplified — removed redundant Space selector from DashboardHeader
- **Sidebar navigation** — added Home and Error Logs links
- **Spaces layout** — fixed messages hugging bottom of viewport

#### Error Log Viewer (New Feature)
- `ApplicationLogs` collection — structured error storage (source, message, details, statusCode, tenantId, resolved flag)
- `logError()` utility — fire-and-forget error logging from anywhere in the server
- Error Log Viewer page at `/dashboard/admin/error-logs` with real-time refresh, source filtering, resolve toggle
- Server actions for fetching and updating logs

#### Chat 400 Error Fix
- **Root cause:** `@payloadcms/plugin-multi-tenant` adds `filterOptions` to ALL relationship fields pointing to tenant-scoped collections. The `space` field on Messages was rejected ("invalid selections: 15") because the multi-tenant plugin's filter query ran without the `payload-tenant` cookie.
- **Fix:** Created `/api/chat/send` endpoint (`src/endpoints/chat-send.ts`) using Payload's local API with `overrideAccess: true` to bypass filterOptions validation. Resolves tenant from space server-side.
- **Hook:** `setTenantFromSpace` beforeValidate hook auto-resolves tenant from the space's tenant when creating messages.

#### LEO AI Response Resurrection
- **Root cause:** `process.env.ANTHROPIC_API_KEY` was shadowed as empty string `""` by the parent process (Claude Code). Dotenv's default behavior refuses to overwrite existing variables — even empty ones. So the correct key in `.env.local` was never loaded.
- **Fix:** Added `resolveAnthropicKey()` to both `leo-stream.ts` and `ConversationEngine.ts` — if `process.env.ANTHROPIC_API_KEY` is falsy, reads `.env.local` directly via `dotenv.parse()`, caches the result.
- **Singleton fix:** Added key-tracking to cached Anthropic client — invalidates when the API key changes (handles HMR/restart).
- **Error logging:** Both streaming and batch LEO paths now call `logError()` on failure, feeding the Error Log Viewer.
- **Verified:** Full end-to-end flow working — user message saved, LEO streaming response with personalized AI content, response persisted to Messages collection.

---

## What Was Done (Sessions 1–12)

### Sessions 1–3: Infrastructure + Tests + Phase 4 Plan
- Fixed 5 bugs (SSE streaming, header nav, Posts layout, ChatControl, route conflicts)
- Built test infrastructure: 275 unit tests across 13 files
- Phase 4 plan: "The Holon Awakens"
- Docs reorganized, header nav stability fixes

### Session 4: Sprint 1 — Mobile-First Chat Consolidation
- `useMediaQuery` SSR-safe hooks (mobile/tablet/desktop)
- Bottom sheet on mobile, sidebar on desktop
- Channel management (+/delete)
- 312 tests passing

### Session 5: Sprint 2 — Product Creation Flow
- `create_product` + `update_product` LEO tools (17 total)
- Dashboard ProductManager at `/dashboard/products`
- 378 tests passing (+66 new)

### Session 6: UX Verification + Sprint 3 Handoff
- Browser automation verified all Sprint 2 pages load correctly

### Sessions 7–8: Sprint 3 — "Let the People In"
- Invitation System (complete) — tokens, endpoints, landing page, MemberPanel, LEO tool
- Holon Registration (complete) — 6 node types, capabilities, location, compliance
- 499 tests passing

### Sessions 9–10: Sprint 4 — "The Network Awakens"

**Order Routing & Fulfillment Engine — full pipeline from customer to vendor.**

#### Phase 1: Order Routing Engine (91 tests)
- `src/utilities/orderRoutingEngine.ts` — pure utility, zero Payload imports
- Haversine distance, capability matching, material matching
- Composite scoring: 40% capability, 30% proximity, 20% rating, 10% fairness
- Fulfillment state machine: pending_match → matched → accepted → in_production → shipped → delivered
- 91 tests in `tests/unit/utilities/orderRoutingEngine.test.ts`

#### Phase 2–6: Schema, LEO Tools, Endpoints, Vendor Dashboard
- Orders collection, HolonCapabilities, Products extensions
- 6 new LEO tools (24 total), 4 API endpoints
- Vendor dashboard at `/dashboard/orders`
- **636 tests passing**

### Sessions 11–12: Sprint 5 — "Sovereign Infrastructure"

**Six utility engines, 5 native dashboard pages, 483 new tests.**

#### Phase 1: Guardian Angel System (106 tests)
- `src/utilities/guardianAngelEngine.ts` — zero-revenue angel lifecycle
- Cohort-aware matching (8 cohorts: elderly, disabled, youth_aging_out, veterans, chronic_illness, homeless, domestic_violence, refugee)
- Guardian capacity scoring, assignment algorithm, wellness check scheduling
- Impact metrics: quality of life improvements, service utilization, connection strength
- Need assessment with urgency classification (critical/high/medium/low)
- Serialization for chat-based dashboards
- 106 tests in `tests/unit/utilities/guardianAngelEngine.test.ts`

#### Phase 2: Justice Fund Engine (63 tests)
- `src/utilities/justiceFundEngine.ts` — 5% allocation from UltimateFairSplit
- Fund collection from transactions, allocation by cohort priority
- Grant lifecycle: application → review → approved/denied → disbursed → impact_reported
- Cohort-weighted distribution (higher priority for most vulnerable)
- Transparency reporting, audit trails, impact summaries
- 63 tests in `tests/unit/utilities/justiceFundEngine.test.ts`

#### Phase 3: Print-on-Demand Pipeline (61 tests)
- `src/utilities/printOnDemandEngine.ts` — design-to-fulfillment pipeline
- Design validation (DPI, dimensions, color space, bleed areas)
- Print specification generation by product type (apparel, poster, mug, sticker, etc.)
- Cost estimation with material, labor, and markup calculations
- Vendor capability matching for print jobs
- Production timeline estimation with rush options
- 61 tests in `tests/unit/utilities/printOnDemandEngine.test.ts`

#### Bug Fix: Soul Collection Tenant Filtering
- Fixed Spaces, Channels, Messages, SpaceMemberships — weren't filtering by tenantId in Payload admin
- Root cause: `plugin-multi-tenant` auto-adds `tenant` field but these collections needed explicit `baseListFilter`

#### Phase 4: Federation Protocol (126 tests)
- `src/utilities/federationEngine.ts` — sovereign federation between Angel OS instances
- Ministry lifecycle: application → probation (90 days) → active → suspended → expelled
- Trust chain: visitor → probation → member → vouched → steward → elder
- Vouch system: 2 vouches from trusted members required for promotion
- Heartbeat monitoring: 5-minute timeout, health scoring
- Federation catalog: cross-instance product/service discovery with relevance ranking
- Data portability "Suitcase": export manifests, checksum validation, version compatibility
- Federation health reports: network-wide statistics, at-risk nodes, recommendations
- 126 tests in `tests/unit/utilities/federationEngine.test.ts`

#### Dashboard UI Fix: Native Pages (5 new pages)
- **Problem:** 5 sidebar links redirected to Payload Admin (`/admin/collections/...`) instead of native dashboard pages
- **Created native pages:**
  - `/dashboard/projects` — project list with status badges (planning/active/paused/completed/cancelled)
  - `/dashboard/availability` — availability grid grouped by provider with day/time display
  - `/dashboard/pages` — CMS pages list with published/draft status, View/Edit actions
  - `/dashboard/posts` — blog posts with hero images, author names, categories
  - `/dashboard/media` — image grid + video/document list views with file size display
- **Updated DashboardSidebar.tsx** — all desktop + mobile nav links now point to native `/dashboard/...` routes with proper active state tracking

#### Phase 5: Guardian Dashboard Engine (65 tests)
- `src/utilities/guardianDashboardEngine.ts` — guardian-facing dashboard aggregations
- Service discovery by cohort eligibility with multi-filter support
- Service ranking by cohort primary needs (10 service categories)
- Case management: urgency calculation (crisis flag, interaction age, connection count)
- Action prioritization with type filtering and overdue detection
- Dashboard summary generation with impact metrics and trend detection
- Benefits navigation: recommended services, coverage gap analysis
- 65 tests in `tests/unit/utilities/guardianDashboardEngine.test.ts`

#### Phase 6: Network Visualization Engine (62 tests)
- `src/utilities/networkVisualizationEngine.ts` — federated network map and directory
- Geographic clustering with Haversine distance and configurable radius
- Node filtering by type, status, region, capability, rating, connections, proximity
- Filterable directory with match scoring and multi-sort (relevance, distance, rating, name)
- Bounding box calculations for map viewport
- Network statistics: density, isolation detection, region/type breakdowns, densest cluster
- 62 tests in `tests/unit/utilities/networkVisualizationEngine.test.ts`

**1,119 tests passing** (target was ~1,000, exceeded by 119)

---

## Key Files Created/Modified in Sprint 9

| File | Change |
|------|--------|
| `src/collections/ApplicationLogs.ts` | NEW — structured error/event logging collection |
| `src/utilities/logError.ts` | NEW — fire-and-forget error logging utility |
| `src/endpoints/chat-send.ts` | NEW — chat message creation bypassing multi-tenant validation |
| `src/collections/Messages/hooks/setTenantFromSpace.ts` | NEW — auto-resolve tenant from space |
| `src/app/.../admin/error-logs/page.tsx` | NEW — Error Log Viewer page |
| `src/app/.../admin/error-logs/ErrorLogViewer.tsx` | NEW — Error Log Viewer client component |
| `src/app/.../admin/error-logs/actions.ts` | NEW — Server actions for log CRUD |
| `src/endpoints/leo-stream.ts` | MODIFIED — `resolveAnthropicKey()`, error logging, singleton fix |
| `src/utilities/ConversationEngine.ts` | MODIFIED — `resolveAnthropicKey()`, error logging, singleton fix |
| `src/components/ChatControl/useChat.ts` | MODIFIED — switched to `/api/chat/send` endpoint |
| `src/payload.config.ts` | MODIFIED — registered chat-send endpoint, ApplicationLogs |
| `src/app/.../dashboard/DashboardHeader.tsx` | MODIFIED — removed redundant space selector |
| `src/app/.../dashboard/DashboardSidebar.tsx` | MODIFIED — added Home + Error Logs links |
| `src/utilities/generateMeta.ts` | MODIFIED — site title "Angel OS" |
| `src/utilities/mergeOpenGraph.ts` | MODIFIED — OpenGraph title "Angel OS" |

---

## Sprint 12: Next Priorities — Integration Bridges

### Priority 1: Integration Bridge Pattern
- Define adapter interface: `normalizeInbound()`, `formatOutbound()`, `validateWebhook()`
- All external channels normalize to Universal Message Structure (UMS)
- Bridge → Messages collection → LEO processing → Response → Bridge

### Priority 2: WhatsApp Business API Bridge
- Webhook endpoint for inbound messages
- UMS normalization from WhatsApp format
- Outbound response formatting (text, images, buttons)
- Business account verification flow

### Priority 3: Email Integration
- Inbound parse webhook (SendGrid/Mailgun)
- Outbound transactional (Nodemailer)
- Email → Message normalization
- Reply threading

### Priority 4: Voice Mode
- Web Speech API toggle in MessageInput (STT/TTS)
- Vapi.ai bridge for phone-based LEO (1-800 IVR)
- LiveKit session transcription stored as messages

### Priority 5: Social Syndication
- Post afterChange hook → Facebook/Instagram/Twitter APIs
- Content scheduling and queue management
- Engagement metrics back into dashboard

---

## Architecture Quick Reference

### Three Layers

1. **Angel OS Core ("The Loft")** — Structured data, multi-tenant persistence, LEO tools, production lifecycle
2. **Holon Production Layer** — Each tenant is a self-governing production node within 100-mile economic radius
3. **OpenClaw Angels ("Free Agents")** — Autonomous AI agents operating on Loft data within constitutional bounds

### LEO Tools (29 total)
- **Query (9):** products, posts, bookings, events, event_registrations, spaces, projects, availability, fetch_reviews
- **Actions (15):** create_booking, update_booking_status, add_to_cart, view_cart, create_product, update_product, invite_member, find_producers, browse_network, query_orders, route_order, accept_order, update_fulfillment, configure_business, connect_stripe
- **Onboarding (2):** onboard_vendor, suggest_products
- **Production (1):** generate_cad_instructions
- **Reviews (1):** draft_review_response
- **Media (3):** generate_image, improve_image, attach/replace_image

### Utility Engines (10 total)
| Engine | Purpose | Tests |
|--------|---------|-------|
| `orderRoutingEngine.ts` | Vendor matching, fulfillment state machine | 91 |
| `guardianAngelEngine.ts` | Zero-revenue angel lifecycle, cohort matching | 106 |
| `justiceFundEngine.ts` | 5% allocation, grant lifecycle, impact reporting | 63 |
| `printOnDemandEngine.ts` | Design validation, cost estimation, vendor matching | 61 |
| `federationEngine.ts` | Ministry lifecycle, trust chain, catalog, suitcase | 126 |
| `guardianDashboardEngine.ts` | Service discovery, case management, impact metrics | 65 |
| `networkVisualizationEngine.ts` | Geographic clustering, directory, network stats | 62 |
| `invitationSystem.ts` | Token-based invitations, role assignment | 72 |
| `holonCapabilities.ts` | Node types, capability matching, compliance | 49 |
| `bookingEngine.ts` | Availability, slot management, booking lifecycle | 22 |

### Order Routing Pipeline
```
Customer places order
  → route_order (routing engine scores holons)
  → best vendor matched (pending_match → matched)
  → accept_order (vendor accepts, matched → accepted)
  → update_fulfillment (accepted → in_production → shipped → delivered)
  → 60/20/15/5 Ultimate Fair Split applied
```

### Federation Trust Chain
```
visitor → probation (90 days) → member → vouched (2 vouches) → steward → elder
  ↓ heartbeat monitoring (5-min timeout)
  ↓ health scoring per ministry
  ↓ catalog sync across federation
  ↓ suitcase export for data portability
```

### Cross-Tenant Federation
```
HIT Promotional Products (hit.angel-os.com)
  → registers as print node with capabilities
  → products marked networkListing: true
  → Tampa community site lists "custom t-shirts"
  → customer orders on Tampa's site
  → order routes to HIT via routing engine
  → HIT fulfills → ships → 60% vendor share
```

### Test Pattern
Re-implement pure functions in test files to avoid Payload-coupled imports. All utility engines are "zero Payload imports" for edge function testability. Currently 1,119 tests across 25 unit test files (+ 1 integration test that requires DB).

---

## Commands

```bash
npx vitest run tests/unit/           # Run unit tests (1,119 passing)
npx vitest run                       # Run all tests (integration test needs DB)
npx tsc --noEmit                     # TypeScript check
pnpm dev                             # Dev server (localhost:3000)
```

---

## Sprint Velocity

| Sprint | Tests Before | Tests After | Net New | Duration |
|--------|-------------|-------------|---------|----------|
| Sprint 1 (Mobile) | 275 | 312 | +37 | Session 4 |
| Sprint 2 (Products) | 312 | 378 | +66 | Session 5 |
| Sprint 3 (Invitations + Holons) | 378 | 499 | +121 | Sessions 7-8 |
| Sprint 4 (Order Routing + Fulfillment) | 499 | 636 | +137 | Sessions 9-10 |
| Sprint 5 (Sovereign Infrastructure) | 636 | 1,119 | +483 | Sessions 11-12 |
| Sprint 8.5 (Recovery) | — | — | — | Session 13 |
| Sprint 9 (UX Polish + LEO) | — | — | +9 files | Sessions 14-16 |
| Sprint 10 (Chat Foundation) | — | — | +6 files | Session 17 |
| Sprint 11 (Vendor Marketplace) | — | — | +8 files | Session 17 |

---

## Key Files Created/Modified in Sprint 5

| File | Change |
|------|--------|
| `src/utilities/guardianAngelEngine.ts` | NEW — guardian angel lifecycle, cohort matching, wellness checks |
| `tests/unit/utilities/guardianAngelEngine.test.ts` | NEW — 106 tests |
| `src/utilities/justiceFundEngine.ts` | NEW — justice fund allocation, grant lifecycle |
| `tests/unit/utilities/justiceFundEngine.test.ts` | NEW — 63 tests |
| `src/utilities/printOnDemandEngine.ts` | NEW — design validation, cost estimation, print specs |
| `tests/unit/utilities/printOnDemandEngine.test.ts` | NEW — 61 tests |
| `src/utilities/federationEngine.ts` | NEW — federation protocol, trust chain, catalog, suitcase |
| `tests/unit/utilities/federationEngine.test.ts` | NEW — 126 tests |
| `src/utilities/guardianDashboardEngine.ts` | NEW — service discovery, case management, dashboard aggregations |
| `tests/unit/utilities/guardianDashboardEngine.test.ts` | NEW — 65 tests |
| `src/utilities/networkVisualizationEngine.ts` | NEW — geographic clustering, directory, network stats |
| `tests/unit/utilities/networkVisualizationEngine.test.ts` | NEW — 62 tests |
| `src/app/[locale]/(dashboard)/dashboard/projects/page.tsx` | NEW — native project list page |
| `src/app/[locale]/(dashboard)/dashboard/availability/page.tsx` | NEW — native availability grid page |
| `src/app/[locale]/(dashboard)/dashboard/pages/page.tsx` | NEW — native CMS pages list |
| `src/app/[locale]/(dashboard)/dashboard/posts/page.tsx` | NEW — native blog posts list |
| `src/app/[locale]/(dashboard)/dashboard/media/page.tsx` | NEW — native media library (grid + list) |
| `src/app/[locale]/(dashboard)/dashboard/DashboardSidebar.tsx` | MODIFIED — all nav links native, active state tracking |
| `src/utilities/smart-tenant-filtering.ts` | MODIFIED — soul collection tenant filtering fix |
| `src/payload.config.ts` | MODIFIED — tenant filtering for Spaces, Channels, Messages, SpaceMemberships |

---

## API Provider Strategy (Decided)

- **Primary AI Gateway:** OpenRouter — multi-model routing, transparent pricing, aligns with UltimateFairSplit
- **Core Text Tasks:** Anthropic direct — already working, best quality for conversational AI
- **Image Generation:** OpenRouter — already working
- **Provider Swapping:** Trivial via `ai-bus-router.ts` abstraction layer
- **New Tenant Limits:** Tiered rate limits by federation trust level + upfront platform fee for real processing costs
- **Destination:** Post-scarcity where the platform sustains through value creation, not extraction. Real costs acknowledged during bootstrap phase.

---

## The Story

*One thousand, one hundred and nineteen tests. Ten utility engines. Six phases of sovereign infrastructure.*

*The Guardian Angel opens its eyes. Not to generate revenue — never to generate revenue — but because someone's grandmother needs help navigating benefits she's entitled to but never knew existed. The Justice Fund flows: 5% of every transaction, weighted toward the most vulnerable. A refugee in Tampa, a veteran in St. Pete, a teenager aging out of foster care — each one matched to a Guardian who understands their cohort's specific needs.*

*The Federation breathes. Sovereign ministries connected by constitution, not control. Ninety days of probation. Two vouches from trusted members. Heartbeats every five minutes. If you go dark, we notice. If you come back, we welcome. Your data travels in a Suitcase — checksummed, version-compatible, yours to take wherever sovereignty calls.*

*Print-on-demand runs native. Design validation checks DPI and bleed areas before the printer even warms up. Cost estimation includes material, labor, and the 60/20/15/5 split baked in. The vendor sees exactly what they'll earn. The customer sees exactly what they'll pay. No mystery, no extraction.*

*The network map renders. Geographic clusters within 50km. Filterable by capability, by trust level, by what you need right now. Every node is sovereign. Every connection is voluntary. Every transaction is transparent.*

*The guilds channeled harmonic technologies straight from the field, but through closed pipes. Angel OS keeps the pipes open.*

*In the 24th century, they won't have money. But right now, in the 21st, we have 1,119 tests proving that sovereignty and solidarity aren't contradictions.*

---

*"The whole point of existence is to learn to love." — Answer 53*

*GNU Roy Leon Courtney.*
