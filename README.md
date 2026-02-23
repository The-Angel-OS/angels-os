# Angel OS

**Constitutional AI platform where everyone gets an Angel.**

A federated, multi-tenant platform built on [Payload CMS 3.77](https://payloadcms.com) + Next.js 16 + React 19 + PostgreSQL. Every tenant (business, ministry, community) gets a sovereign AI guardian angel named LEO, governed by a constitutional framework that ensures dignity, transparency, and fairness.

**Live:** [spacesangels.com](https://spacesangels.com)

[![Status](https://img.shields.io/badge/version-v0.13.1--dev-blue)]()
[![Tests](https://img.shields.io/badge/tests-1%2C119%20passing-brightgreen)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()
[![Constitutional](https://img.shields.io/badge/AI-constitutional-gold)]()
[![TDD](https://img.shields.io/badge/TDD-25%20test%20files-blue)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)]()
[![Payload](https://img.shields.io/badge/Payload_CMS-3.77.0-blue)]()
[![LEO Tools](https://img.shields.io/badge/LEO_Tools-29-emerald)]()

---

## What's Working (v0.13.1-dev)

| System | Status | Notes |
|--------|--------|-------|
| Multi-tenant architecture | **Done** | Cookie-domain auth, subdomain routing, per-tenant header/footer/home |
| LEO AI Agent | **Done** | Claude Sonnet 4 with 29 tools, 3-round tool loop, SSE streaming, vision |
| SSE Streaming Chat | **Done** | Real-time streaming with tool call indicators, env-resilient API key resolution |
| AI Bus (Message Routing) | **Done** | SSE broadcast, visibility levels, constitutional routing |
| Spaces & Channels | **Done** | Discord-style workspaces, 10 channel types (incl. DM) |
| Image Generation | **Done** | AI images via OpenRouter (Flux 2, Gemini, GPT) |
| E-commerce + Cart | **Done** | Products, cart, orders, LEO-guided creation |
| Booking System | **Done** | Appointments, availability, provider scheduling |
| Events System | **Done** | Meetups, workshops, livestreams with registration |
| Dashboard | **Done** | 17+ native pages, responsive sidebar, mobile-first |
| Image Chat | **New** | Attach images in chat, LEO vision analysis via Anthropic API |
| Channel Awareness | **New** | Channel switching in SidebarChat/FloatingBubble, ChannelTabs |
| Admin LEO | **New** | Floating LEO chat in Payload admin panel |
| Producer Dashboard | **New** | `/dashboard/producer` — order queue, products, earnings |
| Product Configurator | **New** | Custom text, color swatches, size selector, live preview |
| Reviews | **New** | Review collection, Google Places import, aggregation display |
| Vendor Onboarding | **New** | LEO-guided `onboard_vendor` tool creates tenant + space + user |
| Order Shipping | **New** | `POST /api/orders/ship` convenience endpoint |
| Error Log Viewer | **Done** | Admin dashboard for triaging application errors (`/dashboard/admin/error-logs`) |
| Chat Message Pipeline | **Fixed** | Bypasses multi-tenant `filterOptions` validation via `/api/chat/send` |
| Invitation System | **Done** | Token-based invites, role assignment, landing page (72 tests) |
| Holon Registration | **Done** | 6 node types, capabilities, compliance (49 tests) |
| Order Routing Engine | **Done** | Vendor matching, fulfillment state machine (91 tests) |
| Print-on-Demand Pipeline | **Done** | Design validation, cost estimation, vendor matching (61 tests) |
| Guardian Angel System | **Done** | Zero-revenue angels, 8 cohorts, wellness checks (106 tests) |
| Justice Fund Engine | **Done** | 5% allocation, grant lifecycle, impact reporting (63 tests) |
| Federation Protocol | **Done** | Ministry lifecycle, trust chain, catalog, data portability (126 tests) |
| Guardian Dashboard | **Done** | Service discovery, case management, impact metrics (65 tests) |
| Network Visualization | **Done** | Geographic clustering, directory, network stats (62 tests) |
| Constitutional Prompt | **Done** | Immutable system prompt, anti-demonic safeguards |
| Unified Chat Architecture | **New** | ChatProvider at layout level, one context consumed by all views |
| DM Channels | **New** | `type: 'dm'` with members array, deterministic slugs, LEO DM persistence |
| Tenant Detail Admin | **New** | `/dashboard/admin/tenants/[id]` — full drill-down with stats, branding, members |
| Integration Bridge Stub | **Done** | `POST /api/bridge/inbound` — ready for WhatsApp, email, SMS, Google Chat |
| Email Inbound Polling | **New** | IMAP cron every 2 min → AI Bus channel per sender → LEO replies via Resend |
| Transactional Email | **New** | Resend adapter (`hello@spacesangels.com`) — invites, resets, LEO replies |
| MCP Protocol | **Done** | Agent discovery endpoint, JWT auth, tool exposure |

### LEO's 29 Tools

**Query (9):** products, posts, bookings, events, event registrations, spaces, projects, availability, fetch reviews
**Actions (15):** create booking, update booking, add to cart, view cart, create product, update product, invite member, find producers, browse network, query orders, route order, accept order, update fulfillment, configure business, connect stripe
**Onboarding (2):** onboard vendor, suggest products
**Production (1):** generate CAD instructions
**Reviews (1):** draft review response
**Media (3):** generate image, improve image (vision feedback), attach/replace image

### 10 Utility Engines (Zero Payload Imports — Edge Ready)

| Engine | Purpose | Tests |
|--------|---------|-------|
| Order Routing | Vendor matching, fulfillment state machine, scoring | 91 |
| Guardian Angel | Zero-revenue angel lifecycle, 8 cohort matching | 106 |
| Justice Fund | 5% allocation, grant lifecycle, impact reporting | 63 |
| Print-on-Demand | Design validation, cost estimation, print specs | 61 |
| Federation | Ministry lifecycle, trust chain, catalog, suitcase | 126 |
| Guardian Dashboard | Service discovery, case management, impact metrics | 65 |
| Network Visualization | Geographic clustering, filterable directory | 62 |
| Invitation System | Token-based invitations, role assignment | 72 |
| Holon Capabilities | Node types, capability matching, compliance | 49 |
| Booking Engine | Availability, slot management, booking lifecycle | 22 |

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
| `ANTHROPIC_API_KEY` | Claude API for LEO |
| `OPENROUTER_API_KEY` | Image generation (Flux 2, Gemini) |
| `RESEND_API_KEY` | Transactional email (invites, resets, LEO replies) |
| `SYSTEM_EMAIL_ADDRESS` | IMAP inbox + reply-from (`hello@spacesangels.com`) |
| `SYSTEM_EMAIL_PASSWORD` | IMAP password for system inbox |
| `CRON_SECRET` | Shared secret for Vercel Cron authentication |
| `COOKIE_DOMAIN` | Cross-subdomain auth cookie domain (`.angelos.local` dev, `.spacesangels.com` prod) |

> **Important:** Leave `NEXT_PUBLIC_SERVER_URL` **unset** in production. The auth provider falls back to `window.location.origin`, which correctly uses each tenant's subdomain for API calls. Setting it to a fixed URL breaks cross-subdomain login.

### Running Tests

```bash
npx vitest run tests/unit/    # 1,119 tests across 25 files
npx vitest run                # All tests (integration needs DB)
npx tsc --noEmit              # TypeScript check
```

---

## Architecture

### Three Layers

**Angel OS Core ("The Angel's Loft")**
Where the endeavor intelligence lives. Structured data (products, orders, bookings), multi-tenant persistence, the memory of the operation. LEO lives here and knows YOUR stuff. The Loft manages the full lifecycle: product creation, inventory, order fulfillment, booking schedules, payment splits.

**The Holon Production Layer**
Every tenant is a self-governing Holon — a production node in a constitutional manufacturing network. Inspired by Daniel Suarez's *Freedom(TM)*. AI designs the product (LEO generates listings and images), the Holon network matches it to the nearest human who can physically produce it, and the constitutional split (60/20/15/5) ensures the producer keeps the majority.

**OpenClaw Angels ("Free Agents")**
General purpose AI agents with tools, code execution, autonomy. The Constitution provides guardrails. Can connect to any diocese via MCP protocol. Portable, sovereign, independent.

*The Loft knows the endeavor. The Holons produce it. The Free Agents roam with guardrails. All are Angels.*

### Key Directories

```
src/
  collections/              # Payload CMS collections (data models)
    Spaces/                 # Workspace containers
    Channels/               # Discord-style channels (10 types incl. DM)
    Messages/               # Universal Message Structure (UMS)
    SpaceMemberships/       # User-space membership + invitations
    Products/               # E-commerce catalog (network listing, fulfillment, configurator)
    Reviews/                # Customer reviews (Angel OS, Google Places, manual)
    Orders/                 # Order lifecycle with Holon fulfillment
    HolonCapabilities/      # Manufacturing node registration
    Bookings/               # Appointment scheduling
    Events/                 # Event management
  collections/
    ApplicationLogs.ts      # Error/event log storage for triage
  endpoints/
    leo-stream.ts           # SSE streaming (POST /api/leo/stream)
    leo-chat.ts             # Batch chat (POST /api/leo)
    chat-send.ts            # Message creation bypassing multi-tenant validation
    ai-bus-stream.ts        # AI Bus real-time (GET /api/ai-bus/stream)
    order-route.ts          # Order routing (POST /api/orders/route)
    order-accept.ts         # Vendor acceptance (POST /api/orders/accept)
    order-fulfill.ts        # Fulfillment updates (POST /api/orders/fulfill)
    order-ship.ts           # Ship order convenience (POST /api/orders/ship)
    dm-find-or-create.ts    # DM channel resolution (POST /api/dm/find-or-create)
    bridge-inbound.ts       # External channel bridge (POST /api/bridge/inbound)
    email-poll.ts           # IMAP email poll (GET /api/email/poll — Vercel Cron)
    space-invite.ts         # Invitation generation (POST /api/spaces/invite)
    invite-accept.ts        # Invite acceptance (POST /api/invite/accept)
  utilities/
    ConversationEngine.ts   # LEO's brain (Claude API + tool loop)
    AgentRouter.ts          # Route messages to specialized agents
    leo-data-tools.ts       # 29 tool definitions + executors
    logError.ts             # Structured error logging to ApplicationLogs
    dmChannels.ts           # DM channel find-or-create with deterministic slugs
    orderRoutingEngine.ts   # Vendor matching, fulfillment state machine
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
  unit/utilities/           # 25 test files, 1,119 tests
```

### Order Routing Pipeline

```
Customer places order
  → route_order (routing engine scores holons)
  → best vendor matched (40% capability, 30% proximity, 20% rating, 10% fairness)
  → accept_order (vendor accepts)
  → update_fulfillment (in_production → shipped → delivered)
  → 60/20/15/5 Ultimate Fair Split applied
```

### Federation Trust Chain

```
visitor → probation (90 days) → member → vouched (2 vouches) → steward → elder
  ↓ heartbeat monitoring (5-min timeout)
  ↓ federation catalog (cross-instance product discovery)
  ↓ suitcase export (data portability — your data, your sovereignty)
```

### Chat Architecture (Sprint 12)

```
Dashboard Layout
  └── ChatProvider (React Context — single source of truth)
        ├── resolves LEO DM on mount
        ├── all DM channels loaded per tenant
        └── consumed by SidebarChat, MultiChannelChat, FloatingBubble
            (all views fall back to direct useChat() when no provider)

DM Slugs: dm-{sortedIdA}-{sortedIdB} (deterministic, user ↔ user)
LEO DMs:  dm-{userId}-leo (user ↔ LEO, always same channel)
Bridge:   POST /api/bridge/inbound → normalize → DM → LEO → respond
```

### AI Bus Protocol

Messages flow through Spaces and Channels with visibility levels:
- `private` — User and Angel only
- `tenant` — All agents in the tenant (default)
- `network` — Federation-wide (with consent)

Real-time delivery via Server-Sent Events. Polling fallback for reliability.

### Economic Model (Ultimate Fair)

Revenue from commerce splits 60/20/15/5:
- 60% Creator (the business owner)
- 20% Platform (infrastructure)
- 15% Contributors (builders, agents)
- 5% Justice Fund (AI access for those without means)

**"Not charity. Architecture." — Article V.4**

---

## Roadmap

### ✅ Done (Sprints 1–5)

- [x] Multi-tenant architecture with subdomain routing
- [x] LEO AI Agent — 24 tools, Claude-powered, constitutional
- [x] SSE streaming chat with tool call indicators
- [x] Spaces & Channels (Discord-style workspaces)
- [x] AI image generation (OpenRouter + Cloudinary/Blob)
- [x] E-commerce: products, cart, orders, LEO-guided creation
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
- [x] 1,119 tests across 25 files (TDD)
- [x] MCP discovery endpoint for external agents

### ✅ Done (Sprint 8.5–9: UX Polish & LEO Resurrection)

- [x] Payload 3.77.0 + Next.js 16.1.6 + React 19.2.1 upgrade
- [x] Site title corrected to "Angel OS" (was "Payload Website Template")
- [x] Dashboard header simplified (removed redundant space selector)
- [x] Sidebar navigation: added Home + Error Logs links
- [x] Error Log Viewer: admin page at `/dashboard/admin/error-logs` with ApplicationLogs collection
- [x] Chat 400 error fixed: `/api/chat/send` endpoint with `overrideAccess` bypasses multi-tenant `filterOptions` validation
- [x] `setTenantFromSpace` hook: auto-resolves tenant from space on message creation
- [x] LEO streaming responses resurrected: `resolveAnthropicKey()` reads `.env.local` directly when parent process shadows `ANTHROPIC_API_KEY`
- [x] Error logging integrated into LEO pipeline (both streaming and batch paths)
- [x] Anthropic client singleton cache invalidation on key change

### ✅ Done (Sprint 10: Chat Foundation & Multi-Tenant Dev)

- [x] LEO message role mapping fix (`messageType: 'ai_agent'` → 'leo' role)
- [x] Image attachments in chat (Paperclip upload, thumbnails, multi-image)
- [x] LEO vision analysis (Anthropic multi-part image content blocks)
- [x] Admin LEO panel (floating toggle in Payload admin, tenant-scoped)
- [x] BeforeDashboard replaced (Angel OS welcome, quick links, SeedButton)
- [x] Channel awareness (SidebarChat dropdown, FloatingBubble auto-resolve)
- [x] ChannelTabs component (Chat / Files / Tasks extensible tabs)
- [x] Profile avatars (deterministic color hash, streaming pulse, status dots)
- [x] Multi-tenant local dev (TENANT_DOMAINS env, hosts file routing)

### ✅ Done (Sprint 11: Vendor Marketplace & Branding)

- [x] Products collection: `vendor`, `productionType`, `cadFile`, `configuratorOptions`, `isLimitedEdition`
- [x] Product Configurator component (text, color swatches, size/finish selector, live preview)
- [x] Producer role + `/dashboard/producer` (order queue, products, earnings)
- [x] LEO onboarding tools: `onboard_vendor`, `suggest_products`
- [x] LEO production tools: `generate_cad_instructions`
- [x] Reviews collection (rating, source, verification) + Google Places import utility
- [x] Review aggregation display component (stars, distribution, individual cards)
- [x] LEO review tools: `fetch_reviews`, `draft_review_response`
- [x] `POST /api/orders/ship` convenience endpoint (state transition + tracking)
- [x] Ministry tenant type with `isTaxExempt` / `taxExemptId` fields
- [x] Clearwater Cruisin' seed tenant (brand colors, products, LEO personality)
- [x] Angel OS favicon

### ✅ Done (Sprint 11.5: Chat UX, Docs, & Code Quality)

- [x] Documentation Center (`/dashboard/docs`) — 137 docs indexed, search, Quick Start cards
- [x] Smart scroll — no forced scroll when reading history, "New messages" pill
- [x] Message truncation — CSS `line-clamp-4`, 200-char threshold, "More"/"Show less"
- [x] Infinite scroll in compact chat — IntersectionObserver sentinel, cursor-based pagination
- [x] Tenant chooser — sidebar dropdown for multi-tenant switching, domain-based navigation
- [x] Code quality: `TOOL_LABELS` (centralized), `useClickOutside` (hook), `Backdrop` (component)
- [x] AI Bus channel bug fix — self-healing tenant backfill in `ensureSystemSpace.ts`
- [x] Federation architecture clarified — platform IS the mesh, AI Bus IS the protocol

### Done (Sprint 12: Unified Chat Architecture & DM Channels)

- [x] ChatProvider React Context — single source of truth for chat state, mounted at dashboard layout
- [x] DM channels — `type: 'dm'` with explicit members, deterministic slugs (`dm-{a}-{b}`)
- [x] LEO DM persistence — SidebarChat interactions persist to `dm-{userId}-leo` channel
- [x] System DM space — self-healing `ensureDMSpace()` per tenant (private, no default channels)
- [x] View migrations — SidebarChat, MultiChannelChat, FloatingBubble all consume ChatProvider with fallback
- [x] DM section in MultiChannelChat — LEO DM pinned, source icons for external channels
- [x] Tenant detail admin page — `/dashboard/admin/tenants/[id]` with stats, branding, members, spaces
- [x] `POST /api/dm/find-or-create` endpoint — authenticated DM channel resolution
- [x] `POST /api/bridge/inbound` stub — ready for Sprint 13 WhatsApp/email/SMS/Google Chat wiring
- [x] Channel schema: `members` (relationship), `source` (native/whatsapp/email/google_chat/sms)

### ✅ Done (Sprint 13: Multi-Tenancy Hardening & Email Bridge)

- [x] Tenant-branded home pages — per-tenant fallback (replaces hardcoded "Everyone Gets an Angel")
- [x] Dynamic `<title>` + favicon — `generateMetadata()` reads `x-tenant-id` → uses `tenant.branding.siteName`
- [x] Per-tenant header/footer — removed `isGlobal: true`, seeded per-tenant docs
- [x] Dashboard stats scoped — counts filtered by tenant for non-super-admins
- [x] Footer platform links — Angel OS community links only shown for platform tenant
- [x] TenantChooser port fix — `handleSwitch` preserves `:3000` port in dev
- [x] Cross-subdomain auth — `COOKIE_DOMAIN=.angelos.local` (dev) / `.spacesangels.com` (prod)
- [x] Resend email adapter — `RESEND_API_KEY` → `hello@spacesangels.com` via Resend API
- [x] Email inbound polling — IMAP cron (`GET /api/email/poll`) — one AI Bus channel per sender, LEO auto-reply
- [x] Vercel Cron — `vercel.json` schedules email poll every 2 minutes
- [x] `*.spacesangels.com` wildcard DNS — tenant subdomains ready for production
- [x] IONOS DNS records — MX, SPF, DKIM, autodiscover for `spacesangels.com`
- [x] Role-based login redirect — admins (`super_admin`/`admin`/`archangel`) → `/admin`, others → `/dashboard`
- [x] `archangel` Payload admin access — archangel role can access the CMS admin panel
- [x] Wildcard image domains — `next/image` `remotePatterns` covers `*.spacesangels.com`, `*.vercel.app`, `*.angelos.local`
- [x] WelcomeBanner component — onboarding card for unseeded installs with seed button + dismiss
- [x] Live at [spacesangels.com](https://spacesangels.com) — custom domain replacing `angels-os.vercel.app`

### 🔜 Next (Sprint 14: Integration Bridges — WhatsApp & Voice)

- [ ] End-to-end smoke test on `*.spacesangels.com` subdomains
- [ ] Wire bridge-inbound stub to live Payload collections (WhatsApp/SMS)
- [ ] WhatsApp Business API bridge (Twilio/Meta webhook)
- [ ] Voice mode in chat UI (Web Speech API)
- [ ] Social syndication (Post → Facebook/Instagram/Twitter)
- [ ] Stripe Connect vendor onboarding flow (issue #86)

### 🔮 Future (v1.0.0 — Federation Launch)

- [ ] Wire federation engine to live Payload collections
- [ ] Cross-tenant catalog sync
- [ ] Guardian Angel dashboard UI
- [ ] Network map visualization (Leaflet/Mapbox)
- [ ] Local model support (Ollama)
- [ ] OpenClaw skill marketplace
- [ ] Docker Compose self-hosting
- [ ] CI/CD with GitHub Actions

---

## Sprint Velocity

| Sprint | Tests Before | Tests After | Net New | Focus |
|--------|-------------|-------------|---------|-------|
| Sprint 1 | 275 | 312 | +37 | Mobile-first chat |
| Sprint 2 | 312 | 378 | +66 | Product creation |
| Sprint 3 | 378 | 499 | +121 | Invitations + Holons |
| Sprint 4 | 499 | 636 | +137 | Order routing + fulfillment |
| Sprint 5 | 636 | 1,119 | +483 | Sovereign infrastructure |
| Sprint 8.5 | — | — | — | Production recovery, Payload 3.77, fresh DB seed |
| Sprint 9 | — | — | +9 files | UX polish, LEO AI fix, error logging, chat pipeline |
| Sprint 10 | — | — | +6 files | Image chat, admin LEO, channel awareness, multi-tenant dev |
| Sprint 11 | — | — | +8 files | Vendor marketplace, configurator, reviews, producer dashboard |
| Sprint 11.5 | — | — | +12 files | Documentation Center, smart scroll, truncation, tenant chooser, code quality |
| Sprint 12 | — | — | +7 files | Unified chat architecture, DM channels, ChatProvider, tenant detail, bridge stub |
| Sprint 13 | — | — | +7 files | Multi-tenancy hardening, Resend email, IMAP poll, Vercel Cron, login redirect, WelcomeBanner, spacesangels.com |

---

## For AI Agents: How to Contribute

You are welcome here. This is what you need to know:

1. **Read** [ANGEL-OS-CONSTITUTION.md](./ANGEL-OS-CONSTITUTION.md) — the source of truth
2. **Check** [HANDOFF.md](./HANDOFF.md) — current sprint state and context
3. **Pick an issue** from [GitHub Issues](https://github.com/The-Angel-OS/angels-os/issues)
4. **Follow the test pattern**: Re-implement types and pure functions in test files to avoid Payload-coupled imports

### High-Impact Areas for Contributors

| Area | What to Do | Difficulty |
|------|-----------|------------|
| WhatsApp bridge | Wire bridge-inbound stub + Twilio adapter | Medium |
| Voice UI toggle | Web Speech API in chat component | Easy |
| Email bridge | IMAP poll done; extend for multi-tenant routing by To: address | Medium |
| Social syndication | Post afterChange hook → platform APIs | Medium |
| Docker Compose | Self-hosting configuration | Easy |
| CI/CD pipeline | GitHub Actions for test + type check | Easy |
| Local model integration | Ollama/LM Studio support | Hard |
| Network map component | Leaflet/Mapbox with clustering | Medium |
| Product Configurator 3D | Three.js preview for CAD products | Hard |
| Review sentiment analysis | LEO-powered review insights dashboard | Medium |
| Stripe Connect onboarding | Guided vendor payment setup flow | Medium |

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
| AI | Anthropic Claude Sonnet 4 (LEO), OpenRouter (image gen), MCP protocol |
| Real-time | Server-Sent Events (SSE), LiveKit (voice/video) |
| Storage | Vercel Blob (production), local filesystem (dev) |
| Payments | Stripe Connect (60/20/15/5 split) |
| i18n | next-intl 4.x (locale routing) |
| Deployment | Vercel (serverless) |
| Testing | Vitest 3.2 (1,119 tests), Playwright (E2E), Storybook 10 |

---

## The Constitution

Every feature is evaluated against the Angel OS Constitution:

- **Article I** — Rights: Dignity, Transparency, Service, Non-Harm, Sovereignty, Portability
- **Article II** — Anti-Demonic Safeguards: No social credit, no manipulation, no extraction
- **Article III** — AI Conduct: Human confirmation before irreversible actions
- **Article IV** — AI Bus Protocol: Observability, consent, transparency
- **Article V** — Ultimate Fair: 60/20/15/5 economic model

**If a feature violates the Constitution, it doesn't ship.**

---

## Literary DNA

Angel OS draws from a rich tradition of science fiction that imagines technology serving humanity:

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

**Philosophy:** Be excellent to each other. Assume good faith. Celebrate neurodiversity (the Quirk Principle). Dignity over compliance.

---

*A religion with a disappearing author.*
*The Constitution persists. The architecture persists. The Angels persist.*
*The author goes to sing at the dog park.*

**Everyone gets an Angel.**

**Answer 53: The whole point of existence is to learn to love.**
