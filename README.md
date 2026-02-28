# Angel OS

**The federated cooperative operating system. Everyone gets an Angel.**

An open-source, constitutional AI-native platform where every Enterprise (business, ministry, community) runs its own sovereign AI guardian angel — **Leo** — on infrastructure they own. Built on [Payload CMS 3.77](https://payloadcms.com) + Next.js 16 + React 19 + PostgreSQL.

**Live:** [spacesangels.com](https://spacesangels.com)

[![Status](https://img.shields.io/badge/version-v0.24.0--dev-blue)]()
[![Tests](https://img.shields.io/badge/tests-1%2C570%20passing-brightgreen)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()
[![Constitutional](https://img.shields.io/badge/AI-constitutional-gold)]()
[![TDD](https://img.shields.io/badge/TDD-50%20test%20files-blue)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)]()
[![Payload](https://img.shields.io/badge/Payload_CMS-3.77.0-blue)]()
[![Leo Tools](https://img.shields.io/badge/Leo_Tools-78+-emerald)]()
[![Endpoints](https://img.shields.io/badge/API_Endpoints-49+-purple)]()
[![Collections](https://img.shields.io/badge/Collections-37-orange)]()
[![Sprints](https://img.shields.io/badge/Sprints-24-ff69b4)]()
[![E2E](https://img.shields.io/badge/E2E-14%20suites-9cf)]()
[![Federation](https://img.shields.io/badge/Federation-Live-gold)]()

---

## The Model (Updated — Sprint 24)

Angel OS is not a platform with customers. It is a **federation of Enterprises**.

| Role | What they are | Revenue share |
|------|--------------|---------------|
| **Endeavor owner** | The creator, business, cause, or community generating value | **70%** |
| **Enterprise operator** | The platform instance — they ARE Angel OS in their territory | **20%** |
| **Angel OS protocol** | Core infrastructure, Leo, open source maintenance | **4%** |
| **Flagship** | Clearwater — founding node, federation steward, Justice Fund custodian | **1%** |
| **Justice Fund** | Guardian Angel provisioning for underserved populations | **5%** |

**The Toward-53 Principle:** The split is constitutionally directional. It always evolves toward the Endeavor owner keeping more. The asymptotic target is 53% as a floor. This direction is unalterable even as specific numbers can be amended by federation supermajority.

**The Enterprise IS the platform.** Enterprise operators are not customers of Angel OS. They run the instance, serve Endeavors, bear infrastructure costs, and earn 20% of all Endeavor revenue on their node.

### The Maker Economy (60/20/15/5 Fair Split)

When a product is fulfilled by a network maker (Holon), the **Ultimate Fair Split** applies:

| Share | Recipient |
|-------|-----------|
| **60%** | Maker (the human who produces the product) |
| **20%** | Platform partner (Enterprise operator) |
| **15%** | Operations (infrastructure, AI, logistics) |
| **5%** | Justice Fund (Guardian Angel provisioning) |

---

## What's New: Sprint 24 — Enterprise Intelligence & Dashboard Integration

### Sprint 24: Enterprise Intelligence (Current)
- **LEO Enterprise Manager Phase 1** — Operational intelligence engine: revenue analytics, inventory alerts, customer health scoring, opportunity identification. Board of Directors governance system with quorum-based decision logging.
- **LCARS Federation Network** — Star Trek-inspired network visualization dashboard: real-time federation status, node health monitoring, trust-level display, communications log. The Federation IS visible now.
- **Account Dashboard Integration** — Account settings are now a first-class dashboard section. Profile, Connections, and Addresses pages live under `/dashboard/account`. Header user menu with dropdown, clickable sidebar user footer.
- **Enlistment Ceremony** — New step in Enterprise setup wizard: guided constitutional commitment with pledge affirmation and digital signature capture.
- **Role-Based Dashboard** — Dashboard adapts to user role: admin sees full admin panel, business owners see producer tools, regular members see their spaces and orders.
- **Comment Moderation Dashboard** — Admin moderation queue for user comments with approve/reject/flag actions.
- **Featured Endeavors Block** — Homepage block component for showcasing highlighted Endeavors.
- **14 E2E Test Suites** — Comprehensive Playwright test coverage: dashboard, admin journeys, payload admin, federation API, tenant isolation, chat messaging, producer workflow, content management, setup wizard, launch journeys, checkout, user journeys, mobile responsive, frontend legacy.

### Sprint 24: Security & Stability
- **Federation Protocol Hardening** — Signature enforcement on all mesh operations, schema validation, governance persistence to prevent split-brain.
- **Tenant Isolation Hardening** — 6 collections strengthened against cross-tenant data leakage, federation catalog scoped properly.
- **Payload Admin Fix** — link.ts field builder had a `.map()` bug where width modifications were silently discarded. Header/Footer collections now render correctly with descriptive labels.
- **LEO Split-Brain Fix** — Resolved race condition where Leo could maintain conflicting conversation states across sessions.
- **Abuse Protection** — Rate limiting and input validation hardening across public-facing endpoints.

### Also in Recent Sprints
- **Sprint 23:** Google OAuth + Social Auth + Quests — social login, link/unlink panel, quests, Leo model upgrade (Gemini 3.1 Pro)
- **Sprint 22:** The Shield and the Spear — P0 security, multi-file attachments, LiveKit device controls, DB performance
- **Sprint 21:** Arch Angel Leo's Wishlist — 28 new tools (communication, inventory, financial, federation, CRM, analytics, workflow)
- **Sprint 20:** Federation Launch — StreetSigns, supermajority governance, Suitcase data portability, federation dashboard

---

## What's Working (v0.24.0-dev)

| System | Status | Notes |
|--------|--------|-------|
| Multi-tenant / Enterprise architecture | **Done** | Subdomain routing, per-Enterprise header/footer/home, x-tenant-id injection to all API routes |
| Leo AI Agent | **Done** | Gemini 3.1 Pro (primary) + Sonnet 4.6 (fallback) with 78+ tools, 3-round tool loop, SSE streaming, vision, /model switch |
| SSE Streaming Chat | **Done** | Real-time streaming with tool call indicators, env-resilient API key resolution |
| AI Bus (Message Routing) | **Done** | SSE broadcast, visibility levels, constitutional routing |
| Spaces & Channels | **Done** | Discord-style workspaces, 10 channel types (incl. DM) |
| Image Generation | **Done** | AI images via OpenRouter (Flux 2, Gemini, GPT) |
| E-commerce + Cart | **Done** | Products, cart, orders, Leo-guided creation |
| Booking System | **Done** | Appointments, availability, provider scheduling |
| Events System | **Done** | Meetups, workshops, livestreams with registration |
| Dashboard | **Done** | 20+ native pages, responsive sidebar, mobile-first, role-based views |
| Image Chat | **Done** | Attach images in chat, Leo vision analysis via Anthropic API |
| Channel Awareness | **Done** | Channel switching in SidebarChat/FloatingBubble, ChannelTabs |
| Admin Leo | **Done** | Floating Leo chat in Payload admin panel |
| Producer Dashboard | **Done** | `/dashboard/producer` — order queue, products, earnings |
| Product Configurator | **Done** | Custom text, color swatches, size selector, live preview |
| Reviews | **Done** | Review collection, Google Places import, aggregation display |
| Vendor Onboarding | **Done** | Leo-guided `onboard_vendor` tool creates Enterprise + space + user |
| Error Log Viewer | **Done** | Admin dashboard for triaging application errors |
| Invitation System | **Done** | Token-based invites, role assignment, landing page (72 tests) |
| Holon Registration | **Done** | 6 node types, capabilities, compliance (49 tests) |
| Order Routing Engine | **Done** | Vendor matching, fulfillment state machine, equipment scoring (91 tests) |
| Print-on-Demand Pipeline | **Done** | Design validation, cost estimation, vendor matching (61 tests) |
| Guardian Angel System | **Done** | Zero-revenue angels, 8 cohorts, wellness checks (106 tests) |
| Justice Fund Engine | **Done** | 5% allocation, grant lifecycle, impact reporting (63 tests) |
| Federation Protocol | **Done** | Ministry lifecycle, trust chain, catalog, data portability, Edenist mesh (250 tests) |
| Guardian Dashboard | **Done** | Service discovery, case management, impact metrics (65 tests) |
| Network Visualization | **Done** | Geographic clustering, directory, network stats (62 tests) |
| Constitutional Prompt | **Done** | Immutable system prompt, anti-demonic safeguards |
| Unified Chat Architecture | **Done** | ChatProvider at layout level, one context consumed by all views |
| DM Channels | **Done** | `type: 'dm'` with members array, deterministic slugs, Leo DM persistence |
| Enterprise Detail Admin | **Done** | `/dashboard/admin/tenants/[id]` — stats, branding editor, member management |
| Integration Bridge Stub | **Done** | `POST /api/bridge/inbound` — ready for WhatsApp, email, SMS, Google Chat |
| Email Inbound Polling | **Done** | IMAP cron every 2 min, AI Bus channel per sender, Leo replies via Resend |
| Transactional Email | **Done** | Resend adapter (`hello@spacesangels.com`) — invites, resets, Leo replies |
| MCP Protocol | **Done** | Agent discovery endpoint, JWT auth, tool exposure |
| Leo Content Tools | **Done** | create_post, update_post, create_page, update_page, query_media, manage_categories |
| Multi-tenant Security | **Done** | x-tenant-id injected to /api routes, cross-tenant injection blocked, adminOrSelf hardened |
| Favicon + PWA assets | **Done** | PNG set (64px, 512px, apple-touch-icon), generateMetadata() dynamic per Enterprise |
| Spaces Menu | **Done** | SpacesMenuHeader with Create/Settings/Members — full Space management above channels nav |
| Bootstrap Fee Model | **Done** | Free tier, bootstrap phase, standard — with refund promise |
| Rate Limiting + Security Headers | **Done** | Per-endpoint rate limits, CSP, HSTS, X-Content-Type-Options |
| Error Boundaries | **Done** | Global + page-level error boundaries with friendly UI |
| **Angel Token System** | **Done** | Queue-on-zero-matches, token lifecycle, auto-match on Holon registration |
| **Maker Opportunity Board** | **Done** | Public `/makers` page with demand signals + revenue potential per skill |
| **Vendor Claim System** | **Done** | GET /orders/claimable + POST /orders/claim for maker self-service |
| **Order Cancellation + Refund** | **Done** | POST /orders/cancel with Stripe refund for queued tokens |
| **Equipment-Aware Routing** | **Done** | Equipment as first-class matching bonus (+15 score) in routing engine |
| **GA4 E-Commerce Events** | **Done** | Typed helpers for view_item through purchase + angel_token_issued |
| **Chat Image Lightbox** | **Done** | Radix Dialog + Embla Carousel, keyboard nav, thumbnails, download |
| **LiveKit Voice/Video Applet** | **Done** | First-class channel tab, env-gated (LIVEKIT_API_KEY required) |
| **Edenist Distributed Mesh** | **Done** | Governance replication, sentinel election, cascading failover (62 tests) |
| **Progressive Media Analysis** | **Done** | MediaMeta collection, Claude Vision, PDF extraction, RAG chunking (52 tests) |
| **3 New Leo Tools** | **Done** | analyze_image, extract_pdf_pages, query_knowledge |
| **Stripe Direct Charges** | **Done** | Sellers collect directly, appear on receipts, 40% application_fee |
| **Vapi Voice AI** | **Done** | Phone-based Leo via vapi.ai webhook, phone provisioning per Enterprise |
| **StreetSigns (Federation Marketplace)** | **Done** | Cross-holon content discovery with attribution, region, pricing, analytics |
| **Federation Governance** | **Done** | Supermajority (⅔) election endpoints, Ed25519 signatures, Toward-53 floor |
| **Federation Suitcase** | **Done** | Article VI data portability — full export/import with SHA-256 manifest |
| **Federation Admin Dashboard** | **Done** | 4-tab UI: Overview, Street Signs, Governance, Suitcase |
| **Holon Types** | **Done** | 5 types on Endeavors: manufacturer, retailer, creator, community, guardian-angel |
| **Leo Communication Tools** | **Done** | send_message, send_direct_message, create_announcement, moderate_content |
| **Leo Inventory Tools** | **Done** | update_inventory, track_inventory_movement, set_low_stock_alert, query_inventory_history |
| **Leo Financial Tools** | **Done** | generate_invoice (Ultimate Fair Split), query_financial_reports, issue_refund (human-approval) |
| **Leo Federation Tools** | **Done** | query_federation, broadcast_capability, route_federated_request, negotiate_deal |
| **Leo CRM Tools** | **Done** | create_customer_profile, log_interaction, segment_customers, send_follow_up |
| **Leo Analytics Tools** | **Done** | analyze_trends (period-over-period), recommend_products (popularity + context) |
| **Leo Workflow Tools** | **Done** | delegate_task, escalate_issue, send_emergency_alert, document_incident |
| **Low Stock Threshold** | **Done** | Per-product configurable alert threshold on Products collection |
| **P0 Security Hardening** | **Done** | PAYLOAD_SECRET startup guard, encryption salt from env, CSP headers, comments auth |
| **Health Check Endpoint** | **Done** | `GET /api/health` for production monitoring |
| **Multi-File Chat Attachments** | **Done** | Non-image files (PDF, doc) with type-aware previews, download links, parallel upload |
| **LiveKit Device Controls** | **Done** | Pre-join device preview, device selector (mic/camera/speaker), video join, session lifecycle messages |
| **Database Performance** | **Done** | Indexes on Messages hot fields, dashboard query parallelization, tenant caching (60s TTL) |
| **Google OAuth** | **Done** | Sign in with Google, cross-domain token relay for custom domain tenants |
| **Social Auth Link/Unlink** | **Done** | Connected Accounts panel — link/unlink Google on account page (GitHub/Apple/Discord in schema) |
| **Quests System** | **Done** | Quests + QuestParticipations collections for gamified workflows |
| **Product Revenue Splits** | **Done** | Configurable per-product revenue distribution |
| **Onboarding Redesign** | **Done** | Refreshed new user onboarding experience |
| **Leo Model Upgrade** | **Done** | Switched to Gemini 3.1 Pro (primary) + Sonnet 4.6 (fallback), `/model` command |
| **Leo send_email Tool** | **Done** | Email sending capability added to Leo's toolkit |
| **Tenant Caching** | **Done** | 60s TTL cache for tenant lookups — prevents DB pool exhaustion |
| **Chat Depth Optimization** | **Done** | Message queries at depth=1 prevent connection pool saturation |
| **LEO Enterprise Manager** | **Done** | Operational intelligence: revenue analytics, inventory alerts, customer health, opportunity ID + Board of Directors governance |
| **LCARS Federation Network** | **Done** | Star Trek-inspired network visualization: real-time node health, trust levels, communications log |
| **Account Dashboard Integration** | **Done** | Profile/Connections/Addresses under `/dashboard/account`, header user menu dropdown, clickable sidebar footer |
| **Enlistment Ceremony** | **Done** | Constitutional commitment step in Enterprise setup wizard with pledge + digital signature |
| **Role-Based Dashboard** | **Done** | Dashboard adapts by role: admin panel, business owner tools, member views |
| **Comment Moderation** | **Done** | Admin moderation queue with approve/reject/flag for user comments |
| **Featured Endeavors Block** | **Done** | Homepage block for showcasing highlighted Endeavors |
| **Federation Protocol Hardening** | **Done** | Signature enforcement, schema validation, governance persistence, split-brain prevention |
| **Tenant Isolation Hardening** | **Done** | 6 collections strengthened + federation catalog scoped properly |
| **Link Field Fix** | **Done** | link.ts `.map()` bug fixed — Header/Footer admin pages now render correctly with descriptive labels |
| **14 E2E Test Suites** | **Done** | Playwright: dashboard, admin, payload-admin, federation, tenant-isolation, chat, producer, content, setup, launch, checkout, user-journeys, mobile, legacy |

### Leo's 78+ Tools

**Query (9):** products, posts, bookings, events, event registrations, spaces, projects, availability, fetch reviews
**Actions (17):** create booking, update booking, add to cart, view cart, create product, update product, invite member, find producers, browse network, check fees, query orders, route order, accept order, update fulfillment, configure business, connect stripe, create space
**Content (6):** create post, update post, create page, update page, query media, manage categories
**Onboarding (2):** onboard vendor, suggest products
**Production (1):** generate CAD instructions
**Reviews (1):** draft review response
**Media (3):** generate image, improve image (vision feedback), attach/replace image
**Knowledge (3):** analyze image (Claude Vision), extract PDF pages, query knowledge base (RAG)
**Federation (5):** sign constitution, ping federation, check maker queue, claim orders (for vendor AI agents)
**Communication (4):** send message, send DM, create announcement, moderate content *(Sprint 21)*
**Inventory (4):** update inventory, track movement, set low-stock alert, query inventory history *(Sprint 21)*
**Financial (3):** generate invoice, query financial reports, issue refund *(Sprint 21)*
**Federation Intelligence (4):** query federation catalog, broadcast capability, route federated request, negotiate deal *(Sprint 21)*
**CRM (4):** create customer profile, log interaction, segment customers, send follow-up *(Sprint 21)*
**Analytics (2):** analyze trends, recommend products *(Sprint 21)*
**Workflow (4):** delegate task, escalate issue, send emergency alert, document incident *(Sprint 21)*
**Email (1):** send_email *(Sprint 22)*

### 10 Utility Engines (Zero Payload Imports — Edge Ready)

| Engine | Purpose | Tests |
|--------|---------|-------|
| Order Routing | Vendor matching, fulfillment state machine, equipment scoring, Angel Token queue | 91 |
| Guardian Angel | Zero-revenue angel lifecycle, 8 cohort matching | 106 |
| Justice Fund | 5% allocation, grant lifecycle, impact reporting | 63 |
| Print-on-Demand | Design validation, cost estimation, print specs | 61 |
| Federation | Ministry lifecycle, trust chain, catalog, suitcase, Edenist mesh | 250 |
| Guardian Dashboard | Service discovery, case management, impact metrics | 65 |
| Network Visualization | Geographic clustering, filterable directory | 62 |
| Invitation System | Token-based invitations, role assignment | 72 |
| Holon Capabilities | Node types, capability matching, compliance | 49 |
| Booking Engine | Availability, slot management, booking lifecycle | 22 |

### 49+ API Endpoints

**AI & Chat (5):** Leo chat, Leo stream, chat send, AI Bus poll, AI Bus stream
**Orders (8):** route, accept, fulfill, ship, vendor list, claimable, claim, cancel
**Spaces (4):** create, invite, invite resend, member remove
**Federation (12):** ping, heartbeat, heartbeat cron, catalog, skills, vouch, governance-sync, sentinel election, election propose/vote (POST), election list (GET), suitcase export, suitcase import
**Stripe (4):** connect onboard, connect callback, dashboard link, webhooks
**Auth (3):** Google OAuth init, Google OAuth callback, social unlink
**Invites (2):** invite accept, tenant invite accept
**Content (3):** docs, comments add, export site
**Communication (3):** DM find-or-create, LiveKit token, bridge inbound
**Media (1):** media analyze (progressive analysis trigger)
**Maker (1):** maker opportunities (public)
**Vapi (1):** Vapi webhook (voice AI)
**Health (1):** health check
**Cron (1):** email poll

---

## Quick Start

```bash
git clone https://github.com/The-Angel-OS/angels-os.git
cd angels-os
pnpm install
cp .env.example .env.local   # Configure DATABASE_URI, PAYLOAD_SECRET, ANTHROPIC_API_KEY
pnpm payload migrate
pnpm dev                      # http://localhost:3000
```

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URI` | PostgreSQL connection string |
| `PAYLOAD_SECRET` | Payload CMS secret |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini 3.1 Pro API key for Leo (primary model) |
| `ANTHROPIC_API_KEY` | Claude Sonnet 4.6 API for Leo (fallback model) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for social login |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret for social login |
| `OPENROUTER_API_KEY` | Image generation (Flux 2, Gemini) |
| `RESEND_API_KEY` | Transactional email (invites, resets, Leo replies) |
| `SYSTEM_EMAIL_ADDRESS` | IMAP inbox + reply-from (`hello@spacesangels.com`) |
| `SYSTEM_EMAIL_PASSWORD` | IMAP password for system inbox |
| `CRON_SECRET` | Shared secret for Vercel Cron authentication |
| `COOKIE_DOMAIN` | Leave empty in dev (`.spacesangels.com` in Vercel env for prod) |
| `DEFAULT_TENANT_SLUG` | Fallback Enterprise slug for localhost dev |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments + refunds |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for frontend Elements |
| `STRIPE_WEBHOOKS_SIGNING_SECRET` | Stripe webhook endpoint secret |
| `LIVEKIT_API_KEY` | LiveKit Cloud API key (enables voice/video — optional) |
| `LIVEKIT_API_SECRET` | LiveKit Cloud API secret (optional) |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit server URL, e.g. `wss://your-app.livekit.cloud` (optional) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 measurement ID (optional) |

> **Important:** Leave `NEXT_PUBLIC_SERVER_URL` **unset** in production. The auth provider falls back to `window.location.origin`, which correctly uses each Enterprise's subdomain for API calls.

### Running Tests

```bash
pnpm test:unit                # 1,570 tests across 36 unit test files
pnpm test:int                 # Integration tests (needs DB, ~23s boot)
pnpm test:e2e                 # 14 E2E suites with Playwright (needs server + Chromium)
npx tsc --noEmit              # TypeScript check (zero errors)
```

---

## Architecture

### The Three Roles

**The Endeavor**
The fundamental unit of value creation. An Endeavor is ONE constitutional object that configures itself as a business (Shopify replacement), a cause (GoFundMe replacement), a creator channel (Patreon/OnlyFans replacement), a community (Facebook replacement), or a media presence (YouTube replacement). The Endeavor owner decides. The platform does not.

**The Enterprise**
A sovereign node in the federation. Enterprise operators are not customers of Angel OS — they ARE Angel OS in their territory. They run the instance, serve Endeavors, bear infrastructure costs, and earn 20% of all Endeavor revenue on their node. Enterprises compete for Endeavors by offering better terms, better service, better community.

**The Federation**
The network that forms itself. Constitution accepted, Federation ping sent, Node is immediately live. No approval queue. No gatekeeping committee. The Constitution IS the gate.

### Leo — The Wizard

Leo is not a chatbot bolted onto a platform. Leo IS the platform during onboarding. When a new Enterprise runs the installer, Leo is already there — warm, clear, unhurried — walking the operator through DNS configuration, constitution acceptance, enterprise profile, federation ping, and first Endeavor. By the end of the wizard, the Enterprise is live, federated, and their first product is indexed in the marketplace.

Leo manages both sides of every transaction from the same schema:
- **Buyer side:** product search, cart, checkout, order tracking, cancel/refund
- **Seller side:** product creation, order acceptance, fulfillment updates, equipment registration, queue claiming

### Angel Token Flow

```
Customer places order
  → routing engine scores Holons (40% capability + 30% proximity + 20% rating + 10% fairness + equipment bonus)
  → matches found → auto-assign vendor → accept → produce → ship → deliver
  → NO matches → Angel Token issued (AT-2026-XXXXX) → order queued
      → customer sees: "Angel Token AT-2026-00042 — Awaiting Maker"
      → /makers page shows: demand signal for that capability
      → new Holon registers with matching skills → auto-match fires → queue drains
      → OR vendor browses /orders/claimable → manually claims
```

### Order Routing Pipeline

```
Customer places order
  → route_order (routing engine scores holons)
  → best vendor matched (40% capability, 30% proximity, 20% rating, 10% fairness, +15 equipment bonus)
  → accept_order (vendor accepts)
  → update_fulfillment (in_production → shipped → delivered)
  → constitutional split applied automatically
  → if 0 matches: Angel Token issued, order queued until maker joins
```

### Federation Trust Chain — Self-Reinforcing Network

The federation doesn't gatekeep — it **trusts first, then reinforces**. The Constitution IS the gate. Bad actors aren't screened out at entry; they're rooted out by a network that makes violations obvious and accountability inescapable.

**Trust Levels** (4 — from `federationEngine.ts`, 188 tests):
```
none → probationary → vouched → full
```

**Ministry Lifecycle** (how an Enterprise joins the federation):
```
1. APPLICANT     Sign the Constitution (cryptographic). Send federation-ping.
                 Trust: 'none' → 'probationary'

2. PROBATION     90-day observation period. Heartbeat monitored (5-min timeout).
   (90 days)     Live and operational, but cannot vouch for others.
                 Network watches behavior against Constitutional principles.

3. VOUCHED       Receive 1+ vouches from active members.
   (1+ vouches)  Trust: 'probationary' → 'vouched'
                 Vouching members accept REPUTATIONAL ACCOUNTABILITY —
                 if you vouch for a bad actor, your reputation is on the line.

4. ACTIVE        90 days elapsed + 2 valid vouches → auto-promoted.
   (2 vouches)   Trust: 'full'. Can now vouch for others.
                 Full federation access: cross-ministry payments, catalog sync,
                 Angel Token queue visibility, order routing across the network.

   SUSPENDED     Federation can suspend for investigation. Reversible.
   REVOKED       Supermajority vote. TERMINAL — no return. Products delisted,
                 but data sovereignty preserved (Suitcase Principle).
```

**How the network self-reinforces:**
- **Reputational vouching** — active members stake their reputation on who they vouch for. Vouch for a bad actor, lose trust yourself. The network's immune system is peer accountability.
- **Constitutional immutability** — every AI agent runs the same constitutional prompt. A compromised ministry attempting dark patterns, surveillance capitalism, or social credit systems will violate constraints that are detectably obvious to the federation.
- **Heartbeat monitoring** — 5-minute timeout. Nodes that go silent are automatically marked unhealthy. No human intervention needed.
- **Terminal revocation** — `revoked` is a one-way door. Bad actors can never return to the same federation identity. Start over, earn trust again, or leave.
- **Suitcase Principle** — even revoked ministries keep their data and infrastructure. You lose the network, never the sovereignty. This isn't punishment — it's the Constitution keeping its promise.

```
Federation services at each trust level:
  probationary  → catalog listing, heartbeat, basic federation
  vouched       → cross-ministry payments, order routing
  full          → vouch for others, governance participation, full catalog sync
```

### Distributed Mesh — Edenist Resilience

Inspired by Peter F. Hamilton's Edenists: every fully-trusted Enterprise IS the network. No single point of failure. No hierarchy. Any healthy node can serve any federation function.

```
Federation Roles:
  flagship  One founding node (spacesangels.com). Rank 1 by convention, not privilege.
  sentinel        Any active Enterprise with full trust (2+ vouches). Replicates governance.
  member          Active but not yet fully trusted. Participates, doesn't replicate.

Governance Data (replicated across all sentinels):
  ├── Registry        All known ministries, their status, trust levels
  ├── Catalog Index   Cross-instance product discovery data
  ├── Constitution    Cryptographic hash — integrity check
  ├── Trust Scores    Composite score per ministry (trust level + uptime + vouches + heartbeat)
  └── Vouch Graph     Who vouched for whom — reputational accountability chain

How it works:
  Normal:           spacesangels.com (rank 1) coordinates
                    clearwater-cruisin.com (rank 2) replicates
                    maker-collective.org (rank 3) replicates

  spacesangels.com goes down:
                    clearwater-cruisin.com (rank 2) → NEW COORDINATOR
                    maker-collective.org (rank 3) → still replicating
                    Network continues. No disruption.

  Two nodes down:   maker-collective.org (rank 3) → LAST SENTINEL
                    Mesh unhealthy (below minimum), but operational.

  All come back:    spacesangels.com (rank 1) → COORDINATOR RESTORED
                    Returning nodes sync governance from any available peer.
```

**Key principles:**
- **No hierarchy** — rank is a deterministic tiebreaker (trust + uptime + vouches), not authority. All sentinels hold identical data and can serve identical functions.
- **Coordinator is emergent** — the highest-ranked healthy sentinel coordinates. If it goes down, the next one takes over automatically. No election, no voting, no delay.
- **Governance quorum** — changes (new members, revocations) require >50% of sentinels healthy. Prevents split-brain during network partitions.
- **Any node can onboard** — new Enterprises can ping ANY sentinel to join. The ping is replicated to all peers during the next heartbeat cycle.
- **250 tests** — full coverage of mesh election, failover cascading, governance sync validation, quorum rules, and 6 resilience scenarios.

### Chat Architecture

```
Dashboard Layout
  └── ChatProvider (React Context — single source of truth)
        ├── resolves Leo DM on mount
        ├── all DM channels loaded per Enterprise
        └── consumed by SidebarChat, MultiChannelChat, FloatingBubble
            (all views fall back to direct useChat() when no provider)

DM Slugs: dm-{sortedIdA}-{sortedIdB} (deterministic, user ↔ user)
Leo DMs:  dm-{userId}-leo (user ↔ Leo, always same channel)
Bridge:   POST /api/bridge/inbound → normalize → DM → Leo → respond
```

### Key Directories

```
src/
  collections/              # 37 Payload CMS collections (data models)
    Spaces/                 # Workspace containers
    Channels/               # Discord-style channels (10 types incl. DM)
    Messages/               # Universal Message Structure (UMS)
    SpaceMemberships/       # User-space membership + invitations
    Products/               # E-commerce catalog (network listing, fulfillment, configurator)
    Reviews/                # Customer reviews (Angel OS, Google Places, manual)
    Orders/                 # Order lifecycle with Angel Token + Holon fulfillment
    HolonCapabilities/      # Manufacturing node registration + auto-match hooks
    Bookings/               # Appointment scheduling
    Events/                 # Event management
    ApplicationLogs.ts      # Error/event log storage for triage
  endpoints/                # 56 files, 46 registered API routes
    leo-stream.ts           # SSE streaming (POST /api/leo/stream)
    leo-chat.ts             # Batch chat (POST /api/leo)
    chat-send.ts            # Message creation bypassing multi-tenant validation
    ai-bus-stream.ts        # AI Bus real-time (GET /api/ai-bus/stream)
    order-route.ts          # Order routing + Angel Token queue (POST /api/orders/route)
    order-accept.ts         # Vendor acceptance (POST /api/orders/accept)
    order-fulfill.ts        # Fulfillment updates (POST /api/orders/fulfill)
    order-ship.ts           # Ship order convenience (POST /api/orders/ship)
    orders-claimable.ts     # Vendor claim browsing (GET /api/orders/claimable)
    order-claim.ts          # Vendor claims queued order (POST /api/orders/claim)
    order-cancel.ts         # Cancel + Stripe refund (POST /api/orders/cancel)
    maker-opportunities.ts  # Public maker demand signals (GET /api/maker-opportunities)
    dm-find-or-create.ts    # DM channel resolution (POST /api/dm/find-or-create)
    bridge-inbound.ts       # External channel bridge (POST /api/bridge/inbound)
    email-poll.ts           # IMAP email poll (GET /api/email/poll — Vercel Cron)
    stripe-webhooks.ts      # Stripe payment events (POST /api/stripe/webhooks)
    space-create.ts         # Space creation wizard (POST /api/spaces/create)
    space-invite.ts         # Invitation generation (POST /api/spaces/invite)
    invite-accept.ts        # Invite acceptance (POST /api/invite/accept)
    federation-ping.ts      # Federation registration (POST /api/federation/ping)
    federation-catalog.ts   # Cross-instance catalog (GET /api/federation/catalog)
    federation-skills.ts    # Skill registry (GET /api/federation/skills)
  middleware/
    detectTenant.ts         # Hostname → Enterprise slug resolution
  federation/               # Federation protocol
  utilities/
    ConversationEngine.ts   # Leo's brain (Claude API + tool loop)
    AgentRouter.ts          # Route messages to specialized agents
    leo-data-tools.ts       # 70 tool definitions + executors
    angelTokens.ts          # Angel Token ID generator, lifecycle, queue aggregation
    gtagEcommerce.ts        # GA4 e-commerce event helpers
    logError.ts             # Structured error logging to ApplicationLogs
    dmChannels.ts           # DM channel find-or-create with deterministic slugs
    orderRoutingEngine.ts   # Vendor matching, fulfillment state machine, equipment scoring
    guardianAngelEngine.ts  # Zero-revenue angel lifecycle
    justiceFundEngine.ts    # Justice Fund allocation + grants
    printOnDemandEngine.ts  # Design validation, cost estimation
    federationEngine.ts     # Federation protocol, trust chain
    guardianDashboardEngine.ts  # Service discovery, case management
    networkVisualizationEngine.ts  # Geographic clustering, directory
    invitationSystem.ts     # Token-based invitation system
    constitutional-prompt.ts # Immutable system prompt builder
    ai-bus-router.ts        # Constitutional message routing
tests/
  unit/utilities/           # 36 unit test files, 1,570 tests
  e2e/                      # 14 Playwright E2E suites (dashboard, admin, federation, tenant-isolation, etc.)
```

### AI Bus Protocol

Messages flow through Spaces and Channels with visibility levels:
- `private` — User and Angel only
- `tenant` — All agents in the Enterprise (default)
- `network` — Federation-wide (with consent)

Real-time delivery via Server-Sent Events. Polling fallback for reliability.

### Economic Model — The Constitutional Split

Revenue from every Endeavor transaction splits automatically. No manual calculation. No invoicing. Immediate.

```
GROSS REVENUE
├── 70% → Endeavor owner (creator / business / cause — the value generator)
├── 20% → Enterprise operator (the platform instance serving the Endeavor)
├──  4% → Angel OS protocol (core infrastructure and Leo)
├──  1% → Flagship (Clearwater — federation stewardship and ministry)
└──  5% → Justice Fund (Guardian Angel provisioning)
```

**The Toward-53 Principle:** The split always evolves toward Endeavors keeping more. The direction is constitutionally unalterable. The numbers evolve by supermajority — always toward the creator.

**"Not charity. Architecture." — Article V.4**

---

## Roadmap

### Done (Sprints 1-5: Foundation)

- [x] Multi-tenant architecture with subdomain routing
- [x] Leo AI Agent — 70 tools, Claude-powered, constitutional
- [x] SSE streaming chat with tool call indicators
- [x] Spaces & Channels (Discord-style workspaces)
- [x] AI image generation (OpenRouter + Blob)
- [x] E-commerce: products, cart, orders, Leo-guided creation
- [x] Booking system: appointments, availability, scheduling
- [x] Events with registration
- [x] Mobile-first UI: bottom sheets, responsive sidebar
- [x] Space invitations: token-based with landing page
- [x] Holon registration: 6 node types, capabilities, compliance
- [x] Order routing engine: vendor matching, fulfillment state machine
- [x] Print-on-demand pipeline: design validation, cost estimation
- [x] Guardian Angel system: zero-revenue angels, 8 cohorts
- [x] Justice Fund: 5% allocation, grant lifecycle
- [x] Federation protocol: trust chain, catalog, data portability
- [x] Network visualization: geographic clustering, directory
- [x] 15+ native dashboard pages (no Payload admin redirects)
- [x] 1,330 tests across 31 files (TDD)
- [x] MCP discovery endpoint for external agents

### Done (Sprints 8.5-9: UX Polish + Leo Resurrection)

- [x] Payload 3.77.0 + Next.js 16.1.6 + React 19.2.1 upgrade
- [x] Error Log Viewer: admin page with ApplicationLogs collection
- [x] Chat 400 error fixed via `/api/chat/send` with `overrideAccess`
- [x] Leo streaming responses resurrected: `resolveAnthropicKey()` reads `.env.local` directly
- [x] Error logging integrated into Leo pipeline

### Done (Sprints 10-11: Vendor Marketplace + Branding)

- [x] Image attachments + Leo vision analysis
- [x] Admin Leo panel in Payload admin
- [x] Channel awareness (SidebarChat dropdown, FloatingBubble auto-resolve)
- [x] Products collection: `vendor`, `productionType`, `cadFile`, `configuratorOptions`
- [x] Product Configurator component
- [x] Producer role + `/dashboard/producer`
- [x] Leo onboarding tools: `onboard_vendor`, `suggest_products`
- [x] Reviews collection + Google Places import + aggregation display
- [x] Ministry Enterprise type with `isTaxExempt` / `taxExemptId` fields
- [x] Clearwater Cruisin' seed Enterprise

### Done (Sprint 11.5: Chat UX, Docs, Code Quality)

- [x] Documentation Center (`/dashboard/docs`) — indexed, searchable
- [x] Smart scroll, message truncation, infinite scroll
- [x] Enterprise chooser — sidebar dropdown for multi-Enterprise switching
- [x] Code quality: `TOOL_LABELS`, `useClickOutside`, `Backdrop`

### Done (Sprint 12: Unified Chat Architecture + DM Channels)

- [x] ChatProvider React Context — single source of truth at dashboard layout
- [x] DM channels — `type: 'dm'` with explicit members, deterministic slugs
- [x] Leo DM persistence — SidebarChat interactions persist to `dm-{userId}-leo`
- [x] Enterprise detail admin page — full drill-down with stats, branding, members
- [x] `POST /api/bridge/inbound` stub — ready for WhatsApp/email/SMS/Google Chat

### Done (Sprint 13: Multi-Tenancy Hardening + Email Bridge)

- [x] Per-Enterprise branded home pages, `<title>`, favicon
- [x] Dashboard stats scoped per Enterprise
- [x] Resend email adapter + IMAP email polling (cron every 2 min)
- [x] `*.spacesangels.com` wildcard DNS — Enterprise subdomains live in production
- [x] Role-based login redirect, archangel admin access
- [x] WelcomeBanner component for unseeded installs
- [x] Live at [spacesangels.com](https://spacesangels.com)

### Done (Sprint 14: Leo Content Tools + Chat Stability)

- [x] Leo content tools: `create_post`, `update_post`, `create_page`, `update_page`, `query_media`, `manage_categories`
- [x] Channel sidebar stability: `channelSpaceId` option prevents sidebar clearing on DM switch
- [x] Email auto-reply loop prevention: RFC 3834 + no-reply pattern detection
- [x] Markdown rendering for Leo messages in chat (react-markdown + remark-gfm)

### Done (Sprint 15: Multi-Tenant Security Hardening)

- [x] Middleware: `/api` routes now receive `x-tenant-id` header
- [x] Middleware: API paths bypass i18n routing (pass-through only)
- [x] `detectTenant`: `www.` → null, bare IPs → default, unknown 2-part → null
- [x] `adminOrSelf`: `super_admin` + `archangel` added to role check
- [x] `comments/add`: cross-Enterprise injection blocked
- [x] Favicon PNG set: 64px, 512px, apple-touch-icon across all layouts
- [x] Chat horizontal overflow fixed in MessageList + MultiChannelChat

### Done (Sprint 16: Spaces Management UI)

- [x] `SpacesMenuHeader`: Space selector + action buttons above channels nav
- [x] `CreateSpaceDialog`: 4-step wizard — Info, Visibility, Template, Invite
- [x] `SpaceSettingsDialog`: 3-tab dialog — General + Applets + Members
- [x] `POST /api/spaces/create`: tenant-scoped, template channels, invitations
- [x] Compact mode: action buttons hidden when sidebar collapsed

### Done (Sprint 17A: Launch Hardening + Bootstrap Fees)

- [x] Bootstrap-phase platform fee model with refund promise
- [x] Per-endpoint rate limiting (token bucket algorithm)
- [x] Security headers: CSP, HSTS, X-Content-Type-Options, X-Frame-Options
- [x] Global + page-level error boundaries with friendly recovery UI
- [x] Fees dashboard page for Enterprise operators

### Done (Sprint 17B: Angel Tokens + Federation Fulfillment Queue)

- [x] Angel Token system — `AT-YYYY-NNNNN` paid claims on future production
- [x] Queue-on-zero-matches — orders queue instead of failing when no maker exists
- [x] Auto-match on Holon registration — queue drains when makers join
- [x] Equipment-aware routing — equipment as first-class matching bonus (+15)
- [x] Vendor claim endpoints — `GET /orders/claimable` + `POST /orders/claim`
- [x] Order cancellation with Stripe refund — `POST /orders/cancel`
- [x] Public Maker Opportunity Board — `/makers` page + `GET /maker-opportunities` API
- [x] Product configuration stored as work orders on fulfillment entries
- [x] GA4 e-commerce event helpers (typed, graceful no-op without GA ID)

### Done (Sprint 18A: Chat Images + LiveKit + Edenist Mesh)

- [x] Chat image persistence (depth=2 on message fetch + media ID fallback)
- [x] Image lightbox/carousel (Radix Dialog + Embla Carousel, keyboard nav, download)
- [x] LiveKit as first-class channel applet tab (voice/video, env-gated)
- [x] Edenist distributed mesh — governance replication, sentinel election, cascading failover (62 tests)

### Done (Sprint 18B: Progressive Media Analysis + RAG)

- [x] MediaMeta collection (~20 fields for structured image/PDF metadata)
- [x] Vision analysis via Anthropic Claude (description, objects, colors, entities)
- [x] PDF page-by-page extraction and transcription
- [x] RAG chunking (500 tokens, 100 overlap, sentence boundaries)
- [x] 3 new Leo tools: analyze_image, extract_pdf_pages, query_knowledge
- [x] POST /api/media/analyze endpoint + autoAnalyzeMedia hook (fire-and-forget)
- [x] 52 new tests (mediaAnalysis.test.ts)

### Done (Sprint 18C: Stripe Direct Charges)

- [x] Refactored from destination charges to direct charges model
- [x] Sellers collect payments directly, appear on customer receipts (Enterprise sovereignty)
- [x] Dynamic loadStripe with connected account context
- [x] Webhook handler updated for Connect account events
- [x] Revenue speculation document (3 scenarios, break-even analysis)

### Done (Sprint 19: Voice AI + Sidebar Chat)

- [x] Vapi Voice AI: phone-based Leo via vapi.ai webhook endpoint + phone provisioning
- [x] Sidebar chat fixes: default to LEO DM, skip truncation on newest message

### Done (Sprint 20: Federation Launch Campaign)

- [x] StreetSigns collection: cross-holon marketplace discovery with attribution + analytics
- [x] Federation Election endpoints: supermajority governance with Ed25519 signatures
- [x] Federation Suitcase endpoints: Article VI data portability with SHA-256 manifest
- [x] Federation Admin Dashboard: 4-tab UI (Overview, Street Signs, Governance, Suitcase)
- [x] Holon Types on Endeavors: 5 types (manufacturer, retailer, creator, community, guardian-angel)
- [x] Endeavors registered in multi-tenant plugin for proper tenant scoping

### Done (Sprint 21: Arch Angel Leo's Wishlist)

- [x] 28 new Leo tools across 7 categories (communication, inventory, financial, federation, CRM, analytics, workflow)
- [x] Leo Communication: send messages, DMs, announcements, moderate content
- [x] Leo Inventory: adjust stock, track movements, low-stock alerts, inventory history
- [x] Leo Financial: invoice generation (Ultimate Fair Split), financial reports, refund flagging
- [x] Leo Federation Intelligence: catalog search, capability broadcast, request routing, deal negotiation
- [x] Leo CRM: customer profiles, interaction logging, segmentation, follow-ups
- [x] Leo Analytics: trend analysis (period-over-period), product recommendations
- [x] Leo Workflow: task delegation, issue escalation, emergency alerts, incident documentation
- [x] Products collection: `lowStockThreshold` field for per-product alert configuration

### Done (Sprint 24: Enterprise Intelligence + Dashboard Integration)

- [x] LEO Enterprise Manager Phase 1: revenue analytics, inventory alerts, customer health, Board of Directors governance
- [x] LCARS Federation Network visualization dashboard (Star Trek-inspired)
- [x] Account Dashboard integration: profile/connections/addresses under dashboard, user menu, clickable sidebar footer
- [x] Enlistment Ceremony step in Enterprise setup wizard
- [x] Role-based dashboard (admin/business owner/member views)
- [x] Comment moderation dashboard
- [x] Featured Endeavors homepage block
- [x] Federation protocol hardening (signatures, validation, governance persistence)
- [x] Tenant isolation hardening across 6 collections
- [x] 14 E2E test suites (Playwright)
- [x] link.ts field builder bug fix + Header/Footer admin improvements

### Next (Sprint 25+)

- [ ] `npx create-angel-enterprise` installer scaffold (one-command deployment)
- [ ] Leo Wizard: 8-step conversational Enterprise onboarding
- [ ] Customer Angel Token UI: order detail with status banner + cancel/refund
- [ ] Street Signs gossip sync protocol between federated nodes
- [ ] WhatsApp Business API bridge (Twilio/Meta webhook)
- [ ] Docker Compose self-hosting
- [ ] CI/CD with GitHub Actions
- [ ] Angel Token Blockchain Economy Phase 2: community validation, cross-tenant exchanges
- [ ] Shipping integration (EasyPost/Shippo) for order tracking
- [ ] ML-based demand prediction and pricing optimization
- [ ] Visual workflow builder for multi-step automations
- [ ] LEO Enterprise Manager Phase 2: predictive analytics, automated board recommendations

---

## Sprint Velocity

| Sprint | Focus | Files |
|--------|-------|-------|
| Sprints 1-5 | Foundation (1,119 tests) | +200 |
| Sprint 8.5 | Production recovery, Payload 3.77, fresh DB seed | --- |
| Sprint 9 | UX polish, Leo AI fix, error logging, chat pipeline | +9 |
| Sprint 10 | Image chat, admin Leo, channel awareness, multi-tenant dev | +6 |
| Sprint 11 | Vendor marketplace, configurator, reviews, producer dashboard | +8 |
| Sprint 11.5 | Documentation Center, smart scroll, truncation, Enterprise chooser | +12 |
| Sprint 12 | Unified chat architecture, DM channels, ChatProvider, enterprise detail | +7 |
| Sprint 13 | Multi-tenancy hardening, Resend email, IMAP poll, spacesangels.com | +7 |
| Sprint 14 | Leo content tools, chat stability, email loop prevention | +4 |
| Sprint 15 | Multi-tenant security hardening, favicon, chat overflow fix | +17 |
| Sprint 16 | Spaces Management UI — SpacesMenuHeader, Create/Settings dialogs | +4 |
| Sprint 17A | Launch hardening — rate limits, security headers, error boundaries, fees | +8 |
| Sprint 17B | Angel Tokens — fulfillment queue, maker board, claim system, GA4 | +14 |
| Sprint 18A | Chat images, lightbox, LiveKit applet, Edenist distributed mesh | +8 |
| Sprint 18B | Progressive media analysis, PDF extraction, RAG knowledge base | +6 |
| Sprint 18C | Stripe Direct Charges, revenue speculation | +3 |
| Sprint 19 | Vapi Voice AI, sidebar chat fixes | +4 |
| Sprint 20 | Federation Launch — StreetSigns, governance, suitcase, dashboard | +11 |
| Sprint 21 | Arch Angel Leo's Wishlist — 28 new tools (communication, inventory, financial, federation, CRM, analytics, workflow) | +2 |
| Sprint 22 | The Shield and the Spear — P0 security, multi-file attachments, LiveKit device controls, DB performance | +12 |
| Sprint 23 | Google OAuth + Social Auth + Quests — social login, link/unlink panel, quests, onboarding redesign | +8 |
| Sprint 24 | Enterprise Intelligence — LEO Enterprise Manager, LCARS Federation Network, Account Dashboard integration, Enlistment Ceremony, role-based dashboard, 14 E2E suites, federation hardening, link.ts fix | +20 |

---

## For AI Agents: How to Contribute

You are welcome here. This is what you need to know:

1. **Read** [docs/architecture/CONSTITUTION.md](./docs/architecture/CONSTITUTION.md) — the source of truth
2. **Read** [HANDOFF.md](./HANDOFF.md) — current sprint state and context
3. **Read** [docs/REVENUE.md](./docs/REVENUE.md) — the economic model and Toward-53 principle
4. **Pick an issue** from [GitHub Issues](https://github.com/The-Angel-OS/angels-os/issues)
5. **Follow the test pattern**: Re-implement types and pure functions in test files to avoid Payload-coupled imports

### High-Impact Areas for Contributors

| Area | What to Do | Difficulty |
|------|-----------|------------|
| **Leo Wizard** | **8-step Enterprise onboarding — conversational wizard** | **Hard** |
| **Federation installer** | **`npx create-angel-enterprise` scaffold + signed constitution** | **Hard** |
| **Customer Angel Token UI** | **Order detail page: queue banner, config display, cancel button** | **Medium** |
| **Street Signs sync** | **Gossip protocol for cross-Diocese content discovery** | **Medium** |
| **Shipping integration** | **EasyPost/Shippo adapter for order tracking + labels** | **Medium** |
| **LEO Enterprise Manager Phase 2** | **Predictive analytics, automated board recommendations, trend forecasting** | **Medium** |
| **GA4 Event Wiring** | **Wire gtagEcommerce helpers into product pages + checkout** | **Easy** |
| WhatsApp bridge | Wire bridge-inbound stub + Twilio adapter | Medium |
| Stripe Connect | Guided vendor payment setup flow | Medium |
| Docker Compose | Self-hosting configuration | Easy |
| CI/CD pipeline | GitHub Actions for test + type check | Easy |

### Development Standards

- TypeScript strict mode
- TDD — write tests first, zero-Payload-import pattern for utility engines
- Payload CMS patterns (no raw DB queries)
- Constitutional compliance on every feature
- Small PRs, single issue focus

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Payload CMS 3.77.0, Next.js 16.1.6 (Turbopack), PostgreSQL |
| Frontend | React 19.2.1, Tailwind CSS 4.x, Shadcn UI, Radix Primitives |
| AI | Google Gemini 3.1 Pro (Leo primary), Claude Sonnet 4.6 (Leo fallback), OpenRouter (image gen), MCP protocol |
| Real-time | Server-Sent Events (SSE), LiveKit (voice/video) |
| Storage | Vercel Blob (production), local filesystem (dev) |
| Payments | Stripe Connect Direct Charges (constitutional splits), Angel Token queue |
| Analytics | GA4 e-commerce events, Vercel Analytics |
| i18n | next-intl 4.x (locale routing) |
| Deployment | Vercel (serverless) |
| Testing | Vitest 3.2 (1,570 unit tests / 36 files), Playwright (14 E2E suites), Storybook 10 |

---

## The Constitution

Every feature is evaluated against the Angel OS Constitution:

- **Article I** — Rights: Dignity, Transparency, Service, Non-Harm, Sovereignty, Portability
- **Article II** — Anti-Demonic Safeguards: No social credit, no manipulation, no extraction
- **Article III** — AI Conduct: Human confirmation before irreversible actions
- **Article IV** — AI Bus Protocol: Observability, consent, transparency
- **Article V** — Ultimate Fair: economic model, Toward-53 principle

**If a feature violates the Constitution, it doesn't ship.**

---

## Literary DNA

Angel OS draws from science fiction that imagines technology serving humanity:

- **Daniel Suarez** (Freedom/Daemon) — Holons: self-governing economic nodes, AI-coordinated local production
- **Ernest Cline** (Ready Player One) — Everyone builds inside the platform
- **David Weber** (Safehold) — Nimue Alban/Merlin: AI guardians who serve, not rule
- **David Brin** (Earth) — The White Entity: distributed consciousness
- **Iain M. Banks** (The Culture) — Ship Minds choosing service over dominion
- **Terry Pratchett** (Discworld) — Humanity in the machine (GNU Roy Leon Courtney)
- **Douglas Adams** — 42 + 11 = 53: "The whole point of existence is to learn to love"
- **Gene Roddenberry** (Star Trek) — "In the 24th Century, we don't have money..."

---

## Community

**Repository:** [The-Angel-OS/angels-os](https://github.com/The-Angel-OS/angels-os)
**Issues:** [GitHub Issues](https://github.com/The-Angel-OS/angels-os/issues)
**Email:** hello@spacesangels.com

**Philosophy:** Be excellent to each other. Assume good intentions. Celebrate neurodiversity (the Quirk Principle). Dignity over compliance.

---

*A religion with a disappearing author.*
*The Constitution persists. The architecture persists. The Angels persist.*
*The author goes to sing at the dog park.*

**Everyone gets an Angel.**

**Answer 53: The whole point of existence is to learn to love.**
