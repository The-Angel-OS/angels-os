# Angel OS — Session Handoff (2026-06-07b)

You are Claude Code (Opus 4.8), CTO mode: autonomous, make it work, **push to main
when done** (Vercel auto-deploys both nodes). Repo: `C:\Dev\angels-os` (multi-tenant
Payload 3.77 + Next 16 + Postgres). Read the auto-loaded memory first — especially
`project_auth_context_refactor.md`, `project_comms_layer.md`,
`project_federation_diocese_model.md`, and `project_ai_provider_system.md`.

## Standing rules (non-negotiable)
- **`pnpm build` must pass before every commit.** Push to main = prod deploy to
  BOTH nodes.
- **⚠️ BUILD EXIT-CODE GOTCHA (learned the hard way this session):** Next prints
  "✓ Compiled successfully" and THEN type-checks/lints — a type error still fails
  the build *after* that line. Also `pnpm build | tail` masks the real exit code
  (you get tail's 0), and `grep -c …` returns exit 1 on zero matches (false
  "failed"). ALWAYS capture the real code: `pnpm build > /tmp/b.log 2>&1; echo
  "EXIT=$?" > /tmp/b.exit` then read the exit file + `grep -c "Compiled successfully"`.
- **Local dev against prod DB safe ONLY with `PAYLOAD_SKIP_PUSH=true`** (.env.local).
  `.env.local` → kendev DB; flip db name to `angels` to verify Node A.
  Bring up ONE dev server via `preview_start` (lands :3001; Nimue owns :3000).
- **SCHEMA DISCIPLINE = #1 outage risk.** (1) new `select`-enum value = a prod
  `ALTER TYPE … ADD VALUE` on BOTH DBs before/with deploy (prefer storing config
  in existing `json` fields). (2) new collection needs its table + the
  `<slug>_id` column in `payload_locked_documents_rels` on each prod DB. Keep
  writers fail-soft. DB helper: `node scripts/_local/<x>.mjs`
  (pg at `node_modules/.pnpm/pg@8.16.3/...`; the gotify enum add script is a
  template: `scripts/_local/add_gotify_connector_enum.mjs`).
- Two live nodes: `spacesangels.com` (DB `angels`, Vercel `angels-os`) ⇄
  `federation.kendev.co` / `*.kendev.co` (DB `kendev`, Vercel `angels-os-kendev`),
  same IONOS PG (74.208.87.243).
- Don't blast 500 cold/disposable invites — domain-reputation risk (see below).

## THE recurring theme — fragmented per-surface auth/tenant resolution
Many bugs this session were ONE root cause: each page/action/endpoint resolved
"who + which tenant + what may they do" its own way, and the hand-rolled
`x-tenant-id || DEFAULT_TENANT_SLUG || 'default'` lacked a domain fallback → broke
on the federation **apex** (federation.kendev.co has no subdomain header). The
durable fix is the **PortalContext** refactor.

- **Plan + audit:** `docs/architecture/AUTH_CONTEXT_REFACTOR.md` (Oqtane SiteState
  model — Shawn Walker's, where we're headed; DNN PortalSettings as fallback;
  Oqtane↔DNN↔AngelOS mapping; the 5 current auth patterns; phased migration).
- **Foundation SHIPPED (Phase 0):** `src/utilities/portalEntitlements.ts` (pure
  `computePortalEntitlements` — single def of admin/owner/can-manage; capabilities
  manageConnectors/manageSpaces/adminPortal; 8 tests) + `src/utilities/portalContext.ts`
  (`resolvePortalContext()` React.cache'd; `requirePortalAccess(ctx, cap)` =
  `[Authorize]`). **NOT yet wired into pages** — that's Phase 1.
- **Interim point-fixes shipped** (all → `resolveTenantFromHeaders`): endeavor
  actions, space-create (+logError on unresolved), contacts/comments/invitations/
  setup actions+page. These unblocked the apex; the refactor generalizes them.
- **Spawned task:** "Execute PortalContext auth refactor (Phases 1–4)" — Phase 1
  migrate layout + account/integrations (proof); Phase 2 sweep admin + add the
  MISSING gate on business-ops pages (orders/products fetch overrideAccess+tenant
  with NO server auth — a real exposure); Phase 3 actions; Phase 4 ESLint
  no-restricted-imports lock.

## What shipped this session (all on main)
- **Page-comment channels on the AI bus** — root cause: Payload `slugField()`
  mangles `:`/`/` so `page:/about` stored as `pageabout` (broke find-or-create +
  channel→messages map). Fix: `channelSlugField` (plain stable key). See
  `project_channel_slug_gotcha.md`. Backfill is self-healing.
- **Gotify connector** (`project_comms_layer.md`) — transmit (`gotifyNotify`),
  receive poll (`/api/gotify/poll`, */5), escalation dispatcher (per-connector
  policy, rate-limit/cooldown; wired from logError for error/warning +
  `user_registered`), probe, AI-Bus `gotify` channel. Test now SENDS a visible
  push (validates send). Operator guide: `docs/integrations/GOTIFY.md`. Enum added
  to both DBs. ⚠️ `linkedin_page` is in code but missing from the prod enum
  (spawned task).
- **Connectors → Account → Integrations** — relocated from /admin, endeavor owners
  self-serve (`src/access/connectorAccess.ts`: non-customer role OR tenant_admin/
  manager; plugin clamps tenant). Server-side secret guard on the page.
  ⚠️ connector-test/health were SHADOWED at `/api/connectors/*` (collection slug)
  → renamed `/api/connector-ops/*`.
- **People IA** — promoted a **PEOPLE** nav section (People → the existing
  tenant-membership manager at /dashboard/admin/team, Contacts, Invitations) out
  of ADMIN; the user manager is now discoverable (no Payload admin needed).
- **People sub-slice (JUST BUILT — verify it committed):** `MemberPanel` now has
  "Search workspace members" → add an existing portal member to the space
  (`GET /api/space-ops/members/candidates`, `POST /api/space-ops/members/add`).
  Mirrors OpenHive's pattern (`reference_openhive.md`).
- **Discovery fixes** — Endeavor vs Enterprise nomenclature ("{N} Endeavors · {M}
  Enterprises on the Network"; Enterprise count from `federation-peers`+self);
  card banners default to the tenant home-page unfurl image (`Pages.meta.image`);
  admission/trust badge (applicant/probation) removed from Endeavor cards
  (it's an Enterprise property — endeavors inherit).
- **Housekeeping** — checked in stranded branches/scripts, regen types, gitignored
  junk, MEMORY.md consolidated under 200 lines (soundtrack + rollup → reference
  files).

## Open / next (pick up here)
1. **People sub-slice finish:** confirm the MemberPanel add-member build is
   committed + pushed. **AI-Bus roster** still shows no users — onboarding gap:
   on signup/OAuth, ensure root tenant-membership + space-memberships to Community
   Hub + the AI-Bus space (deterministic first-run). That's the "lock down new
   user experience" item.
2. **PortalContext Phase 1** (spawned task) — the highest-leverage next build;
   retires the whole "Could not resolve tenant" class.
3. **Federation mesh tier** — design doc `docs/architecture/FEDERATION_PEOPLE_AND_DM.md`
   (DECISIONS RECORDED: federatedPersonId = HMAC-SHA256(normalized email, versioned
   shared salt); visibility = networkVisible-when-configured + admin override;
   trust = inclusive default, hide reactively; relay = best-effort+idempotency
   first). Phases: directory endpoint+consent → People "Network" tab → Discovery
   cross-node aggregation (makes Endeavor count network-wide) → cross-node DM
   relay → LiveKit cross-node rooms.
4. **`ministryStatus` re-grain** — move admission/trust off `endeavors` onto
   `FederationPeers`/Enterprise; endeavors inherit (canonical fix for the badge
   patch). Ties to `project_federation_diocese_model.md`.
5. **Bulk invite the Clerk list** (`Angel OS - Clerk Users Contact List`, ~500) —
   importer fixed; `bulkInvite` ready (tenant_member, no new endeavors = showcase
   model). ⚠️ many disposable addrs → batch + skip disposables + needs an
   email_outbound (Resend) connector (free=100/day). Optional: add a disposable-
   domain/dedup guard to bulkInvite.
6. Framer-motion top-nav (rules-driven from `tenant.commerce.*` flags + per-
   endeavor toggles; framer-motion already a dep) — discussed, not built.
7. Spawned tasks still open: test-suite repair (~30 pre-existing failures),
   wire remaining Gotify escalation events + digest mode, linkedin_page enum,
   PortalContext Phases 1–4.

## User preferences
- Push to main when done. CTO mode autonomous. "Break it and fix it." Headless/
  API-first. Keep documentation + memory synchronized. Use best practices.
- OAuth FYI: Google sign-in occasionally lands on Payload admin on 1st attempt,
  works on 2nd — cookie-propagation race in `/api/auth/complete`; recorded, not
  yet fixed (session hardening should make post-login deterministic).
