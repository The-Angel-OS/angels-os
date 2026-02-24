# Angel OS MVP Blueprint

## Overview

Angel OS is a multi-tenant e-commerce platform with sovereign AI intelligence, built on Payload 3.0 and the "Ultimate Fair" economic model. This doc is the technical blueprint for the MVP — use it alongside the [Constitution](Angel_OS_Constitution.md) and [implementation plan](ZUBRICKS_MULTITENANT_IMPLEMENTATION_PLAN.md).

**Architecture (Feb 2026):** Angel OS = OpenClaw + Angel OS Constitution; this repo is **Angel OS Core** (Payload CMS–powered CMS with widgets/blocks). Each Angel is the configuration storage; OpenClaw UI is not imported here. Future: VAPI.AI-style bots and Twilio (or equivalent) 800 numbers per Angel (e.g. 1-800-Angels with Nimue routing). See [ANGEL_OS_ARCHITECTURE_OVERVIEW.md](ANGEL_OS_ARCHITECTURE_OVERVIEW.md).

## Core Infrastructure ✅

- **Payload 3.0** with official E-commerce template
- **PostgreSQL** via `@payloadcms/db-postgres` (segmented tenant data)
- **Vercel Blob Storage** for media
- **ShadCN UI** + Tailwind CSS
- **Sharp** for image processing

## Multi-Domain (Finly Pattern) ✅

- **Tenants collection** with domain, slug, branding
- **middleware.ts** introspects hostname → injects `x-tenant-id` header
- **@payloadcms/plugin-multi-tenant** (installed, commented out – enable when combining with ecommerce plugin)
- **TENANT_DOMAINS** env: `domain1:slug1,domain2:slug2` for explicit mapping
- **localhost** → `default` tenant

## Sovereign Intelligence (LEO) ✅

- **LEO API** at `/api/leo` (batch) and `/api/leo/stream` (SSE streaming)
- **29 tools** -- query, action, onboarding, production, review, media
- **AI Gateway** -- Vercel AI Gateway for multi-model routing (Claude, Gemini Pro, GPT-4o)
- **Dual-path architecture** -- BYOAI keys → direct SDK; Gateway available → AI SDK; else → Anthropic fallback
- **Vision analysis** -- multi-part image content blocks
- **Constitutional system prompt** -- Nimue/Merlin identity, immutable principles

## Ultimate Fair Economic Engine ✅ (Scaffold)

- **Fee split**: 60% Provider | 20% Platform | 15% Ops | 5% Justice Fund
- **src/lib/ultimate-fair-split.ts** – split calculation
- **src/lib/stripe-connect-config.ts** – Stripe Connect application fee helper
- **Next step**: Custom payment adapter for Stripe Connect with `application_fee_amount`

## Dynamic Provisioning 🚧

- **src/scripts/provision-tenant.ts** – scaffold for LLM handshake
- **Flow**: New domain → LLM generates branding/copy → Create tenant + seed content

## Interface

- **Spaces architecture** (Discord-style chat) – future
- **LEO chatbot** on brochure pages – future
- **VAPI.ai / Twilio** voice bridge – future
- **Posts collection** as source of truth for social automation – add if needed

## Environment Variables

See `.env.example`. Key vars:

- `DATABASE_URI` – PostgreSQL connection
- `PAYLOAD_SECRET` – required for Payload
- `BLOB_READ_WRITE_TOKEN` – Vercel Blob
- `ANTHROPIC_API_KEY` – LEO's brain (direct Anthropic SDK)
- `AI_GATEWAY_API_KEY` – Vercel AI Gateway for multi-model routing (optional, enables Gemini/GPT-4o)
- `LLM_MODEL` – Override default model (aliases: `claude-sonnet`, `gemini-pro`, `gpt-4o`, etc.)
- `OPENROUTER_API_KEY` – Image generation (Flux 2 Pro, Gemini Image, GPT Image)
- `RESEND_API_KEY` – Transactional email via Resend
- `TENANT_DOMAINS` – optional hostname→slug mapping
- `DEFAULT_TENANT_SLUG` – default for localhost (default: `default`)
- `COOKIE_DOMAIN` – Cross-subdomain auth (`.angelos.local` dev / `.spacesangels.com` prod)
- `CRON_SECRET` – Cron endpoint protection

## Scripts

- `pnpm dev` – development (ensure `.env.local` has PAYLOAD_SECRET, DATABASE_URI)
- `pnpm migrate` – run migrations (requires env)
- `pnpm migrate:create` – create new migration
- `pnpm payload migrate` – same as migrate

## CLI Environment

For `payload migrate` and other CLI commands, load env first:

```powershell
$env:PAYLOAD_SECRET="your-secret"; $env:DATABASE_URI="postgresql://..."
pnpm migrate
```

Or use a `.env` file (Payload CLI loads `.env` by default).
