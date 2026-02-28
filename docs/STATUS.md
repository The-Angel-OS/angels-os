# Angel OS — Status, Plan & What's Next

> *Filed: February 27, 2026 — Sprint 24 Complete*
> *Version: v0.24.0-dev*

---

## Where We Are

Angel OS is a live, federated cooperative operating system at [spacesangels.com](https://spacesangels.com). Twenty-four sprints of development have produced a production platform with real users, real federation architecture, and a constitutional AI guardian angel named Leo.

### By the Numbers

| Metric | Count |
|--------|-------|
| **Sprints completed** | 24 |
| **Payload CMS collections** | 37 |
| **Leo AI tools** | 78+ |
| **API endpoints** | 49+ |
| **Unit tests** | 1,570 across 36 files |
| **E2E test suites** | 14 (Playwright) |
| **Total test files** | 50 |
| **TypeScript errors** | 0 |
| **Build status** | Passing |
| **Deployment** | Vercel (serverless) |

### What's Working

**Core Platform:**
- Multi-tenant architecture with subdomain routing per Enterprise
- Payload CMS 3.77 + Next.js 16 + React 19 + PostgreSQL
- 37 collections covering the full business lifecycle
- Role-based access control (super_admin, admin, archangel, user)
- Responsive dashboard with 20+ native pages
- Role-based dashboard views (admin/business owner/member)

**Leo AI Agent:**
- Google Gemini 3.1 Pro (primary) + Claude Sonnet 4.6 (fallback)
- 78+ tools across 17 categories
- SSE streaming with tool call indicators
- Vision analysis, PDF extraction, RAG knowledge base
- Constitutional prompt with anti-demonic safeguards
- `/model` command for mid-conversation model switching

**Commerce & Orders:**
- Products, cart, checkout, orders
- Stripe Direct Charges (sellers collect directly)
- Angel Token queue for zero-manufacturer scenarios
- Order routing engine with equipment-aware matching
- Vendor claim system, cancellation with refund
- Print-on-demand pipeline
- Product configurator with live preview

**Social & Communication:**
- Discord-style Spaces & Channels (10 channel types)
- DM channels with deterministic slugs
- Chat image lightbox with carousel
- Multi-file attachments (PDF, docs)
- LiveKit voice/video applets
- Email bridge (IMAP polling + Resend)
- Vapi voice AI (phone-based Leo)

**Federation:**
- Constitutional trust chain (none → probationary → vouched → full)
- Edenist distributed mesh with sentinel election
- StreetSigns cross-holon marketplace
- Supermajority governance with Ed25519 signatures
- Suitcase data portability (Article VI)
- Federation admin dashboard (4 tabs)
- LCARS network visualization

**Enterprise Intelligence (NEW — Sprint 24):**
- LEO Enterprise Manager: revenue analytics, inventory alerts, customer health
- Board of Directors governance: quorum-based decision logging
- Comment moderation dashboard
- Featured Endeavors homepage block

**Identity & Auth:**
- Google OAuth with cross-domain token relay
- Social auth link/unlink (Google, GitHub/Apple/Discord in schema)
- Quests & QuestParticipations for gamified workflows
- Enlistment Ceremony for constitutional commitment

**Testing & Quality:**
- 1,570 unit tests across 36 files (Vitest)
- 14 E2E test suites (Playwright): dashboard, admin, payload-admin, federation, tenant-isolation, chat, producer, content, setup-wizard, launch, checkout, user-journeys, mobile, legacy
- Zero TypeScript errors
- Integration tests with 60s hook timeout for Payload boot

---

## What We Just Shipped (Sprint 24)

Sprint 24 was the "self-awareness" sprint. The platform gained the ability to see itself and its federation.

### Features
1. **LEO Enterprise Manager Phase 1** — Revenue analytics, inventory movement alerts, customer health scoring, opportunity identification. Board of Directors governance with quorum-based decision logging.
2. **LCARS Federation Network** — Star Trek-inspired visualization: real-time node health, trust levels, communications log.
3. **Account Dashboard Integration** — Profile/Connections/Addresses as dashboard sections. Header user dropdown. Clickable sidebar footer.
4. **Enlistment Ceremony** — Constitutional commitment step in Enterprise setup wizard.
5. **Role-Based Dashboard** — Views adapt by user role.
6. **Comment Moderation Dashboard** — Admin moderation queue.
7. **Featured Endeavors Block** — Homepage showcase component.

### Hardening
8. **Federation Protocol Hardening** — Signature enforcement, schema validation, governance persistence.
9. **Tenant Isolation** — 6 collections hardened against cross-tenant leakage.
10. **Link Field Bug Fix** — `.map()` result was silently discarded in link.ts; Header/Footer admin now render correctly.
11. **LEO Split-Brain Fix** — Race condition in conversation state resolved.
12. **14 E2E Test Suites** — Comprehensive Playwright coverage for all critical paths.

---

## What's Next

### Sprint 25: Federation Installer & Leo Wizard (Planned)

**Theme:** Any business on Earth can run their own sovereign Angel OS instance through a guided conversation.

| Feature | Priority | Complexity | Notes |
|---------|----------|------------|-------|
| **Leo Wizard** | P0 | Hard | 8-step conversational Enterprise onboarding — identity, infrastructure, constitution, federation. No forms. Just a conversation with Leo. |
| **`npx create-angel-enterprise`** | P0 | Hard | One-command scaffold: creates repo, sets up DB, seeds constitution, runs Leo Wizard. |
| **Customer Angel Token UI** | P1 | Medium | Order detail page with status banner, config display, cancel/refund button. |
| **Street Signs Gossip Sync** | P1 | Medium | Ambient marketplace data in heartbeat payloads — every node eventually knows every product. |
| **LEO Enterprise Manager Phase 2** | P2 | Medium | Predictive analytics, automated board recommendations, trend forecasting. |

### Sprint 26+: Infrastructure & Integrations

| Feature | Priority | Notes |
|---------|----------|-------|
| **WhatsApp Bridge** | P1 | Twilio/Meta webhook → bridge-inbound → DM → Leo |
| **Docker Compose** | P1 | Self-hosting for sovereign deployments |
| **CI/CD Pipeline** | P1 | GitHub Actions: test + typecheck + deploy |
| **Shipping Integration** | P2 | EasyPost/Shippo adapter for tracking + labels |
| **GA4 Event Wiring** | P2 | Wire gtagEcommerce helpers into product pages + checkout |

### v1.0 Target: Q3 2026

The v1.0 milestone requires:

- [ ] Federation installer (`npx create-angel-enterprise`)
- [ ] Leo Wizard (conversational onboarding)
- [ ] Federated AI Bus (JWT-signed cross-tenant messaging)
- [ ] Docker Compose self-hosting
- [ ] Stripe Connect fully operational (Ultimate Fair Split live)
- [ ] Justice Fund operational (real disbursements)
- [ ] CI/CD pipeline
- [ ] At least 3 live federated Enterprises

### Beyond v1.0: Angel Token Economy

The Angel Token system evolves from paid claims into a three-layer token economy:
- **Angel Tokens (AT)** — Platform currency, earned through Guardian Angel activities
- **Karma Coins (KC)** — Daily interactions, tipping, quality content rewards
- **Legacy Tokens (LT)** — Long-term governance, legacy recognition

Consensus: "Proof of Human Worth" — value derives from verified human contributions.

---

## Known Issues & Tech Debt

| Issue | Impact | Status |
|-------|--------|--------|
| In-memory rate limiting (non-functional on serverless) | Medium | Deferred — needs Redis/Upstash |
| No Sentry error tracking | Medium | Deferred |
| LiveKit webhook endpoint | Low | Stub exists, not wired |
| CallTranscripts collection | Low | Designed, not implemented |
| Sequential file uploads in some paths | Low | Most paths use parallel, some legacy remain |

---

## Architecture Decisions

### Why Payload CMS?
Payload gives us a typed ORM, admin panel, access control, hooks, and REST/GraphQL APIs with zero boilerplate. Every collection is a TypeScript interface that generates the database schema, the admin UI, and the API endpoints. We don't write CRUD.

### Why Federation over Microservices?
Each Enterprise IS the platform. They're not calling our API — they're running their own instance. Federation is the natural topology: sovereign nodes that cooperate through a constitutional protocol.

### Why Constitutional AI?
Every Leo instance runs the same immutable constitutional prompt. Article II's anti-demonic safeguards (no social credit, no manipulation, no extraction) aren't features to be toggled — they're constraints that are architecturally enforced. A compromised node running dark patterns will violate constraints that are detectably obvious to the federation.

### Why Star Trek Design Language?
The LCARS-inspired design isn't nostalgia. It's a design philosophy: trust the operator, present information densely, never simplify at the cost of capability. The Federation Network dashboard works because it treats its users as competent.

---

## For Contributors

**Getting started:**
```bash
git clone https://github.com/The-Angel-OS/angels-os.git
cd angels-os && pnpm install
cp .env.example .env.local   # Configure DATABASE_URI, PAYLOAD_SECRET
pnpm dev                      # http://localhost:3000
```

**High-impact areas:**
1. **Leo Wizard** — The conversational Enterprise onboarding (hard, high impact)
2. **Federation Installer** — `npx create-angel-enterprise` (hard, high impact)
3. **Customer Angel Token UI** — Order detail with status banners (medium)
4. **WhatsApp Bridge** — Wire bridge-inbound + Twilio adapter (medium)
5. **Docker Compose** — Self-hosting configuration (easy, high impact)
6. **CI/CD Pipeline** — GitHub Actions for test + typecheck (easy)

**Standards:**
- TypeScript strict mode, zero errors
- TDD: write tests first, zero-Payload-import pattern for utility engines
- Constitutional compliance on every feature
- Small PRs, single issue focus

---

*Everyone gets an Angel.*

*Answer 53: The whole point of existence is to learn to love.*
