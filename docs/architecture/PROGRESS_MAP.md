# Architecture Progress Map

**Purpose:** Track implementation progress across all Angel OS subsystems.
**Last Updated:** February 18, 2026 (Session 3 — Phase 4 Sprint 1)
**Test Coverage:** 297 unit tests across 15 test files

---

## Constitutional Foundation

**Status:** DONE | **Tests:** 23 passing (constitutional-prompt.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Constitution Loading | Done | `ANGEL-OS-CONSTITUTION.md` |
| Genesis Breath Init | Done | First-message validation |
| Constitutional Prompt | Done | `constitutional-prompt.ts` -- immutable system prompt |
| Poisoned Model Detection | Done | Anti-injection validation |
| Messages Visibility Field | Done | private / tenant / network |

---

## AI Bus Architecture

**Status:** DONE (core + SSE streaming) | **Tests:** 44 passing (AgentRouter.test.ts, ai-bus-router.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| AI Bus Router | Done | `ai-bus-router.ts` -- message routing |
| SSE Streaming | Done | `ai-bus-stream.ts` -- real-time broadcast |
| Subscriber Registry | Done | In-memory subscriber tracking per process |
| Visibility Routing | Done | Tenant-scoped, channel-filtered |
| Filter Support | Done | Channel + tenant filtering |
| Messages afterChange Hook | Done | Auto-broadcast on new messages |

---

## LEO Conversation Engine

**Status:** DONE | **Tests:** 36 passing (ConversationEngine.test.ts, leo-stream-helpers.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Anthropic Claude Integration | Done | `ConversationEngine.ts` |
| SSE Streaming Endpoint | Done | `leo-stream.ts` -- POST /api/leo/stream |
| Batch Endpoint | Done | `leo-chat.ts` -- POST /api/leo |
| Agent Router | Done | `AgentRouter.ts` -- channel/keyword routing |
| Tool Use Loop | Done | Max 3 rounds, 15+ tools available |
| Conversation History | Done | DB-backed, 8-turn context window |
| Message Persistence | Done | Auto-save LEO responses to Messages collection |
| User Context | Done | Name, email, roles injected into prompt |
| Constitutional System Prompt | Done | Nimue/Merlin identity, Safehold lore, Herald's story |

### LEO Tools (15 tools)

| Tool | Type | Status |
|------|------|--------|
| query_products | Read | Done |
| query_posts | Read | Done |
| query_bookings | Read | Done |
| query_events | Read | Done |
| query_event_registrations | Read | Done |
| query_spaces | Read | Done |
| query_projects | Read | Done |
| query_availability | Read | Done |
| create_booking | Write | Done |
| update_booking_status | Write | Done |
| add_to_cart | Write | Done |
| view_cart | Read | Done |
| generate_image | Write | Done |
| improve_image | Write | Done |
| attach_image_to_product | Write | Done |
| replace_image | Write | Done |

---

## ChatControl (Universal Chat UI)

**Status:** DONE (4 modes + mobile-responsive) | **Tests:** 76 passing (extractImagesFromText, extractText, HeaderNav, useMediaQuery)

| Component | Status | Notes |
|-----------|--------|-------|
| useChat Hook | Done | SSE streaming + polling + optimistic UI |
| MessageList | Done | Full-page + compact modes with grouping |
| MessageInput | Done | Touch-friendly (16px font prevents iOS zoom, larger tap targets) |
| FloatingBubble | Done | Embeddable chat widget |
| MinimalistChat | Done | Mobile: bottom sheet (85vh, swipe-to-dismiss). Desktop: bubble popup |
| MultiChannelChat | Done | Mobile: horizontal scrollable tabs. Desktop: sidebar channel list |
| SidebarChat | Done | Mobile: full-width overlay + backdrop. Desktop: w-96 slide-in |
| Image Display | Done | Inline images from tool results |
| Tool Call Indicators | Done | Animated status pills during tool execution |
| Streaming Cursor | Done | Blinking cursor during SSE stream |
| Infinite Scroll | Done | Cursor-based pagination |
| Stream Abort on Channel Switch | Done | AbortController cleanup |
| Stream-Done Grace Period | Done | Prevents poll race condition |
| useMediaQuery Hook | Done | SSR-safe, useIsMobile/useIsTablet/useIsDesktop |
| Dashboard Sidebar (mobile) | Done | Hamburger overlay on mobile, collapsible on desktop |
| Dashboard Layout (mobile) | Done | Responsive padding, mobile-friendly header |

---

## Image Generation & Media

**Status:** DONE | **Tests:** 26 passing (imageGeneration.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| OpenRouter Integration | Done | Flux 2 Pro, Gemini Image, GPT Image |
| Prompt Enhancement | Done | Category-specific photography styles |
| Auto-upload to Payload Media | Done | Vercel Blob in production |
| Vision Feedback (Anthropic) | Done | Analyze + improve existing images |
| Attach to Product Gallery | Done | Add/replace gallery images |
| Global Image Replacement | Done | Deep replace across products/posts |
| Image URL Extraction | Done | Blob URLs, markdown, media patterns |

---

## Spaces & Channels

**Status:** DONE (core) / IN PROGRESS (invitations) | **Tests:** 23 passing (spaceProvisioning.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Spaces Collection | Done | Workspace containers with visibility |
| Channels Collection | Done | 9 channel types (general, support, sales, etc.) |
| SpaceMemberships | Done | Roles: space_admin, moderator, member, guest |
| Public Spaces Route | Done | `/spaces` -- server-rendered |
| Dashboard Spaces Route | Done | Full Discord-style experience |
| Invitation Schema | Done | Token, expiration, email, message fields |
| **Invitation Workflow** | **TODO** | Send/accept/decline endpoints + UI |
| **Invitation Email Delivery** | **TODO** | Email integration |

---

## Events System

**Status:** DONE (v0.4.0) | **Tests:** Needs coverage

| Component | Status | Notes |
|-----------|--------|-------|
| Events Collection | Done | Meetups, workshops, livestreams, conferences |
| EventRegistrations Collection | Done | RSVP with status tracking |
| Events Page | Done | Public listing with empty state |
| Dashboard Events | Done | Admin event management |
| LEO Event Queries | Done | `query_events`, `query_event_registrations` |

---

## E-commerce

**Status:** DONE (foundation) | **Tests:** 24 passing (ultimateFairSplit.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Products Collection | Done | Catalog with gallery, pricing, inventory |
| Orders Collection | Done | Financial lifecycle tracking |
| Shopping Cart | Done | User-scoped cart via Payload ecommerce plugin |
| LEO Cart Tools | Done | `add_to_cart`, `view_cart` |
| Ultimate Fair Splits | Done | 60/20/15/5 revenue distribution -- calculateSplit, breakdown, transparency |
| **Stripe Connect** | **TODO** | Payment processing (#31) |

---

## Booking System

**Status:** DONE | **Tests:** 22 passing (bookingEngine.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Bookings Collection | Done | Service, consultation, rental, class, event, custom |
| Availability Collection | Done | Provider scheduling windows |
| Booking Engine | Done | Slot generation, conflict detection, harmonic scoring |
| LEO Booking Tools | Done | `create_booking`, `update_booking_status`, `query_availability` |
| Dashboard Appointments | Done | Admin booking management |

---

## Multi-Tenant Infrastructure

**Status:** DONE | **Tests:** 23 passing (tenantPackageValidation.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Tenant Resolution | Done | By domain + by slug with fallback |
| Tenant Branding | Done | Logo, colors, fonts, site name |
| Per-Tenant Data Isolation | Done | All collections tenant-scoped |
| TenantMemberships | Done | Roles + invitation structure |
| Provision Wizard | Done | Multi-step tenant creation (#10) |
| Suitcase Manager | Done | Import/export with constitutional validation (#12) |
| Package Validation | Done | Structure, slug, and ISO date validation |

---

## What's NOT Done Yet

### Critical Path (v0.5.0)
- [ ] Space invitation workflow (send/accept/decline UI + endpoints)
- [ ] Stripe Connect integration (#31)
- [ ] Ultimate Fair payment splits (#32)
- [ ] User AI key management -- bring-your-own-key (#39)
- [x] ~~Testing infrastructure~~ — 297 unit tests across 15 files
- [x] ~~Mobile-first ChatControl~~ — responsive bottom sheet, horizontal tabs, overlays
- [x] ~~Dashboard mobile layout~~ — hamburger sidebar, responsive padding
- [x] ~~Posts/Pages/Products 500 fix~~ — overrideAccess: true for public queries

### Important (v0.5.0 - v1.0.0)
- [ ] Docker Compose for self-hosting (#21)
- [ ] Local model integration -- Ollama (#40)
- [ ] Justice Fund AI provisioning (#41)
- [ ] CRM collections (#33)
- [ ] Channel widgets system (#4, #5, #6)
- [ ] Anti-daemon error messages (#19)
- [ ] Warm empty states (#20)

### Federation (v1.0.0)
- [ ] Diocese registry and heartbeat (#15)
- [ ] Federation security (#16)
- [ ] OpenClaw skill marketplace (#8)

---

## Development Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-18 | Phase 4 Sprint 1: mobile-first ChatControl | Bottom sheet, horizontal tabs, full-width overlays, hamburger dashboard sidebar, 297 tests (15 files) |
| 2026-02-18 | Fixed posts/pages/products 500 error | overrideAccess: draft → true for public content queries (multi-tenant access control blocks unauthenticated visitors) |
| 2026-02-18 | Added Phase 4.6 AI-Actuated Flywheel plan | Schema-first assembly, useAngelAction hook, autonomous maintenance via test-gated AI |
| 2026-02-18 | Expanded test suite to 275 tests, 13 files | Full coverage: UltimateFair splits, AI Bus routing, booking engine, image gen, space provisioning, tenant validation, SSE helpers |
| 2026-02-18 | Added unit test suite (102 tests, 6 files) | TDD infrastructure for sprint preservation -- constitutional, routing, image extraction, UMS, nav |
| 2026-02-18 | Added Posts to public nav (always visible) | Posts were only accessible via CMS nav -- inconsistent with Events |
| 2026-02-18 | Fixed generateStaticParams overrideAccess | Build-time has no user context -- multi-tenant access control fails without override |
| 2026-02-18 | Increased MAX_RESPONSE_TOKENS 800->1500 | LEO needs room to respond after tool calls (image gen) |
| 2026-02-18 | Added SSE AbortController on channel switch | Prevents orphaned streams and state corruption |
| 2026-02-18 | Added 3s grace period after stream-done | Prevents polling from clobbering messages before DB persist |
| 2026-02-18 | Broadened image URL regex patterns | Vercel Blob URLs with hyphens/dots were being missed |
| 2026-02-18 | Reduced PG pool max 10->3 per invocation | Serverless: many invocations share one PG server |
| 2026-02-16 | Added Events system (v0.4.0) | Meetups, workshops, registrations |
| 2026-02-16 | Added AI Bus SSE streaming | Real-time message broadcast |
| 2026-02-14 | LEO image generation via OpenRouter | Unified gateway to Flux 2, Gemini, GPT Image |

---

**Everyone gets an Angel.**
