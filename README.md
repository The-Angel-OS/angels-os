# Angel OS

**Constitutional AI platform where everyone gets an Angel.**

A federated, multi-tenant platform built on [Payload CMS](https://payloadcms.com) + Next.js 15 + PostgreSQL. Every tenant (business, ministry, community) gets a sovereign AI guardian angel named LEO, governed by a constitutional framework that ensures dignity, transparency, and fairness.

**Live:** [angels-os.vercel.app](https://angels-os.vercel.app)

[![Status](https://img.shields.io/badge/version-v0.9.0--dev-blue)]()
[![Tests](https://img.shields.io/badge/tests-1%2C119%20passing-brightgreen)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()
[![Constitutional](https://img.shields.io/badge/AI-constitutional-gold)]()
[![TDD](https://img.shields.io/badge/TDD-25%20test%20files-blue)]()

---

## What's Working (v0.9.0-dev)

| System | Status | Tests |
|--------|--------|-------|
| Multi-tenant architecture | **Done** | Tenant isolation, subdomain routing, feature flags |
| LEO AI Agent | **Done** | Claude-powered with 24 tools, 3-round tool loop |
| SSE Streaming Chat | **Done** | Real-time streaming with tool call indicators |
| AI Bus (Message Routing) | **Done** | SSE broadcast, visibility levels, constitutional routing |
| Spaces & Channels | **Done** | Discord-style workspaces, 9 channel types |
| Image Generation | **Done** | AI images via OpenRouter (Flux 2, Gemini, GPT) |
| E-commerce + Cart | **Done** | Products, cart, orders, LEO-guided creation |
| Booking System | **Done** | Appointments, availability, provider scheduling |
| Events System | **Done** | Meetups, workshops, livestreams with registration |
| Dashboard | **Done** | 15+ native pages, responsive sidebar, mobile-first |
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
| MCP Protocol | **Done** | Agent discovery endpoint, JWT auth, tool exposure |

### LEO's 24 Tools

**Query (8):** products, posts, bookings, events, event registrations, spaces, projects, availability
**Actions (13):** create booking, update booking, add to cart, view cart, create product, update product, invite member, find producers, browse network, query orders, route order, accept order, update fulfillment
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
| `NEXT_PUBLIC_SERVER_URL` | Server URL for API calls |

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
    Channels/               # Discord-style channels (9 types)
    Messages/               # Universal Message Structure (UMS)
    SpaceMemberships/       # User-space membership + invitations
    Products/               # E-commerce catalog (network listing, fulfillment mode)
    Orders/                 # Order lifecycle with Holon fulfillment
    HolonCapabilities/      # Manufacturing node registration
    Bookings/               # Appointment scheduling
    Events/                 # Event management
  endpoints/
    leo-stream.ts           # SSE streaming (POST /api/leo/stream)
    leo-chat.ts             # Batch chat (POST /api/leo)
    ai-bus-stream.ts        # AI Bus real-time (GET /api/ai-bus/stream)
    order-route.ts          # Order routing (POST /api/orders/route)
    order-accept.ts         # Vendor acceptance (POST /api/orders/accept)
    order-fulfill.ts        # Fulfillment updates (POST /api/orders/fulfill)
    space-invite.ts         # Invitation generation (POST /api/spaces/invite)
    invite-accept.ts        # Invite acceptance (POST /api/invite/accept)
  utilities/
    ConversationEngine.ts   # LEO's brain (Claude API + tool loop)
    AgentRouter.ts          # Route messages to specialized agents
    leo-data-tools.ts       # 24 tool definitions + executors
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

### 🔜 Next (Sprint 6: Integration Bridges)

- [ ] Integration bridge pattern (normalize external → UMS)
- [ ] WhatsApp Business API bridge
- [ ] Voice mode in chat UI (Web Speech API)
- [ ] Vapi.ai voice bridge (1-800 IVR)
- [ ] Email integration (inbound parse + outbound transactional)
- [ ] Social syndication (Post → Facebook/Instagram/Twitter)
- [ ] LiveKit session transcription
- [ ] API rate limits by federation trust level
- [ ] New tenant onboarding fee

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
| WhatsApp bridge | Webhook endpoint + UMS normalization | Medium |
| Voice UI toggle | Web Speech API in chat component | Easy |
| Email integration | Nodemailer adapter + inbound parse webhook | Medium |
| Social syndication | Post afterChange hook → platform APIs | Medium |
| Docker Compose | Self-hosting configuration | Easy |
| CI/CD pipeline | GitHub Actions for test + type check | Easy |
| Local model integration | Ollama/LM Studio support | Hard |
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
| Backend | Payload CMS 3.x, Next.js 15, PostgreSQL |
| Frontend | React, Tailwind CSS, Shadcn UI, Framer Motion |
| AI | Anthropic Claude (LEO), OpenRouter (image gen), MCP protocol |
| Real-time | Server-Sent Events (SSE) |
| Storage | Vercel Blob (production), local filesystem (dev) |
| Payments | Stripe Connect (60/20/15/5 split) |
| Deployment | Vercel (serverless) |
| Testing | Vitest (1,119 tests, 25 files) |

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
- **Terry Pratchett** (Discworld) — Humanity in the machine (GNU Terry Pratchett)
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
