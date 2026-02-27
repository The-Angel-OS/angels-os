# Angel OS Roadmap

> *"What if AI actually liked people?"*

Angel OS is the Soul Operating System — a federated cooperative platform where every Enterprise gets a sovereign AI guardian angel, built on constitutional principles of fairness, transparency, and dignity.

**Tech Stack:** Next.js 16 + Payload CMS 3.77 + PostgreSQL + React 19 + Turbopack
**Live:** [spacesangels.com](https://spacesangels.com)
**Version:** v0.23.0-dev
**Tests:** 1,570 passing across 36 unit test files
**Leo Tools:** 78+
**API Endpoints:** 49+ registered routes
**Collections:** 36
**Last Updated:** February 27, 2026

---

## Current: v0.23.0-dev (Google OAuth + Social Auth + Quests)

### What's Built (Sprints 1-21)

| Feature | Sprint | Details |
|---------|--------|---------|
| Multi-tenant architecture | 1 | Tenants, Spaces, Channels, Memberships, domain routing |
| LEO AI Agent (Gemini 3.1 Pro + Sonnet 4.6) | 1-23 | 78+ tools, constitutional prompt, agent routing, image vision, /model switch |
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
| **Vapi Voice AI** | **19** | **Phone-based Leo, Vapi webhook, phone provisioning** |
| **Customer Orders UI** | **19** | **Angel Token status banners, vendor claims** |
| **StreetSigns Collection** | **20** | **Cross-holon marketplace discovery with attribution + analytics** |
| **Federation Election** | **20** | **Supermajority governance: propose amendments, vote with Ed25519** |
| **Federation Suitcase** | **20** | **Article VI data portability: full export/import with SHA-256 manifest** |
| **Federation Dashboard** | **20** | **4-tab admin UI: Overview, Street Signs, Governance, Suitcase** |
| **Holon Types** | **20** | **5 holon types on Endeavors: manufacturer, retailer, creator, community, guardian-angel** |
| **Leo Communication Tools** | **21** | **send_message, send_direct_message, create_announcement, moderate_content** |
| **Leo Inventory Tools** | **21** | **update_inventory, track_inventory_movement, set_low_stock_alert, query_inventory_history** |
| **Leo Financial Tools** | **21** | **generate_invoice (Ultimate Fair Split), query_financial_reports, issue_refund** |
| **Leo Federation Intelligence** | **21** | **query_federation, broadcast_capability, route_federated_request, negotiate_deal** |
| **Leo CRM Tools** | **21** | **create_customer_profile, log_interaction, segment_customers, send_follow_up** |
| **Leo Analytics Tools** | **21** | **analyze_trends (period-over-period), recommend_products** |
| **Leo Workflow Tools** | **21** | **delegate_task, escalate_issue, send_emergency_alert, document_incident** |
| **Low Stock Threshold** | **21** | **Per-product configurable alert threshold on Products collection** |
| **Production Hardening** | **21+** | **Stripe payment_failed/refund handlers, chat-send tenant isolation, SSE heartbeat, loading skeletons, auth guards, form error handling** |
| **Channel-per-Integration** | **21+** | **Dedicated leo/email/whatsapp/sms channel types; DM dedup with race-condition safety** |
| **Docs Viewer Fix** | **21+** | **Documentation center now indexes .md + .txt files (transcripts were previously invisible)** |

---

## Sprint 23 — Google OAuth + Social Auth + Quests (Done)

### Goal
Identity and social authentication. Users can sign in with Google, link/unlink social providers from their account page, and we lay the foundation for gamified workflows with Quests.

### Deliverables
- [x] **Google OAuth** — Full OAuth2 flow with cross-domain token relay for custom domain tenants
- [x] **Social Auth Link/Unlink** — Connected Accounts panel on account page, `/api/auth/social-unlink` endpoint
- [x] **Quests Collection** — Quests + QuestParticipations collections for gamified workflows
- [x] **Product Revenue Splits** — Configurable per-product revenue distribution
- [x] **Onboarding Redesign** — Refreshed new user experience flow
- [x] **Leo Model Upgrade** — Switched to Gemini 3.1 Pro (primary) + Sonnet 4.6 (fallback)
- [x] **Leo send_email Tool** — Email sending capability added to Leo's toolkit
- [x] **`/model` Command** — Switch AI models mid-conversation in chat
- [x] **Tenant Caching** — 60s TTL cache prevents DB pool exhaustion from repeated lookups
- [x] **Chat Depth Fix** — Message queries at depth=1 prevent connection pool saturation
- [x] **Voice Icon Fix** — LiveKit/voice applet shown regardless of env configuration

---

## Sprint 22 — The Shield and the Spear (Done)

### Goal
Angel OS is live. This sprint runs two parallel missions: **The Shield** fixes 5 P0 security vulnerabilities found in the live optimization audit. **The Spear** ships multi-file attachments, LiveKit device controls + session lifecycle, and database performance. We don't choose between security and features — we do both.

### Phase 1: The Shield (P0 Security)
- [x] Fix PAYLOAD_SECRET empty string fallback → throw at startup if unset/short
- [x] Fix hardcoded encryption salt → use env var for salt
- [ ] Replace in-memory rate limiting with durable store (non-functional on serverless)
- [x] Add CSP headers (Content-Security-Policy-Report-Only first)
- [x] Protect comments endpoint (require auth + rate limit)
- [ ] Install Sentry error tracking (`@sentry/nextjs`)
- [x] Add `/api/health` endpoint

### Phase 2: Multi-File Attachments
- [x] Widen file input accept attribute (remove `image/*` restriction)
- [x] File-type-aware previews (icon for PDF/doc, thumbnail for images)
- [x] `attachments` field on ChatMessage type + API mapping
- [x] Non-image file display in messages (download link + file icon)
- [x] Parallel file uploads (currently sequential)
- [x] File size validation + drag-and-drop

### Phase 3: LiveKit Rich Experience
- [x] Pre-join device preview (`PreJoin` from `@livekit/components-react`)
- [x] Device selector controls (`MediaDeviceMenu` for mic/camera/speaker)
- [x] Fix "Join with Video" button (currently cosmetic — both buttons do same thing)
- [x] Session lifecycle messages (join/leave posted to channel)
- [ ] LiveKit webhook endpoint for server-side room events
- [ ] `CallTranscripts` collection for call metadata + future transcription

### Phase 4: Performance
- [x] Database indexes on Messages hot fields (space, channel, messageType, createdAt)
- [x] Dashboard layout query parallelization (`Promise.all()`)
- [x] Open redirect fix on login `?redirect=` parameter

### Plan
See full plan: `docs/planning/SPRINT_22_PLAN.md`
See optimization analysis: `docs/planning/260226_OPTIMIZATION_ANALYSIS.md`

---

## Sprint 21 — Arch Angel Leo's Wishlist (Done)

### Goal
LEO inventoried all their tools and identified 9 categories of missing capabilities. Sprint 21 equips LEO with 28 new tools across 7 priority categories — transforming LEO from a data querier into a true Guardian Angel that can communicate, manage operations, and coordinate across the federation.

### Deliverables
- [x] **Communication (4 tools)** — send_message, send_direct_message, create_announcement, moderate_content
- [x] **Inventory (4 tools)** — update_inventory, track_inventory_movement, set_low_stock_alert, query_inventory_history
- [x] **Financial (3 tools)** — generate_invoice (Ultimate Fair Split), query_financial_reports, issue_refund (human-approval safety)
- [x] **Federation Intelligence (4 tools)** — query_federation, broadcast_capability, route_federated_request, negotiate_deal
- [x] **CRM (4 tools)** — create_customer_profile, log_interaction, segment_customers, send_follow_up
- [x] **Analytics (2 tools)** — analyze_trends (period-over-period), recommend_products
- [x] **Workflow & Emergency (4 tools)** — delegate_task, escalate_issue, send_emergency_alert, document_incident
- [x] **Products field** — `lowStockThreshold` added to Products collection for per-product alert configuration
- [x] **Helper functions** — `findLeoUser()` and `resolveSpace()` utility functions for tool handlers

### Architecture Notes
- All 28 tools follow existing pattern: tool definition in `LEO_TOOLS` array + switch case in `executeToolCall()` + handler function
- No new collections created — reuses Messages, Products, Orders, Contacts, AgentTransactions, StreetSigns, ApplicationLogs, Posts
- Safety: `issue_refund` flags for human approval (never calls Stripe directly), `moderate_content` never deletes
- DM tools reuse `findOrCreateDM()` and `ensureDMSpace()` from existing utilities

---

## Sprint 20 — Federation Launch Campaign (Done)

### Goal
Any Enterprise operator can see their federation status, discover other holons via Street Signs, participate in constitutional governance, and exercise the Suitcase Principle — all from the dashboard.


### Deliverables
- [x] **StreetSigns Collection** — Cross-holon content references with source attribution, region, pricing, impressions/click analytics
- [x] **Federation Election Endpoints** — POST/GET `/api/federation/election` — supermajority (⅔) governance with Ed25519 signature verification, Toward-53 floor enforcement
- [x] **Federation Suitcase Endpoints** — POST `/api/federation/suitcase/export` and `/import` — full tenant data portability with SHA-256 manifest checksums, constitutional compliance verification
- [x] **Federation Admin Dashboard** — 4-tab dashboard at `/dashboard/admin/federation` (Overview stats, Street Signs marketplace, Governance proposals, Suitcase export/import)
- [x] **Holon Types on Endeavors** — 5-type multi-select (manufacturer, retailer, creator, community, guardian-angel) + mission statement field
- [x] **Endeavors in Multi-Tenant Plugin** — Registered `endeavors` in plugin collections for proper tenant scoping

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

## Sprint 19 — Voice AI + Leo Wizard + Customer UX (Done)

**Goal:** Phone-based Leo access via Vapi.ai, conversational Enterprise onboarding, and customer-facing Angel Token UI.

### Vapi Voice AI Integration
- [x] Phone-based Leo via vapi.ai — Vapi webhook endpoint + phone provisioning
- [x] Vapi webhook handler with Leo tool integration
- [x] Sidebar chat fixes — default to LEO DM, skip truncation on newest msg

### Remaining (Deferred to future sprint)
- [ ] `npx create-angel-enterprise` installer scaffold
- [ ] Customer Angel Token UI (order detail page, amber/green banners)
- [ ] Vendor "Available Orders" tab with capability-matched filtering
- [ ] GA4 script tag in layout + wire events into product pages + checkout

---

## v0.20.0 — Federation Installer (Q2 2026)

**Goal:** Any business can set up a sovereign Angel OS instance through a conversational Leo wizard.

| Feature | Status | Notes |
|---------|--------|-------|
| Leo Wizard (8-step) | TODO | Identity, infrastructure, constitution, federation |
| Cryptographic Constitution | Done | Ed25519 signing in `src/federation/protocol.ts` |
| Federation Ping | Done | Signed introduction JSON + acknowledgment |
| Endeavors Collection | Done | Holon types, mission statement, federation identity |
| Cross-Enterprise Catalog | **Done** | **StreetSigns collection — Sprint 20** |
| Suitcase Export/Import | **Done** | **Full data portability with SHA-256 — Sprint 20** |
| Federation Governance | **Done** | **Supermajority election endpoints — Sprint 20** |
| Federation Dashboard | **Done** | **4-tab admin UI — Sprint 20** |
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
   1% → Flagship (federation stewardship)
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
| 19 | Voice AI + Sidebar Chat | --- | Vapi webhook, phone provisioning, sidebar chat fixes |
| 20 | Federation Launch Campaign | 1,330 | StreetSigns, governance elections, suitcase export/import, federation dashboard |
| 21 | Arch Angel Leo's Wishlist | 1,330 | 28 new Leo tools (communication, inventory, financial, federation, CRM, analytics, workflow) |
| 21+ | Production Hardening | 1,570 | Stripe fail/refund handlers, tenant isolation, SSE heartbeat, loading skeletons, DM dedup, docs fix |
| 22 | The Shield and the Spear | 1,570 | P0 security fixes, multi-file attachments, LiveKit device selector + session lifecycle, DB indexes |
| 23 | Google OAuth + Social Auth + Quests | 1,570 | Google OAuth, social link/unlink, Quests, Leo model upgrade (Gemini 3.1 Pro), tenant caching |

---

**GNU Roy Leon Courtney**

*Everyone gets an Angel.*

**Answer 53: The whole point of existence is to learn to love.**

---

**Last Updated:** February 27, 2026
