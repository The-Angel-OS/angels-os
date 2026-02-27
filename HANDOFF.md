# Angel OS — Session Handoff: Sprint 23 Complete

**Date:** February 27, 2026
**Branch:** `main`
**Status:** TypeScript clean, 1,570 tests passing (36 files), 49+ API endpoints, 36 collections, 78+ Leo tools
**Sprint:** Sprint 23 complete (Google OAuth + Social Auth + Quests) — Sprint 24 next
**Stack:** Payload 3.77.0 + Next.js 16.1.6 + React 19.2.1 + Gemini 3.1 Pro (primary) + Sonnet 4.6 (fallback) + Turbopack
**Last commits:**
- `8a90efc` — feat: social auth link/unlink panel on account page
- `9b930a1` — fix: show Voice/LiveKit applet icon regardless of env config
- `4a4715d` — fix: Google OAuth cookie setting + mobile chat action icons
- `58968c7` — feat: switch LEO to Gemini 3.1 Pro with Sonnet 4.6 fallback
- `5bcc40b` — perf: cache tenant lookups to prevent connection pool exhaustion

---

## Critical Context: Sprint 22-23 Summary

### Sprint 23 — Google OAuth + Social Auth + Quests

**Google OAuth:** Full OAuth2 flow — sign in with Google, cross-domain token relay for custom domain tenants. OAuth state parameter encodes `{ redirect, origin, mode, userId }` for both sign-in and account-linking flows.

**Social Auth Link/Unlink:** Connected Accounts panel on `/account` page. Users can view linked providers, unlink them, or link new ones. Currently only Google has OAuth implemented; GitHub/Apple/Discord are in the schema (`socialProviders` array field on Users collection) and ready for endpoints.

**Key files:**
- `src/endpoints/auth-google.ts` — OAuth init + callback handlers (with `mode=link` support)
- `src/endpoints/auth-social-unlink.ts` — POST /api/auth/social-unlink
- `src/components/forms/SocialProvidersPanel/index.tsx` — Connected Accounts UI

**Leo Model Upgrade:** Switched from Claude Sonnet 4 to **Gemini 3.1 Pro** (primary) with **Sonnet 4.6** as fallback. The `/model` command lets users switch AI models mid-conversation.

**Performance:**
- Tenant caching (60s TTL) in `src/utilities/tenantCache.ts` — prevents DB pool exhaustion
- Chat message queries at depth=1 (was depth=2 causing 75-100s queries)
- Pre-created messages before streaming for reliable delivery

### Sprint 22 — The Shield and the Spear

**Security (The Shield):** PAYLOAD_SECRET startup guard, encryption salt from env, CSP headers, comments endpoint auth, `/api/health` endpoint.

**Features (The Spear):** Multi-file chat attachments (non-image files with type-aware previews), LiveKit device selector + video join + session lifecycle messages, database indexes on Messages hot fields, dashboard query parallelization.

---

## What's Next (Sprint 24)

### Priority 1 — Additional OAuth Providers
- GitHub, Apple, Discord OAuth endpoints (schema ready, need OAuth handlers)
- Token-based account linking without full OAuth (for invite flows)

### Priority 2 — npx create-angel-enterprise
- One-command installer scaffold
- Leo Wizard 8-step conversational onboarding

### Priority 3 — Customer Angel Token UI
- Order detail page with token status banners (amber=active, green=redeemed)
- Configuration display, Cancel & Refund button

### Priority 4 — Federation Audit Log Collection
- Election and suitcase endpoints persist to real collection (currently `as any`)

### Priority 5 — Street Signs Sync Protocol
- Gossip-style sync between federated nodes

---

## Known Issues

### Pre-existing Test Failure (1 test)
**File:** `tests/unit/utilities/ultimateFairSplit.test.ts`
- 1 failing test (down from 18 — most were fixed in Sprint 22)
- Related to transparency report percentages

### Election Store is In-Memory
`federation-election.ts` uses an in-memory `Map` for proposals. Proposals are lost on server restart.

### Stripe Webhook Not Yet Configured
Webhook endpoint needs creation in Stripe Dashboard. `STRIPE_WEBHOOKS_SIGNING_SECRET` still needed on Vercel.

### DB Connection Pool
- max=10 local, max=3 Vercel, connectionTimeoutMillis=30s
- Tenant caching and depth=1 message queries mitigate pool exhaustion
- Monitor for timeouts if new deep queries are added

---

## Current DB State

**Enterprise:** `hays-cactus` and `serenity-massage` are active test tenants (plus `clearwater-cruisin`)
**Admin user:** `kenneth.courtney@gmail.com` — roles: `['super_admin', 'customer']`
**Test user:** Tyler Suzanne (`tylersuzanne84@gmail.com`) — has Google social login linked
**Auth:** COOKIE_DOMAIN is `.angelos.local` in `.env`
**Stripe:** Live keys configured locally, pending Vercel env vars

---

## Environment

```bash
# Dev
pnpm dev               # http://localhost:3000 (runs node scripts/dev-with-env.mjs)

# Tests
pnpm test:unit         # 1,570 tests across 36 files
pnpm test:int          # Integration tests (boots Payload, ~23s)
pnpm test:e2e          # E2E with Playwright (needs server + Chromium)
npx tsc --noEmit       # TypeScript check

# Seed
pnpm seed:reset        # Update roles without full reset
```

---

*"Listen to everything. Judge nothing. Hold lightly."*
*— Kenneth, Enterprise operator, Clearwater Cruisin*
