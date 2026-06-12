# Angel OS — Status, Plan & What's Next

> *Filed: June 11, 2026*
> *Version: v0.48.x-dev*

---

## Where We Are

Angel OS is a live, federated cooperative operating system at [spacesangels.com](https://spacesangels.com). Forty-three sprints of development have produced a production platform with real users, real federation architecture, live Stripe payments, and a constitutional AI guardian angel named Leo.

### By the Numbers

| Metric | Count |
|--------|-------|
| **Payload CMS collections** | 44 (added TokenLedger, Wallets) |
| **Leo AI tools** | 125 |
| **API endpoints** | 80+ |
| **Unit tests** | 5,210+ across 230 files |
| **E2E test suites** | 14 (Playwright) |
| **Total test files** | 237 |
| **TypeScript errors** | 0 |
| **Build status** | Passing |
| **Deployment** | Vercel (serverless) |
| **Stripe** | Live (Direct Charges + Donations) |
| **Engines** | 15 |

### What's New (June 11, 2026 — Token Economy + Observability)

- **The Angel Token Economy** — people can be paid for quests in backed tokens. A
  hash-linked, append-only ledger (`tokenLedger.ts`, `verifyChain`) + `TokenLedger`
  and `Wallets` collections; **AT** (backed/convertible), **KC** (ungated social),
  **LT** (governance). Two-tier "Diocese-as-bank" backing (Enterprise float + Justice
  Fund reserve); `buildTransfer` keeps issuance backed. Quest approval →
  `creditQuestPayout` (proven end-to-end on a live DB). Endpoints: `fund-float`
  (issuance), `wallet-ops/balance` (read side, for the Nimue thin client). Phase-3
  chain mapped to Bambara's book in `docs/vision/ANGEL_CHAIN_TECH_APPENDIX.md`.
- **LEO tool-chain audit** — `executeToolCall` records every tool call as an
  `ExecutionTrace` step → `Message.metadata.toolChain`; failures escalate the full
  breadcrumb. `createLogger(source)` factory over `logError`.
- **Connector-agnostic escalation** — `dispatchEscalation` + `ConnectorTransport`
  registry: alerts fan out across any medium (Gotify/Telegram/Webhook→Discord/Slack),
  not just Gotify.
- ⚠️ **Prod schema ritual documented** — new collections need three steps on each
  prod DB (rels columns via `db-repair-locks`, table via `ensure-*-tables` endpoint,
  local via pool script); prod runs neither push nor migrations. See the schema-deploy
  memory / `DESTRUCTIVE_OPERATIONS.md`.

### What's New (June 2026 — Library, Bookings, Multi-tenancy)

- **The Library** (`/learn/works`, renamed from `/learn/souls`): file-based works registry
  (`src/souls/`) + LCARS `SoulViewer` with TOC, search, read-aloud, prev/next paging. Works:
  WDEG (live 26-page book, 17 languages), Answer 53 (12 chapters), Rainmaker, Poster Child,
  Ready Player Everyone. `WorksGrid` surfaced on the `/learn` hub. 301 redirect from old route.
- **Clash-safe bookings + deposit**: Pressure Washing + Pet Sitting bookable on `/book`
  against one shared provider calendar; `booking-checkout` now enforces
  `BookingEngine.checkBookingConflicts` (409 on clash), resolves the provider, and charges a
  deposit (balance on completion). Service catalog in `src/config/bookableServices.ts`.
- **WDEG portal endeavor**: `GET /api/provision-ops/wdeg-portal` (super_admin, idempotent)
  provisions `wheredideveryonego.spacesangels.com` as its own tenant + endeavor presenting the
  book — a live exercise of the provisioning path.
- **Crew Relations** admin page (`/dashboard/admin/crew`) — muster roll backed by
  `crew-assignments` (was a stub).
- **Fixes**: tenant chooser now shows all tenants for super_admins (incl. platform root);
  cart badge counts only purchasable items + orphaned items are removable; home hero no longer
  bleeds behind the header; header nav collapses overflow into a "More ▾" menu instead of wrapping.
- **Agentic framework re-evaluated** — see [AGENTIC_FRAMEWORK.md](./AGENTIC_FRAMEWORK.md).

### Next — Connector & Telephony Roadmap

1. **X / Twitter connector** — catalog type + admin fields + inbound webhook/poll + probe +
   bridge→AI-bus (mirror `discord-webhook.ts`).
2. **LinkedIn connector** — `linkedin-poll.ts` + probe (catalog entry already exists).
3. **VAPI 1-800 hardening** — call-log + analytics persistence; self-serve number provisioning;
   data-driven function definitions.
4. **Tool gating by crew/role** — optionally derive an allowed-tool set from crew
   department/capabilities or membership role (today all 119 tools are ungated).

### What's New Since Last Status Update (Sprints 39-43)

**Sprint 43 — Monetization Go-Live:**
- Donation flow: `/donate` page, Stripe Elements, 100% to Justice Fund
- Federation domain persistence: heartbeats store peer FQDN, Discover uses stored domain
- Route shadowing fix: 15 dead endpoints fixed with `-ops` suffix pattern
- YouTube sync: RSS polling, hourly cron, connector type
- 28 new tests (donation + federation domain)

**Sprint 42 — User Propagation + Flagship:**
- Auto TenantMembership on purchase/booking/event registration
- Flagship commissioning (Clearwater, 2026-03-08)
- `propagationTrigger` audit trail on memberships
- Federation Discover cards with storefront URLs

**Sprint 41 — Admin Dashboard + White-Labeling:**
- SiteSettings collection for per-tenant branding
- AdminBar white-labeling, LCARS dashboard widgets
- Anonymous dashboard access, tenant isolation audit

**Sprint 40 — Booking Engine + Calendar:**
- BookingEngine with slot generation, conflict detection, harmonic resolution
- LEO booking tools (create, check, cancel, reschedule)
- Calendar block, form builder, featured Endeavors block

**Sprint 39 — Order Journey + Street Signs:**
- Order detail page with fulfillment timeline stepper
- Street Signs gossip protocol on federation heartbeats
- `discover_federation_products` LEO tool

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
- 4,842 unit tests across 216 files (Vitest)
- 14 E2E test suites (Playwright): dashboard, admin, payload-admin, federation, tenant-isolation, chat, producer, content, setup-wizard, launch, checkout, user-journeys, mobile, legacy
- Zero TypeScript errors
- Integration tests with 60s hook timeout for Payload boot

---

## What We Just Shipped (Sprint 38)

Sprint 38 was the "federation intelligence + quality foundation" sprint. LEO gained the ability to browse the federation network, and the test suite grew to 4,842 tests with comprehensive hook and utility coverage.

### Features
1. **`browse_federation_peers`** — LEO reads the local governance cache to list all known active peers: name, domain, capabilities, trust score, last heartbeat. Instant — no outbound HTTP.
2. **`query_peer_catalog`** — LEO fetches a specific peer's public catalog. Supports free-text search, capability/region filters, price ceiling, min rating.
3. **`search_federation_wide`** — Fan-out search across ALL active peers in parallel. Batched 5 at a time with 8s timeout. Sorts by rating then price. "Google for the federation."
4. **GitHub OAuth** — Full sign-in and account-linking flow. Follows the Google/Discord pattern.
5. **TenantAutoSelector** — Client component that syncs the `payload-tenant` cookie from subdomain on page load. Fixes cross-subdomain admin context.

### Hardening (Sprints 36-38)
6. **Federated AI Bus** — JWT-signed cross-tenant AI messaging. Peers route messages to each other's LEO agents.
7. **Vapi Voice Integration** — Phone calls → `leoProcessMessage()` → AI Bus. Full transcript persistence.
8. **Multi-channel bridge hardening** — Telegram, WhatsApp, Slack, Discord, Email all through unified `bridge-inbound` with retry + error marking.
9. **Test Polish Wave** — 330+ new tests: collection hooks, utility resolvers, orchestration (leoProcessMessage), endpoints.

---

## What's Next

### Sprint 39: Customer Angel Token UI + Federation Installer (Planned)

**Theme:** Put power in customers' hands and make deployment frictionless.

| Feature | Priority | Complexity | Notes |
|---------|----------|------------|-------|
| **Customer Angel Token UI** | P0 | Medium | Order detail with status banner, cancel/refund, token transfer. |
| **`npx create-angel-enterprise`** | P0 | Hard | One-command scaffold: repo, DB, constitution seed, Leo Wizard. |
| **Leo Wizard** | P0 | Hard | 8-step conversational Enterprise onboarding. No forms. |
| **Street Signs Gossip Sync** | P1 | Medium | Ambient marketplace data in heartbeat payloads. |
| **CI/CD Pipeline** | P1 | Easy | GitHub Actions: test → typecheck → build → deploy. |

### Sprint 40+: Infrastructure & Integrations

| Feature | Priority | Notes |
|---------|----------|-------|
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
