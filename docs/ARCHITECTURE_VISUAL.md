# Angel OS — Visual Architecture Guide

> *Sprint 43 — March 18, 2026*
> *For engineers, operators, and curious humans.*

---

## 1. System Overview

```
                        ╔══════════════════════════════════════════╗
                        ║           ANGEL OS FEDERATION            ║
                        ║     "Everyone Gets an Angel" (Art. I)    ║
                        ╚══════════════════════════════════════════╝
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
              ┌─────▼─────┐        ┌─────▼─────┐        ┌─────▼─────┐
              │ FLAGSHIP   │◄──────►│ ENTERPRISE │◄──────►│ ENTERPRISE │
              │ Clearwater │  Ed25519│  Node B    │  Ed25519│  Node C    │
              │ spacesangels│ heartbeat│           │ heartbeat│           │
              │   .com     │◄──────►│           │◄──────►│           │
              └─────┬──────┘        └─────┬──────┘        └─────┬──────┘
                    │                     │                     │
         ┌──────────┼──────────┐          │                     │
         │          │          │          │                     │
    ┌────▼───┐ ┌────▼───┐ ┌───▼────┐ ┌───▼────┐          ┌────▼───┐
    │Cruisin │ │ Hays   │ │HelpDNA │ │Endeavor│          │Endeavor│
    │Ministry│ │ Cactus │ │  Free  │ │   D    │          │   E    │
    │        │ │  Farm  │ │Ernesto │ │        │          │        │
    └────────┘ └────────┘ └────────┘ └────────┘          └────────┘

    ◄─── Endeavors (tenants aboard an Enterprise) ───►
```

---

## 2. Request Flow

```
    Browser                    Vercel Edge                Angel OS Server
    ───────                    ──────────                ────────────────

    GET /shop          ──────►  Next.js Middleware
                                    │
                                    ▼
                              ┌─────────────┐
                              │  detectTenant│
                              │  from hostname│
                              │  ───────────  │
                              │ *.spacesangels│──► slug lookup
                              │  .com        │
                              │ x-tenant-id  │──► injected to headers
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │ Payload CMS  │
                              │   REST API   │
                              │  ───────────  │
                              │ /api/{coll}  │──► Auto-generated CRUD
                              │ /api/{custom}│──► Custom -ops endpoints
                              └──────┬───────┘
                                     │
                          ┌──────────┼──────────┐
                          │          │          │
                    ┌─────▼────┐ ┌───▼───┐ ┌───▼────┐
                    │ Tenant   │ │ Access│ │Response│
                    │ Scoping  │ │Control│ │  JSON  │
                    │(multiTen)│ │(RBAC) │ │ or SSR │
                    └──────────┘ └───────┘ └────────┘

    ⚠️  RULE: Custom endpoints NEVER use a collection slug as path prefix.
              Use -ops suffix: /order-ops/*, /booking-ops/*, /space-ops/*
              (Sprint 42 fix: 15 dead endpoints from route shadowing)
```

---

## 3. LEO AI Chat Pipeline

```
    User Message
         │
         ▼
    ┌────────────┐     ┌──────────────────────────────────────┐
    │ chat-send  │────►│           AI GATEWAY                 │
    │  endpoint  │     │  src/utilities/ai-gateway.ts         │
    └────────────┘     │                                      │
                       │  Credit Check ──► Tier Selection     │
                       │                                      │
                       │  ┌─────────┐  ┌─────────┐           │
                       │  │ Tier 1  │  │ Tier 2  │           │
                       │  │ Gemini  │  │ Sonnet  │           │
                       │  │ 3.1 Pro │  │  4.6    │           │
                       │  └────┬────┘  └────┬────┘           │
                       │       │            │                 │
                       │  ┌────▼────┐  ┌────▼────┐           │
                       │  │ Tier 3  │  │ Tier 4  │           │
                       │  │ Haiku   │  │ Gemini  │           │
                       │  │  3.6    │  │  Flash  │           │
                       │  └─────────┘  └─────────┘           │
                       └──────────┬───────────────────────────┘
                                  │
                                  ▼
                       ┌──────────────────┐
                       │   LEO STREAM     │
                       │  leo-stream.ts   │
                       │                  │
                       │  105+ Tools      │
                       │  ───────────     │
                       │  Commerce (15)   │
                       │  Booking (4)     │
                       │  CRM (6)         │
                       │  Federation (8)  │
                       │  Content (12)    │
                       │  Analytics (4)   │
                       │  Inventory (5)   │
                       │  Financial (4)   │
                       │  Workflow (4)    │
                       │  Media (3)       │
                       │  Navigation (2)  │
                       │  Slash Cmds (8)  │
                       │  + more...       │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   SSE STREAM     │
                       │  ──────────      │
                       │  text chunks     │
                       │  tool_call_start │
                       │  tool_call_end   │
                       │  [DONE]          │
                       └──────────────────┘
```

---

## 4. Payment Flow — Stripe Connect Direct Charges

```
    Customer                    Angel OS                    Stripe
    ────────                    ────────                    ──────

    1. Add to Cart
         │
    2. /checkout ──────────►  3. initiatePayment()
                                     │
                                     ▼
                              ┌──────────────┐
                              │ PaymentIntent │────────►  Created on
                              │   .create()   │          SELLER's
                              │               │          connected
                              │ application_  │          account
                              │ fee = 40%     │          (Direct Charge)
                              └──────┬───────┘
                                     │
    4. <PaymentElement> ◄────────────┘  (clientSecret)
         │
    5. confirmPayment() ──────────────────────────────►  Process card
                                                              │
                              ┌───────────────────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │   WEBHOOK    │     payment_intent.succeeded
                       │stripe-webhooks│
                       │     .ts      │
                       └──────┬───────┘
                              │
                    ┌─────────┼─────────────────┐
                    │         │                 │
              ┌─────▼────┐ ┌──▼──────────┐ ┌───▼─────────┐
              │ Order    │ │ Justice Fund│ │   Email     │
              │ status   │ │ 5% allocate │ │ confirmation│
              │ → 'paid' │ │ to JFT coll│ │ via Resend  │
              └──────────┘ └─────────────┘ └─────────────┘

    ┌──────────────────────────────────────────────────────┐
    │              ULTIMATE FAIR SPLIT                     │
    │  ┌──────────────────────────────────────────────┐   │
    │  │  60% ████████████████████████████░░░░░░ Maker │   │
    │  │  20% ██████████░░░░░░░░░░░░░░░░░░░ Platform  │   │
    │  │  15% ████████░░░░░░░░░░░░░░░░░░░░░░░░░ Ops   │   │
    │  │   5% ███░░░░░░░░░░░░░░░░░░░░░░░░░ Justice    │   │
    │  └──────────────────────────────────────────────┘   │
    └──────────────────────────────────────────────────────┘
```

---

## 5. Donation Flow (Sprint 43)

```
    Donor                      Angel OS                    Stripe
    ─────                      ────────                    ──────

    1. /donate
       Select amount
       ($5, $10, $25,
        $50, $100, Custom)
         │
    2. "Continue" ──────────►  3. POST /api/donation-ops/create-intent
                                     │
                                     ▼
                              ┌──────────────┐
                              │ PaymentIntent │────────►  Created on
                              │   .create()   │          PLATFORM
                              │               │          account
                              │ metadata:     │          (not Connect)
                              │  angelOs_type │
                              │  = 'donation' │
                              └──────┬───────┘
                                     │
    4. <PaymentElement> ◄────────────┘  (clientSecret)
         │
    5. confirmPayment() ──────────────────────────────►  Process card
                                                              │
                              ┌───────────────────────────────┘
                              │
                       ┌──────▼───────┐
                       │   WEBHOOK    │  if (angelOs_type === 'donation')
                       │  early exit  │
                       └──────┬───────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Justice Fund   │
                    │  100% allocated │
                    │  (no split)     │
                    │  ───────────    │
                    │  Community      │
                    │  Wrongful conv. │
                    │  Guild infra    │
                    └─────────────────┘
```

---

## 6. Federation Heartbeat Protocol

```
    Enterprise A                                    Enterprise B
    ────────────                                    ────────────

    Every 5 minutes (cron):

    ┌────────────────┐                        ┌────────────────┐
    │ Heartbeat Cron │                        │ Heartbeat      │
    │  Outbound      │                        │  Handler       │
    └───────┬────────┘                        └───────▲────────┘
            │                                         │
            ▼                                         │
    ┌────────────────┐                                │
    │ Build Payload  │                                │
    │  ────────────  │                                │
    │  federationId  │                                │
    │  domain (FQDN) │◄── Sprint 43: stored, not     │
    │  name          │    constructed from localhost   │
    │  capabilities  │                                │
    │  capacity snap │                                │
    │  streetSigns   │                                │
    └───────┬────────┘                                │
            │                                         │
            ▼                                         │
    ┌────────────────┐       POST /api/federation/    │
    │ Sign with      │       heartbeat                │
    │ Ed25519 key    │───────────────────────────────►│
    │                │                                │
    │ Headers:       │                                │
    │  X-Fed-Id      │                        ┌───────┴────────┐
    │  X-Fed-Sig     │                        │ Verify Ed25519 │
    │  X-Fed-Key     │                        │ Check timestamp│
    │  X-Fed-Time    │                        │ (5 min replay) │
    └────────────────┘                        └───────┬────────┘
                                                      │
                                              ┌───────▼────────┐
                                              │ Store/Update   │
                                              │ Endeavor record│
                                              │  ────────────  │
                                              │ lastPingAt     │
                                              │ domain ◄── NEW │
                                              │ capacity       │
                                              │ streetSigns    │
                                              └───────┬────────┘
                                                      │
            ┌─────────────────────────────────────────┘
            │
            ▼
    ┌────────────────┐
    │ Response:      │
    │  acknowledged  │
    │  theirStatus   │
    │  theirFedId    │
    │  constitution  │
    └────────────────┘
```

---

## 7. Multi-Tenant Isolation Model

```
    ┌───────────────────────────────────────────────────────────┐
    │                     FEDERATION LAYER                      │
    │  Ed25519 signatures │ Constitutional trust chain          │
    │  Heartbeat protocol │ Suitcase data portability           │
    └───────────────────────────────────┬───────────────────────┘
                                        │
    ┌───────────────────────────────────▼───────────────────────┐
    │                    ENTERPRISE LAYER                        │
    │                                                           │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
    │  │  PLATFORM   │  │  FLAGSHIP   │  │  (future    │      │
    │  │  tenant     │  │  tenant     │  │   peer      │      │
    │  │  ─────────  │  │  ─────────  │  │   nodes)    │      │
    │  │  Archangel  │  │  slug:      │  │             │      │
    │  │  LEO        │  │   'default' │  │             │      │
    │  │  Merlin     │  │  isFlagship │  │             │      │
    │  │  (infra)    │  │   = true    │  │             │      │
    │  └─────────────┘  └──────┬──────┘  └─────────────┘      │
    │                          │                                │
    └──────────────────────────┼────────────────────────────────┘
                               │
    ┌──────────────────────────▼────────────────────────────────┐
    │                    ENDEAVOR LAYER                          │
    │                                                           │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
    │  │Clearwater│ │  Hays    │ │ HelpDNA  │ │Celersoft │    │
    │  │ Cruisin  │ │ Cactus   │ │  Free    │ │ Tech     │    │
    │  │ Ministry │ │  Farm    │ │ Ernesto  │ │          │    │
    │  │──────────│ │──────────│ │──────────│ │──────────│    │
    │  │ Products │ │ Products │ │ Products │ │ Services │    │
    │  │ Posts    │ │ Posts    │ │ Posts    │ │ Posts    │    │
    │  │ Spaces   │ │ Spaces   │ │ Spaces   │ │ Spaces   │    │
    │  │ LEO      │ │ LEO      │ │ LEO      │ │ LEO      │    │
    │  │(persona) │ │(persona) │ │(persona) │ │(persona) │    │
    │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
    │                                                           │
    │  multiTenantPlugin scopes ALL data per tenant:            │
    │  pages, posts, products, media, spaces, channels,         │
    │  messages, bookings, events, orders, header, footer,      │
    │  site-settings, endeavors, connectors, contacts...        │
    └───────────────────────────────────────────────────────────┘
                               │
    ┌──────────────────────────▼────────────────────────────────┐
    │                      USER LAYER                           │
    │                                                           │
    │  Users are GLOBAL (unique by email).                      │
    │  TenantMemberships connect users to Endeavors.            │
    │                                                           │
    │  ┌─────────┐     ┌──────────────────┐     ┌─────────┐   │
    │  │  User   │────►│ TenantMembership │◄────│ Tenant  │   │
    │  │ (global)│     │  role: member    │     │ (scoped)│   │
    │  │         │     │  trigger: manual │     │         │   │
    │  │         │     │     OR purchase  │     │         │   │
    │  │         │     │     OR booking   │     │         │   │
    │  │         │     │     OR event_reg │     │         │   │
    │  └─────────┘     └──────────────────┘     └─────────┘   │
    │                                                           │
    │  Sprint 42: Auto-propagation — buy/book/register on a    │
    │  new Endeavor → silent TenantMembership creation          │
    └───────────────────────────────────────────────────────────┘
```

---

## 8. Order Routing — Holon Manufacturing Network

```
    New Order
       │
       ▼
    ┌──────────────────┐
    │ ORDER ROUTING    │
    │ ENGINE           │
    │ ────────────     │
    │ 4-dimension      │
    │ scoring:         │
    │                  │
    │ Equipment  40%   │──► CNC router, laser cutter, 3D printer...
    │ Proximity  30%   │──► Geo distance to customer
    │ Rating     20%   │──► Historical fulfillment quality
    │ Capacity   10%   │──► Current workload headroom
    │ + Equipment      │
    │   bonus +15      │──► Exact equipment match
    └───────┬──────────┘
            │
            ▼
    ┌───────────────────────────────────────────┐
    │              MATCH RESULT                 │
    │                                           │
    │  ┌─────────┐  Score: 87                   │
    │  │ Holon A │  Equipment: CNC ✓            │
    │  │ (maker) │  Distance: 12 mi             │
    │  │         │  Rating: 4.8/5               │   MATCHED
    │  └─────────┘  Capacity: 3 slots open      │──────────►
    │                                           │
    │  ┌─────────┐  Score: 71                   │
    │  │ Holon B │  Equipment: Laser ✓          │   BACKUP
    │  │ (maker) │  Distance: 45 mi             │
    │  └─────────┘                              │
    └───────────────────────────────────────────┘
            │
            │  NO MATCH?
            ▼
    ┌───────────────────┐
    │   ANGEL TOKEN     │
    │   ─────────────   │
    │   Order queued    │
    │   Token issued    │
    │   Visible on      │
    │   /makers board   │
    │                   │
    │   When new Holon  │
    │   registers with  │
    │   matching caps → │
    │   auto-match      │
    └───────────────────┘

    Fulfillment State Machine:
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ pending  │─►│ matched  │─►│ accepted │─►│  in      │
    │ _match   │  │          │  │          │  │production│
    └──────────┘  └──────────┘  └──────────┘  └────┬─────┘
                                                    │
                                              ┌─────▼─────┐  ┌──────────┐
                                              │  shipped   │─►│delivered │
                                              │            │  │          │
                                              └────────────┘  └──────────┘
```

---

## 9. Intelligence Layer — Swarm + Workload

```
    ┌──────────────────────────────────────────────────────────────┐
    │                   PHEROMONE ENGINE                            │
    │                   pheromone-engine.ts                         │
    │                                                              │
    │   5 Pheromone Types:                                         │
    │   ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
    │   │ SUCCESS  │ │ FAILURE  │ │DISCOVERY │                   │
    │   │ (green)  │ │ (red)    │ │ (blue)   │                   │
    │   └──────────┘ └──────────┘ └──────────┘                   │
    │   ┌──────────┐ ┌──────────┐                                 │
    │   │ DEMAND   │ │ WARNING  │                                 │
    │   │ (gold)   │ │ (orange) │                                 │
    │   └──────────┘ └──────────┘                                 │
    │                                                              │
    │   Operations: deposit → decay → reinforce → follow gradient  │
    │   Game of Life: Conway's rules for mesh health               │
    │   70 tests                                                   │
    └──────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
    ┌──────────────────────────────────────────────────────────────┐
    │                   WORKLOAD ENGINE                            │
    │                   workload-engine.ts                         │
    │                                                              │
    │   5-Dimension Scoring:                                       │
    │   ┌────────────────────────────────────────────┐            │
    │   │ Capability  ██████████████████████████ 30%  │            │
    │   │ Trust       ████████████████████████  25%   │            │
    │   │ Load        ████████████████████     20%    │            │
    │   │ Performance █████████████████       15%     │            │
    │   │ Cost        ██████████████         10%      │            │
    │   │ + Pheromone bonus (0-15%)                   │            │
    │   └────────────────────────────────────────────┘            │
    │                                                              │
    │   WorkUnit State Machine:                                    │
    │   pending → claimed → executing → completed/failed/timeout   │
    │                                                              │
    │   Backpressure: 85% mesh-wide threshold                     │
    │   Priority: critical (never shed) > high > normal > low      │
    │   91 tests                                                   │
    └──────────────────────────────────────────────────────────────┘
```

---

## 10. Engine Reference

```
    ┌─────────────────────────────────────────────────────────────────┐
    │                    15 ENGINES AT A GLANCE                       │
    ├──────────────────────┬──────────────────┬───────────────────────┤
    │ Engine               │ File             │ Tests                 │
    ├──────────────────────┼──────────────────┼───────────────────────┤
    │ AI Gateway           │ ai-gateway.ts    │ 65 tests, 4 tiers     │
    │ Order Routing        │ orderRouting*.ts │ 91 tests, 40/30/20/10 │
    │ Booking Engine       │ bookingEngine.ts │ 40+ tests, harmonics  │
    │ Logistics Engine     │ logistics-*.ts   │ 55 tests, B-B + Soul  │
    │ Pheromone Engine     │ pheromone-*.ts   │ 70 tests, 5 types     │
    │ Workload Engine      │ workload-*.ts    │ 91 tests, 5-dim       │
    │ Print-on-Demand      │ printOnDemand*.ts│ 61 tests, cost est    │
    │ Guardian Angel       │ guardianAngel*.ts│ 106 tests, 8 cohorts  │
    │ Justice Fund         │ justiceFund*.ts  │ 63 tests, 5% alloc    │
    │ Federation Protocol  │ federation/*.ts  │ 250+ tests, Ed25519   │
    │ Synchronicity Engine │ synchronicity*.ts│ pattern matching       │
    │ Street Signs         │ streetSigns.ts   │ 16 tests, gossip      │
    │ Edenist Mesh         │ edenist*.ts      │ 62 tests, sentinel    │
    │ Media Analysis       │ mediaAnalysis.ts │ 52 tests, RAG chunks  │
    │ Tenant Cache         │ tenantCache.ts   │ 60s TTL Map cache     │
    ├──────────────────────┴──────────────────┴───────────────────────┤
    │ TOTAL: 5,017+ unit tests across 223 files                      │
    └─────────────────────────────────────────────────────────────────┘
```

---

## 11. Database Architecture

```
    ┌──────────────────────────────────────────────────────────────────┐
    │                    PostgreSQL (42 Collections)                   │
    │                                                                  │
    │  ┌─── CORE ──────────────────────────────────────────────────┐  │
    │  │ users, tenants, tenant-memberships, media, media-meta     │  │
    │  │ pages, posts, categories, comments, site-settings         │  │
    │  │ header, footer                                            │  │
    │  └───────────────────────────────────────────────────────────┘  │
    │                                                                  │
    │  ┌─── COMMERCE ──────────────────────────────────────────────┐  │
    │  │ products, orders, reviews, contacts                       │  │
    │  │ justice-fund-transactions, processed-stripe-events        │  │
    │  │ agent-transactions                                        │  │
    │  └───────────────────────────────────────────────────────────┘  │
    │                                                                  │
    │  ┌─── SOCIAL ────────────────────────────────────────────────┐  │
    │  │ spaces, channels, messages                                │  │
    │  └───────────────────────────────────────────────────────────┘  │
    │                                                                  │
    │  ┌─── SCHEDULING ────────────────────────────────────────────┐  │
    │  │ bookings, availability, events, event-registrations       │  │
    │  └───────────────────────────────────────────────────────────┘  │
    │                                                                  │
    │  ┌─── FEDERATION ────────────────────────────────────────────┐  │
    │  │ endeavors, connectors, board-members, quests              │  │
    │  │ quest-participations                                      │  │
    │  └───────────────────────────────────────────────────────────┘  │
    │                                                                  │
    │  ┌─── INTELLIGENCE ──────────────────────────────────────────┐  │
    │  │ pheromones, work-units                                    │  │
    │  └───────────────────────────────────────────────────────────┘  │
    │                                                                  │
    │  ┌─── LOGISTICS ─────────────────────────────────────────────┐  │
    │  │ logistics-nodes, transports, shipments                    │  │
    │  └───────────────────────────────────────────────────────────┘  │
    │                                                                  │
    │  ┌─── SYSTEM ────────────────────────────────────────────────┐  │
    │  │ redirects, forms, form-submissions, search                │  │
    │  │ payload-locked-documents, payload-preferences             │  │
    │  │ payload-migrations                                        │  │
    │  └───────────────────────────────────────────────────────────┘  │
    │                                                                  │
    │  Connection Pool: max=10 local, max=3 Vercel                    │
    │  connectionTimeoutMillis: 30s                                    │
    └──────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference

| What | Where |
|------|-------|
| Live site | [spacesangels.com](https://spacesangels.com) |
| Answer 53 | [answer53.vercel.app](https://answer53.vercel.app) |
| GitHub | [The-Angel-OS/angels-os](https://github.com/The-Angel-OS/angels-os) |
| Dev server | `pnpm dev` → localhost:3000 |
| Tests | `pnpm test:unit` (5,017+ tests) |
| Build | `pnpm build` |
| DB pool | max=10 local, max=3 Vercel |
| Stripe | Live keys (Direct Charges + Donations) |
| Constitution | [docs/architecture/CONSTITUTION_FULL.md](docs/architecture/CONSTITUTION_FULL.md) |

---

*Generated: March 18, 2026 — Sprint 43*
*Angel OS v0.43.0-dev*
