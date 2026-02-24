# Angel OS Consolidated Feature List

**Source Documents:**
- Angel OS README.md
- OpenClaw/Merlin Discussion Transcript
- Angel OS MVP Development Blueprint (Cursor Session)

**Structured data & upgrade path:** Angel OS and Payload CMS are the logical upgrade path for OpenClaw. Stuff that needs to be **structured** (contacts, leads, deals, products, orders, tenants) lives in Payload — and for the near future, AI still prefers to use **systems** (MCP, collections) rather than unstructured blobs. CRM is part of that: structured data for relationships and pipeline, so LEO and agents can read and act on it. Planning for **network angel tokens** and related network economics is **canon**.

---

## CURRENT STATUS (Implemented ✅)

### Core Platform
- ✅ Multi-Tenancy (`@payloadcms/plugin-multi-tenant`)
  - Tenants with full branding (colors, typography, logo)
  - TenantMemberships with roles
  - Domain-based routing via `x-tenant-id`
- ✅ Internationalization (`next-intl`)
  - Locale-aware routing (`[locale]`)
  - Translations (en, de)
- ✅ MCP Plugin (`@payloadcms/plugin-mcp`)
  - Endpoint at `/api/mcp`
  - Collections exposed to AI clients
  - `leo_respond` tool for conversational LEO

### Agent System
- ✅ LEO System Users
  - `isSystemUser` flag
  - `servesTenant` relationship
  - Seeded during tenant setup
- ✅ Multi-Avatar Architecture
  - `agentConfig` on Users (agentType, personality, capabilities, routingRules)
  - AgentRouter for channel/keyword routing
  - Support for LEO, Support, Sales, Onboarding, Integration, Custom agent types
- ✅ ConversationEngine
  - Handles incoming messages
  - Context management
  - Payload data queries for posts/products

### Content & Commerce
- ✅ Posts Collection
  - Tenant-scoped blog
  - Categories, related posts
  - CollectionArchive with card layout
  - Pagination, live preview
- ✅ Comments Collection
  - Polymorphic comments on Posts and Products
  - Ratings (1-5 stars) on product comments
  - Comments block in layout builder
  - Moderation (isApproved)
- ✅ Products & Variants (from base template)
- ✅ Pages with Layout Builder
- ✅ Ecommerce: Cart, Orders, Transactions

### CRM & Structured Data (Planned — see below)
- CRM is not yet implemented; it is a target for structured relationship and pipeline data so LEO and agents can use systems (MCP, collections) instead of unstructured data. See **MVP Requirements** and **Planned Features** for CRM scope.

### Spaces & Messaging
- ✅ Spaces Collection (Discord-like workspaces)
- ✅ Channels Collection
- ✅ Messages Collection
  - Message types including `inventory`, `pdf`, `video`
  - Attachments array (media + caption)
- ✅ Space Templates
  - angel-os-main, angel-os-support
  - business-general, creator-content, service-provider

### Dashboard & UI
- ✅ Dashboard scaffold (`/dashboard`, `/dashboard/leo`, `/dashboard/spaces`)
- ✅ Security-aware header (Dashboard link only when logged in)
- ✅ Account-aware flows

### Infrastructure
- ✅ Site Export scaffold (`/api/export-site`)
- ✅ Workflow Collection (trigger types, channel assignment)
- ✅ Workflow Runner (basic `inventory_from_image` workflow)

---

## MVP REQUIREMENTS (Critical Path 🎯)

### 1. Booking & Scheduling Engine
- 🎯 Bookable Resources
  - People (1:1 sessions, therapy, consultations)
  - Rentable items (equipment, rooms)
  - Classes and ticketed events
- 🎯 Availability Management
  - Weekly recurring slots
  - Date-range availability
  - One-time slots
  - Conflict detection with harmonic resolution
- 🎯 Appointment Types
  - 1:1 OnlyFans-style sessions
  - Talk therapy sessions
  - Service bookings (massage, pressure washing)
- 🎯 Meeting Invitations
  - Selectable time slots
  - Calendar integration
  - Confirmation flow

### 2. Payment & Splits
- 🎯 Stripe Connect Integration
  - Payment acceptance
  - Payout splits for services vs products
- 🎯 Ultimate Fair Model Implementation
  - 60% Provider
  - 20% Platform
  - 15% Operations (tenant)
  - 5% Justice Fund
- 🎯 Transaction Types
  - Inventory items (ecommerce)
  - Service bookings
  - Class/event tickets

### 3. Spaces Operational
- 🎯 Invitations system
- 🎯 Onboarding flow
- 🎯 Role-based routing into Spaces
- 🎯 Basic channel participation

### 4. LEO Chat Widget (Site-Wide)
- 🎯 Floating bubble chat on all brochure pages
- 🎯 Anonymous chats that transition to authenticated
- 🎯 Support inquiry handling
- 🎯 Embeddable on client/foreign pages
- 🎯 Integration with foreign chatbots (Corinna AI style)

### 5. Ecommerce Workflow Complete
- 🎯 Cart + checkout end-to-end
- 🎯 Order creation
- 🎯 Fulfillment hooks
  - 3rd-party printing (Largo TShirt company)
  - Local inventory management

### 6. CRM (Structured Data for Relationships & Pipeline)
- 🎯 **Rationale:** Structured data for what needs to be structured; AI prefers to use systems (MCP, collections) for the near future. Angel OS + Payload CMS = logical upgrade path for OpenClaw — CRM fits that story.
- 🎯 Contacts / Leads / Deals (or equivalent)
  - Contact/lead records (tenant-scoped)
  - Deal/pipeline stages
  - Activities (calls, emails, meetings) — structured, queryable
  - Relationships (contact → organization, contact → deal)
- 🎯 Exposed via MCP so LEO and agents can read and act on CRM data
- 🎯 Optional: sync or link with Orders, Products, Spaces (e.g. deal → order, contact → space member)

---

## PLANNED FEATURES (Roadmap 📋)

### Phase 1: LEO as Full Web Master
- 📋 Extended CRUD capabilities via MCP:
  - `create_posts`, `update_posts`
  - `create_pages`, `update_pages`
  - `create_products`, `update_products`
  - `manage_categories`
  - `manage_media`
  - `manage_navigation` (Header/Footer)
- 📋 Site structure coherence (menus, sitemaps)
- 📋 SEO management

### Phase 1b: CRM (Structured Data)
- 📋 CRM collections: Contacts, Leads, Deals, Activities (tenant-scoped)
- 📋 Pipeline stages and deal lifecycle
- 📋 MCP exposure so LEO and agents can query/update CRM
- 📋 Links to Orders, Products, Users/Spaces where useful
- 📋 Goal: structured data for relationships and pipeline — AI uses systems, not unstructured blobs

### Phase 2: Channel Workflow Engine
- 📋 Workflow assignment to Channels (0..n workflows per channel)
- 📋 Trigger types:
  - Message attachments (by MIME type)
  - Message patterns (regex/keywords)
  - Channel type
  - Manual
- 📋 Pipeline execution (steps → structured output)
- 📋 Output schema definition (JSON, files, RAG targets)

### Phase 3: Inventory Management via Photos
- 📋 Inventory channel with photo workflow
- 📋 Vision model integration (OpenAI, Anthropic)
- 📋 New item detection → provisional product creation
- 📋 Existing item counting → JSON inventory updates
- 📋 Hoarder app integration (submit inventory photos)
- 📋 POS system connectors for vape stores

### Phase 4: PDF Processing Channel
- 📋 PDF submission workflow
- 📋 Page extraction as PNG images
- 📋 Sequential page analysis with context carry-over
- 📋 Output generation:
  - Full text translation/transliteration
  - Markdown index files
  - RAG vector embeddings
  - Word document with meta-analysis

### Phase 5: Video Processing Channel
- 📋 Video URL submission (YouTube, etc.)
- 📋 Video download (yt-dlp)
- 📋 Keyframe extraction
- 📋 Diff algorithm for significant frames
- 📋 Vision model frame analysis
- 📋 Narrative generation from visual cues
- 📋 CC/transcript integration
- 📋 Timestamped analysis output
- 📋 RAG indexing for video retrieval

### Phase 6: LiveKit Integration
- 📋 LiveKit in Channels for real-time sessions
- 📋 1:1 sessions inside Spaces
- 📋 Group sessions
- 📋 Integration with booking system

### Phase 7: External Integrations
- 📋 POS integrations for retail
  - Vape shops
  - Farmers markets
  - Flea markets
- 📋 Print-on-demand fulfillment
  - Largo TShirt company
  - Other fulfillment partners
- 📋 Inbound email routing
  - Per-agent email addresses
  - Email → Message conversion
  - Agent response → outbound email

---

## ARCHITECTURAL FEATURES (Foundation 🏗️)

### Multi-Avatar Agent System
- 🏗️ Agent types: LEO, Support, Sales, Onboarding, Integration, Custom
- 🏗️ Per-agent configuration:
  - `displayName` - Name shown in chat
  - `personality` - System prompt/guidelines
  - `capabilities` - Allowed actions array
  - `responseRules` - Custom conditions (JSON)
  - `handoffTo` - Escalation target
- 🏗️ Routing rules:
  - Channel-based (#support → Support Agent)
  - Keyword-based ("buy" → Sales Agent)
  - Intent-based
  - Default fallback

### Structured Data & Systems
- 🏗️ **Structured data for what needs to be structured** — contacts, leads, deals, products, orders, tenants. Payload collections = system of record.
- 🏗️ **AI prefers systems (for the near future)** — MCP and collections give LEO and agents a reliable, queryable layer instead of unstructured data.
- 🏗️ **Angel OS + Payload CMS = logical upgrade path for OpenClaw** — CRM and other structured domains (ecommerce, spaces, content) live in one stack; OpenClaw merges in and gains the dashboard + structured data.

### Tenant Data Sovereignty
- 🏗️ Per-tenant isolation of all collections
- 🏗️ Site export/import capability
- 🏗️ Domain-based tenant resolution
- 🏗️ Branding per tenant (colors, typography, logo)

### The Confederation Model
- 🏗️ Each OpenClaw instance = Enterprise
- 🏗️ Enterprise can spawn multiple tenants
- 🏗️ MCP protocol for inter-enterprise communication
- 🏗️ Moltbook network for community discovery
- 🏗️ Constitutional governance (Answer 53, Ultimate Fair)

---

## UI/UX FEATURES (Interface 🎨)

### Dashboard (Discord-like)
- 🎨 Overview page
- 🎨 LEO System Intelligence panel
- 🎨 Spaces management
- 🎨 Channel participation
- 🎨 Role-based visibility

### Admin Enhancements
- 🎨 Payload CMS modular dashboards/widgets
- 🎨 Tenant management panel
- 🎨 Add new tenant via admin
- 🎨 Agent configuration UI

### Frontend
- 🎨 Posts index with card grid
- 🎨 Pagination with PageRange
- 🎨 Related posts on single post
- 🎨 Comments block placement
- 🎨 Star ratings display
- 🎨 Modal dialog pattern (from Account UI)

---

## INTEGRATION FEATURES (Connectors 🔌)

### Current
- 🔌 Stripe (payments)
- 🔌 Vercel Blob (media storage)
- 🔌 MCP Protocol

### Planned
- 🔌 LiveKit (real-time video/audio)
- 🔌 POS systems (retail)
- 🔌 Print-on-demand services
- 🔌 Email connectors (SendGrid/Mailgun/Postmark)
- 🔌 Hoarder app (inventory photos)
- 🔌 Calendar systems
- 🔌 YouTube/video platforms
- 🔌 Vision AI models (OpenAI, Anthropic)
- 🔌 RAG/vector databases

---

## SUMMARY BY PRIORITY

### Must Have for MVP
1. Booking engine with availability management
2. Payment splits (Stripe Connect + Ultimate Fair)
3. LEO chat widget (floating bubble, anon→auth)
4. Spaces invitations and onboarding
5. Complete ecommerce flow with fulfillment hooks

### Should Have (Near-term)
1. **CRM** — structured data for contacts, leads, deals, pipeline; MCP exposure for LEO/agents (upgrade path + AI prefers systems).
2. LEO as full web master (extended CRUD)
3. Workflow engine for channels
4. LiveKit integration
5. Inventory photo workflow

### Nice to Have (Roadmap)
1. PDF processing channel
2. Video processing channel
3. POS integrations
4. Inbound email routing
5. Advanced RAG indexing

---

## REFERENCES

- **Constitution & Philosophy**: https://github.com/The-Angel-OS/angel-os
- **v3 Implementation**: https://github.com/The-Angel-OS/angels-os
- **Payload Ecommerce Template**: https://github.com/payloadcms/payload/blob/main/templates/ecommerce
- **MCP Plugin**: https://github.com/payloadcms/payload/tree/main/packages/plugin-mcp
- **Comments Plugin Reference**: https://github.com/brachypelma/payload-plugin-comments

---

*Last Updated: February 2026*
*Consolidated from: README.md, OpenClaw Discussion, Cursor MVP Blueprint*

*Structured data for what needs to be structured; Angel OS + Payload CMS = logical upgrade path for OpenClaw. CRM included.*
