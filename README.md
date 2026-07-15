# The Angel OS

**A multi-tenant, AI-native platform where everyone gets an Angel.** Commerce, community, content, and a constitutional AI guardian (Leo) — one stack, one brain, many bodies.

Built on **Payload CMS 3.77 + Next.js + PostgreSQL**. Each tenant is a sovereign portal (a business, a ministry, a family Circle, a personal guardian angel) with its own storefront, spaces, and Leo instance — all federating over a shared constitutional network.

> **New here?** Read [`AGENTS.md`](AGENTS.md) — the authoritative runbook for standing up a node, plus **The Model** (the canonical Enterprise / Tenant / Endeavor / Circle vocabulary). This README is the feature map; AGENTS.md is the how.

---

## One Mind, Three Bodies

Angel OS runs as three cooperating bodies sharing one portable brain (`leoBrain.ts` — a neutral message + tool contract):

- **Core** (this repo) — the web platform: Payload CMS, Next.js, the dashboard, storefronts, the AI Bus, and Leo's ~125 tools. Deploys to Vercel.
- **Merlin** ([`../merlin`](https://github.com/The-Angel-OS/merlin)) — an optional long-lived local/residential node: media server, on-box Ollama brain, camera sentinel, and a search/compute worker. Talks to Core's Leo (or its own local loop), echoed to its AI-Bus channel.
- **Nimue** — the Android guardian client: the Card Stage ("the Primer"), address book, offline Works, wake-word Leo.

You only need **Core** to run a node. Merlin and Nimue are optional and connect to a running Core.

---

## Feature Map

### Multi-tenancy & identity
Subdomain/domain routing · per-tenant branding, header/footer/home · `x-tenant-id` isolation on every API route · tenant flavors (Business / Circle / Guardian Angel / Personal Portal) · Google OAuth + passwordless **email-OTP** login · cross-subdomain SSO · role-based access (super_admin → tenant_admin → member) · federated auth (Google id_token → local session).

### Leo — the constitutional AI guardian
~125 tools across query / commerce / content / media / federation / comms / CRM / analytics / workflow · SSE streaming chat with vision · multi-provider AI gateway (credit-aware 4-tier routing, first-available-wins) · per-tenant BYO keys (OpenAI/Google/Cloudflare/OpenRouter/Anthropic/Ollama) · image generation (multi-provider) · COO mode (proactive health digests, operational intelligence) · immutable constitutional prompt + anti-demonic safeguards · `/model` switch · MCP server (agent discovery, JWT auth).

### Spaces & comms (the "AI Bus")
Discord-class workspaces + channels (10 types incl. DM) · real-time SSE broadcast · DMs on the AI Bus, membership-grained privacy · LiveKit voice/video applet · connectors: Discord, Telegram, WhatsApp, email (IMAP poll → channel per sender), SMS, Google Chat · transactional email (Resend) · per-node channels (Merlin nodes echo here).

### Commerce, bookings & events
Products (configurator, variants, revenue splits) · cart + orders + Stripe (direct charges, Connect, refunds) · booking engine (slot generation, conflict/harmonic resolution, reschedule) · events with registration · reviews (Google Places import) · membership plans + gated member dashboards · site templates (`apply_site_template`: church, fitness).

### Content & Works
Page/post CMS (block-based renderer) · the **Card Stage** (directive cards, page-published triggers, generated-media attachments) · the **Illustrated Primer / Library** (Works + progress + TTS + offline reading) · media library on Cloudflare R2 (zero-egress, direct upload, large video) · progressive media analysis (Claude Vision, PDF extraction, RAG).

### Federation & economy
Constitutional federation (trust chain, catalog gossip via Street Signs, data-portability "suitcase", Ed25519 governance) · Angel Token economy (backed AT / social KC / governance LT, Ledger + Wallets) · Ultimate Fair Split (maker economy) · Justice Fund (5% allocation, grants) · Guardian Angel provisioning (free per-gmail angels, metered overage) · distributed mesh (workload engine, pheromone grid, sentinel election, cascading failover).

### Reentry & community verticals
Church / gym / market templates over one engine · `verify_address` (residency-restriction proximity checker for reentry housing) · guardian dashboard (service discovery, case management) · quests / gamified workflows.

### Observability & self-healing
Structured error logging (ApplicationLogs) · health endpoint · rate limiting + CSP/HSTS security headers · tenant caching (pool-exhaustion guard) · error boundaries · telemetry in message metadata.

---

## Quick Start

Full env + bring-up is in **[`AGENTS.md`](AGENTS.md)**. The short version:

```bash
pnpm install
cp .env.example .env         # set DATABASE_URI + PAYLOAD_SECRET (the only hard requirements)
pnpm dev                     # → http://localhost:3000
```

Add a media store (Blob or R2), an AI key (for Leo), and email (for OTP) as you need them — Angel OS degrades gracefully without them (config-free for the 99%).

```bash
pnpm test:unit   # ~5,500 vitest unit tests (the gate)
pnpm test:int    # boots Payload (~23s)
pnpm test:e2e    # Playwright
```

Builds run `payload migrate` first, so migrations auto-apply on deploy.

---

## Architecture

- **Data** — ~42 Payload collections (Spaces, Channels, Messages/UMS, Products, Orders, Bookings, Events, Tenants, Endeavors, …). Migrations in `src/migrations/`.
- **Leo** — `ai-gateway.ts` (routing) → `leo-stream.ts` (SSE + tool loop) → `leo-data-tools.ts` (the tool registry; `executeToolCall` is the single chokepoint).
- **Engines** (zero Payload imports, edge-ready) — orderRouting, logistics, pheromone, workload, booking, federation, guardian, justice-fund, tenantCache.
- **AI Bus** — constitutional message routing with visibility levels; SSE broadcast; nodes are channels.
- **Key dirs**: `src/collections/` · `src/endpoints/` (`-ops` suffix convention) · `src/utilities/` (engines + Leo tools) · `src/blocks/` (page blocks) · `src/app/[locale]/(dashboard|app|payload)/`.

See [`docs/`](docs/) for deep dives (large — being progressively consolidated).

---

## Repos

- **Core** — this repo · [github.com/The-Angel-OS/angels-os](https://github.com/The-Angel-OS/angels-os) · prod: [spacesangels.com](https://www.spacesangels.com)
- **Merlin** — [github.com/The-Angel-OS/merlin](https://github.com/The-Angel-OS/merlin)

*Part of the Angel OS ecosystem · The whole point of existence is to learn to love (Answer 53). · Ad Astra*
