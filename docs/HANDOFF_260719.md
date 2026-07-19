# Handoff — 260719 (for the next dev thread)

> Ken is continuing from his phone in a fresh thread; this session went persistently disconnected. This is the baton. Read `docs/STATE_OF_THE_ANGEL_OS.md` for the full picture; this doc is "how to continue + what's hot."

---

## How to work on this node (read first)

- **The node is self-hosted in Docker** on Ken's box, public via cloudflared at `*.payloadnuke.com`. Postgres + Core containers (`angelos-pg`, `angelos-core`).
- **You (Claude) CAN deploy it yourself** — Docker is reachable from the Bash tool (`docker exec/logs/compose` all work). Deploy = **`cmd.exe //c "C:\Dev\datacenter\stack\rebuild.cmd"`** (~5 min: build image → recreate container → migrations on boot → curls local/www/tenant health = 200). Don't hand rebuilds back to Ken; run them.
- **Rebuild builds from the local working tree** on `main` — so committed (even unpushed) work goes live on payloadnuke. This is the fast dev loop.
- **⚠️ DO NOT `git push origin main` without Ken's OK** — main carries `1bd794a` (CORS de-couple) which auto-deploys his **kendev.co / spacesangels.com** commercial prod (Vercel). Local rebuilds don't touch those; a push does.
- **Test gate:** `pnpm test:unit`. Typecheck: `npx tsc --noEmit 2>&1 | grep -c "error TS"` — baseline has ~98 pre-existing errors in `tests/`; only care about `^src/` ones (should be 0).
- **Temporal-stamp replies** `YYMMDD ~HHMM Name —`; CTO-autonomy (decide, do it, commit); prefer a LEO tool for any action.

## Git state

- `main` HEAD = **`122ca38`**, **9 commits ahead of `origin/main`** (`43f7d5e`). Unpushed on purpose (CORS). Live on payloadnuke, NOT on GitHub/Vercel.
- Unmerged feature branches worth knowing: **`feat/onboarding-reception`**, **`feat/active-endeavor-switch`**, **`feat/bookable-inventory`** (the three that converge into the coupling spine). Ignore the stale `feat-works-*`.

## This session's shipped work (all live on payloadnuke)

- **Clearwater fixes** (`44779aa`/`fc7aa25`): shop pagination, Book nav (fallback-aware `hasBook`), services dashboard seed, `/products`→`/shop` rewrite, **Soul Van** bookable service.
- **Media chat-attachment tenant fix** (`551d493`): attachment tenant follows the space, not the cookie (was breaking uploads).
- **Spaces routing** (`199ce05`): bare `/dashboard/spaces` → tenant's default space, not platform `'1'`.
- **Vercel analytics gated** (`d36c665`) to `VERCEL===1` (was 404-spamming the console off-Vercel).
- **Appointments Calendar view** (`2345d1a`): List/Calendar toggle, month grid.
- **payloadnuke = first-class platform apex** (`43f7d5e`) + **federation de-coupled** (`1bd794a`): CORS env-driven (`CORS_ORIGINS` + self-allow from `NEXT_PUBLIC_SERVER_URL`), EndeavorBrowser discovers peers from the `federation-peers` DB, no hardcoded node domains.
- **AI provider resilience** (`603906e`/`bc5169e`/`18498b3`/`cc32402`): image-gen + vision + text all fail-soft/fail-up over the ONE `providerHealth` breaker (keys namespaced `image:<provider>`); `IMAGE_PROVIDER` env override; native Gemini `generateContent` path.
- **Payments hardening** (`c72e28c`): clear "STRIPE_SECRET_KEY missing" error + lazy key resolution.
- **Dashboard cleanup** (`122ca38`): hid The Network / The Federation (behind `NEXT_PUBLIC_SHOW_FEDERATION`, off) + Welcome banner (unseeded-only).
- Docs: `STATE_OF_THE_ANGEL_OS.md`, `design/IDENTITY_GRAPH.md`.

## HOT: pending Ken decisions (blockers)

1. **Push `main`?** — 9 commits incl. CORS. Set `CORS_ORIGINS` on kendev/spacesangels Vercel first if they cross-call, then push.
2. **Identity graph — Person schema shape.** Design doc: `docs/design/IDENTITY_GRAPH.md`. **LOCKED:** magic-link-to-anchor confirm; platform-native id + email/phone co-equal anchors; link-on-confirm. **OPEN (Ken discussing):** `users`-as-Person vs a **separate `people` collection**. My revised rec = **separate `people`, introduced additively** (because a Person must exist *before* a login and *without* an email — the phone-only Craigslist vendor). Awaiting his yes to build.
3. **spacesangels checkout** still broken — its Vercel `STRIPE_SECRET_KEY` shows "Needs Attention" (likely empty). Ken re-enters it on that Vercel project.
4. **`.env` / `.env.local` consolidation** — they'd drifted (Stripe + Cloudflare were only in `.env`, which the container didn't read → checkout + image-gen were dead). **Fixed** by compose now reading both (`C:\Dev\datacenter\stack\docker-compose.yml`). Rec: keep two files with roles — `.env` = full canonical secrets, `.env.local` = local overrides only (trim its ~22 duplicates). Ken drives moving secret values.
5. **Domain** — payloadnuke.com is a placeholder; gut picks `angelos.app` / `halo.build`. Tech works on any apex now.

## Now-working / verified this session

- **Checkout** — Stripe key reaches the container (verified 107-char key present); Ken to re-test his cart on payloadnuke.
- **Image-gen via Cloudflare Flux** — WORKS end-to-end (`IMAGE_PROVIDER=cloudflare` + token now in container). Generated `docs/marketing/artifacts/campaign/cadillac/cadillac-cts-flux.png`. Gemini image models hard-429 (daily quota) — Flux is the node's image path.

## Next work (from STATE doc, prioritized)

1. **Identity graph schema** (P0) — once Ken confirms `people`-vs-`users`. Build: `people` + anchors + `identities` credential table + `users.person` link + backfill op (all additive), then the link-on-confirm resolution + OIDC generalization (Apple/MS/LinkedIn) + SMS-OTP.
2. **Coupling spine** (P0) — one primitive, two doors (authed-user reception + claim-token from a seeded endeavor). Converge the three unmerged branches.
3. **Prove the earn loop** end-to-end (voice → configure → sell) on payloadnuke.
4. **Acquisition funnel** — seed endeavor from a Craigslist/listing (reuse the housing-search CL parser) → perfectly-usable services site → claim = couple. Compliance guardrail: CAN-SPAM email OK; unsolicited SMS = TCPA risk.

## Gotchas (don't re-learn the hard way)

- New collection/field needs a migration; after adding a collection run `GET /api/provision-ops/db-repair-locks`. Container runs `migrate` (not push) on boot.
- Submit relationship ids as `Number()` (multi-tenant `filterOptions` compares in JS). `limit:0` = unlimited.
- `providerHealth.ts` is THE canonical AI circuit breaker — don't make a second one.
- A key that's only in `.env` (not `.env.local`) — container now reads both, but keep this in mind.
- Payload parked on 3.77 (3.85 broke Vercel). Railway is the near-term durable target.

## Key docs
`docs/STATE_OF_THE_ANGEL_OS.md` · `docs/design/IDENTITY_GRAPH.md` · `docs/strategy/BOOKABLE_INVENTORY_PLAN.md` · memory `MEMORY.md` (auto-loads).
