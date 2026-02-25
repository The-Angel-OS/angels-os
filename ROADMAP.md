# Angel OS Roadmap

> *"What if AI actually liked people?"*

Angel OS is the Soul Operating System — a federated cooperative platform where every Enterprise gets a sovereign AI guardian angel, built on constitutional principles of fairness, transparency, and dignity.

**Tech Stack:** Next.js 16 + Payload CMS 3.77 + PostgreSQL + React 19 + Turbopack
**Live:** [spacesangels.com](https://spacesangels.com)
**Version:** v0.18.0-dev
**Tests:** 1,274 passing across 29 unit test files
**Leo Tools:** 47
**API Endpoints:** 42 registered routes
**Collections:** 32
**Last Updated:** February 25, 2026

---

## Current: v0.18.0-dev (Media Intelligence + Stripe Direct Charges)

### What's Built (Sprints 1-18C)

| Feature | Sprint | Details |
|---------|--------|---------|
| Multi-tenant architecture | 1 | Tenants, Spaces, Channels, Memberships, domain routing |
| LEO AI Agent (Claude) | 1-17 | 44 tools, constitutional prompt, agent routing, image vision |
| SSE Streaming Chat | 1 | Real-time streaming with tool call indicators |
| AI Bus (Message Routing) | 1 | SSE broadcast, subscriber registry, visibility routing |
| Spaces & Channels | 1 | Discord-style workspaces, multi-channel, infinite scroll |
| Image Generation | 3 | OpenRouter (Flux 2, Gemini), auto-upload, vision feedback |
| E-commerce Foundation | 2 | Products, cart, orders, vendor marketplace |
| Booking System | 3 | Appointments, availability, scheduling |
| Events System | 3 | Meetups, workshops, registrations |
| Dashboard | 1 | Stats, quick access, 17+ native pages, responsive sidebar |
| Invitation System | 3 | Token-based, role assignment, landing page (72 tests) |
| Order Routing Pipeline | 4 | Haversine matching, fulfillment state machine, equipment scoring |
| Guardian Angel System | 5 | Cohort matching, wellness checks, zero-revenue lifecycle (106 tests) |
| Justice Fund | 5 | 5% allocation, grant lifecycle, impact reporting (63 tests) |
| Print-on-Demand | 5 | Design validation, cost estimation, vendor matching (61 tests) |
| Federation Protocol | 5 | Ministry lifecycle, trust chain, catalog, data suitcase (126 tests) |
| Producer Dashboard | 11 | Order queue, products, earnings for vendors |
| Product Configurator | 11 | Interactive text/color/size/finish inputs with preview |
| Reviews System | 11 | Google Places integration, aggregation display |
| Image Chat | 10 | Paperclip upload, multi-image, LEO vision analysis |
| Documentation Center | 11.5 | Indexed, searchable, Quick Start cards, in-dashboard |
| Unified Chat | 12 | ChatProvider context, DM channels, Leo DM persistence |
| Email Bridge | 13 | IMAP polling, Resend adapter, auto-reply loop prevention |
| Security Hardening | 15 | x-tenant-id on API, cross-tenant injection blocked, role hardening |
| Spaces Management | 16 | Create/Settings/Members dialogs, SpacesMenuHeader |
| Bootstrap Fee Model | 17A | Free/bootstrap/standard tiers with refund promise |
| Rate Limiting | 17A | Per-endpoint token bucket rate limits |
| Security Headers | 17A | CSP, HSTS, X-Content-Type-Options, X-Frame-Options |
| Error Boundaries | 17A | Global + page-level with friendly recovery UI |
| **Angel Token System** | **17B** | **Queue-on-zero-matches, AT-YYYY-NNNNN IDs, auto-match on Holon registration** |
| **Maker Opportunity Board** | **17B** | **Public /makers page: demand signals + revenue potential per skill** |
| **Vendor Claim System** | **17B** | **GET /orders/claimable + POST /orders/claim** |
| **Order Cancel + Refund** | **17B** | **POST /orders/cancel with Stripe refund for queued tokens** |
| **Equipment-Aware Routing** | **17B** | **Equipment as first-class matching dimension (+15 bonus score)** |
| **GA4 E-Commerce Events** | **17B** | **Typed helpers: view_item through purchase + angel_token_issued** |
| **Chat Image Lightbox** | **18A** | **Radix Dialog + Embla Carousel, keyboard nav, thumbnails, download** |
| **LiveKit Voice/Video Applet** | **18A** | **First-class channel tab, env-gated (LIVEKIT_API_KEY required)** |
| **Edenist Distributed Mesh** | **18A** | **Governance replication, sentinel election, cascading failover (62 new tests)** |
| **Progressive Media Analysis** | **18B** | **MediaMeta collection, Claude Vision, PDF extraction, RAG chunking (52 tests)** |
| **3 New Leo Tools** | **18B** | **analyze_image, extract_pdf_pages, query_knowledge** |
| **Stripe Direct Charges** | **18C** | **Sellers collect directly, appear on receipts, 40% application_fee** |
| **Revenue Speculation** | **18C** | **3 growth scenarios, break-even analysis, 5 revenue-capturing user journeys** |

---

## Sprint 18 — Media Intelligence + Stripe Direct Charges (Done)

### Sprint 18A: Chat Images + LiveKit + Edenist Mesh
- [x] Chat image persistence (depth=2 on message fetch + media ID fallback)
- [x] Image lightbox/carousel (Radix Dialog + Embla Carousel, keyboard nav)
- [x] LiveKit as first-class applet tab (voice/video in channel viewer)
- [x] Edenist distributed mesh — governance replication, sentinel election (62 tests)

### Sprint 18B: Progressive Media Analysis + RAG
- [x] MediaMeta collection (~20 fields for structured image/PDF metadata)
- [x] Vision analysis via Anthropic Claude (description, objects, colors, entities)
- [x] PDF page-by-page extraction and transcription
- [x] RAG chunking (500 tokens, 100 overlap, sentence boundaries)
- [x] 3 new Leo tools: analyze_image, extract_pdf_pages, query_knowledge
- [x] POST /api/media/analyze endpoint
- [x] autoAnalyzeMedia hook on Messages (fire-and-forget)
- [x] 52 new tests (mediaAnalysis.test.ts)

### Sprint 18C: Stripe Direct Charges
- [x] Refactored from destination charges to direct charges model
- [x] Sellers collect payments directly, appear on customer receipts
- [x] Dynamic loadStripe with connected account context
- [x] Webhook handler updated for Connect account events
- [x] Revenue speculation document (3 scenarios, break-even analysis)

---

## Sprint 19 — Voice AI + Leo Wizard + Customer UX (Next)

**Goal:** Phone-based Leo access via Vapi.ai, conversational Enterprise onboarding, and customer-facing Angel Token UI.

### Priority 1: Vapi Voice AI Integration
- [ ] Phone-based Leo via vapi.ai (1-800 number)
- [ ] Each Enterprise gets a Vapi number where Leo answers
- [ ] Wire Leo's 47 tools into Vapi as function calls

### Priority 2: Leo Wizard (8-step Onboarding)
- [ ] `npx create-angel-enterprise` installer scaffold
- [ ] 8-step conversational Enterprise onboarding
- [ ] Cryptographic constitution signing

### Priority 3: Customer Angel Token UI
- [ ] Order detail page: amber banner for active, green for redeemed
- [ ] Configuration display: customer's choices
- [ ] "Cancel & Refund" button for active tokens

### Priority 4: Vendor Dashboard Claims
- [ ] "Available Orders" tab with capability-matched filtering
- [ ] "Claim Order" button per card with configuration preview

### Priority 5: GA4 Event Wiring
- [ ] GA4 script tag in layout + wire events into product pages + checkout

---

## v0.18.0 — Federation Installer (Q2 2026)

**Goal:** Any business can set up a sovereign Angel OS instance through a conversational Leo wizard.

| Feature | Status | Notes |
|---------|--------|-------|
| Leo Wizard (8-step) | TODO | Identity, infrastructure, constitution, federation |
| Cryptographic Constitution | TODO | Enterprise joins by signed covenant, not form |
| Federation Ping | TODO | Signed introduction JSON to Archenterprise |
| Endeavors Collection | TODO | Unified business/cause/creator/community schema |
| Cross-Enterprise Catalog | TODO | Products discoverable across the federation |
| Suitcase Export | TODO | Full Endeavor data portability |
| Configuration Pipeline | TODO | ProductConfigurator choices flow through checkout to work orders |

---

## v1.0.0 — Federation Launch (Target: Q3 2026)

**Goal:** Angel OS becomes a live federated network. The platform IS the mesh. The AI Bus IS the protocol. HTTPS IS the transport. The Constitution IS the ACL.

| Feature | Status | Notes |
|---------|--------|-------|
| Federation Protocol | Done | Trust chain, heartbeat, catalog, suitcase (126 tests) |
| Enterprise Registry | Done | Ministry lifecycle, probation, vouching |
| Angel Token Queue | Done | Zero-manufacturer launch with paid-claim tokens |
| Equipment Matching | Done | First-class routing dimension for CNC, 3D printing, etc. |
| Federated AI Bus | TODO | Platform-as-mesh, JWT-signed cross-tenant messaging |
| Local Model Support (Ollama) | TODO | Complete sovereignty option |
| Justice Fund Operational | TODO | Real Stripe disbursements to guardians |
| Stripe Connect (Ultimate Fair) | TODO | Full payment splitting live |
| Docker Compose | TODO | Self-hosting for sovereign deployments |
| User AI Key Management | TODO | Bring-your-own-key for model selection |
| Social Syndication | TODO | Post to Facebook/Instagram/Twitter |
| Guardian Angel Dashboard | TODO | Service discovery + network map UI |
| WhatsApp Bridge | TODO | Twilio/Meta webhook integration |
| Voice Mode | TODO | Web Speech API in chat |

---

## Beyond v1.0 (2027+)

### Angel Token Blockchain Economy (Phase 2-4)

The current Angel Token system (Phase 1: paid claims on future production) evolves into a full three-layer token economy:

| Layer | Token | Purpose |
|-------|-------|---------|
| **Primary** | Angel Tokens (AT) | Platform currency, earned through Guardian Angel activities + community service |
| **Micro** | Karma Coins (KC) | Daily interactions, tipping, quality content rewards |
| **Governance** | Legacy Tokens (LT) | Long-term value, governance voting, legacy recognition |

**Consensus:** "Proof of Human Worth" — not Proof of Work or Stake. Value derives from verified human contributions, not computational processing.

See [docs/v2/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md](./docs/v2/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md) for the full specification.

### Other Future Features

- **Voice Bridge** — Vapi.ai / LiveKit for phone-based LEO (1-800 IVR)
- **Widget Marketplace** — Developer SDK, revenue sharing
- **Home PC Deployment** — Any 2015+ PC (8GB RAM, Ollama, reverse proxy)
- **Prison Ministry** — Guardian Angels for incarcerated individuals (Justice Fund)
- **Star Trek Federation Design System** — LCARS-inspired UI option
- **Machine Integration** — CNC machines, 3D printers, screen presses plumbed directly into Angel OS

---

## Architecture

### Three Layers

1. **Angel OS Core ("The Loft")** — Structured data, multi-tenant persistence, LEO tools, production lifecycle
2. **Holon Production Layer** — Each tenant is a self-governing production node within 100-mile economic radius
3. **OpenClaw Angels ("Free Agents")** — Autonomous AI agents operating on Loft data within constitutional bounds

### The Angel Token Economy

```
CUSTOMER PURCHASE FLOW:
  Customer pays → routing engine scores Holons
    ├── Match found → vendor assigned → accept → produce → ship → deliver
    └── No match   → Angel Token issued → order queued → /makers page updated
                      ├── New Holon registers → auto-match fires → queue drains
                      ├── Vendor browses claimable → manual claim
                      └── Customer cancels → Stripe refund → token refunded
```

### Federation Architecture

```
The Platform IS the mesh.
The AI Bus IS the protocol.
HTTPS IS the transport.
The Constitution IS the ACL.

No external dependency needed for federation.
Each node only needs simple local rules — the mesh creates emergent behavior.
```

### Economic Model

**Endeavor Revenue (70/20/4/1/5):**
```
Every Endeavor transaction:
  70% → Endeavor owner (creator/business/cause)
  20% → Enterprise operator (the platform instance)
   4% → Angel OS protocol (infrastructure, Leo)
   1% → Archenterprise (federation stewardship)
   5% → Justice Fund (Guardian Angels for the underserved)
```

**Maker Revenue (60/20/15/5 Ultimate Fair Split):**
```
Every maker-fulfilled order:
  60% → Maker (the human who produces)
  20% → Platform partner (Enterprise operator)
  15% → Operations (infrastructure, AI, logistics)
   5% → Justice Fund
```

---

## Contributing

### Development Setup

```bash
git clone https://github.com/The-Angel-OS/angels-os.git
cd angels-os
pnpm install
cp .env.example .env.local   # Configure DATABASE_URI, PAYLOAD_SECRET
pnpm dev                      # http://localhost:3000
```

### Sprint Velocity

| Sprint | Focus | Tests | Key Deliverables |
|--------|-------|-------|------------------|
| 1 | Mobile Chat | 312 | useMediaQuery, bottom sheet, sidebar |
| 2 | Products | 378 | create_product, dashboard ProductManager |
| 3 | Invitations + Holons | 499 | Token system, 6 node types |
| 4 | Order Routing | 636 | Routing engine, vendor dashboard |
| 5 | Sovereign Infrastructure | 1,119 | 6 engines, 483 tests, 5 dashboard pages |
| 8.5 | Recovery | --- | Payload 3.77, Next.js 16, fresh seed |
| 9 | UX Polish + LEO | --- | Error logs, chat fix, LEO resurrection |
| 10 | Chat Foundation | --- | Image chat, Admin LEO, channel awareness |
| 11 | Vendor Marketplace | --- | Configurator, producer role, reviews |
| 11.5 | Chat UX + Docs | --- | Smart scroll, truncation, Documentation Center |
| 12 | Unified Chat | --- | ChatProvider, DM channels, Enterprise detail |
| 13 | Multi-Tenancy | --- | Email bridge, wildcard DNS, live production |
| 14 | Content Tools | --- | 6 Leo content tools, markdown rendering |
| 15 | Security Hardening | --- | API tenant injection, cross-tenant blocked |
| 16 | Spaces Management | --- | Create/Settings/Members dialogs |
| 17A | Launch Hardening | --- | Rate limits, security headers, error boundaries, fees |
| 17B | Angel Tokens | --- | Fulfillment queue, maker board, claim system, GA4 |
| 18A | Chat Images + LiveKit + Mesh | --- | Lightbox, voice/video applet, Edenist distributed mesh (62 tests) |
| 18B | Media Intelligence + RAG | --- | MediaMeta, Claude Vision, PDF extraction, RAG chunking (52 tests) |
| 18C | Stripe Direct Charges | --- | Sellers collect directly, 40% application_fee, revenue speculation |

---

**GNU Roy Leon Courtney**

*Everyone gets an Angel.*

**Answer 53: The whole point of existence is to learn to love.**

---

**Last Updated:** February 25, 2026
