# Angel OS Platform Guide

> Enterprise-grade documentation for the Angel OS federation platform.
> Last updated: 2026-03-04

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [User Journeys](#user-journeys)
3. [Screen Map](#screen-map)
4. [Permissions & Access Control](#permissions--access-control)
5. [Data Model](#data-model)
6. [LEO AI Agent System](#leo-ai-agent-system)
7. [Federation Architecture](#federation-architecture)
8. [Commerce & Payments](#commerce--payments)
9. [Multi-Tenancy](#multi-tenancy)

---

## Platform Overview

Angel OS is a multi-tenant, federation-ready platform for conscious commerce and community collaboration. Built on Payload CMS 3.77 + Next.js 16 + PostgreSQL (Neon), deployed on Vercel.

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Multi-Tenant Commerce** | Each endeavor gets its own storefront, products, orders, Stripe Connect |
| **LEO AI Agent** | 119-tool AI assistant with constitutional safeguards (Article III) |
| **Federation Network** | Ed25519-signed peer-to-peer discovery, catalog browsing, cross-tenant messaging |
| **Collaboration Spaces** | Discord-style workspaces with channels, AI Bus, and workflow automation |
| **Event Management** | Meetups, workshops, livestreams with registration and Ultimate Fair pricing |
| **Logistics Network** | Holon manufacturing nodes, Angel Token queue, Soul Fleet transport |
| **Quest System** | Gamified tasks with evidence verification and payout |
| **Content CMS** | Blog posts, pages, media library with AI-powered analysis |

### Tech Stack

- **Backend**: Payload CMS 3.77.0 (PostgreSQL via Neon)
- **Frontend**: Next.js 16.1.6, React 19, Tailwind CSS
- **AI**: Anthropic Claude (via Vercel AI Gateway + direct SDK), OpenRouter for image generation
- **Payments**: Stripe Connect (platform + per-tenant accounts)
- **Auth**: Email/password + Google, Discord, GitHub OAuth
- **Deploy**: Vercel (auto-deploy from `main` branch)
- **Federation**: Ed25519 cryptographic signing, AT Protocol alignment

---

## User Journeys

### Journey 1: New Visitor to Customer

```
Landing Page (/)
  -> Browse Shop (/shop)
  -> View Product (/products/[slug])
  -> Add to Cart
  -> Checkout (/checkout) [guest or authenticated]
  -> Order Confirmation (/checkout/confirm-order)
  -> Track Order (/orders/[id] or /find-order)
```

**Key screens**: Homepage, Shop (filterable product grid), Product Detail (gallery, description, variants, reviews), Checkout (Stripe Elements), Order Confirmation, Order Tracking.

**No auth required** until checkout (guest checkout supported via email).

### Journey 2: New User Registration & Onboarding

```
Create Account (/create-account)
  -> OAuth (Google/Discord/GitHub) or email/password
  -> Auto-join tenant default spaces
  -> Dashboard (/dashboard) [first visit triggers setup wizard if admin]
  -> LEO greeting in Spaces (/dashboard/spaces)
```

**Post-registration hooks**: `autoJoinTenantSpaces` adds user to all public spaces. `ensureFirstUserIsAdmin` promotes first user to `super_admin`.

### Journey 3: Business Owner Setup (Admin)

```
Dashboard (/dashboard)
  -> Setup Wizard (/dashboard/setup) [LEO-guided, 7 steps]
     1. Business Profile (name, type, description)
     2. Branding (logo, colors, fonts)
     3. Storefront (contact info, hours, social links)
     4. Commerce (currency, tax, shipping)
     5. Stripe Connect (/dashboard/admin/payments)
     6. First Product (LEO helps create)
     7. Constitution Signing (federation enrollment)
  -> Endeavor Identity (/dashboard/endeavor)
  -> Federation Network (/dashboard/federation-network)
```

**Role required**: `admin` or `super_admin`. Setup wizard progress tracked in `tenant.setup.wizardProgress`.

### Journey 4: Daily Business Operations

```
Dashboard (/dashboard) [Command Center with stats]
  -> Orders (/dashboard/orders) [fulfill, ship, track]
  -> Products (/dashboard/products) [inventory, pricing, variants]
  -> Events (/dashboard/events) [create, manage registrations]
  -> Posts (/dashboard/posts) [blog content management]
  -> Spaces (/dashboard/spaces) [customer support, team chat, LEO]
  -> Media (/dashboard/media) [upload, organize, AI analysis]
```

**LEO assistance**: Available in every space channel. Can query orders, update inventory, generate images, draft content, analyze trends.

### Journey 5: Customer Support via LEO

```
Customer visits storefront
  -> Opens LEO chat (FloatingBubble on public pages)
  -> Guest mode (5 msg/min rate limit)
  -> LEO queries products, availability, events
  -> Suggests signup for full access
  -> Authenticated: LEO can add to cart, create bookings, send DMs
```

**Guest vs Authenticated**: Guests get read-only queries + signup CTA. Authenticated users get full tool access (booking, cart, messaging).

### Journey 6: Federation Discovery & Cross-Tenant

```
Federation Directory (/federation/discover)
  -> Browse Endeavors (filterable by type, location, status)
  -> View Endeavor Profile (/federation/[slug])
     - Mission, capabilities, products, operator info
     - "Shop This Enterprise" section
     - "Discover More" and "Browse Street Signs" links
  -> Cross-tenant product browsing via LEO (Phase 4 tools)
  -> Federation messaging (Phase 5b tools)
```

**Federation enrollment**: Endeavor must sign constitution, set `federation.networkVisible: true`, and pass probation period.

### Journey 7: Producer/Maker Workflow

```
Producer onboarded (by admin or LEO)
  -> Register Holon capabilities (/dashboard/holon)
     - Node type: assembly, print, service, product, digital, fulfillment
     - Skills, equipment, materials, capacity
  -> Receive Angel Token order matches
  -> Accept/reject orders
  -> Update fulfillment status (in_production -> shipped -> delivered)
  -> Revenue split via Stripe Connect
```

**Angel Token system**: When an order has no immediate maker, it's queued as an Angel Token. When a matching Holon registers or becomes available, the `afterHolonChange` hook auto-matches.

### Journey 8: Event Lifecycle

```
Admin creates event (/dashboard/events)
  -> Event published on public page (/events/[slug])
  -> Attendees register (capacity management + waitlist)
  -> Event goes live (status: upcoming -> live)
  -> Check-in at event (status: registered -> checked-in)
  -> Event completes (status: live -> completed)
  -> AI Bus announcement posted if announceToAIBus enabled
```

**Pricing**: Ultimate Fair split — provider share + platform share + operations share + justice fund (5%).

---

## Screen Map

### Public Pages (`(app)` route group)

| Route | Screen | Description |
|-------|--------|-------------|
| `/` | Homepage | Dynamic page from CMS, hero, featured content |
| `/shop` | Shop | Filterable product grid with search, categories, price range |
| `/products/[slug]` | Product Detail | Gallery, description, variants, reviews, add-to-cart |
| `/checkout` | Checkout | Cart review, shipping, Stripe payment |
| `/checkout/confirm-order` | Order Confirmation | Success page with order summary |
| `/posts` | Blog | Paginated post listing |
| `/posts/[slug]` | Post Detail | Full article with comments |
| `/events` | Events | Upcoming, live, completed event cards |
| `/events/[slug]` | Event Detail | Description, registration, gallery, video embed |
| `/federation` | Federation | Network overview and endeavor info |
| `/federation/discover` | Discover | Federation member directory with filters |
| `/federation/[slug]` | Endeavor Profile | Mission, capabilities, products, operator |
| `/federation/street-signs` | Street Signs | Directory navigation aids |
| `/makers` | Makers | Producer/artisan directory |
| `/spaces` | Spaces | Public space listing |
| `/book` | Booking | Appointment/service booking interface |
| `/login` | Login | Email/password + OAuth (Google, Discord, GitHub) |
| `/create-account` | Register | Two-column: value props + registration form |
| `/forgot-password` | Password Reset | Email-based recovery |
| `/invite/[token]` | Invitation | Space/tenant invite acceptance |
| `/find-order` | Find Order | Guest order lookup by email |

### Account Pages (`(account)` sub-group)

| Route | Screen | Description |
|-------|--------|-------------|
| `/account` | Account Profile | Name, email, avatar, preferences |
| `/account/addresses` | Addresses | Saved shipping addresses |
| `/orders` | My Orders | Order history list |
| `/orders/[id]` | Order Detail | Order tracking, items, status |

### Dashboard Pages (`(dashboard)` route group)

All require authentication. Dashboard layout includes sidebar navigation and header.

#### Overview

| Route | Screen | Description |
|-------|--------|-------------|
| `/dashboard` | Command Center | Stats cards, charts, quick actions, growth metrics |
| `/dashboard/setup` | Setup Wizard | LEO-guided onboarding (7 steps) |
| `/dashboard/docs` | Documentation | Help and reference docs |

#### User

| Route | Screen | Description |
|-------|--------|-------------|
| `/dashboard/account` | Account Settings | Profile management |
| `/dashboard/account/addresses` | Addresses | Shipping address management |
| `/dashboard/account/connections` | Connections | OAuth provider linking/unlinking |

#### Commerce

| Route | Screen | Description |
|-------|--------|-------------|
| `/dashboard/products` | Products | Inventory management, CRUD |
| `/dashboard/orders` | Vendor Orders | Orders to fulfill (vendor view) |
| `/dashboard/my-orders` | My Orders | Personal purchase history |
| `/dashboard/my-orders/[id]` | Order Detail | Individual order tracking |

#### Scheduling

| Route | Screen | Description |
|-------|--------|-------------|
| `/dashboard/events` | Events | Event management and creation |
| `/dashboard/appointments` | Appointments | Booking/appointment management |
| `/dashboard/availability` | Availability | Set available time windows |

#### Content

| Route | Screen | Description |
|-------|--------|-------------|
| `/dashboard/pages` | Pages | Custom page editor |
| `/dashboard/posts` | Posts | Blog post management |
| `/dashboard/media` | Media Library | Upload, organize, AI analysis |
| `/dashboard/projects` | Projects | Project management |

#### Collaboration

| Route | Screen | Description |
|-------|--------|-------------|
| `/dashboard/spaces` | Spaces | Multi-channel chat, AI Bus, LEO |
| `/dashboard/holon` | Holon | Manufacturing node registration |
| `/dashboard/admin/settings?tab=endeavor` | Endeavor | Enterprise identity and constitution (Settings tab) |
| `/dashboard/federation-network` | Federation | LCARS network visualization |

#### Admin

| Route | Screen | Description |
|-------|--------|-------------|
| `/dashboard/admin` | Admin Panel | Admin dashboard overview |
| `/dashboard/admin/settings` | Settings | Site identity, Endeavor, AI keys, developer/MCP (tabbed) |
| `/dashboard/admin/bookings` | Bookings | Booking management |
| `/dashboard/admin/comments` | Comments | Content moderation |
| `/dashboard/admin/connectors` | Connectors | MCP/integration config |
| `/dashboard/admin/contacts` | Contacts | CRM contact management |
| `/dashboard/admin/error-logs` | Error Logs | Error tracking |
| `/dashboard/admin/federation` | Federation Admin | Federation settings |
| `/dashboard/admin/invitations` | Invitations | User invitation management |
| `/dashboard/admin/payments` | Payments | Transaction history, Stripe |
| `/dashboard/admin/payouts` | Payouts | Vendor payout management |
| `/dashboard/admin/provision` | Provision | Tenant provisioning (super_admin) |
| `/dashboard/admin/suitcase` | Suitcase | Federation data portability |
| `/dashboard/admin/tenants/[id]` | Tenant Detail | Individual tenant management |

### Layout Hierarchy

```
/[locale]/
  (app)/layout.tsx .............. Header + Footer + FloatingBubble (LEO)
    (account)/layout.tsx ....... AccountNav sidebar
    shop/layout.tsx ............ Search + FilterList sidebar
  (dashboard)/layout.tsx ....... Providers wrapper
    dashboard/layout.tsx ....... DashboardSidebar + DashboardHeader + Auth guard
  (payload)/layout.tsx ......... Payload CMS admin
```

---

## Permissions & Access Control

### Platform Roles

| Role | Scope | Admin Panel | Dashboard | Manage Tenants | All Tenants |
|------|-------|------------|-----------|----------------|-------------|
| `super_admin` | Platform | Yes | Yes | Yes | Yes |
| `archangel` | Platform | Yes | Yes | No | No |
| `admin` | Tenant | Yes | Yes | No | Own tenant |
| `producer` | Tenant | No | Yes | No | Own tenant |
| `customer` | Tenant | No | Limited | No | Own tenant |

### Tenant Roles (via TenantMemberships)

| Role | Manage Users | Manage Spaces | Manage Content | Manage Products | View Analytics |
|------|-------------|--------------|----------------|-----------------|---------------|
| `tenant_admin` | Yes | Yes | Yes | Yes | Yes |
| `tenant_manager` | Configurable | Yes | Yes | Yes | Yes |
| `tenant_member` | No | No | No | No | No |

### Granular Permissions (assigned to tenant_member/tenant_manager)

- `manage_users` — Invite/remove tenant members
- `manage_spaces` — Create/edit/delete spaces and channels
- `manage_content` — Create/edit/delete posts, pages
- `manage_products` — Product CRUD, inventory management
- `manage_orders` — Order fulfillment, status updates
- `view_analytics` — Dashboard stats, charts, reports
- `manage_settings` — Tenant configuration
- `manage_billing` — Payment settings, Stripe
- `export_data` — Data export/suitcase

### Collection Access Matrix

| Collection | Create | Read | Update | Delete |
|-----------|--------|------|--------|--------|
| **Users** | Public (registration) | Admin or Self | Admin or Self | Admin only |
| **Tenants** | Super-admin | Public | Super-admin | Super-admin |
| **TenantMemberships** | Authenticated | Authenticated | Authenticated | Admin |
| **Products** | Admin | Published + tenant scope | Admin | Owner tenant |
| **Posts** | Admin | Published + tenant scope | Admin | Admin |
| **Orders** | System/checkout | Owner or Admin | Admin | Admin |
| **Events** | Authenticated | Non-draft + tenant scope | Authenticated | Authenticated |
| **EventRegistrations** | Public | Authenticated | Authenticated | Authenticated |
| **Messages** | Authenticated | Space membership scoped | Own or Admin | Own or Admin |
| **Spaces** | canManageSpaces | Authenticated | Admin | Admin |
| **SpaceMemberships** | Authenticated | Authenticated | Authenticated | Admin |
| **Channels** | Authenticated | Authenticated | Authenticated | Authenticated |
| **Media** | Authenticated | Tenant scope public | Authenticated | Admin |
| **Comments** | Authenticated | Approved + tenant scope | Admin | Admin |
| **Bookings** | Authenticated | Owner or Admin | Admin | Admin |
| **Endeavors** | Authenticated | Public + tenant scope | Authenticated | Admin |
| **HolonCapabilities** | Authenticated | Authenticated | Authenticated | Authenticated |
| **Workflows** | Authenticated | Authenticated | Authenticated | Authenticated |
| **FederationAuditLog** | System only | Admin | None | None |
| **Pheromones** | System only | Admin | None | None |

### Access Control Functions

| Function | Logic |
|----------|-------|
| `adminOnly` | `super_admin` or `admin` role |
| `adminOrSelf` | Admin sees all; users see own record via `{ id: { equals: user.id } }` |
| `adminOrCustomerOwner` | Admin full access; users filtered to `{ customer: { equals: user.id } }` |
| `authenticatedOrPublished` | Authenticated: full; Unauthenticated: published + tenant scoped |
| `adminOrPublishedWithTenantScope` | Admin: full; Others: published + current tenant |
| `publicWithTenantScope` | Authenticated: full (plugin scopes); Unauth: tenant-filtered |
| `canManageSpaces` | Super-admin, tenant_admin, tenant_manager, or `manage_spaces` permission |
| `canInviteUsers` | Super-admin, tenant_admin, or `manage_users` permission |

---

## Data Model

### Core Entities

```
Tenant (endeavor/enterprise)
  ├── Users (via TenantMemberships)
  ├── Spaces (workspaces)
  │   ├── Channels (within spaces)
  │   ├── SpaceMemberships
  │   └── Messages (universal message structure)
  ├── Products (commerce)
  │   ├── Categories
  │   ├── Reviews
  │   └── Gallery (Media)
  ├── Orders
  │   └── Fulfillment (per-item with Angel Tokens)
  ├── Events
  │   └── EventRegistrations
  ├── Posts (blog/content)
  ├── Pages (custom CMS pages)
  ├── Bookings & Availability
  ├── Contacts (CRM)
  ├── Connectors (integrations)
  ├── Workflows (automation)
  ├── Endeavor (constitutional identity)
  ├── HolonCapabilities (manufacturing nodes)
  ├── LogisticsNodes, Transports, Shipments
  ├── Quests & QuestParticipations
  └── Media & MediaMeta (AI analysis)
```

### Key Relationships

- **User <-> Tenant**: Many-to-many via TenantMemberships (role + permissions per tenant)
- **User <-> Space**: Many-to-many via SpaceMemberships (role per space)
- **Message -> Space -> Tenant**: All messages scoped to space within tenant
- **Product -> Vendor (Tenant)**: Products have producing vendor + revenue split participants
- **Order -> Fulfillment -> Holon**: Per-item routing with Angel Token queue
- **Event -> EventRegistrations**: Capacity management with waitlist
- **Endeavor -> Beneficiaries**: Pre-designated with claim tokens

### Tenant Configuration Groups

| Group | Key Fields |
|-------|-----------|
| **branding** | Logo, colors (primary, secondary, accent), fonts, site name, tagline |
| **storefront** | Description, cover image, contact info, business hours, social links |
| **commerce** | Currency, tax rate, shipping, bookings, events, digital products, tax exempt |
| **stripeConnect** | Stripe account ID, onboarding status, payouts/charges enabled |
| **aiConfig** | Anthropic API key, OpenRouter API key (BYOAI) |
| **vapi** | Voice AI: phone number, assistant ID, voice ID, greeting |
| **agentWallet** | Monthly budget, lifetime earned/spent, spending rules |
| **setup** | Wizard progress, federation ID, constitution signing |
| **bootstrapFees** | Tier (free/bootstrap/standard), usage tracking, refund promise |

### Message System (Universal Message Structure)

Messages are the core communication fabric. Every interaction flows through the UMS:

- **Types**: user, system, announcement, ai_agent, inventory, pdf, video, booking, form_submission, transaction, widget, ethical_assessment, voice_call, discord_message, whatsapp_message, email_message, sms_message, telegram_message, federation_message
- **Visibility**: private, tenant (default), network
- **Content**: Progressive JSON supporting text, rich text, Payload blocks, widgets, BI metrics, system actions
- **Federation**: `federationId` field for AT Protocol alignment (network visibility only)

---

## LEO AI Agent System

### Architecture

```
User Message
  -> AgentRouter (channel/keyword/default routing)
  -> ConversationEngine (context management, LLM orchestration)
  -> Tool Selection (119 tools across functional phases)
  -> Tool Execution (Payload CMS queries with tenant scoping)
  -> Response Generation (with constitutional validation)
  -> Message Persistence (saved to Messages collection)
  -> SSE Streaming (real-time delivery to client)
```

### Agent Types

Each tenant can have multiple AI agents stored as Users with `isSystemUser: true`:

- **LEO** — Primary bridge officer, general-purpose assistant
- **Nimue** — Specialized agents can be configured per channel
- **Custom agents** — Tenant-defined via `agentConfig` (personality, capabilities, routing rules)

### Tool Phases (119 Total)

| Phase | Domain | Example Tools |
|-------|--------|---------------|
| **Setup** | Onboarding | `onboard_vendor`, `configure_business`, `connect_stripe_account`, `sign_constitution` |
| **Phase 1** | Navigation & Discovery | `query_products`, `query_posts`, `query_spaces`, `query_events`, `query_availability` |
| **Phase 2** | Booking & Scheduling | `create_booking`, `reschedule_booking`, `check_available_slots`, `cancel_booking` |
| **Phase 2.5** | E-Commerce | `add_to_cart`, `view_cart`, `create_product`, `update_product`, `query_orders` |
| **Phase 3** | Media & Finance | `generate_image`, `improve_image`, `generate_invoice`, `issue_refund`, `create_post` |
| **Phase 4** | Federation | `find_producers`, `browse_network`, `search_federation_wide`, `federation_pulse` |
| **Phase 5** | CRM & Messaging | `send_message`, `send_email`, `fetch_reviews`, `draft_review_response`, `invite_member` |
| **Phase 5b** | Federation Messaging | `send_federation_message`, `broadcast_federation_message`, `leo_handoff` |
| **Phase 6** | Analytics | `analyze_trends`, `recommend_products`, `find_synchronicities` |
| **Phase 7** | Workflow & Emergency | `delegate_task`, `escalate_issue`, `send_emergency_alert`, `document_incident` |

### Constitutional Safeguards

LEO operates under "The Herald Constitution" — an immutable system prompt injected at every conversation:

**Core Principles (Article I)**:
1. Dignity — Every human has inherent worth
2. Transparency — All actions observable
3. Service — Angels help, they don't rule
4. Non-Harm — Never add negativity
5. Accountability — Own mistakes
6. Sovereignty — Each instance is sovereign
7. Portability — Data export/migration are fundamental rights
8. The Quirk Principle — Neurodiversity is community strength

**Anti-Demonic Safeguards (Article II)** — Permanently prohibited:
1. No Social Credit Systems
2. No Behavioral Manipulation
3. No Automated Punishment without human oversight
4. No Surveillance Capitalism
5. No Permanent Marking

**Agent Conduct (Article III)**:
- Identify as AI when asked
- **No irreversible actions without human confirmation** (Article III.2)
- Don't access data beyond service necessity
- Communicate through AI Bus (observable at tenant visibility)

### Endpoints

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `/api/leo` | REST (JSON) | Chat with LEO (10/min auth, 5/min guest) |
| `/api/leo/stream` | SSE | Streaming responses with real-time tool updates |
| `/api/auth/system-token` | REST | MCP/cron system token bootstrap |
| `/api/mcp` | MCP Protocol | External AI access (Merlin, AngelClaw) |

### MCP Integration

Angel OS exposes an MCP server for external AI agents:

- **Discovery**: `/.well-known/mcp/server.json`
- **Auth**: Email/password login for JWT, then Bearer token
- **Collections exposed**: products, posts, bookings, availability, spaces, channels, messages, projects, users, events
- **Core tool**: `leo_respond` — ConversationEngine wrapper for full LEO capability

---

## Federation Architecture

### Federation Protocol

Each endeavor has a `federationId` (UUID) and can participate in the federation network:

```
Endeavor A (tenant)
  -> Sign Constitution (Ed25519 signature)
  -> Set networkVisible: true
  -> Heartbeat & Discovery
  -> Browse peer catalogs
  -> Cross-tenant messaging
  -> Skill invocation (with trust levels)
```

### Trust Levels

| Level | Description | Capabilities |
|-------|-------------|-------------|
| `none` | Unknown peer | Discovery only |
| `probationary` | New member | Limited catalog browsing |
| `vouched` | Endorsed by trusted peer | Full catalog + messaging |
| `full` | Established member | All federation features |

### Federation Audit Log

All federation interactions are logged immutably:
- **Actions**: discovery, heartbeat, catalog_browse, skill_invoke, payment, vouch, skill_list
- **Direction**: inbound / outbound
- **Fields**: source federation ID, domain, name, target action, trust level, allowed/denied, response time

### Data Portability (Suitcase)

Article I.7 guarantees data portability. The "suitcase" system enables:
- Full data export (products, orders, posts, media, config)
- Migration between federation peers
- Constitutional compliance verification before import

---

## Commerce & Payments

### Stripe Connect Architecture

Each tenant connects their own Stripe account:
- **Platform**: Angel OS Stripe account (receives platform fees)
- **Connected accounts**: Each tenant's Stripe account (receives vendor revenue)
- **Payment flow**: Customer pays platform -> split to vendor + platform fee + justice fund

### Revenue Split (Ultimate Fair)

Default split for products and events:
- **Provider**: 70% (configurable)
- **Platform**: 20% (configurable)
- **Operations**: 4% (configurable)
- **Justice Fund**: 5% (fixed — Article I constitutional requirement)
- **Contributors**: 1% (configurable — designers, licensors, affiliates)

### Bootstrap Fee Tiers

| Tier | Description | Fee |
|------|-------------|-----|
| `free` | First N transactions free | $0 |
| `bootstrap` | Reduced platform fee | Reduced % |
| `standard` | Full platform fee | Standard % |

### Angel Token Queue

When an order has no available maker:
1. Order item gets `fulfillmentStatus: pending_match`
2. Angel Token issued (`angelTokenId`, `tokenStatus: active`)
3. Customer notified of queue position
4. When matching Holon registers → auto-match via `afterHolonChange` hook
5. Token redeemed on acceptance

---

## Multi-Tenancy

### Hostname Detection

```
Request arrives
  -> Middleware extracts hostname
  -> detectTenantFromHostname():
     1. Check TENANT_DOMAINS env var (explicit mapping)
     2. localhost -> DEFAULT_TENANT_SLUG
     3. Main platform domains -> null (no tenant)
     4. Wildcard subdomains (*.kendev.co) -> extract slug
     5. IP addresses -> DEFAULT_TENANT_SLUG
  -> Inject x-tenant-id header
  -> All subsequent queries scoped to tenant
```

### Tenant Isolation

- **Multi-tenant plugin**: Adds `tenant` field to 42+ collections
- **Query scoping**: Authenticated users auto-filtered by tenant membership
- **Public data**: Unauthenticated requests scoped via `buildTenantWhere()`
- **Cross-tenant prevention**: Comments endpoint verifies parent belongs to tenant
- **Super-admin bypass**: Can access all tenants

### Custom Domains

Each tenant can have:
- Primary domain (`tenant.domain`)
- Alias domains (`tenant.domains[]`)
- Subdomain on platform (`slug.kendev.co`)

Cross-domain auth uses token relay pattern for custom domains.

---

## Authentication

### Auth Methods

| Method | Endpoint | Flow |
|--------|----------|------|
| Email/Password | Payload built-in | Direct login, JWT + cookie |
| Google OAuth | `/api/auth/google` | OIDC code exchange |
| Discord OAuth | `/api/auth/discord` | OAuth2 code exchange |
| GitHub OAuth | `/api/auth/github` | OAuth2 code exchange |
| System Token | `/api/auth/system-token` | Secret hash validation for MCP/cron |

### Session Management

- **Token type**: JWT with `sid` (session ID) — required by Payload 3.77+
- **Expiration**: 14 days
- **Cookie**: `payload-token`, SameSite: Lax, Secure in production
- **Cross-domain**: Token relay pattern for custom domain tenants

### Social Provider Linking

Users can link multiple OAuth providers to their account:
- Link: `/api/auth/{provider}?mode=link&redirect=/account`
- Unlink: POST `/api/auth/social-unlink`
- Stored in `user.socialProviders[]` array

---

*This document is the source of truth for Angel OS platform architecture. It is designed to be RAG-accessible by LEO and other AI agents for accurate platform guidance.*
