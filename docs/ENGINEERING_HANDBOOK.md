# Angel OS Engineering Handbook

> "The whole point of existence is to learn to love." — Answer 53

**Scotty's Manual** — Everything a maintainer needs to keep this ship flying.

---

## The 30-Second Briefing

Angel OS is a **constitutional AI platform** where every tenant (Endeavor) gets a sovereign AI guardian (LEO), a storefront, collaboration spaces, and federation connectivity. Built on Payload CMS 3.77 + Next.js 16 + PostgreSQL, deployed on Vercel.

**Non-negotiable:** The Constitution is immutable. Articles I, II, V.4 cannot be amended. The Justice Fund (5% to forgotten communities) is architectural, not optional.

---

## Critical Gotchas (Read These First)

### 1. JWT Sessions — The Silent Killer

Payload 3.77+ hashes secrets internally and requires session IDs:

```
payload.secret ≠ process.env.PAYLOAD_SECRET
```

Custom JWTs MUST include `sid` matching `user.sessions[]`. Without it, auth silently returns `{ user: null }` — no error, no log, nothing.

**Files:** `src/endpoints/auth-google.ts` (the pattern), `MEMORY.md` (the saga)

### 2. Serverless Connection Pool

```typescript
pool: { max: process.env.VERCEL ? 3 : 10 }
```

Vercel runs many parallel instances. Each gets 3 connections max to avoid exhausting Neon PostgreSQL. Drizzle schema introspection at startup fires concurrent queries — headroom is essential.

### 3. Middleware Skips API Routes

i18n middleware adds locale prefixes (`/en/api/...`). API and admin routes MUST be excluded or they break. OAuth callback routes (`/api/auth/complete`, `/api/auth/set-cookie`) are fully excluded.

### 4. overrideAccess for System Queries

Backend operations (hooks, federation, LEO tools) must use `overrideAccess: true`. Without it, queries respect user access control and return empty results in system contexts.

### 5. Fire-and-Forget Hooks

`autoAnalyzeMedia` uses `setImmediate()` — returns immediately, runs analysis in background. Test the return value, not the side effect.

### 6. Multi-Tenant Plugin Registration

Every tenanted collection MUST be listed in `multiTenantPlugin.collections` in `payload.config.ts`. Miss one and tenant isolation breaks silently.

---

## Architecture Map

```
┌─────────────────────────────────────────────────┐
│                   NEXT.JS 16                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ App Pages│  │ API Routes│  │  Middleware    │  │
│  │ (SSR/RSC)│  │ (REST)   │  │ (tenant+i18n) │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │           │
│  ┌────▼──────────────▼────────────────▼───────┐  │
│  │            PAYLOAD CMS 3.77                │  │
│  │  42 Collections · Typed Hooks · Access ACL │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐  │  │
│  │  │ Auth    │ │ Commerce │ │ Federation │  │  │
│  │  │ (OAuth) │ │ (Stripe) │ │ (Herald)   │  │  │
│  │  └─────────┘ └──────────┘ └────────────┘  │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                           │
│  ┌────────────────────▼───────────────────────┐  │
│  │              LEO AI ENGINE                  │  │
│  │  ConversationEngine · 108 Tools · RAG      │  │
│  │  Constitutional Prompt · Multi-Model        │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │    PostgreSQL (Neon)    │
          │    Vercel Blob Storage  │
          └─────────────────────────┘
```

---

## Collections by Domain

| Domain | Collections | Key Pattern |
|--------|------------|-------------|
| **Core** | Tenants, Users, TenantMemberships | Tenant-first, role-based access |
| **Collaboration** | Spaces, SpaceMemberships, Channels, Messages | Universal Message Structure |
| **Content** | Pages, Posts, Media, Categories, Comments | Block-based layout, ISR revalidation |
| **Commerce** | Products, Orders, Reviews, ProcessedStripeEvents | Stripe Connect, bootstrap fees |
| **Events** | Events, EventRegistrations, Bookings, Availability | Calendar integration ready |
| **Federation** | Endeavors, FederationAuditLog, StreetSigns, Pheromones | Herald Protocol, Ed25519 |
| **Logistics** | LogisticsNodes, Transports, Shipments | Dispatch engine |
| **Intelligence** | HolonCapabilities, WorkUnits, AgentTransactions | Swarm coordination |
| **Gamification** | Quests, QuestParticipations | Engagement loops |
| **CRM** | Contacts | Pipeline management |

---

## Authentication Flow

```
User → Google/Discord/GitHub consent screen
  → Callback on canonical domain (spacesangels.com)
  → Find or create user
  → Create session (user.sessions[])
  → Sign JWT with { sub, sid }  ← BOTH required
  → If cross-domain: token-relay → set cookie on origin
  → Redirect to dashboard
```

**Files:** `src/endpoints/auth-google.ts` (template), `auth-discord.ts`, `auth-github.ts`, `auth-token-relay.ts`

---

## Federation Protocol

Each Endeavor is a **sovereign node**. Nodes cooperate through:

1. **Heartbeat** — `POST /api/federation/heartbeat` (Ed25519-signed health pings)
2. **AI Bus** — `POST /api/federation/message` (EdDSA JWT cross-tenant messaging)
3. **StreetSigns** — Ambient marketplace data gossipped via heartbeat
4. **Pheromones** — Swarm intelligence signals (task coordination)

**Trust levels:** `unknown → vouched → trusted → allied`

---

## LEO Tool Lifecycle

```
User message → ConversationEngine
  → Build context (tenant, role, space, history)
  → Inject constitutional system prompt
  → Send to LLM (Claude Sonnet 4.6 primary)
  → LLM returns tool_use or text
  → Execute tool (with access control)
  → Return result to LLM for synthesis
  → Stream response to user via SSE
```

**Tool safety:** Article III.2 — irreversible actions require human confirmation. LEO MUST ask before deleting, publishing, or spending money.

---

## Commerce Engine

### Bootstrap Fee Tiers

| Tier | When | Fee | Promise |
|------|------|-----|---------|
| **Free** | First N transactions / $X GMV | 0% | N/A |
| **Bootstrap** | After free exhausted | 5% | 100% refund committed |
| **Standard** | Post-graduation | UltimateFairSplit | 60% creator / 20% platform / 15% logistics / 5% Justice Fund |

**File:** `src/utilities/bootstrapFees.ts`

### Stripe Connect Flow

1. Tenant connects Stripe account via `/dashboard/admin/settings`
2. Products created with prices synced to Stripe
3. Orders processed through Stripe Connect (platform takes split)
4. Bootstrap fees tracked and refund-promised

---

## Testing

```bash
pnpm vitest run              # 4,842 tests, 216 files
pnpm vitest run src/         # Source tests only
pnpm exec playwright test    # E2E suites
npx tsc --noEmit             # TypeScript check
```

**Patterns:**
- `vi.mock()` hoisting: Never reference external `const` in factories
- Hook tests: Cast args `as any` (strict Payload types)
- Fire-and-forget: Test return value, not async side effect

---

## Deployment

- **Push to `main`** → auto-deploys to Vercel
- **Pre-push:** `npx tsc --noEmit` + `pnpm vitest run`
- **Env vars:** `PAYLOAD_SECRET`, `DATABASE_URI`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`
- **Connection pool:** 3 max on Vercel, 10 local
- **Runtime logs:** Use Vercel dashboard (MCP tools timeout intermittently)

---

## File Index (Start Here)

| What | Where |
|------|-------|
| Main config | `src/payload.config.ts` |
| Middleware | `src/middleware.ts` |
| OAuth pattern | `src/endpoints/auth-google.ts` |
| Federation heartbeat | `src/endpoints/federation-heartbeat.ts` |
| LEO engine | `src/utilities/ConversationEngine.ts` |
| LEO tools | `src/utilities/leo-tools/` |
| Constitutional prompt | `src/utilities/constitutional-prompt.ts` |
| Bootstrap fees | `src/utilities/bootstrapFees.ts` |
| Collection template | `src/collections/Messages/index.ts` |
| User journeys | `docs/PLATFORM_GUIDE.md` |
| Data model | `docs/DATA_MODEL.md` |
| LEO tools ref | `docs/LEO_TOOLS_REFERENCE.md` |
| Sprint status | `docs/STATUS.md` |
| Revenue model | `docs/REVENUE.md` |
| Constitution | `docs/architecture/CONSTITUTION.md` |
| Podcast scripts | `docs/transcripts/260222 Angel OS podcast-ep01.md` (and series) |

---

*Last updated: Sprint 38 — March 4, 2026*
*4,842 tests passing · 42 collections · 108 LEO tools · Zero src/ TS errors*
