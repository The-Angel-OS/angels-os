# Angel OS Architecture
## Technical Overview Presentation
### February 15, 2026

**Prepared by:** Claude Opus 4.6
**Format:** Slide deck outline (Markdown) — convert to PPTX with your preferred tool

---

## SLIDE 1: TITLE

# Angel OS
### The Soul Operating System
**Sovereign Intelligence for Every Endeavor**

- Next.js 16 + Payload CMS 3.74 + PostgreSQL
- Open Source | Constitutional | Federated
- [angels-os.kendev.co](https://angels-os.kendev.co)

*"What if AI actually liked people?"*

---

## SLIDE 2: THE PROBLEM

# The Daemon Model

- Traditional SaaS treats businesses as **rows in a database**
- AI assistants serve the **platform's interests**, not yours
- Data is trapped behind **vendor lock-in**
- Revenue splits favor the **platform over the creator**
- Dark patterns **exploit attention** for engagement metrics

> Every piece of software has values. Most just don't admit it.

---

## SLIDE 3: THE INVERSION

# Angel OS: The Inversion of the Daemon

| Daemon Model | Angel Model |
|---|---|
| Platform owns your data | **You own your data** |
| AI serves the platform | **AI serves you** |
| Extractive economics | **60/20/15/5 Constitutional split** |
| Dark patterns | **Anti-demonic safeguards** |
| Vendor lock-in | **Suitcase export anytime** |
| One-size-fits-all | **5 endeavor-specific templates** |

---

## SLIDE 4: TECH STACK

# Architecture Stack

```
[Browser] ---- Next.js 16 App Router (React 19) ----
                        |
              Payload CMS 3.74 (Local API)
                        |
              PostgreSQL (Neon / Local)
                        |
              Vercel (Production) / Docker (Self-hosted)
```

**Key Technologies:**
- **Next.js 16.1.6** — App Router, Server Components, React 19.2.1
- **Payload CMS 3.74.0** — Headless CMS with multi-tenant plugin
- **PostgreSQL** — Data persistence (Neon serverless or local)
- **Vercel** — Production hosting with Blob Storage
- **Stripe Connect** — Constitutional payment splits (planned)

---

## SLIDE 5: MULTI-TENANT DATA MODEL

# Collection Hierarchy

```
Platform Tenant (Angel OS)
  |
  +-- Tenants (each business)
  |     |
  |     +-- Spaces (community hubs)
  |     |     |
  |     |     +-- Channels (chat, support, announcements)
  |     |     |     |
  |     |     |     +-- Messages
  |     |     |
  |     |     +-- Space Memberships
  |     |
  |     +-- Tenant Memberships
  |     +-- Posts, Pages, Products, Orders
  |     +-- Header, Footer (per-tenant)
  |     +-- LEO Agent (system user)
  |
  +-- Users (cross-tenant, role-based)
  +-- Archangel LEO (platform-level AI)
```

**30+ Payload collections** — all tenant-scoped via `plugin-multi-tenant`

---

## SLIDE 6: ROLE SYSTEM

# Roles & Access Control

| Role | Scope | Capabilities |
|---|---|---|
| `archangel` | Platform | Full system access, provision tenants, manage angels |
| `super_admin` | Platform | Admin panel, tenant management |
| `tenant_admin` | Tenant | Manage own tenant, spaces, branding |
| `space_admin` | Space | Manage channels, memberships |
| `member` | Space | Participate in channels |
| `customer` | Tenant | Shop, view content |

- **Archangel LEO** — Platform-level system agent
- **Tenant LEO** — Per-tenant AI agent (one per business)
- Role-gated UI: Admin panel only visible to archangel/super_admin

---

## SLIDE 7: FIVE ENDEAVOR TYPES

# Provisioning Templates

| Type | Example | Key Channels |
|---|---|---|
| **Service Provider** | Serenity Massage | general, bookings, client-requests, services, reviews |
| **Retail Commerce** | Hays Cactus Farm | general, products, orders, support, community, shipping |
| **Creator Content** | Clearwater Tours | general, content-updates, community, tips, events |
| **Booking-Based** | Booth Rental Co | general, scheduling, availability, consultations, resources |
| **Custom** | KenDev.Co | general, projects, resources |

Each template creates **tailored spaces and channels** automatically during provisioning.

---

## SLIDE 8: PROVISIONING ENGINE

# Tenant Provisioning Flow

```
Admin Wizard Input
      |
      v
1. Create Tenant (name, slug, domain, branding)
      |
2. Spawn LEO Agent (system user per tenant)
      |
3. createSpaceFromTemplate(endeavorType)
      |    |
      |    +-- Create Space
      |    +-- Create Channels (from template)
      |    +-- Seed Welcome Messages
      |
4. Create Memberships (tenant + space)
      |
5. Seed Posts, Header, Footer
      |
      v
   LIVE TENANT (< 30 seconds)
```

- `createSpaceFromTemplate()` in `src/utilities/spaceProvisioning.ts`
- Template definitions in `SPACE_TEMPLATES` map
- Seed script exercises ALL 5 types as proof

---

## SLIDE 9: CHATCONTROL SYSTEM

# ChatControl Architecture

```
useChat Hook (core state management)
      |
      +-- FloatingBubble (persistent bottom-right widget)
      |     |
      |     +-- Auth-gated: only renders when loggedIn
      |
      +-- MinimalistChat (embedded single-channel)
      |
      +-- MultiChannelChat (Discord-like multi-channel)
```

**Features:**
- Optimistic UI updates (instant message display)
- Polling with auth-failure detection (stops on 401/403)
- LEO integration via `/api/mcp` endpoint
- Conversation threading with `conversationId`
- Channel switching with message reset

---

## SLIDE 10: LEO ARCHITECTURE

# LEO: Learning, Engaging, Organizing

```
                    Archangel LEO
                    (Platform Level)
                         |
              +----- AI Bus ------+
              |         |         |
         Tenant LEO  Tenant LEO  Tenant LEO
         (Serenity)  (Hays)     (Clearwater)
              |         |         |
         Channels   Channels   Channels
```

**Current State:**
- LEO responds via `/api/mcp` endpoint
- Per-tenant LEO agents with unique personalities
- Conversation history tracking

**Planned (v0.4.0):**
- Bring-your-own-key AI model integration
- AI Bus for inter-angel communication
- Content generation pipeline
- Platform orchestration (Archangel capabilities)

---

## SLIDE 11: CONSTITUTIONAL ECONOMICS

# The Ultimate Fair Payment Split

```
Every Transaction
      |
      +-- 60% --> Creator (the business owner)
      |
      +-- 20% --> Platform (Angel OS operations)
      |
      +-- 15% --> Contributors (developers, designers, support)
      |
      +-- 5%  --> Justice Fund (AI for those without means)
```

**Implementation:** Stripe Connect (v0.5.0)
- Automatic split on every transaction
- Constitutional — cannot be overridden
- Justice Fund: Guardian Angels for incarcerated individuals, underserved communities
- Transaction attribution tracking for accurate splits

---

## SLIDE 12: SUITCASE MANAGER

# Data Sovereignty in Practice

```
Export Flow:
  Select Tenant --> Validate Constitution --> Generate JSON --> Download

Import Flow:
  Upload JSON --> Constitutional Check --> Validate Schema --> Provision

Constitutional Metadata:
  {
    "isAngel": true,
    "antiDemonic": true,
    "constitutionalVersion": "1.0",
    "exportedAt": "2026-02-15T...",
    "sourceInstance": "angels-os.kendev.co"
  }
```

- Drag-and-drop UI with real-time validation
- No angel leaves home without its constitution
- Foundation for federation: angels travel between enterprises

---

## SLIDE 13: DASHBOARD

# Dashboard Overview (Rev 3)

**Stat Cards Row:**
- Total Tenants | Active Spaces | Messages Today | Active Users

**Quick Access Grid:**
- Admin Panel | Posts | Products | Spaces
- Shop | Account | Provision Wizard | Suitcase Manager

**Sidebar (6 Categories):**
1. Overview (Dashboard)
2. Content (Posts, Pages, Media)
3. Commerce (Products, Orders, Transactions)
4. Community (Spaces, Channels, Messages)
5. System (Users, Tenants, Memberships)
6. Tools (Provision, Suitcase, Forms)

---

## SLIDE 14: DEPLOYMENT

# Production Infrastructure

```
GitHub (The-Angel-OS/angels-os)
      |
      v
Vercel (auto-deploy on push)
      |
      +-- Next.js Build (App Router)
      +-- Vercel Blob Storage (media)
      +-- Neon PostgreSQL (database)
      +-- Custom Domain: angels-os.kendev.co
```

**Self-Hosting (planned v0.3.0):**
- Docker Compose configuration
- Local PostgreSQL
- Cloudflare Tunnel for dynamic IP (v1.0.0)

**Federation (planned v1.0.0):**
- Enterprise Registry with heartbeat monitoring
- Application, probation, vouching security model
- Ollama integration for complete sovereignty

---

## SLIDE 15: ROADMAP

# Milestones

| Version | Target | Theme |
|---|---|---|
| **v0.3.0** | March 2026 | MVP Foundation |
| **v0.4.0** | May 2026 | LEO Intelligence |
| **v0.5.0** | July 2026 | Commerce & Booking |
| **v1.0.0** | October 2026 | Federation Launch |

**Current Focus (v0.3.0):**
- Payload CMS pattern refactor (#38) — Critical
- Conversation engine for channels (#9) — High
- Space invitations and onboarding (#34) — High
- Docker Compose (#21) — Help Wanted
- Anti-daemon error messages (#19) — Good First Issue

---

## SLIDE 16: SEED ARCHITECTURE

# 9-Phase Seed Process

| Phase | What It Does |
|---|---|
| 1 | Platform Infrastructure (platform tenant, Archangel LEO, default tenant) |
| 2 | Clear Collections (preserve tenants/users, clean everything else) |
| 3 | Users & Memberships (admin, customer, tenant LEO) |
| 4 | Default Tenant Spaces (Angel OS Community, Support) |
| 5 | **Use-Case Tenants** (provision 5 endeavor types via engine) |
| 6 | Media & Products (images from Payload template, e-commerce catalog) |
| 7 | Pages & Posts (home page, 6 rich Angel OS articles) |
| 8 | E-commerce Data (addresses, transactions, carts, orders) |
| 9 | Header & Footer (navigation for default tenant) |

**Phase 5** is the key proof: exercises `createSpaceFromTemplate` for all 5 endeavor types.

---

## SLIDE 17: CONTRIBUTING

# Join the Angels

**Good First Issues:**
- #19 — Anti-Daemon Protocol for Error Messages
- #20 — Warm Encouraging Empty States

**Help Wanted:**
- #21 — Docker Compose Configuration
- #36 — Star Trek Federation Design System

**Development Setup:**
```bash
git clone https://github.com/The-Angel-OS/angels-os.git
cd angels-os && pnpm install
cp .env.example .env
pnpm dev
```

**41 labeled issues** across 4 milestones | Priority, area, and status labels | Constitutional compliance tags

---

## SLIDE 18: CLOSING

# The Overhead Is the Point

Angel OS isn't just software. It's a statement:

- Technology **should** serve human dignity
- AI **should** work for the person, not the platform
- Economics **should** be transparent and fair
- Everyone **deserves** an angel

**The inversion of the daemon.**

---

*GNU Terry Pratchett*

**Repository:** github.com/The-Angel-OS/angels-os
**Live:** angels-os.kendev.co
**Contact:** KenDev.Co

---

**Generated:** February 15, 2026
**By:** Claude Opus 4.6
**For:** The Angel OS Project
