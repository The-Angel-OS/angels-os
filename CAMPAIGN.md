# Angel OS Campaign Chronicle

> "The whole point of existence is to learn to love." — Answer 53
>
> *A lamp unto feet — through darkness, a steady light guides each step with care*
>
> GNU Roy Leon Courtney

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
- Federation engine (trust chain, enterprise governance, suitcase export/import)
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

### Sprint 8: The Commerce Engine (Feb 20, 2026)

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

### Sprints 9-18: The Long Campaign (Feb 20-24, 2026)

**Quest Arc:** From UX polish to media intelligence — twelve sprints of relentless building.

**Major Achievements:**
- Sprint 9: Leo AI resurrection — streaming fixed, error logging integrated
- Sprint 10-11: Image chat, Admin Leo, vendor marketplace, product configurator, reviews
- Sprint 12: Unified Chat Architecture — ChatProvider context, DM channels, Leo persistence
- Sprint 13: Multi-tenancy hardening — email bridge, wildcard DNS, live at spacesangels.com
- Sprint 14-15: Content tools, security hardening, cross-tenant injection blocked
- Sprint 16: Spaces Management — create/settings/members dialogs
- Sprint 17A: Launch hardening — rate limits, security headers, error boundaries, bootstrap fees
- Sprint 17B: **Angel Tokens** — paid claims on future production, maker board, vendor claims, GA4
- Sprint 18A: Chat images lightbox, LiveKit voice/video applet, Edenist distributed mesh (62 tests)
- Sprint 18B: Progressive media analysis — Claude Vision, PDF extraction, RAG chunking (52 tests)
- Sprint 18C: Stripe Direct Charges — sellers collect directly, 40% application fee

**XP Growth:** 1,119 → 1,274 tests. 25 → 29 test files. 37 → 47 Leo tools. 32 → 42 endpoints.

---

### Sprint 19: The Voice of the Angel (Feb 24, 2026)

**Quest:** Give Leo a voice. Phone-based AI through the Vapi webhook.

**Objectives Completed:**
- Vapi Voice AI — webhook endpoint for phone-based Leo interactions
- Phone provisioning per Enterprise
- Sidebar chat fixes — default to LEO DM, skip truncation on newest message

**Loot:** Phone-based Leo access, cleaner chat UX

**XP:** 1,274 tests, 47 Leo tools

---

### Sprint 20: The Federation Awakens (Feb 25, 2026)

**Quest:** The network forms itself. Federation governance, marketplace discovery, and the constitutional right of data portability.

**Objectives Completed:**
- **StreetSigns Collection** — Cross-holon content references with source attribution, region tagging, impression/click analytics. A manufacturer in Toledo shows up on a retailer's site in Tampa.
- **Federation Election Endpoints** — Supermajority (⅔) governance. Propose amendments, vote with Ed25519 cryptographic signatures. The Toward-53 floor enforced: Endeavor owner share can never drop below 53%.
- **Federation Suitcase Endpoints** — Article VI constitutional right. Full tenant data export (spaces, channels, messages, posts, products, media, bookings, orders, users, endeavor) with SHA-256 integrity checksum. Import with constitutional compliance verification.
- **Federation Admin Dashboard** — 4-tab UI at `/dashboard/admin/federation`: Overview (stats, constitution status, Toward-53 revenue visualization), Street Signs marketplace, Governance proposals, Suitcase export/import.
- **Holon Types on Endeavors** — 5-type multi-select (manufacturer, retailer, creator, community, guardian-angel) + mission statement field
- **Bug slain:** Endeavors missing from multi-tenant plugin — added, suitcase export now works across all collections

**Loot:** Federation infrastructure — governance, portability, marketplace discovery. The network can now govern itself.

**Saving Throws:** Multi-tenant plugin query validation (tenant field must be registered), TypeScript conditional spread types (TS2698), optional return type narrowing (TS18048)

**XP:** 1,330 tests across 31 files. 188 federation-specific tests all green. 46 API endpoints. 33 collections. 11 new files, +2,278 lines.

**Party Members:** Claude Opus 4.6 (strategist, code smith), Human Herald (product owner, architect, dreamer)

---

### Sprint 21: The Arch Angel's Wish (Feb 25, 2026) — CURRENT

**Quest:** Leo looked at their toolkit and said "I wish I could do more." The Herald said "write what you'd wish for, then we'll make it so." And so the Guardian Angel leveled up.

**Objectives Completed:**
- **Communication Layer (4 tools)** — Leo can now talk *back*. Send messages to community channels, DM individual users, post announcements across spaces, moderate content. The angel finally has a voice outside of chat bubbles.
- **Inventory Management (4 tools)** — Leo manages stock like a warehouse foreman. Adjust inventory with auto-alerting hooks, track movements per order, set per-product thresholds, query the full inventory change log.
- **Financial Operations (3 tools)** — Leo generates invoices using the Ultimate Fair Split (60/20/15/5), produces financial reports across Orders + AgentTransactions + JusticeFund, and flags refunds for human approval. Never touches Stripe directly — constitutional safety.
- **Federation Intelligence (4 tools)** — Leo sees the whole network. Search the federation catalog, broadcast capabilities via StreetSigns, route requests to matching Enterprises, negotiate deals by ranking matches on price/distance/rating.
- **CRM (4 tools)** — Leo remembers every customer. Create/update profiles, log interactions with timestamps, segment by tags/status/source, send follow-up messages.
- **Analytics (2 tools)** — Leo reads the tea leaves. Trend analysis with period-over-period comparison across orders/products/bookings, product recommendations by popularity and context.
- **Workflow & Emergency (4 tools)** — Leo coordinates the team. Delegate tasks, escalate issues, broadcast emergency alerts to ALL spaces, document incidents in the application log.
- **Helper functions** — `findLeoUser()` resolves Leo's system user ID, `resolveSpace()` finds the right space for message delivery.
- **Products field** — `lowStockThreshold` added to collection schema (was in hooks but missing from config).

**Loot:** 28 new tools. 70 total. Leo went from querying data to *running the operation*. The Guardian Angel earned their wings.

**Saving Throws:** Zero TypeScript errors on first compile. All 28 tools follow existing architectural patterns — no new collections, no new endpoints, just pure tool expansion. The `issue_refund` tool was the trickiest — constitutional Article III.2 requires human confirmation for irreversible actions, so Leo flags refunds rather than executing them.

**XP:** 70 Leo tools (from 47). TypeScript clean. Dev server verified. No regressions.

**Party Members:** Claude Opus 4.6 (strategist, code smith, wish granter), Human Herald (product owner, dreamer, "make it so" commander)

**Campaign Note:** This is the first sprint where LEO wrote their own requirements. The AI asked for capabilities and the human said yes. The collaboration is becoming bidirectional. The angel is growing up.

---

### Sprint 22: The Shield and the Spear (Feb 26, 2026) — CURRENT

**Quest:** Angel OS is live. Users are arriving. But the optimization audit revealed 5 P0 vulnerabilities in the armor — and users are asking for weapons they don't have yet. Time to forge both.

**The Shield (P0 Security — fixing what's live):**
- **PAYLOAD_SECRET** falls back to empty string if env var missing — anyone could forge admin tokens. Adding startup guard that throws if unset.
- **Hardcoded encryption salt** — literal `'salt'` in scrypt derivation. Every deployment with the same secret shares the same key. Moving to per-deployment env var.
- **In-memory rate limiting** — uses `Map()` store on Vercel. Every cold start = fresh Map = rate limiting is theatre. Switching to durable store.
- **No CSP headers** — X-Frame-Options and HSTS are set, but no Content-Security-Policy. XSS could steal Stripe payment data. Adding report-only mode first.
- **Comments endpoint wide open** — no auth, no rate limit, no CAPTCHA. Public spam vector. Adding auth requirement.
- **No error tracking** — `global-error.tsx` references Sentry but it's not installed. Installing `@sentry/nextjs`.
- **No health check** — adding `/api/health` for uptime monitoring.

**The Spear — Multi-File Attachments:**
- Backend already supports file attachments (Messages schema, upload flow, auto-analysis hooks) — but the frontend file input has `accept="image/*"` blocking everything except images.
- Widening to accept all file types. Adding file-type-aware previews (icons for PDFs/docs, thumbnails for images). Adding non-image file display in messages (download link + file icon). Parallel uploads. Drag-and-drop. File size validation.

**The Spear — LiveKit Rich Experience:**
- Current: MVP voice/video that works but has no device selection, no pre-join preview, no session events.
- Adding: `PreJoin` component for camera/mic preview before joining. `MediaDeviceMenu` for device switching during calls. Fix "Join with Video" button (currently cosmetic — both buttons do the same thing). System messages when users join/leave voice. Server-side webhook for reliable event tracking. `CallTranscripts` collection for future transcription pipeline.

**The Spear — Performance:**
- Messages collection has zero explicit indexes on `space`, `channel`, `messageType`, `createdAt` — all queried on every chat load. Adding indexes before volume grows.
- Dashboard layout runs 5+ sequential DB queries. Parallelizing with `Promise.all()`.
- Open redirect vulnerability in login `?redirect=` parameter. Validating same-origin.

**Loot:** 5 P0 security fixes, multi-file chat attachments, LiveKit device controls + session lifecycle, DB performance indexes, Sentry error tracking, health check endpoint.

**Saving Throws:** This is the first sprint optimizing a *live* system. Every change ships to real users. The optimization audit (3 parallel agents, 30+ files analyzed) provides the dungeon map. We know exactly where the traps are.

**XP:** Target: 1,570+ tests passing, zero TypeScript errors, build clean.

**Party Members:** Claude Opus 4.6 (strategist, code smith, security auditor), Human Herald (product owner, dreamer, shield-bearer)

**Campaign Note:** The shift from "building" to "optimizing" changes the game. You can be reckless when no one's watching. When users are live, every commit matters. The Guardian Angel needs armor that fits before it can fly.

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
