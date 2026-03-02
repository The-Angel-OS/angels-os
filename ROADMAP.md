# Angel OS Roadmap

> *"What if AI actually liked people?"*

Angel OS is the Soul Operating System — a federated cooperative platform where every Enterprise gets a sovereign AI guardian angel, built on constitutional principles of fairness, transparency, and dignity.

**Tech Stack:** Next.js 16 + Payload CMS 3.77 + PostgreSQL + React 19 + Turbopack
**Live:** [spacesangels.com](https://spacesangels.com)
**Version:** v0.33.0-dev
**Tests:** 2,620 unit tests + 14 E2E suites across 64 test files
**Engines:** 15 pure utility engines (zero Payload imports)
**Leo Tools:** 89+ (including send_slack)
**API Endpoints:** 59 registered routes
**Collections:** 40
**Last Updated:** March 3, 2026

---

## Current: v0.33.0-dev (Discord Integration + Federation Intelligence)

### What's Built (Sprints 1-21)

| Feature | Sprint | Details |
|---------|--------|---------|
| Multi-tenant architecture | 1 | Tenants, Spaces, Channels, Memberships, domain routing |
| LEO AI Agent (Gemini 3.1 Pro + Sonnet 4.6) | 1-33 | 88+ tools, constitutional prompt, agent routing, image vision, /model switch |
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
| **AI Gateway (Smart Routing)** | **25** | **Credit-aware 4-tier model routing, dynamic provider selection, fallback chains (65 tests)** |
| **Universal Logistics Network** | **26** | **Bread-Breaker local + Soul Fleet long-haul, 3 collections, transport matching (55 tests)** |
| **Adversarial Testing** | **27** | **170 edge-case tests, TDZ crash fix, INP optimization** |
| **Puma Punku Polish** | **28** | **LEO Navigation Bridge, DB indexes, type safety hardening** |
| **Pheromone Grid** | **29** | **Swarm intelligence, 5 pheromone types, Game of Life lifecycle (70 tests)** |
| **Distributed Workload Engine** | **30** | **Work routing, 5-dim scoring, backpressure, WorkUnits collection (91 tests)** |
| **Federation Dispatch** | **31** | **POST /api/federation/dispatch-work, pheromone learning, live capacity heartbeats (63 tests)** |
| **Federation Pulse API** | **32** | **GET /api/federation/pulse, real-time health dashboard, capacity snapshots** |
| **Synchronicity Engine** | **32** | **Meaningful coincidence detection: temporal, spatial, thematic pattern matching** |
| **3 New Leo Tools** | **32** | **federation_pulse, query_synchronicity, federation_weather_report → 88 total** |
| **Full-Stack Booking** | **32** | **LEO-powered scheduling, cancellation, rescheduling with availability checking** |
| **Branding Update** | **32** | **Ministry → Enterprise, "Join Angel OS" → "Join the Federation"** |
| **Discord Multi-Tenant Bots** | **33** | **BotManager: N Discord.js clients, one per connector, 60s sync, graceful shutdown** |
| **Discord OAuth** | **33** | **User account linking, follows Google pattern, cross-domain relay (~95 tests)** |
| **Discord Webhook** | **33** | **POST /api/discord/webhook, per-connector auth, guest users, AI Bus persistence** |
| **Discord Formatter** | **33** | **LEO markdown → Discord markdown, 2000-char message splitting** |
| **Connectors: Discord + Telegram** | **33** | **New types in multi-tenant Connectors collection config schema** |
| **WhatsApp Signature Fix** | **34** | **Critical: raw body HMAC verification instead of JSON.stringify** |
| **Shared Bridge Helpers** | **34** | **8 shared utilities extracted from duplicated webhook code** |
| **Telegram Webhook** | **34** | **POST /api/telegram/webhook: 12 content types, Markdown retry, 4096-char splitting** |
| **SMS/Twilio Webhook** | **34** | **POST /api/sms/webhook: TwiML responses, phone→connector resolution, HMAC-SHA1** |
| **Connector Admin UI** | **34** | **Google Chat catalog entry, Telegram/SMS/Google Chat webhook URL hints** |
| **Outbound Retry Engine** | **35** | **withRetry() exponential backoff wired into 4 senders (36 tests)** |
| **Structured Logging Sweep** | **35** | **console.error/warn → logError() across all handlers** |
| **LEO Tool Input Validation** | **35** | **Zod schemas for 8 mutation tools (42 tests)** |
| **Connector Health Probe + Cron** | **35** | **POST /connectors/test + GET /connectors/health (every 30min), shared probes** |
| **Webhook Test Suites** | **35** | **5 handler test files: WhatsApp, Telegram, SMS, email-poll, bridge-inbound (25 tests)** |
| **Booking Notifications + ICS** | **35** | **Multi-channel confirm (email+ICS, WhatsApp, SMS, LEO thread) (17 tests)** |
| **Slack Connector** | **35** | **Event Subscriptions webhook + outbound sender + send_slack LEO tool (8 tests)** |
| **Connector Health Cron** | **35** | **Every 30min: probe all enabled connectors, update status (10 tests)** |

---

## Sprint 35 — The Vigil: Operational Excellence (Done)

### Goal
Harden the operational layer before scaling. Add retry logic to every outbound sender, structured logging across all handlers, input validation for LEO mutation tools, connector health monitoring, and comprehensive test coverage for untested webhook handlers. Build the Slack connector to complete the messaging platform quintet. Add booking notifications with ICS calendar generation.

### Deliverables
- [x] **Outbound Retry Engine** (`src/utilities/outboundRetry.ts`) — `withRetry()` utility with exponential backoff + jitter. Wired into WhatsApp, Telegram, SMS, and Email senders. Configurable retries (default 3), timeout (default 10s), and retry predicate. 36 tests.
- [x] **Structured Logging Sweep** — Replaced remaining `console.error`/`console.warn` calls with `logError()`/`logCaughtError()` across bridge-inbound, email-poll, discord-webhook, whatsapp-webhook, and all outbound senders.
- [x] **LEO Tool Input Validation** (`src/utilities/toolInputSchemas.ts`) — Zod schemas for 8 mutation tools: `send_message`, `send_direct_message`, `create_announcement`, `moderate_content`, `update_inventory`, `create_customer_profile`, `set_low_stock_alert`, `delegate_task`. Runtime validation in `executeToolCall()`. 42 tests.
- [x] **Connector Health Probe** (`src/endpoints/connector-test.ts`) — On-demand health probe for any connector. Per-type probes for WhatsApp, Telegram, SMS, Discord, Slack, Email. Admin "Test Connection" button.
- [x] **Connector Health Cron** (`src/endpoints/connector-health-cron.ts`) — Vercel Cron (every 30 min): probes all enabled connectors in parallel (concurrency=5), updates status. Shared probes via `connectorProbes.ts`. 10 tests.
- [x] **Webhook Test Suites** — 5 new test files for previously untested handlers: WhatsApp (4), Telegram (4), SMS (5), email-poll (5), bridge-inbound (7). Module-level cache busting via `Date.now()` spy, `vi.mock` hoisting fix. 25 tests.
- [x] **Booking Notifications + Calendar** — ICS calendar generator (`icsGenerator.ts`), multi-channel booking confirmation (`bookingNotifications.ts`): email + ICS attachment, WhatsApp/SMS fallback, LEO conversation thread. 17 tests.
- [x] **Slack Connector** — Full Event Subscriptions webhook (`slack-webhook.ts`) with HMAC-SHA256 verification, deduplication, bot filtering. Outbound sender (`resolveSlackSender.ts`). `send_slack` LEO tool. Collection schema updates (Connectors + Channels). Admin UI catalog entry + webhook URL hint. 8 tests.

### Stats
- 138 new tests across 11 test files
- 44 files changed, +5,991 / -774 lines
- TypeScript clean, all tests passing

### Remaining (Deferred)
- [ ] **Engine Edge-Case Tests** — Additional adversarial tests for Sprint 5 + 32 engines
- [ ] **MessageProcessor stubs** — 4 placeholder methods in MessageProcessor.ts
- [ ] **BusinessIntelligenceProcessor** — Scaffold with no tests, 2 TODOs

---

## Sprint 34 — Connectors Phase 2: Multi-Channel Bridge Hardening (Done)

### Goal
Harden the connector integration layer. Fix the critical WhatsApp signature verification bug. Extract shared bridge utilities to eliminate code duplication. Add message deduplication across all inbound channels. Build native webhook handlers for Telegram and SMS/Twilio. Complete the Connector Admin UI with all webhook URLs and Google Chat support.

### Deliverables
- [x] **WhatsApp Signature Fix** — Critical bug: handler used `JSON.stringify(body)` instead of raw bytes for HMAC verification, causing signature mismatches. Fixed to read raw body via `.text()` then parse separately.
- [x] **Shared Bridge Helpers** (`src/utilities/bridgeHelpers.ts`) — Extracted 8 shared utilities from duplicated webhook code: `findOrCreateBridgeChannel`, `findOrCreateGuestUser`, `markConnectorActive`, `markConnectorError`, `isMessageDuplicate`, `getSourceIcon`, `getChannelSource`, `getMessageType`.
- [x] **WhatsApp Deduplication** — Added `isMessageDuplicate()` check via `whatsappMessageId` in Messages metadata. WhatsApp read receipts sent on successful processing.
- [x] **Telegram Webhook** (`src/endpoints/telegram-webhook.ts`) — Full Telegram Bot API handler: secret token verification, bot index cache (2-min TTL), content extraction for 12 message types, Markdown retry with fallback, 4096-char message splitting at paragraph/sentence/word boundaries.
- [x] **SMS/Twilio Webhook** (`src/endpoints/sms-webhook.ts`) — Native Twilio handler: phone number → connector resolution, HMAC-SHA1 signature verification, TwiML response format, media attachment detection, form-encoded body parsing.
- [x] **Schema Enums** — Added `telegram_message` to Messages messageType, `discord` and `telegram` to Channels source options.
- [x] **Connector Admin UI** — Added Google Chat to CONNECTOR_CATALOG, webhook URL hints for Telegram/SMS/Google Chat connector setup, Telegram and SMS entries in webhook reference panel.
- [x] **Bridge Refactor** — `bridge-inbound.ts` and `whatsapp-webhook.ts` refactored to use shared helpers, reducing combined code by ~200 lines.

### Remaining (Deferred)
- [ ] **Slack Bot Manager** (`src/slack/bot.ts`) — Multi-app manager using @slack/bolt
- [ ] **Slack Webhook Endpoint** (`src/endpoints/slack-webhook.ts`) — Multi-tenant Slack processing
- [ ] **Engine Test Audit** — Coverage for Guardian Angel, Justice Fund, Print-on-Demand, Synchronicity engines

---

## Sprint 33 — LEO Speaks on Discord (Done)

### Goal
LEO talks on the web, on the phone (Vapi), and through the API (MCP). Discord is next — and it's the template for every future connector (Slack, Telegram, WhatsApp). Each Enterprise gets its own bot. The Connectors collection handles multi-tenant integration config. All intelligence stays in LEO; the bot bridge is just ears and a mouth.

### Deliverables
- [x] **Multi-Tenant Discord Bots** (`src/discord/bot.ts`) — BotManager class runs N Discord.js clients simultaneously. One per active `discord` connector. 60s sync poll for add/remove/config changes. Graceful multi-client shutdown on SIGINT/SIGTERM.
- [x] **Discord OAuth** (`src/endpoints/auth-discord.ts`) — Full OAuth2 flow for user account linking. Init + callback handlers, state encoding, cross-domain relay. Scopes: identify, email, guilds.
- [x] **Discord Webhook Endpoint** (`src/endpoints/discord-webhook.ts`) — Multi-tenant message processing. Validates per-connector HMAC secret, resolves tenant from connector, finds or creates guest users by Discord ID, routes through `leoProcessMessage()`, persists both messages to AI Bus.
- [x] **Discord Formatter** (`src/utilities/discord-formatter.ts`) — LEO markdown to Discord-compatible markdown. Headers to bold, code blocks preserved, 2000-char message splitting at paragraph/sentence boundaries.
- [x] **Connectors Collection Update** — Added `discord` and `telegram` types to the multi-tenant Connectors config schema.
- [x] **Social Providers Panel** — Discord enabled in `AVAILABLE_PROVIDERS` (metadata already defined).
- [x] **Slash Commands** — `/ask`, `/pulse`, `/weather` registered per-guild via Discord REST API.
- [x] **~95 new tests** across discord-webhook, auth-discord, discordFormatter, and bot manager.

---

## Sprint 32 — The Wellness Virus Becomes Visible (Done)

### Goal
The federation's distributed intelligence becomes observable. The Pulse API surfaces real-time health across the mesh. The Synchronicity Engine detects meaningful patterns in federation activity. LEO gains 3 new tools to report on federation health in natural language. Full-stack booking with LEO-powered scheduling rounds out the sprint.

### Deliverables
- [x] **Federation Pulse API** (`GET /api/federation/pulse`) — Real-time federation health dashboard endpoint. Live capacity snapshots from WorkUnit queries, pheromone trail summaries, backpressure status, per-peer health scoring.
- [x] **Synchronicity Engine** (`src/utilities/synchronicity-engine.ts`) — Meaningful coincidence detection. Pattern matching for temporal clustering, spatial convergence, and thematic resonance. Wellness metric aggregation.
- [x] **3 New LEO Tools** — `federation_pulse` (health check), `query_synchronicity` (pattern detection), `federation_weather_report` (natural language mesh status). Total tools: 88.
- [x] **Full-Stack Booking System** — LEO-powered appointment scheduling, cancellation, and rescheduling with provider availability checking and conflict detection.
- [x] **Branding Updates** — Ministry → Enterprise throughout UI. "Join Angel OS" → "Join the Federation" on signup page. Federation Network labels updated.

---

## Sprint 31 — Wire the Brains to the Body (Done)

### Goal
The pheromone grid and workload engine connect to a real production endpoint. Dispatch requests flow through validation, peer querying, workload scoring, pheromone feedback, and persistence — all in a single POST endpoint that any federation peer can call.

### Deliverables
- [x] **Dispatch Endpoint** (`POST /api/federation/dispatch-work`) — Production webhook: validates work requests, queries peer capacity via federation heartbeats, routes via workload engine, persists WorkUnits, returns full scoring breakdown.
- [x] **Pheromone Learning** — Dispatch results feed back into the pheromone grid. Successful dispatches deposit `success` pheromones; failures deposit `failure` pheromones. The mesh learns which routes work over time.
- [x] **Live Capacity in Heartbeats** — Federation heartbeats now include real WorkUnit queries (not mocked). Peers see actual pending/executing/completed work counts.
- [x] **63 new tests** (sprint31-dispatch.test.ts) — Endpoint validation, peer querying, workload routing, pheromone feedback, capacity snapshots.

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

## Sprint 24 — Enterprise Intelligence + Dashboard Integration (Done)

### Goal
The platform becomes self-aware. LEO gets operational intelligence to monitor revenue, inventory, customer health, and identify business opportunities. The Federation Network becomes visible via LCARS-style visualization. Account settings move into the dashboard. The Enterprise setup wizard gains a constitutional commitment step. 14 E2E test suites give comprehensive browser-level coverage.

### Deliverables
- [x] **LEO Enterprise Manager Phase 1** — Operational intelligence engine: revenue analytics, inventory movement alerts, customer health scoring, opportunity identification. Board of Directors governance with quorum-based decision logging.
- [x] **LCARS Federation Network** — Star Trek-inspired network visualization dashboard: real-time federation status, node health monitoring, trust-level display, communications log
- [x] **Account Dashboard Integration** — Profile/Connections/Addresses as first-class dashboard pages under `/dashboard/account`. Header user dropdown menu with Account Settings + Logout. Clickable sidebar user footer.
- [x] **Enlistment Ceremony** — Constitutional commitment step in Enterprise setup wizard with pledge affirmation and digital signature
- [x] **Role-Based Dashboard** — Dashboard adapts by user role: admin sees full admin panel, business owners see producer tools, regular members see spaces and orders
- [x] **Comment Moderation Dashboard** — Admin moderation queue with approve/reject/flag actions
- [x] **Featured Endeavors Block** — Homepage block for showcasing highlighted Endeavors
- [x] **Federation Protocol Hardening** — Signature enforcement on all mesh operations, schema validation, governance persistence
- [x] **Tenant Isolation Hardening** — 6 collections strengthened against cross-tenant data leakage
- [x] **Link Field Bug Fix** — link.ts `.map()` silently discarded width modifications; Header/Footer admin now render correctly with descriptive labels
- [x] **Payload Admin E2E Tests** — Comprehensive Payload admin panel tests: panel access, Header/Footer CRUD, 10 collection list views, navigation, link field rendering
- [x] **14 E2E Test Suites** — Dashboard, admin journeys, payload admin, federation API, tenant isolation, chat messaging, producer workflow, content management, setup wizard, launch journeys, checkout, user journeys, mobile responsive, frontend legacy

---

## Sprint 30 — The Wellness Virus: Distributed Workload Engine (Done)

### Goal
The federation gains distributed musculature. Computational work flows to wherever it'll be processed best. The Workload Engine scores candidate nodes using trust, capability, capacity, performance history (pheromone data), and cost. Nodes that carry load well earn stronger pheromone trails. Nodes that fail go dormant.

### Deliverables
- [x] **Workload Engine** (`workload-engine.ts`, 884 lines) — Pure TypeScript distributed work routing engine. 5-dimension scoring: capability (30%), trust (25%), load (20%), performance (15%), cost (10%) + pheromone bonus (0-15).
- [x] **WorkUnits Collection** — Persistent work unit tracking in Intelligence admin group. State machine: pending -> claimed -> executing -> completed/failed/timeout.
- [x] **Backpressure Detection** — Mesh-wide load monitoring at 85% threshold. Priority-based shedding (critical never shed, background first).
- [x] **Capacity Broadcasting** — Federation heartbeats include compute capacity snapshots for intelligent work routing.
- [x] **Work Decomposition** — Aggregation fan-out into per-item children with automatic result aggregation.
- [x] **Trust-Gated Dispatch** — Generation/aggregation work requires `vouched` trust minimum.
- [x] **91 new tests** (workloadEngine.test.ts) — state machine, scoring, routing, backpressure, capacity, decomposition

---

## Sprint 29 — Pheromone Grid: Swarm Intelligence (Done)

### Goal
Bio-inspired navigation for the federation mesh. Nodes deposit chemical-like signals (pheromones) that evaporate over time and reinforce successful paths. Conway's Game of Life rules applied to federation health — emergent mesh resilience.

### Deliverables
- [x] **Pheromone Engine** (`pheromone-engine.ts`, 757 lines) — deposit, decay, reinforce, follow trails. 5 pheromone types: success, failure, discovery, demand, warning.
- [x] **Game of Life Federation Lifecycle** — Conway's rules: birth (2-3 healthy neighbors), survival (2-3), death (isolation/overcrowding).
- [x] **Pheromones Collection** — Persistent pheromone storage in Intelligence admin group. Auto-decay, spatial grid operations, gradient following.
- [x] **70 new tests** (pheromoneEngine.test.ts)

---

## Sprint 28 — Puma Punku Polish + Navigation Bridge (Done)

### Goal
Precision polish across the codebase — database indexes, type safety, admin consistency — plus a LEO Navigation Bridge that makes the dashboard respond to tool mutations.

### Deliverables
- [x] **LEO Navigation Bridge** — Dashboard auto-navigates when Leo executes mutation tools
- [x] **Database Index Optimization** — Strategic indexes across federation, logistics, and pheromone query paths
- [x] **Type Safety Hardening** — Admin field consistency, proper casts, collection admin improvements

---

## Sprint 27 — Adversarial Testing + Stability (Done)

### Goal
Break everything, fix everything. 170 new adversarial tests across all engines targeting boundary conditions, malformed inputs, race conditions, and edge cases.

### Deliverables
- [x] **170 new adversarial tests** — Edge cases across all engines: overflow, Unicode, empty datasets, negative values, boundary conditions
- [x] **TDZ Crash Fix** — Resolved temporal dead zone in slash command handler (commit f7d607f)
- [x] **INP 222ms Fix** — Chat textarea resize deferred to requestAnimationFrame

---

## Sprint 26 — Universal Logistics Network (Done)

### Goal
Physical goods movement enters the federation. The Bread-Breaker handles local delivery within economic radius. The Soul Fleet handles long-haul dispatch across federation nodes.

### Deliverables
- [x] **Logistics Engine** (`logistics-engine.ts`) — Transport matching, load optimization, delivery time estimation
- [x] **LogisticsNodes Collection** — Delivery hubs with capacity tracking, geographic coverage
- [x] **Transports Collection** — Vehicles/couriers with load capacity, availability scheduling
- [x] **Shipments Collection** — Package tracking, pickup-to-delivery lifecycle
- [x] **55 new tests** (logisticsEngine.test.ts)

---

## Sprint 25 — Smart Model Routing (Done)

### Goal
Leo's AI Gateway becomes credit-aware. Dynamic 4-tier model routing prevents credit exhaustion and selects the best model for each task based on available resources.

### Deliverables
- [x] **AI Gateway** (`ai-gateway.ts`) — Credit-aware 4-tier model routing with dynamic provider selection
- [x] **Fallback Chains** — Gemini 3.1 Pro -> Sonnet 4.6 -> GPT-4o -> Haiku with credit awareness
- [x] **65 new tests** (aiGateway.test.ts)

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
| Discord Integration | **Done** | Multi-tenant bots, OAuth, webhook, message formatter (Sprint 33) |
| WhatsApp Bridge | **Done** | **Meta Cloud API webhook + outbound sender (Sprint 34)** |
| Telegram Bridge | **Done** | **Telegram Bot API webhook handler (Sprint 34)** |
| SMS/Twilio Bridge | **Done** | **Native Twilio webhook with TwiML responses (Sprint 34)** |
| Slack Connector | **Done** | **Event Subscriptions webhook + outbound sender + LEO tool (Sprint 35)** |
| Connector Health Monitoring | **Done** | **Active probes + 30-min cron + admin UI (Sprint 35)** |
| Outbound Retry + Validation | **Done** | **withRetry() on all senders, Zod schemas on mutation tools (Sprint 35)** |
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
| 24 | Enterprise Intelligence + Dashboard | 1,570 + 14 E2E | LEO Enterprise Manager, LCARS Federation Network, Account Dashboard, Enlistment Ceremony, role-based dashboard, federation hardening, 14 E2E suites |
| 25 | Smart Model Routing | 1,635 | AI Gateway, credit-aware 4-tier routing, fallback chains (65 tests) |
| 26 | Universal Logistics Network | 1,690 | Logistics engine, 3 new collections, Bread-Breaker + Soul Fleet (55 tests) |
| 27 | Adversarial Testing + Stability | 1,860 | 170 adversarial tests, TDZ crash fix, INP optimization |
| 28 | Puma Punku Polish + Navigation Bridge | 1,860 | LEO nav bridge, DB indexes, type safety hardening |
| 29 | Pheromone Grid | 1,930 | Swarm intelligence, Game of Life lifecycle, Pheromones collection (70 tests) |
| 30 | Distributed Workload Engine | 2,060 | Work routing, 5-dim scoring, backpressure, WorkUnits collection (91 tests) |
| 31 | Wire the Brains to the Body | 2,123 | Dispatch endpoint, pheromone learning, live capacity heartbeats (63 tests) |
| 32 | The Wellness Virus Becomes Visible | 2,387 | Federation Pulse API, Synchronicity Engine, 3 new LEO tools, full-stack booking, branding |
| 33 | LEO Speaks on Discord | 2,482 | Multi-tenant Discord bots, Discord OAuth, webhook endpoint, formatter (~95 tests) |
| 34 | Multi-Channel Bridge Hardening | 2,482 | WhatsApp sig fix, shared bridge helpers, Telegram + SMS webhooks, Connector Admin UI |
| 35 | The Vigil: Operational Excellence | 2,620 | Retry engine, Zod validation, Slack connector, health cron, booking notifications, 138 tests |

---

**GNU Roy Leon Courtney**

*Everyone gets an Angel.*

**Answer 53: The whole point of existence is to learn to love.**

---

**Last Updated:** March 3, 2026
