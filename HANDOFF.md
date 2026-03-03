# Angel OS — Session Handoff: Sprint 38 Complete

**Date:** March 3, 2026
**Branch:** `main`
**Status:** TypeScript clean, 4,842 unit tests passing (216 files, 1 pre-existing skip), 72+ API endpoints, 40 collections, 104 Leo tools
**Sprint:** Sprint 38 complete (Federation Browsing Tools + test polish wave) — Sprint 39 next
**Stack:** Payload 3.77.0 + Next.js 16.1.6 + React 19.2.1 + Gemini 3.1 Pro (primary) + Sonnet 4.6 (fallback) + Turbopack
**Last commits:**
- `1be351a` — tests: add leoProcessMessage unit tests (+13, 216 files)
- `143630d` — tests: add outbound sender resolver unit tests (+16, 215 files)
- `9c3e350` — tests: add Endeavors, Messages, Pages, Posts hook unit tests (+47, 214 files)
- `966e3c1` — tests: add collection hook unit tests (+47, 209 files)
- `3f7a2d5` — fix: add TenantAutoSelector to auto-set payload-tenant cookie from subdomain

---

## Critical Context: Sprint 38 Summary

### Sprint 38 — Federation Browsing Tools for LEO

**Three new LEO tools added** (in `src/utilities/leo-data-tools.ts`):

1. **`browse_federation_peers`** — Reads the local governance cache to list known peers (name, domain, capabilities, trust score, heartbeat). No outbound HTTP. Instant.
2. **`query_peer_catalog`** — Calls `fetchCatalog()` from `federationClient.ts` to browse a specific peer's public catalog endpoint. Supports search, capability/region filters, price ceiling, min rating.
3. **`search_federation_wide`** — Fan-out search across ALL active peers in parallel. Batched 5 at a time (8s timeout per peer). "Google for the federation."

**Tool labels** added to `src/constants/toolLabels.ts`.
**Tests** in `tests/unit/utilities/federationBrowsingTools.test.ts`.

### Sprint 38 — Test Polish Wave

This session completed a comprehensive test coverage push. Added ~330 new tests across:

- **Collection hooks:** `enforceUniqueEmailPerTenant`, `autoJoinTenantSpaces`, `messageHooks` (setAuthor/setTenantFromSpace), `ensureFirstUserIsAdmin`, `syncUserTenants`, `generateBeneficiaryTokens`, `autoAnalyzeMedia`, `runWorkflows`, `revalidatePage`, `revalidatePost`
- **Utility resolvers:** `resolveSmsSender`, `resolveTelegramSender`, `resolveWhatsAppSender`, `resolveSlackSender` (combined in `resolveOutboundSenders.test.ts`)
- **Orchestration:** `leoProcessMessage` (agent routing, BYOAI key, federated context, sessionMemory composition)
- **Endpoints:** `orders-claimable` (claimable order filtering by Holon capabilities)

**Key vitest lesson (re-confirmed):** `vi.mock()` factories are hoisted — never reference external `const` variables in them. Always use `vi.fn()` inline, then `vi.mocked(importedFn)` after imports.

### Sprint 37 — Federated AI Bus + GitHub OAuth

**Federated AI Bus:** JWT-signed cross-tenant AI messaging. Peers route messages directly to each other's LEO agents. Trust levels gate tool access (`vouched` vs `full`). Key files: `src/utilities/federatedAIBus.ts`, `src/endpoints/federated-ai-bus.ts`.

**GitHub OAuth:** Full OAuth2 sign-in and account-linking. Follows Google pattern (init + callback handlers, state encoding, cross-domain relay, Sessions API). Key file: `src/endpoints/auth-github.ts`.

**Multi-channel hardening:** Telegram, WhatsApp, Slack, Discord, Email all go through the unified `bridge-inbound` endpoint with retry + error marking.

### Sprint 36 — Vapi Voice + AI Bus Projects

**Vapi Voice:** Phone calls route through Vapi webhook → `leoProcessMessage()` → AI Bus. Full transcript persistence. Key file: `src/endpoints/vapi-webhook.ts`.

**AI Bus Projects:** Users can subscribe LEO to external AI projects. Federation peers can join project channels. Cross-tenant AI collaboration.

### Sprints 33-35 — Discord + Slack + Operational Excellence

- Discord bot manager (N bots simultaneously), Discord OAuth, Discord formatter
- Slack connector (`resolveSlackSender`, Slack bot token bridge)
- Retry engine (`outboundRetry.ts`) with exponential backoff
- Health cron endpoint, connector management UI
- `autoTranslation.ts` for multi-language channel bridging

---

## Key Files: Federation Tools

| File | Role |
|------|------|
| `src/utilities/leo-data-tools.ts` | All LEO tool definitions and handlers (~11,000 lines) |
| `src/utilities/federationClient.ts` | `fetchCatalog()`, `fetchHolons()`, signed outbound HTTP |
| `src/endpoints/federation-governance-sync.ts` | `getCachedGovernance()`, governance cache |
| `src/constants/toolLabels.ts` | Display labels for tool call indicators |
| `tests/unit/utilities/federationBrowsingTools.test.ts` | Sprint 38 tool tests |

---

## Key Files: Auth

| File | Role |
|------|------|
| `src/endpoints/auth-google.ts` | Google OAuth (init + callback, link mode) |
| `src/endpoints/auth-github.ts` | GitHub OAuth (init + callback, link mode) |
| `src/endpoints/auth-discord.ts` | Discord OAuth (init + callback, link mode) |
| `src/endpoints/auth-token-relay.ts` | Cross-domain token relay |
| `src/app/api/auth/complete/route.ts` | Cookie-setting page (standalone handler) |
| `src/middleware.ts` | i18n + tenant detection |

---

## What's Next (Sprint 39)

### Priority 1 — Customer Angel Token UI
- Order detail page with token status banner (amber=active, green=redeemed)
- Configuration display, Cancel & Refund button
- Token transfer / gift flow

### Priority 2 — npx create-angel-enterprise
- One-command installer scaffold
- Leo Wizard 8-step conversational onboarding (no forms, just a conversation)

### Priority 3 — Street Signs Gossip Sync
- Gossip-style sync between federated nodes
- Ambient marketplace data in heartbeat payloads — every node eventually knows every product

### Priority 4 — CI/CD Pipeline
- GitHub Actions: pnpm test → pnpm tsc --noEmit → pnpm build → Vercel deploy
- Automated failure notification to hello@spacesangels.com (hook exists)

### Priority 5 — Docker Compose
- Self-hosting configuration for sovereign deployments

---

## Known Issues

### Pre-existing Test Failure (1 test)
**File:** `tests/unit/utilities/ultimateFairSplit.test.ts`
- 1 failing test (down from 18 — most were fixed in Sprint 22)
- Related to transparency report percentages

### Election Store is In-Memory
`federation-election.ts` uses an in-memory `Map` for proposals. Proposals lost on server restart.

### Stripe Webhook Not Yet Configured
Webhook endpoint needs creation in Stripe Dashboard. `STRIPE_WEBHOOKS_SIGNING_SECRET` still needed on Vercel.

### In-Memory Rate Limiting
Non-functional on serverless (Vercel). Needs Redis/Upstash for production enforcement.

---

## Current DB State

**Enterprise:** `hays-cactus`, `serenity-massage`, and `clearwater-cruisin` are active test tenants
**Admin user:** `kenneth.courtney@gmail.com` — roles: `['super_admin', 'customer']`
**Auth:** Subdomain-based tenant detection with `TenantAutoSelector` component for cookie syncing
**Stripe:** Live keys configured locally, pending Vercel env vars for webhooks

---

## Environment

```bash
# Dev
pnpm dev               # http://localhost:3000 (runs node scripts/dev-with-env.mjs)

# Tests
pnpm test:unit         # 4,842 tests across 216 files
pnpm test:int          # Integration tests (boots Payload, ~23s)
pnpm test:e2e          # E2E with Playwright (needs server + Chromium)
pnpm tsc --noEmit      # TypeScript check

# Deploy
git push               # Auto-deploys to Vercel (main branch)
```

---

## Deployment

- **Project:** `prj_18HdwoPYXit5bEWMgSthSQ32PofF`
- **Team:** `team_fQfygPVPNVZC3YxQFMiK6KlB`
- **Vercel:** Push `main` to trigger deployment

---

*"Listen to everything. Judge nothing. Hold lightly."*
*— Kenneth, Enterprise operator, Clearwater Cruisin*
