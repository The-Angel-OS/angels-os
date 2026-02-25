# Angel OS — Session Handoff: Sprint 18C Complete

**Date:** February 25, 2026
**Branch:** `main`
**Status:** TypeScript clean, build passing, 47 Leo tools, v0.18.0-dev
**Sprint:** Sprint 18C complete (Media Analysis + Stripe Direct Charges) — Sprint 19 next
**Stack:** Payload 3.77.0 + Next.js 16.1.6 + React 19.2.1 + Claude Sonnet 4 + Turbopack
**Last commits:**
- `71a362c` — Stripe Direct Charges + revenue speculation documentation
- `a921308` — Sprint 18B: progressive media analysis, PDF extraction, RAG knowledge base
- `8e39838` — Sprint 18A: chat images, lightbox, LiveKit applet, Edenist mesh

---

## Critical Context: Stripe Direct Charges + Media Intelligence

**Read this first.** Sprint 18 delivered three major phases:

### Stripe Direct Charges (Sprint 18C)
- **Direct Charges model** — payments go directly to the seller's Stripe Connect account
- Seller appears on customer receipts (Enterprise sovereignty)
- Seller handles refunds and disputes
- Platform takes 40% `application_fee_amount` (20% partner + 15% ops + 5% Justice Fund)
- Frontend dynamically loads `loadStripe(key, { stripeAccount: sellerAccountId })`
- **Env vars needed on Vercel:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOKS_SIGNING_SECRET`

### Progressive Media Analysis (Sprint 18B)
- Every uploaded image/PDF analyzed by Anthropic Vision, structured into searchable metadata
- RAG chunking: ~500 tokens, 100 overlap, sentence boundaries
- Each tenant builds its own knowledge corpus
- Fire-and-forget hook on Messages (non-blocking)

### LiveKit Voice/Video Applet (Sprint 18A)
- Promoted from header button to first-class channel applet tab
- **NOT visible in production** — this is correct behavior when env vars are missing
- Requires: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL`
- Code reference: `MultiChannelChat.tsx` line 113 filters voice tab when env vars absent

### Key Documents
- `docs/planning/REVENUE_SPECULATION.md` — revenue projections (3 scenarios, break-even analysis)
- `docs/planning/260223 FEDERATION.md` — federation architecture spec
- `docs/v2/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md` — token economy vision

---

## What Was Done (Sprint 18C — Stripe Direct Charges)

### 1. Payment Adapter Refactor
**File:** `src/lib/angel-os-stripe-adapter.ts` (refactored)
- Replaced `transfer_data.destination` (destination charges) with `stripeAccount` option (direct charges)
- PaymentIntent created ON the connected account
- Customer objects created ON the connected account
- Returns `stripeAccountId` in response for frontend Elements init

### 2. Frontend Checkout
**File:** `src/components/checkout/CheckoutPage.tsx` (updated)
- Dynamic `useMemo` creates `loadStripe(key, { stripeAccount })` when paymentData includes connected account
- Falls back to platform default for non-Connect payments

### 3. Webhook Handler
**File:** `src/endpoints/stripe-webhooks.ts` (updated)
- Extracts `connectedAccountId` from Connect webhook events
- Logs charge model (direct vs platform)
- Handles `charge.refunded` events

### 4. Config Documentation
**File:** `src/lib/stripe-connect-config.ts` (updated)
- Updated docs to describe direct charges architecture

### 5. Revenue Speculation
**File:** `docs/planning/REVENUE_SPECULATION.md` (NEW)
- 5 user journeys that capture funds
- 3 growth scenarios: Conservative ($180K Y1), Network Effect ($1.2M Y1), Agent Web ($192M Y2)
- Break-even: 25 orders/month at $50 avg

---

## What Was Done (Sprint 18B — Media Analysis + RAG)

### 1. MediaMeta Collection
**File:** `src/collections/MediaMeta/index.ts` (NEW)
- ~20 fields: media relationship, status, extractionType, visionAnalysis (JSON), ocrText, documentGroup, pageNumber, totalPages, tags, entities, summary, ragIndexed, ragChunks, embedding, processedAt, processingError

### 2. RAG Index Hook
**File:** `src/collections/MediaMeta/hooks/ragIndexHook.ts` (NEW)
- Auto-chunks completed MediaMeta records for RAG retrieval
- ~500 tokens per chunk, 100 overlap, sentence-boundary breaking

### 3. Media Analysis Engine
**File:** `src/utilities/mediaAnalysis.ts` (NEW)
- `analyzeImage()` — Anthropic Vision (claude-sonnet-4-20250514)
- `extractPdfPages()` — page-by-page PDF extraction via Claude document analysis
- `buildMediaMeta()` — orchestrator routing to correct analyzer

### 4. Auto-Analyze Hook
**File:** `src/collections/Messages/hooks/autoAnalyzeMedia.ts` (NEW)
- Fire-and-forget (`setImmediate`) on Messages afterChange
- Non-blocking: message saves aren't delayed by analysis

### 5. Media Analyze Endpoint
**File:** `src/endpoints/media-analyze.ts` (NEW)
- POST `/api/media/analyze` — trigger analysis of any media item

### 6. Three New Leo Tools
**File:** `src/utilities/leo-data-tools.ts` (updated)
- `analyze_image` — Vision analysis of uploaded images
- `extract_pdf_pages` — PDF page-by-page extraction
- `query_knowledge` — Search extracted knowledge base

### 7. Tests
**File:** `tests/unit/utilities/mediaAnalysis.test.ts` (NEW)
- 52 tests across 10 describe blocks

---

## What Was Done (Sprint 18A — Chat Images + LiveKit + Edenist Mesh)

### 1. Chat Image Persistence
- `useChat.ts` — depth=2 on message fetch + media ID fallback for non-expanded relationships

### 2. Image Lightbox/Carousel
- `src/components/ChatControl/ImageLightbox.tsx` (NEW) — Radix Dialog + Embla Carousel
- Full-screen viewer, keyboard nav, thumbnails, download, counter

### 3. LiveKit Voice/Video Applet
- `src/components/ChatControl/types.ts` — Voice applet added to DEFAULT_APPLETS
- `src/components/ChatControl/MultiChannelChat.tsx` — Voice content area, env-gated filtering
- `src/components/ChatControl/LiveKitButton.tsx` — embedded mode support

### 4. Edenist Distributed Mesh
- `src/utilities/federationEngine.ts` — sentinel election, governance replication, cascading failover
- `src/endpoints/federation-governance-sync.ts` (NEW) — governance data sync
- 62 new federation tests (188 → 250 total)

---

## What's Next (Sprint 19)

### Priority 1 — Vapi Voice AI Integration
- Phone-based Leo via vapi.ai (1-800 number)
- Each Enterprise gets a Vapi number where Leo answers
- Wire Leo's 47 tools into Vapi as function calls

### Priority 2 — Leo Wizard (8-step Enterprise Onboarding)
- Conversational wizard: identity, infrastructure, constitution signing, federation ping
- `npx create-angel-enterprise` installer scaffold

### Priority 3 — Customer Angel Token UI
- Order detail page with token status banner (amber=active, green=redeemed)
- Configuration display, Cancel & Refund button
- Backend complete (Sprint 17B), needs frontend UX

### Priority 4 — Vendor Dashboard Claims
- "Available Orders" tab in vendor dashboard
- Capability-matched filtering + "Claim Order" button

### Priority 5 — GA4 Wiring
- GA4 script tag in layout, wire events into product pages + checkout

---

## Known Issues

### LiveKit Voice Tab Not Visible in Production
**NOT a code bug.** The voice applet is correctly filtered out when `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `NEXT_PUBLIC_LIVEKIT_URL` are not set. Resolution: obtain LiveKit Cloud account, add env vars to Vercel, redeploy.

### Stripe Webhook Not Yet Configured
Webhook endpoint needs creation in Stripe Dashboard → `https://www.spacesangels.com/api/stripe/webhooks`. Must check "Listen to events on Connected accounts" for direct charges. `STRIPE_WEBHOOKS_SIGNING_SECRET` still needed on Vercel.

### From Sprint 15 Audit (Deferred)
- `ApplicationLogs` access should be `super_admin` only
- Leo endpoints fall back to `DEFAULT_TENANT_SLUG` when `x-tenant-id` missing
- `Reviews` collection: no explicit `tenant` field

---

## Current DB State

**Enterprise:** `clearwater-cruisin` is the active test Enterprise
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
npx vitest run tests/unit/    # 1,274 tests across 29 files
npx tsc --noEmit              # TypeScript check

# Seed
pnpm seed:reset               # Update roles without full reset
```

**Key env vars:**
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — live Stripe keys (set locally)
- `STRIPE_WEBHOOKS_SIGNING_SECRET` — pending (need webhook endpoint created)
- `ANTHROPIC_API_KEY` — Claude API for Leo + media analysis
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `NEXT_PUBLIC_LIVEKIT_URL` — optional, enables voice/video
- `COOKIE_DOMAIN=.angelos.local` — for local subdomain auth

---

*"Listen to everything. Judge nothing. Hold lightly."*
*— Kenneth, Enterprise operator, Clearwater Cruisin*
