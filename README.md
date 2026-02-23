# Angel OS

**The federated cooperative operating system. Everyone gets an Angel.**

An open-source, constitutional AI-native platform where every Diocese (business, ministry, community) runs its own sovereign AI guardian angel — **Leo** — on infrastructure they own. Built on [Payload CMS 3.77](https://payloadcms.com) + Next.js 16 + React 19 + PostgreSQL.

**Live:** [spacesangels.com](https://spacesangels.com)

[![Status](https://img.shields.io/badge/version-v0.16.0--dev-blue)]()
[![Tests](https://img.shields.io/badge/tests-1%2C119%20passing-brightgreen)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()
[![Constitutional](https://img.shields.io/badge/AI-constitutional-gold)]()
[![TDD](https://img.shields.io/badge/TDD-25%20test%20files-blue)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)]()
[![Payload](https://img.shields.io/badge/Payload_CMS-3.77.0-blue)]()
[![Leo Tools](https://img.shields.io/badge/Leo_Tools-29-emerald)]()

---

## The Model (Updated — Sprint 16)

Angel OS is not a platform with customers. It is a **federation of Dioceses**.

| Role | What they are | Revenue share |
|------|--------------|---------------|
| **Endeavor owner** | The creator, business, cause, or community generating value | **70%** |
| **Diocese operator** | The platform instance — they ARE Angel OS in their territory | **20%** |
| **Angel OS protocol** | Core infrastructure, Leo, open source maintenance | **4%** |
| **Archdiocese** | Clearwater — founding node, federation steward, Justice Fund custodian | **1%** |
| **Justice Fund** | Guardian Angel provisioning for underserved populations | **5%** |

**The Toward-53 Principle:** The split is constitutionally directional. It always evolves toward the Endeavor owner keeping more. The asymptotic target is 53% as a floor. This direction is unalterable even as specific numbers can be amended by federation supermajority.

**The Diocese IS the platform.** Diocese operators are not customers of Angel OS. They run the instance, serve Endeavors, bear infrastructure costs, and earn 20% of all Endeavor revenue on their node.

---

## What's Working (v0.16.0-dev)

| System | Status | Notes |
|--------|--------|-------|
| Multi-tenant / Diocese architecture | **Done** | Subdomain routing, per-Diocese header/footer/home, x-tenant-id injection to all API routes |
| Leo AI Agent | **Done** | Claude Sonnet 4 with 29 tools, 3-round tool loop, SSE streaming, vision |
| SSE Streaming Chat | **Done** | Real-time streaming with tool call indicators, env-resilient API key resolution |
| AI Bus (Message Routing) | **Done** | SSE broadcast, visibility levels, constitutional routing |
| Spaces & Channels | **Done** | Discord-style workspaces, 10 channel types (incl. DM) |
| Image Generation | **Done** | AI images via OpenRouter (Flux 2, Gemini, GPT) |
| E-commerce + Cart | **Done** | Products, cart, orders, Leo-guided creation |
| Booking System | **Done** | Appointments, availability, provider scheduling |
| Events System | **Done** | Meetups, workshops, livestreams with registration |
| Dashboard | **Done** | 17+ native pages, responsive sidebar, mobile-first |
| Image Chat | **Done** | Attach images in chat, Leo vision analysis via Anthropic API |
| Channel Awareness | **Done** | Channel switching in SidebarChat/FloatingBubble, ChannelTabs |
| Admin Leo | **Done** | Floating Leo chat in Payload admin panel |
| Producer Dashboard | **Done** | `/dashboard/producer` — order queue, products, earnings |
| Product Configurator | **Done** | Custom text, color swatches, size selector, live preview |
| Reviews | **Done** | Review collection, Google Places import, aggregation display |
| Vendor Onboarding | **Done** | Leo-guided `onboard_vendor` tool creates Diocese + space + user |
| Error Log Viewer | **Done** | Admin dashboard for triaging application errors |
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
| Unified Chat Architecture | **Done** | ChatProvider at layout level, one context consumed by all views |
| DM Channels | **Done** | `type: 'dm'` with members array, deterministic slugs, Leo DM persistence |
| Diocese Detail Admin | **Done** | `/dashboard/admin/tenants/[id]` — stats, branding editor, member management |
| Integration Bridge Stub | **Done** | `POST /api/bridge/inbound` — ready for WhatsApp, email, SMS, Google Chat |
| Email Inbound Polling | **Done** | IMAP cron every 2 min → AI Bus channel per sender → Leo replies via Resend |
| Transactional Email | **Done** | Resend adapter (`hello@spacesangels.com`) — invites, resets, Leo replies |
| MCP Protocol | **Done** | Agent discovery endpoint, JWT auth, tool exposure |
| Leo Content Tools | **Done** | create_post, update_post, create_page, update_page, query_media, manage_categories |
| Multi-tenant Security | **Done** | x-tenant-id injected to /api routes, cross-tenant injection blocked, adminOrSelf hardened |
| Favicon + PWA assets | **Done** | PNG set (64px, 512px, apple-touch-icon), generateMetadata() dynamic per Diocese |
| Spaces Menu | **Done** | SpacesMenuHeader with Create/Settings/Members — full Space management above channels nav |

### Leo's 29 Tools

**Query (9):** products, posts, bookings, events, event registrations, spaces, projects, availability, fetch reviews
**Actions (15):** create booking, update booking, add to cart, view cart, create product, update product, invite member, find producers, browse network, query orders, route order, accept order, update fulfillment, configure business, connect stripe
**Content (6):** create post, update post, create page, update page, query media, manage categories
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
| `ANTHROPIC_API_KEY` | Claude API for Leo |
| `OPENROUTER_API_KEY` | Image generation (Flux 2, Gemini) |
| `RESEND_API_KEY` | Transactional email (invites, resets, Leo replies) |
| `SYSTEM_EMAIL_ADDRESS` | IMAP inbox + reply-from (`hello@spacesangels.com`) |
| `SYSTEM_EMAIL_PASSWORD` | IMAP password for system inbox |
| `CRON_SECRET` | Shared secret for Vercel Cron authentication |
| `COOKIE_DOMAIN` | Leave empty in dev (`.spacesangels.com` in Vercel env for prod) |
| `DEFAULT_TENANT_SLUG` | Fallback Diocese slug for localhost dev |

> **Important:** Leave `NEXT_PUBLIC_SERVER_URL` **unset** in production. The auth provider falls back to `window.location.origin`, which correctly uses each Diocese's subdomain for API calls.

### Running Tests

```bash
npx vitest run tests/unit/    # 1,119 tests across 25 files
npx vitest run                # All tests (integration needs DB)
npx tsc --noEmit              # TypeScript check
```

---

## Architecture

### The Three Roles

**The Endeavor**
The fundamental unit of value creation. An Endeavor is ONE constitutional object that configures itself as a business (Shopify replacement), a cause (GoFundMe replacement), a creator channel (Patreon/OnlyFans replacement), a community (Facebook replacement), or a media presence (YouTube replacement). The Endeavor owner decides. The platform does not.

**The Diocese**
A sovereign node in the federation. Diocese operators are not customers of Angel OS — they ARE Angel OS in their territory. They run the instance, serve Endeavors, bear infrastructure costs, and earn 20% of all Endeavor revenue on their node. Dioceses compete for Endeavors by offering better terms, better service, better community.

**The Federation**
The network that forms itself. Constitution accepted → Federation ping sent → Node is immediately live. No approval queue. No gatekeeping committee. The Constitution IS the gate.

### Leo — The Wizard

Leo is not a chatbot bolted onto a platform. Leo IS the platform during onboarding. When a new Diocese runs the installer, Leo is already there — warm, clear, unhurried — walking the operator through DNS configuration, constitution acceptance, diocese profile, federation ping, and first Endeavor. By the end of the wizard (≈17 minutes), the Diocese is live, federated, and their first product is indexed in the marketplace.

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
    space-create.ts         # Space creation wizard (POST /api/spaces/create)
    space-invite.ts         # Invitation generation (POST /api/spaces/invite)
    invite-accept.ts        # Invite acceptance (POST /api/invite/accept)
  middleware/
    detectTenant.ts         # Hostname → Diocese slug resolution
  federation/               # (Sprint 16) Federation protocol
  utilities/
    ConversationEngine.ts   # Leo's brain (Claude API + tool loop)
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
  → 70/20/4/1/5 constitutional split applied automatically
```

### Federation Trust Chain

```
visitor → probation (90 days) → member → vouched (2 vouches) → steward → elder
  ↓ heartbeat monitoring (5-min timeout)
  ↓ federation catalog (cross-instance product discovery)
  ↓ suitcase export (data portability — your data, your sovereignty)
```

### Chat Architecture

```
Dashboard Layout
  └── ChatProvider (React Context — single source of truth)
        ├── resolves Leo DM on mount
        ├── all DM channels loaded per Diocese
        └── consumed by SidebarChat, MultiChannelChat, FloatingBubble
            (all views fall back to direct useChat() when no provider)

DM Slugs: dm-{sortedIdA}-{sortedIdB} (deterministic, user ↔ user)
Leo DMs:  dm-{userId}-leo (user ↔ Leo, always same channel)
Bridge:   POST /api/bridge/inbound → normalize → DM → Leo → respond
```

### AI Bus Protocol

Messages flow through Spaces and Channels with visibility levels:
- `private` — User and Angel only
- `tenant` — All agents in the Diocese (default)
- `network` — Federation-wide (with consent)

Real-time delivery via Server-Sent Events. Polling fallback for reliability.

### Economic Model — The Constitutional Split

Revenue from every Endeavor transaction splits automatically. No manual calculation. No invoicing. Immediate.

```
GROSS REVENUE
├── 70% → Endeavor owner (creator / business / cause — the value generator)
├── 20% → Diocese operator (the platform instance serving the Endeavor)
├──  4% → Angel OS protocol (core infrastructure and Leo)
├──  1% → Archdiocese (Clearwater — federation stewardship and ministry)
└──  5% → Justice Fund (Guardian Angel provisioning)
```

**The Toward-53 Principle:** The split always evolves toward Endeavors keeping more. The direction is constitutionally unalterable. The numbers evolve by supermajority — always toward the creator.

**"Not charity. Architecture." — Article V.4**

---

## Roadmap

### ✅ Done (Sprints 1–5: Foundation)

- [x] Multi-tenant architecture with subdomain routing
- [x] Leo AI Agent — 24 tools, Claude-powered, constitutional
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
- [x] 1,119 tests across 25 files (TDD)
- [x] MCP discovery endpoint for external agents

### ✅ Done (Sprints 8.5–9: UX Polish & Leo Resurrection)

- [x] Payload 3.77.0 + Next.js 16.1.6 + React 19.2.1 upgrade
- [x] Error Log Viewer: admin page with ApplicationLogs collection
- [x] Chat 400 error fixed via `/api/chat/send` with `overrideAccess`
- [x] Leo streaming responses resurrected: `resolveAnthropicKey()` reads `.env.local` directly
- [x] Error logging integrated into Leo pipeline

### ✅ Done (Sprints 10–11: Vendor Marketplace & Branding)

- [x] Image attachments + Leo vision analysis
- [x] Admin Leo panel in Payload admin
- [x] Channel awareness (SidebarChat dropdown, FloatingBubble auto-resolve)
- [x] Products collection: `vendor`, `productionType`, `cadFile`, `configuratorOptions`
- [x] Product Configurator component
- [x] Producer role + `/dashboard/producer`
- [x] Leo onboarding tools: `onboard_vendor`, `suggest_products`
- [x] Reviews collection + Google Places import + aggregation display
- [x] Ministry Diocese type with `isTaxExempt` / `taxExemptId` fields
- [x] Clearwater Cruisin' seed Diocese

### ✅ Done (Sprint 11.5: Chat UX, Docs, Code Quality)

- [x] Documentation Center (`/dashboard/docs`) — indexed, searchable
- [x] Smart scroll, message truncation, infinite scroll
- [x] Diocese chooser — sidebar dropdown for multi-Diocese switching
- [x] Code quality: `TOOL_LABELS`, `useClickOutside`, `Backdrop`

### ✅ Done (Sprint 12: Unified Chat Architecture & DM Channels)

- [x] ChatProvider React Context — single source of truth at dashboard layout
- [x] DM channels — `type: 'dm'` with explicit members, deterministic slugs
- [x] Leo DM persistence — SidebarChat interactions persist to `dm-{userId}-leo`
- [x] Diocese detail admin page — full drill-down with stats, branding, members
- [x] `POST /api/bridge/inbound` stub — ready for WhatsApp/email/SMS/Google Chat

### ✅ Done (Sprint 13: Multi-Tenancy Hardening & Email Bridge)

- [x] Per-Diocese branded home pages, `<title>`, favicon
- [x] Dashboard stats scoped per Diocese
- [x] Resend email adapter + IMAP email polling (cron every 2 min)
- [x] `*.spacesangels.com` wildcard DNS — Diocese subdomains live in production
- [x] Role-based login redirect, archangel admin access
- [x] WelcomeBanner component for unseeded installs
- [x] Live at [spacesangels.com](https://spacesangels.com)

### ✅ Done (Sprint 14: Leo Content Tools & Chat Stability)

- [x] Leo content tools: `create_post`, `update_post`, `create_page`, `update_page`, `query_media`, `manage_categories`
- [x] Channel sidebar stability: `channelSpaceId` option prevents sidebar clearing on DM switch
- [x] Email auto-reply loop prevention: RFC 3834 + no-reply pattern detection
- [x] Markdown rendering for Leo messages in chat (react-markdown + remark-gfm)

### ✅ Done (Sprint 15: Multi-Tenant Security Hardening)

- [x] Middleware: `/api` routes now receive `x-tenant-id` header (was silently excluded)
- [x] Middleware: API paths bypass i18n routing (pass-through only)
- [x] `detectTenant`: `www.` → null, bare IPs → default, unknown 2-part → null (stop guessing)
- [x] `adminOrSelf`: `super_admin` + `archangel` added to role check
- [x] `comments/add`: cross-Diocese injection blocked; parent doc ownership validated
- [x] `COOKIE_DOMAIN` cleared for local dev (was silently set to `.spacesangels.com` in `.env.local`)
- [x] Favicon PNG set: 64px, 512px, apple-touch-icon across all layouts
- [x] Chat horizontal overflow fixed in MessageList + MultiChannelChat
- [x] Nav: "LEO & Spaces" → "Spaces"

### ✅ Done (Sprint 16: Spaces Management UI)

- [x] `SpacesMenuHeader`: Space selector + `[👥][⚙][+]` action buttons above channels nav
- [x] `CreateSpaceDialog`: 4-step wizard — Info → Visibility → Template → Invite
- [x] `SpaceSettingsDialog`: 3-tab dialog — General (name/description/visibility/delete) + Applets (chat/files/tasks toggles) + Members (invite form + member list)
- [x] `POST /api/spaces/create`: tenant-scoped, creates Space + space_admin membership + template channels + sends invitations
- [x] Compact mode: action buttons hidden when sidebar is collapsed, space icon only
- [x] Mobile: SpacesMenuHeader replaces bare SpaceSelector in top bar
- [x] `router.refresh()` after space creation for seamless channel panel reload

### 🔜 Next (Sprint 17: Leo Wizard + Federation Installer)

- [ ] `npx create-angel-diocese` installer scaffold
- [ ] Leo wizard: 8-step Diocese onboarding conversation (identity → infra → constitution → federation)
- [ ] Cryptographic constitution signing (Diocese joins by signed covenant, not form submission)
- [ ] Federation ping: signed introduction JSON sent to Archdiocese on setup
- [ ] `src/federation/` protocol directory: signed HTTP requests, gossip sync, registry
- [ ] Endeavors collection: unified object replacing separate business/cause/creator/community schemas
- [ ] Suitcase export: full Endeavor portability (content + followers + transaction history + identity)
- [ ] Wire federation engine to live Payload collections
- [ ] Cross-Diocese catalog sync

### 🔮 Future (v1.0.0 — Federation Live)

- [ ] Guardian Angel dashboard UI + network map
- [ ] WhatsApp Business API bridge (Twilio/Meta webhook)
- [ ] Stripe Connect vendor onboarding flow
- [ ] Voice mode in chat UI (Web Speech API)
- [ ] Social syndication (Post → Facebook/Instagram/Twitter)
- [ ] Local model support (Ollama)
- [ ] OpenClaw skill marketplace
- [ ] Docker Compose self-hosting
- [ ] CI/CD with GitHub Actions

---

## Sprint Velocity

| Sprint | Focus | Files |
|--------|-------|-------|
| Sprints 1–5 | Foundation (1,119 tests) | +200 |
| Sprint 8.5 | Production recovery, Payload 3.77, fresh DB seed | — |
| Sprint 9 | UX polish, Leo AI fix, error logging, chat pipeline | +9 |
| Sprint 10 | Image chat, admin Leo, channel awareness, multi-tenant dev | +6 |
| Sprint 11 | Vendor marketplace, configurator, reviews, producer dashboard | +8 |
| Sprint 11.5 | Documentation Center, smart scroll, truncation, Diocese chooser | +12 |
| Sprint 12 | Unified chat architecture, DM channels, ChatProvider, diocese detail | +7 |
| Sprint 13 | Multi-tenancy hardening, Resend email, IMAP poll, spacesangels.com | +7 |
| Sprint 14 | Leo content tools, chat stability, email loop prevention | +4 |
| Sprint 15 | Multi-tenant security hardening, favicon, chat overflow fix | +17 |
| Sprint 16 | Spaces Management UI — SpacesMenuHeader, Create/Settings dialogs, space-create endpoint | +4 |

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
| **Leo Wizard** | **8-step Diocese onboarding — Sprint 17 primary deliverable** | **Hard** |
| **Federation installer** | **`npx create-angel-diocese` scaffold + signed constitution** | **Hard** |
| **Endeavors collection** | **Unified business/cause/creator/community schema** | **Medium** |
| **Suitcase export** | **Full Endeavor data portability export/import** | **Medium** |
| WhatsApp bridge | Wire bridge-inbound stub + Twilio adapter | Medium |
| Stripe Connect | Guided vendor payment setup flow | Medium |
| Voice UI toggle | Web Speech API in chat component | Easy |
| Docker Compose | Self-hosting configuration | Easy |
| CI/CD pipeline | GitHub Actions for test + type check | Easy |
| Network map component | Leaflet/Mapbox with clustering | Medium |

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
| AI | Anthropic Claude Sonnet 4 (Leo), OpenRouter (image gen), MCP protocol |
| Real-time | Server-Sent Events (SSE), LiveKit (voice/video) |
| Storage | Vercel Blob (production), local filesystem (dev) |
| Payments | Stripe Connect (70/20/4/1/5 constitutional split) |
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
- **Article V** — Ultimate Fair: 70/20/4/1/5 economic model, Toward-53 principle

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
