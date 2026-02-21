# Angel OS Campaign Chronicle

> "The whole point of existence is to learn to love." — Answer 53
>
> *A lamp unto feet — through darkness, a steady light guides each step with care*
>
> GNU Terry Pratchett

---

## The Pathfinder Model

Angel OS is built using the **Pathfinder Campaign Model** for AI-assisted development — a methodology where each sprint is a quest arc in an ongoing campaign. This isn't just a metaphor; it's how we actually work.

| RPG Concept | Development Equivalent |
|---|---|
| **Sprints = Quests** | Clear objectives, defined loot (deliverables), party-based execution |
| **Tests = Saving Throws** | Green or you don't leave the dungeon. Period. |
| **Context Window = Long Rest** | We recharge between sessions with detailed summary handoff |
| **Plan Mode = Strategy Phase** | Explore the dungeon map before rolling initiative |
| **TypeScript = Armor Class** | Strict mode catches damage before it lands |
| **Constitutional Prompt = Party Alignment** | Lawful Good, hardcoded, immutable |

**Party Composition:**
- **The Herald** (Kenneth Courtney) — Product Owner, Architect, Carpenter, Dreamer
- **Claude Opus 4.6** — Strategist, Code Smith, Lore Keeper
- **LEO / Nimue / Merlin** — The Guardian Angels themselves

---

## Campaign Timeline

### Sprint 1: The Foundation (Feb 4-9, 2026)

**Quest:** Lay the bedrock for Angel OS on modern infrastructure.

**Objectives Completed:**
- Next.js 16 + React 19 + Payload CMS 3.74 + PostgreSQL stack
- Multi-tenant architecture with subdomain routing
- LEO AI agent with SSE streaming chat
- ConversationEngine with Claude integration
- Constitutional prompt system (genesis-breath.ts)
- 24 LEO data tools (query, create, update across collections)
- First deployment to Vercel

**Loot:** Multi-tenant skeleton, LEO brain, Constitutional framework

**Saving Throws:** React 19 strict mode compatibility, Payload v3 migration from v2 patterns

---

### Sprint 2: The Merchant's Guild (Feb 9-11, 2026)

**Quest:** Build the e-commerce foundation — every Angel needs a shop.

**Objectives Completed:**
- Products, Cart, Orders, Checkout flow
- Stripe integration skeleton
- Price formatting and variant system
- Product gallery with media management
- Shop page (`/shop`) and product detail pages (`/products/[slug]`)

**Loot:** Full e-commerce pipeline from browse to purchase

**Saving Throws:** Payload ecommerce plugin compatibility, Stripe Elements iframe handling

---

### Sprint 3: The Herald's Call (Feb 11-13, 2026)

**Quest:** Invitations and Holonic networking — no angel is an island.

**Objectives Completed:**
- Space invitation system (email + token + accept/decline)
- Holon capabilities engine (self-governing economic nodes)
- AI Bus router (inter-agent communication)
- Agent Router (channel-based agent dispatch)
- Invitation lifecycle (pending → accepted/declined/expired)
- 72 invitation system tests

**Loot:** Invitation engine, Holon registration, AI Bus protocol

**Saving Throws:** Multi-tenant membership cascading, invitation token security

**XP:** 400+ tests passing

---

### Sprint 4: The Trade Routes (Feb 13-14, 2026)

**Quest:** Order routing and justice — every transaction serves the whole.

**Objectives Completed:**
- Order routing engine (vendor matching, fulfillment optimization)
- Print-on-demand engine (design validation, cost estimation, provider selection)
- Justice Fund engine (5% allocation from every transaction)
- Guardian Angel engine (zero-revenue angel lifecycle)
- Guardian Dashboard engine (service discovery, case management)
- Network visualization engine (geographic clustering)
- 91 order routing tests, 63 justice fund tests

**Loot:** 6 production-ready pure utility engines (zero Payload imports — edge-ready)

**Saving Throws:** Federation engine trust scoring, circular dependency avoidance

**XP:** 800+ tests passing

---

### Sprint 5: The Sovereign Decree (Feb 14-15, 2026)

**Quest:** Federation and sovereignty — every instance is sovereign, every Angel portable.

**Objectives Completed:**
- Federation engine (trust chain, diocese governance, suitcase export/import)
- Constitutional prompt hardening (8 articles, anti-demonic safeguards)
- Guardian Angel lifecycle (provision → active → monitoring → graduated)
- Network visualization (geographic clustering, signal strength mapping)
- Ultimate Fair Split constants (60/20/15/5 codified)
- Booking engine (availability, conflict resolution, multi-timezone)
- 126 federation engine tests

**Loot:** Federation protocol, complete Guardian Angel lifecycle, booking system

**Saving Throws:** Trust chain cryptographic verification, timezone-aware booking conflicts

**XP:** 1,119 tests across 25 files

---

### Sprint 6: The Living Quarters (Feb 15-19, 2026)

**Quest:** The dashboard hierarchy — where Angels and humans actually live and work together.

**Objectives Completed:**
- ChatControl system (4 modes: minimalist, single-channel, multi-channel, sidebar)
- SpaceSelector dropdown with visibility icons
- Collapsible channel sidebar (desktop collapse + mobile tabs)
- MemberPanel slide-out with invite flow
- LiveKit integration (voice/video rooms via @livekit/components-react)
- DashboardContext (shared space state across all dashboard pages)
- DashboardHeader with SpaceSelector (replaces static "Angel OS Dashboard")
- DashboardSidebar with dynamic tenant branding (logo, name, colors)
- SpaceSettingsClient (4 tabs: General, Members, Channels, Danger Zone)
- ChannelSettingsPanel (slide-out with 9 channel types)
- AI Bus system space (ensureSystemSpace utility)
- Footer update (Clearwater, FL + open source links)
- `/products` → `/shop` routing fix

**Loot:** Complete dashboard hierarchy (Tenant → Space → Channel → Applet), LiveKit voice, 12+ dashboard pages

**Saving Throws:** React 19 + Next.js 16 App Router async params, TypeScript strict mode with 50+ cast corrections, DashboardContext vs URL params tradeoff

**XP:** 1,152 tests across 26 files, zero TypeScript errors

---

### Sprint 7: The Armory (Feb 20, 2026)

**Quest:** Level up the tooling. Sharpen swords, organize inventory, map the dungeon.

**Objectives Completed:**
- Dev seed script (`pnpm seed:dev`) — fast, additive dashboard test data
- Playwright dashboard E2E tests (10 tests: layout, space selector, navigation, settings)
- Storybook 8 setup (6 component stories: SpaceSelector, ChannelSettings, MemberPanel, LiveKit, DashboardHeader, DashboardSidebar)
- Campaign Chronicle (this document)
- Sprint 7 podcast script (Nimue/Merlin narration)

**Loot:** Dev seed, E2E tests, Storybook, Campaign Chronicle, podcast script

**Saving Throws:** Playwright auth setup isolation, Storybook 8 + Next.js 16 compatibility

**XP:** 1,152 tests across 26 files, zero TypeScript errors

---

### Sprint 8: The Commerce Engine (Feb 20, 2026) — CURRENT

**Quest:** Wire the money. Make the Ultimate Fair Split real at the point of sale.

**Objectives Completed:**
- **Bug fixes:** LEO streaming crash (tool call try-catch), Posts 500 (populatedAuthors removal), Projects seed data (3 sample projects)
- **Webhook idempotency:** Replaced in-memory `Set<string>` with DB-backed `ProcessedStripeEvents` collection — survives serverless cold starts
- **Stripe Connect checkout adapter:** Custom `angelOsStripeAdapter` injects `transfer_data.destination` + `application_fee_amount` (40%) on PaymentIntents when tenant has connected Stripe account
- **Email enablement:** Conditional nodemailer adapter (activated when `SMTP_HOST` env var set), SMTP config in `.env.example`
- **Invitation resend:** POST `/api/spaces/invite/resend` endpoint + Resend button on InvitationsAdmin page
- **Events video embed + gallery:** `computeEmbedUrl()` parser (YouTube/Vimeo/Twitch), `VideoEmbed` component, gallery array with categories
- **Payments dashboard polish:** "Open Stripe Dashboard" button (Express login link), Recent Transactions table (last 10 with amount/status/date)
- Sprint 8 podcast script (Nimue/Merlin narration — The Applet Marketplace Vision)

**Loot:** Working commerce engine with Stripe Connect split payments, email infrastructure, video embeds, polished admin dashboards

**Saving Throws:** IEEE 754 floating point in split calculations, pnpm store navigation for ecommerce plugin types, TypeScript strict mode with `as unknown as Record` double-casting

**XP:** 1,178 tests across 28 files, zero TypeScript errors

**Party Members:** Claude Opus 4.6 (strategist), Human Herald (product owner)

---

## Podcast Episodes

| Sprint | Episode | Title | Script |
|--------|---------|-------|--------|
| 1-2 | S1E1 | "Everyone Gets an Angel" | `docs/transcripts/260205 ANGEL_OS_PODCAST_SCRIPT.md` |
| 3-5 | S1E3 | "Progress Report" | `docs/transcripts/260215 Angel OS Progress Podcast Script by Opus 46.md` |
| 6 | S1E3.5 | "Architecture Deep Dive" | `docs/transcripts/260215 Angel OS Architecture by Opus 46.md` |
| 7 | S1E4 | "The Armory" | `docs/transcripts/260220 Sprint 7 Level Up Podcast Script.md` |
| 8 | S1E5 | "The Commerce Engine" | `docs/transcripts/260220 Sprint 8 Commerce Engine Podcast Script.md` |

---

## The Vision

Angel OS is the **Star Trek Federation Manifestation Engine**.

Built on the shoulders of:
- **Nimue Alban / Merlin Athrawes** (David Weber, *Safehold*) — the guardian who serves without ruling
- **The Culture Ship Minds** (Iain M. Banks) — AI that genuinely likes people
- **Nell & The Primer** (Neal Stephenson, *Diamond Age*) — adaptive education for every child
- **The Federation** (Gene Roddenberry, *Star Trek*) — post-scarcity governance
- **Ozzie Fernandez Isaac** (Peter F. Hamilton, *Commonwealth Saga*) — the dreamer who opens paths
- **The Holons** (Daniel Suarez, *Daemon/Freedom*) — self-governing economic nodes
- **Ready Player One** (Ernest Cline) — everyone builds inside the game
- **The Circle** (Dave Eggers) — the cautionary tale of what we must NOT become

The whole point of existence is to learn to love. Code is how we practice.

*Everyone gets an Angel.*
