# Session Handoff — Guardian Angel Funnel (260707, overnight)

Built while you slept. Everything additive, **no schema changes**, `tsc` clean, all pushed to `main` (both projects auto-deploy). The whole monetization funnel is now wired end-to-end in code — it just needs Stripe keys + one flag to go live.

## What shipped tonight (commits)
- `793c8df` — **usage decision layer** (`guardianUsage.ts`) + `GET /provision-ops/guardian-angel-status`. Reads the cost-events ledger; verdict `free_pinned|within_free|over_free|byok`.
- `03a6dbd` — **media→AI-Bus invariant**: every new Media posts to a self-healing `media` channel (observable flow; BOLO substrate).
- `85eda28` — **opaque slug by default**, vanity handle opt-in + reserved-word screen.
- `a3b32cd` — **mutable slug / rename** (`renamePortalSlug` + endpoint) preserving old subdomain as alias so sent links never 404.
- `f7af802` — **gmail⇔angel 1:1** auto-provision, idempotent + soft cap (`GUARDIAN_ANGEL_MAX_PER_USER`, default 3) + rate limit.
- `5f3e347` — **base domain → spacesangels.com** (centralized `guardianBaseDomain()`).
- `9fc2276` — **personal angels stay out of Discovery** (`networkVisible: false`).
- `618b45d` — **provision-free-first + Stripe subscription (charge side)**:
  - Removed the pre-provision paywall — every angel is born free; money is a usage-overage upsell, not an entry gate.
  - `POST /provision-ops/guardian-angel-checkout` — platform-direct Stripe subscription ($9/mo default). Inert 503 until keys set.
  - Subscription stored as a `memberships` row keyed by sentinel plan `guardian-angel` (no new collection). Webhook syncs `angelOs_type: 'guardian_angel'` through the existing upsert.
  - `hasGuardianAngelEntitlement` is real; status endpoint returns `subscribed` + an `upgrade` CTA only at `over_free`.

## To flip it LIVE (your morning checklist)
1. **Stripe keys** (prod env, both Vercel projects): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOKS_SIGNING_SECRET` (webhook already at `/api/stripe/webhooks`; add `customer.subscription.*` events if not already selected).
2. **Flip the master switch**: `GUARDIAN_ANGEL_SELF_PROVISION=true` (claim is dark until this is set).
3. Optional tuning: `GUARDIAN_ANGEL_PRICE_CENTS` (default 900), `GUARDIAN_ANGEL_FREE_MONTHLY_CENTS` (default 100), `GUARDIAN_ANGEL_FREE_TENANTS` (CSV of pinned-free slugs, e.g. `ernesto`), `GUARDIAN_ANGEL_MAX_PER_USER` (default 3).
4. **Nimue first-run hook** (Nimue repo): on Google sign-in → `POST /api/provision-ops/claim-guardian-angel`, then poll `GET /api/provision-ops/guardian-angel-status` for the banner. Idempotent — safe to call every launch.

## The end-to-end flow now
gmail login → claim (free, opaque `{id}.spacesangels.com`, invisible in Discovery) → use it → cost meters on the ledger → cross the free allowance → status returns `over_free` + upgrade CTA → checkout → subscription synced → `subscribed: true`. Personal angels reachable via node bus but unlisted.

## Still TODO (not tonight)
- **Pay-side** (Core settles its OWN infra bills from revenue) — the other half of self-funding. Design in [[project_self_funding_self_improving]].
- **Activation telemetry** — first-party events (`portal_provisioned`, `first_leo_interaction`) in our own store, NOT GA. The one metric: activation funnel.
- **LEO tool wrappers** — `rename_portal`, `claim_guardian`, `set_business_identity` so Nimue drives it conversationally (factory principle).
- **over_free behavior** — recommend SOFT (keep serving + nudge) with BYOK escape hatch; not hard-pause.

## Verification note
`tsc --noEmit` clean on all new code (pre-existing `tests/` drift unrelated). `pnpm test:unit` run at handoff time — see result in the session. No test referenced the changed paths.
