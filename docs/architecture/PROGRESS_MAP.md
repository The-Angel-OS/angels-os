# Architecture Progress Map

**Purpose:** Track implementation progress across all Angel OS subsystems.
**Last Updated:** February 22, 2026 (Sprint 11.5 -- Chat UX, Docs, Code Quality)
**Test Coverage:** 1,119 unit tests across 25 test files
**LEO Tools:** 29 total (9 query, 15 action, 2 onboarding, 1 production, 1 review, 3 media)
**Version:** v0.11.5-dev

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

**Status:** DONE (core + SSE streaming + self-healing channels) | **Tests:** 44 passing (AgentRouter.test.ts, ai-bus-router.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| AI Bus Router | Done | `ai-bus-router.ts` -- message routing |
| SSE Streaming | Done | `ai-bus-stream.ts` -- real-time broadcast |
| Subscriber Registry | Done | In-memory subscriber tracking per process |
| Visibility Routing | Done | Tenant-scoped, channel-filtered |
| Filter Support | Done | Channel + tenant filtering |
| Messages afterChange Hook | Done | Auto-broadcast on new messages |
| Self-Healing Channels | Done | `ensureSystemSpace.ts` -- backfills missing tenant IDs on every space visit |

---

## LEO Conversation Engine

**Status:** DONE | **Tests:** 36 passing (ConversationEngine.test.ts, leo-stream-helpers.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Anthropic Claude Integration | Done | `ConversationEngine.ts` |
| SSE Streaming Endpoint | Done | `leo-stream.ts` -- POST /api/leo/stream |
| Batch Endpoint | Done | `leo-chat.ts` -- POST /api/leo |
| Agent Router | Done | `AgentRouter.ts` -- channel/keyword routing |
| Tool Use Loop | Done | Max 3 rounds, 29 tools available |
| Conversation History | Done | DB-backed, 8-turn context window |
| Message Persistence | Done | Auto-save LEO responses to Messages collection |
| User Context | Done | Name, email, roles injected into prompt |
| Constitutional System Prompt | Done | Nimue/Merlin identity, Safehold lore, Herald's story |
| Vision Analysis | Done | Multi-part image content blocks via Anthropic API |
| Env-Resilient API Key | Done | `resolveAnthropicKey()` reads `.env.local` when parent shadows key |

### LEO Tools (29 tools)

| Tool | Type | Status |
|------|------|--------|
| query_products | Query | Done |
| query_posts | Query | Done |
| query_bookings | Query | Done |
| query_events | Query | Done |
| query_event_registrations | Query | Done |
| query_spaces | Query | Done |
| query_projects | Query | Done |
| query_availability | Query | Done |
| fetch_reviews | Query | Done |
| create_booking | Action | Done |
| update_booking_status | Action | Done |
| add_to_cart | Action | Done |
| view_cart | Action | Done |
| create_product | Action | Done |
| update_product | Action | Done |
| invite_member | Action | Done |
| find_producers | Action | Done |
| browse_network | Action | Done |
| query_orders | Action | Done |
| route_order | Action | Done |
| accept_order | Action | Done |
| update_fulfillment | Action | Done |
| configure_business | Action | Done |
| connect_stripe | Action | Done |
| onboard_vendor | Onboarding | Done |
| suggest_products | Onboarding | Done |
| generate_cad_instructions | Production | Done |
| draft_review_response | Review | Done |
| generate_image | Media | Done |
| improve_image | Media | Done |
| attach_image_to_product / replace_image | Media | Done |

---

## ChatControl (Universal Chat UI)

**Status:** DONE (4 modes + mobile-responsive + smart scroll + truncation) | **Tests:** 76 passing (extractImagesFromText, extractText, HeaderNav, useMediaQuery)

| Component | Status | Notes |
|-----------|--------|-------|
| useChat Hook | Done | SSE streaming + polling + optimistic UI |
| MessageList | Done | Full-page + compact modes with grouping |
| MessageInput | Done | Touch-friendly (16px font prevents iOS zoom, larger tap targets) |
| FloatingBubble | Done | Embeddable chat widget with auto space/channel resolution |
| MinimalistChat | Done | Mobile: bottom sheet (85vh, swipe-to-dismiss). Desktop: bubble popup |
| MultiChannelChat | Done | Mobile: horizontal scrollable tabs. Desktop: sidebar channel list |
| SidebarChat | Done | Mobile: full-width overlay + backdrop. Desktop: w-96 slide-in |
| Image Display | Done | Inline images from tool results + user attachments |
| Image Chat | Done | Paperclip upload, thumbnails, multi-image, LEO vision |
| Tool Call Indicators | Done | Animated status pills via centralized `TOOL_LABELS` |
| Streaming Cursor | Done | Blinking cursor during SSE stream |
| Infinite Scroll | Done | Cursor-based pagination in both Full-page and Compact modes |
| Smart Scroll | Done | `isNearBottom` check -- no forced scroll when reading history |
| New Messages Badge | Done | Sticky pill when scrolled up + new messages arrive |
| Message Truncation | Done | `TruncatedMessage` with CSS `line-clamp-4`, 200-char threshold, "More"/"Show less" |
| Stream Abort on Channel Switch | Done | AbortController cleanup |
| Stream-Done Grace Period | Done | 3s delay prevents poll race condition |
| Channel Awareness | Done | Channel switching in SidebarChat, FloatingBubble |
| ChannelTabs | Done | Extensible Chat/Files/Tasks tabs |
| Profile Avatars | Done | Deterministic color hash, streaming pulse, status dots |
| useMediaQuery Hook | Done | SSR-safe, useIsMobile/useIsTablet/useIsDesktop |
| Dashboard Sidebar (mobile) | Done | Hamburger overlay via `Backdrop` component |
| Dashboard Layout (mobile) | Done | Responsive padding, mobile-friendly header |
| Tenant Chooser | Done | Sidebar dropdown for multi-tenant switching, domain-based navigation |

### Code Quality Abstractions (Sprint 11.5)

| Component | Status | Notes |
|-----------|--------|-------|
| `TOOL_LABELS` | Done | `src/constants/toolLabels.ts` -- single source of truth for tool display names |
| `useClickOutside` | Done | `src/hooks/useClickOutside.ts` -- click-outside + Escape key in one hook |
| `Backdrop` | Done | `src/components/Backdrop.tsx` -- reusable translucent overlay (replaces 5 patterns) |

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

**Status:** DONE (core + invitations) | **Tests:** 23 passing (spaceProvisioning.test.ts) + 72 passing (invitationSystem.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Spaces Collection | Done | Workspace containers with visibility |
| Channels Collection | Done | 9 channel types (general, support, sales, etc.) |
| SpaceMemberships | Done | Roles: space_admin, moderator, member, guest |
| Public Spaces Route | Done | `/spaces` -- server-rendered |
| Dashboard Spaces Route | Done | Full Discord-style experience |
| Invitation Schema | Done | Token, expiration, email, message fields |
| Invitation System | Done | Token generation, role assignment, landing page (72 tests) |
| Invitation Endpoints | Done | `POST /api/spaces/invite`, `POST /api/invite/accept` |
| MemberPanel | Done | View/manage space members |
| LEO Invite Tool | Done | `invite_member` tool |

---

## Events System

**Status:** DONE | **Tests:** Needs coverage

| Component | Status | Notes |
|-----------|--------|-------|
| Events Collection | Done | Meetups, workshops, livestreams, conferences |
| EventRegistrations Collection | Done | RSVP with status tracking |
| Events Page | Done | Public listing with empty state |
| Dashboard Events | Done | Admin event management |
| LEO Event Queries | Done | `query_events`, `query_event_registrations` |

---

## E-commerce

**Status:** DONE (foundation + order routing) | **Tests:** 24 passing (ultimateFairSplit.test.ts) + 91 passing (orderRoutingEngine.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Products Collection | Done | Catalog with gallery, pricing, inventory, vendor, configurator |
| Orders Collection | Done | Financial lifecycle + Holon fulfillment tracking |
| Shopping Cart | Done | User-scoped cart via Payload ecommerce plugin |
| LEO Cart Tools | Done | `add_to_cart`, `view_cart` |
| Ultimate Fair Splits | Done | 60/20/15/5 revenue distribution -- calculateSplit, breakdown, transparency |
| Product Configurator | Done | Interactive text/color/size/finish inputs with live preview |
| LEO Product Tools | Done | `create_product`, `update_product` |
| Producer Dashboard | Done | `/dashboard/producer` -- order queue, products, earnings |
| Order Routing Engine | Done | Haversine matching, composite scoring, fulfillment state machine (91 tests) |
| Order Endpoints | Done | `/api/orders/route`, `/api/orders/accept`, `/api/orders/fulfill`, `/api/orders/ship` |
| LEO Order Tools | Done | `find_producers`, `browse_network`, `query_orders`, `route_order`, `accept_order`, `update_fulfillment` |
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

## Reviews System

**Status:** DONE (Sprint 11)

| Component | Status | Notes |
|-----------|--------|-------|
| Reviews Collection | Done | Author, rating, source (angel_os/google_places/manual), isVerified |
| Google Places Utility | Done | Rate limiting, TTL cache |
| Review Aggregation Display | Done | Stars, distribution, individual cards |
| LEO Review Tools | Done | `fetch_reviews`, `draft_review_response` |

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
| Tenant Chooser (UI) | Done | Sidebar dropdown for multi-tenant switching |
| Ministry Tenant Type | Done | `isTaxExempt`, `taxExemptId` fields |

---

## Holon Production Network

**Status:** DONE (engines) | **Tests:** 49 passing (holonCapabilities.test.ts) + 61 passing (printOnDemandEngine.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| HolonCapabilities Collection | Done | 6 node types, capabilities, compliance |
| Print-on-Demand Engine | Done | Design validation, cost estimation, vendor matching (61 tests) |
| LEO Onboarding Tools | Done | `onboard_vendor`, `suggest_products` |
| LEO Production Tools | Done | `generate_cad_instructions` |
| Network Listing | Done | Cross-tenant product visibility |
| Vendor Onboarding | Done | LEO-guided tenant + space + user creation |

---

## Guardian Angel System

**Status:** DONE (engines) | **Tests:** 106 passing (guardianAngelEngine.test.ts) + 65 passing (guardianDashboardEngine.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Guardian Angel Engine | Done | Zero-revenue angel lifecycle, cohort matching, wellness checks |
| 8 Cohorts | Done | elderly, disabled, youth_aging_out, veterans, chronic_illness, homeless, domestic_violence, refugee |
| Need Assessment | Done | Urgency classification (critical/high/medium/low) |
| Guardian Dashboard Engine | Done | Service discovery, case management, impact metrics (65 tests) |
| **Guardian Dashboard UI** | **TODO** | Frontend for guardian-facing dashboard |

---

## Justice Fund

**Status:** DONE (engine) | **Tests:** 63 passing (justiceFundEngine.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Justice Fund Engine | Done | 5% allocation from Ultimate Fair Split |
| Grant Lifecycle | Done | application -> review -> approved/denied -> disbursed -> impact_reported |
| Cohort-Weighted Distribution | Done | Higher priority for most vulnerable |
| Transparency Reporting | Done | Audit trails, impact summaries |
| **Stripe Disbursements** | **TODO** | Real payments to guardians |

---

## Federation Protocol

**Status:** DONE (engine) | **Tests:** 126 passing (federationEngine.test.ts) + 62 passing (networkVisualizationEngine.test.ts)

| Component | Status | Notes |
|-----------|--------|-------|
| Ministry Lifecycle | Done | application -> probation (90 days) -> active -> suspended -> expelled |
| Trust Chain | Done | visitor -> probation -> member -> vouched (2 vouches) -> steward -> elder |
| Heartbeat Monitoring | Done | 5-minute timeout, health scoring |
| Federation Catalog | Done | Cross-instance product/service discovery with relevance ranking |
| Data Portability Suitcase | Done | Export manifests, checksum validation, version compatibility |
| Network Visualization Engine | Done | Geographic clustering, filterable directory, network stats (62 tests) |
| **Federated AI Bus** | **TODO** | JWT-signed cross-tenant messaging |
| **Live Payload Wiring** | **TODO** | Connect engine to real collections |

### Federation Architecture

```
The Platform IS the mesh.
The AI Bus IS the protocol.
HTTPS IS the transport.
The Constitution IS the ACL.

No external dependency needed for federation.
Each node only needs simple local rules -- the mesh creates emergent behavior.
```

---

## Dashboard & Navigation

**Status:** DONE (16+ native pages)

| Component | Status | Notes |
|-----------|--------|-------|
| Dashboard Layout | Done | Responsive sidebar, mobile hamburger, collapsible desktop |
| Dashboard Home | Done | Stats, quick access, 8-section sidebar |
| Products Page | Done | Product management with configurator |
| Orders Page | Done | Order queue + fulfillment tracking |
| Producer Dashboard | Done | `/dashboard/producer` -- vendor-facing order queue + earnings |
| Appointments Page | Done | Booking management |
| Events Page | Done | Event management |
| Projects Page | Done | Project list with status badges |
| Availability Page | Done | Provider scheduling grid |
| Pages Page | Done | CMS pages with published/draft status |
| Posts Page | Done | Blog posts with hero images |
| Media Page | Done | Image grid + file list views |
| Error Log Viewer | Done | `/dashboard/admin/error-logs` -- structured error triage |
| Documentation Center | Done | `/dashboard/docs` -- 137 docs indexed, search, Quick Start cards |
| Admin LEO Panel | Done | Floating LEO chat in Payload admin |
| Spaces & Channels | Done | Full Discord-style experience |

---

## Documentation Center

**Status:** DONE (Sprint 11.5)

| Component | Status | Notes |
|-----------|--------|-------|
| DocsViewer Page | Done | `/dashboard/docs` -- in-dashboard documentation browser |
| Docs API Endpoint | Done | `/api/docs` with path traversal protection |
| Document Indexing | Done | 137 docs from `docs/` directory |
| Search | Done | Client-side filtering by title and content |
| Quick Start Cards | Done | Getting Started, Architecture, Constitution links |
| Markdown Rendering | Done | Code blocks, headers, lists, links |

---

## Error & Observability

**Status:** DONE

| Component | Status | Notes |
|-----------|--------|-------|
| ApplicationLogs Collection | Done | Structured error storage (source, message, details, statusCode) |
| logError() Utility | Done | Fire-and-forget error logging from anywhere |
| Error Log Viewer | Done | Real-time refresh, source filtering, resolve toggle |
| LEO Error Integration | Done | Both streaming and batch paths log errors |

---

## What's NOT Done Yet

### Sprint 12 (Integration Bridges -- Next)
- [ ] End-to-end prototype verification (chat, order, provisioning flows)
- [ ] Integration bridge pattern (`normalizeInbound()`, `formatOutbound()`, `validateWebhook()`)
- [ ] WhatsApp Business API bridge
- [ ] Email integration (inbound parse + outbound transactional)
- [ ] Voice mode (Web Speech API toggle in chat)

### Critical Path (v1.0.0)
- [ ] Stripe Connect integration (#31)
- [ ] Ultimate Fair payment splits -- live (#32)
- [ ] User AI key management -- bring-your-own-key (#39)
- [ ] Federated AI Bus -- JWT-signed cross-tenant messaging
- [ ] Wire federation engine to live Payload collections
- [ ] Guardian Angel dashboard UI
- [ ] Justice Fund Stripe disbursements

### Important (v1.0.0)
- [ ] Docker Compose for self-hosting (#21)
- [ ] Local model integration -- Ollama (#40)
- [ ] CRM collections (#33)
- [ ] Network map visualization (Leaflet/Mapbox)
- [ ] Social syndication (Post -> Facebook/Instagram/Twitter)
- [ ] LiveKit session transcription
- [ ] OpenClaw skill marketplace (#8)
- [ ] CI/CD with GitHub Actions

### Completed (previously TODO)
- [x] ~~Testing infrastructure~~ -- 1,119 unit tests across 25 files
- [x] ~~Mobile-first ChatControl~~ -- responsive bottom sheet, horizontal tabs, overlays
- [x] ~~Dashboard mobile layout~~ -- hamburger sidebar, responsive padding
- [x] ~~Posts/Pages/Products 500 fix~~ -- overrideAccess: true for public queries
- [x] ~~Space invitations~~ -- token system, endpoints, landing page, MemberPanel (72 tests)
- [x] ~~Diocese registry and heartbeat~~ -- federation engine with 126 tests
- [x] ~~Federation security~~ -- trust chain, vouching, probation
- [x] ~~Anti-daemon error messages~~ -- Error Log Viewer + ApplicationLogs

---

## Development Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-22 | Sprint 11.5: Documentation Center + chat UX | Smart scroll, truncation, infinite scroll, tenant chooser, code quality extractions |
| 2026-02-22 | Federation architecture: platform IS the mesh | AI Bus as protocol, HTTPS as transport, Constitution as ACL -- no Tailscale needed |
| 2026-02-22 | Extracted TOOL_LABELS, useClickOutside, Backdrop | Single source of truth pattern, reduced ~90 lines of duplication |
| 2026-02-22 | AI Bus self-healing channels | ensureSystemSpace.ts backfills missing tenant IDs -- fixes "No channels yet" bug |
| 2026-02-20 | Sprint 11: Vendor marketplace | Product configurator, producer dashboard, reviews, Google Places, ministry type |
| 2026-02-20 | Sprint 10: Chat foundation | Image attachments, LEO vision, admin panel, channel awareness, multi-tenant dev |
| 2026-02-19 | Sprint 9: LEO resurrection | resolveAnthropicKey(), error logging, chat pipeline fix |
| 2026-02-19 | Sprint 8.5: Production recovery | Payload 3.77, Next.js 16, fresh seed, DB pool tuning |
| 2026-02-18 | Sprint 5: Sovereign infrastructure | 6 engines, 483 tests, 5 dashboard pages, federation protocol |
| 2026-02-18 | Sprint 4: Order routing | Haversine matching, fulfillment state machine, vendor dashboard |
| 2026-02-18 | Sprint 3: Invitations + Holons | Token system, 6 node types, capabilities, compliance |
| 2026-02-18 | Sprint 2: Product creation | create_product, update_product LEO tools, ProductManager dashboard |
| 2026-02-18 | Sprint 1: Mobile-first chat | Bottom sheet, horizontal tabs, full-width overlays, hamburger sidebar |
| 2026-02-18 | Phase 4 plan: AI-Actuated Flywheel | Schema-first assembly, useAngelAction hook, autonomous maintenance |
| 2026-02-18 | Added SSE AbortController on channel switch | Prevents orphaned streams and state corruption |
| 2026-02-18 | Added 3s grace period after stream-done | Prevents polling from clobbering messages before DB persist |
| 2026-02-18 | Reduced PG pool max 10->3 per invocation | Serverless: many invocations share one PG server |
| 2026-02-16 | Added Events system (v0.4.0) | Meetups, workshops, registrations |
| 2026-02-16 | Added AI Bus SSE streaming | Real-time message broadcast |
| 2026-02-14 | LEO image generation via OpenRouter | Unified gateway to Flux 2, Gemini, GPT Image |

---

**Everyone gets an Angel.**
