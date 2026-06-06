# Angel OS — Deploy Template & Env-Var Audit

**Goal:** "Vercel → template library → The Angel OS → Deploy" with the fewest possible
operator inputs, auto-federating to spacesangels.com. The blocker is the ~40 env
vars in the codebase — but **most of them shouldn't be env vars at all.**

This audit buckets every `process.env.*` actually used in `src/` and assigns each
an action. Net result: the irreducible operator input at deploy is **`DATABASE_URI`
(auto-provisioned) + `PAYLOAD_SECRET` (auto-generated)** — everything else is
generated, derived, a constant, deferred, or entered in the dashboard after deploy.

---

## Bucket 1 — Infra secrets (must exist at boot; auto-provision/generate)

| Var | Action |
|---|---|
| `DATABASE_URI` (`DATABASE_URL` alias) | **Vercel Postgres / Neon Marketplace integration** provisions it at deploy — operator clicks "Add Postgres," types nothing. |
| `PAYLOAD_SECRET` | **Auto-generate** at deploy (random 32+ bytes). |
| `BLOB_READ_WRITE_TOKEN` | **Vercel Blob integration** provisions it. |
| `ENCRYPTION_SECRET`, `ENCRYPTION_SALT` | Auto-generate; `ENCRYPTION_SECRET` already falls back to `PAYLOAD_SECRET` (`utilities/encryption.ts`). |
| `CRON_SECRET`, `PREVIEW_SECRET` | Auto-generate. |

→ **~0 operator typing** if the template wires the Postgres + Blob integrations.

## Bucket 2 — Derived at runtime (Vercel provides; no input)

`NEXT_PUBLIC_SERVER_URL` / `PAYLOAD_PUBLIC_SERVER_URL` / `COOKIE_DOMAIN` derive from
`VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL`. `getURL.ts` **already** has the
fallback chain. Vercel auto-injects `VERCEL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`,
`VERCEL_REGION`, `VERCEL_GIT_COMMIT_SHA`, `NODE_ENV`, `NEXT_PUBLIC_VERCEL_URL`.

→ **Nothing to set.** (One cleanup task: make `COOKIE_DOMAIN` derive from the
deployment host when unset, so subdomain cookies "just work.")

## Bucket 3 — Template-default constants (bake into the template)

| Var | Default |
|---|---|
| `FEDERATION_REGISTRY_URL` | `https://spacesangels.com` — **this is the "auto-federate" wire.** (Alternate: `https://federation.kendev.co`.) |
| `FEDERATION_AGENT_AUTORESPOND` | `false` — **agent-cold start** (see below). |
| `DEFAULT_TENANT_SLUG` | `default` (or the portal slug set at bootstrap). |
| `LLM_MODEL` | a sane default model id. |
| `FEDERATION_ALLOW_UNSIGNED_PINGS` | `false`. |
| `SSE_MAX_DURATION` | default. |

→ **Set by the template, not the operator.**

## Bucket 4 — Move OUT of env → per-tenant dashboard (the big win)

These are already (or should be) stored **per-tenant** in `Tenants.aiConfig`, the
`vapi` group, or the **Connectors** collection — entered in the dashboard *after*
deploy via LEO's setup wizard, NOT as global env:

- **AI:** `AI_GATEWAY_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_AI_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` → `Tenants.aiConfig` (already exists).
- **Email:** `RESEND_API_KEY`, `SMTP_*`, `SYSTEM_EMAIL_*`, `EMAIL_FROM_*` → `email_outbound` Connector (`resolveEmailSender` already prefers it; env is just the fallback).
- **Stripe:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOKS_SIGNING_SECRET` → per-tenant Stripe Connect (already).
- **Voice/realtime:** `VAPI_*`, `LIVEKIT_*` → `Tenants.vapi` / Connectors (see [comms abstraction](COMMS_PROVIDER_ABSTRACTION.md)).

→ **~12 vars deleted** from the deploy surface. More correct, too (per-tenant keys, not one global secret).

## Bucket 5 — Optional features (defer entirely)

Only set when the operator wants the feature: social login (`GOOGLE_CLIENT_*`,
`GITHUB_CLIENT_*`, `DISCORD_CLIENT_*`), `CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`,
Vercel spend telemetry (`VERCEL_TOKEN`/`VERCEL_API_TOKEN`/`VERCEL_TEAM_ID`), Discord
bot (`PAYLOAD_URL`, `PAYLOAD_API_KEY`), `TENANT_DOMAINS`, `MERLIN_PASSWORD` (seed-only).

---

## The agent-cold start (why a node needs ZERO AI keys)

A fresh node deploys with `FEDERATION_AGENT_AUTORESPOND=false` and **routes inference
through the federation** — borrowing thinking from spacesangels.com / kendev (the
distributed-intelligence thesis; `route_federated_request` / `delegate_task` tools
exist). The operator adds their own AI keys later in the dashboard. So a node can be
live and useful with no provider keys at all.

## The bootstrap (post-deploy, the parts already exist)

1. `federation-bootstrap.ts` — generate the Ed25519 identity → signed heartbeat to
   `FEDERATION_REGISTRY_URL` → register as applicant/probation peer.
2. Canonical provisioning + **`ensureTenantSpaces`** — portal tenant, Community space,
   pages, nav (the helpers `provision-portal` already uses).
3. First admin (auto-gen password or set in the wizard).
4. LEO's 17-minute **Enterprise Setup wizard** — branding, AI keys, payments, comms.

First-run gate triggers the bootstrap; the wizard finishes it.

---

## Minimal required at deploy (the headline)

| Required | How |
|---|---|
| `DATABASE_URI` | Vercel Postgres/Neon integration (no typing) |
| `PAYLOAD_SECRET` | auto-generated |

Everything else: auto-provisioned, derived, a template default, deferred, or
entered in the dashboard. **That's the one-click deploy.**

## Next steps to make it real

1. **`COOKIE_DOMAIN` runtime derivation** when unset (small, removes a var).
2. **Template config** (`vercel.json` deploy block / button): declare the two required
   vars with descriptions, wire the Postgres + Blob integrations, default Bucket 3.
3. **First-run bootstrap gate** that chains `federation-bootstrap` → provisioning →
   wizard.
4. A `.env.template` grouped by these buckets (operator sees only Bucket 1–2).
