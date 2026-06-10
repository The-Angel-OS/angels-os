# Destructive Operations — registry, guards, and audit

A catalog of every operation that can irreversibly destroy or overwrite data, its
guard, and its status. Born from the 2026-06-10 audit after the "Seed Now" footgun
(a tenant-admin on the live kendev node was one click from wiping all tenants).

**Rule of thumb:** any operation that deletes across tenants, overwrites arrays
wholesale, or resets state must (a) be super_admin-gated, (b) refuse when real data
exists unless explicitly forced, and (c) never be advertised by a fragile
"looks empty" heuristic.

---

## FIXED (2026-06-10)

### Seed — global wipe-and-reseed  🔴 was critical
- **Where:** `src/app/[locale]/(app)/next/seed/route.ts` → `src/endpoints/seed/index.ts`
- **What:** `payload.db.deleteMany({ where: {} })` across spaces/channels/messages/
  tenant-memberships/products/posts/pages/… **globally, all tenants**, then reseeds
  the `default` sample tenant.
- **Was:** reachable by any admin (Tyler, super_admin on kendev); a misleading
  "database hasn't been seeded yet" banner invited the click.
- **Now:** server route refuses with **409** when `dataSignal !== 0` (real tenants
  OR any spaces/products/tenant-memberships). Multiple signals so a partial delete
  of one collection can't fake "empty". super_admin may override with `?force=true`
  (eyes-open). The misleading banner is suppressed (see below).

### WelcomeBanner false "not seeded"  🟠 UX footgun
- **Where:** `src/app/[locale]/(dashboard)/dashboard/page.tsx` (`isSeeded`)
- **Was:** `isSeeded = stats.spaces > 0 || stats.products > 0` — TENANT-scoped, so on a
  provisioned node it showed "not seeded" + a destructive Seed button whenever the
  *current* tenant happened to be empty.
- **Now:** node-aware — `|| nodeHasData` (real tenants or any spaces on the node).
  The destructive seed banner no longer appears on a live node.

### findOrCreateUser — role clobber  🟡 medium
- **Where:** `src/endpoints/seed/seed-helpers.ts` (~L151)
- **Was:** existing user's `roles` overwritten with the seed's base set → silent
  downgrade of custom/elevated roles.
- **Now:** union merge (`[...existing, ...incoming]`) — never downgrades.

---

## DEFERRED (documented, fix with integration tests — do NOT change blind)

### Seed deleteMany is unscoped (defense-in-depth)
- **Where:** `src/endpoints/seed/index.ts:~205-229`
- **Issue:** even behind the route guard, the deletes use `where: {}` (all tenants).
- **Why deferred:** scoping to `defaultTenantId` changes seed semantics (platform
  tenant, system agents may not be default-scoped); needs the integration seed test
  to verify nothing the seed recreates is left orphaned. The route guard already
  prevents this running on a populated node.
- **Fix when ready:** scope each delete to the default tenant, or split "reset
  default tenant" from "fresh bootstrap" explicitly.

### update-all-nav — iterates ALL tenants, concurrent deletes
- **Where:** `src/endpoints/update-all-nav.ts`
- **Guard:** super_admin only (acceptable reachability).
- **Fix when ready:** add `?tenant=<slug>` scoping + `?dryRun=true`; make duplicate
  deletion sequential with per-doc logging.

### ensure-page-channels — naive "Page:" name match  ✅ dry-run added
- **Where:** `src/endpoints/ensure-page-channels.ts`
- **Guard:** super_admin or `?key=CRON_SECRET`.
- **Issue:** deletes channels whose name starts with "Page:" but slug is malformed —
  a legit "Page: FAQ" channel could be culled on the next cron run.
- **Done:** `?dryRun=true` reports `deletedChannels[]` (id/name/slug) per tenant and
  mutates NOTHING (skips delete + create + reparent) — preview before running.
  Default deletions also now report `deletedChannels[]` for visibility.
- **Still open:** a positive discriminator for auto-generated vs hand-named "Page:"
  channels (e.g. a type/flag) so the match can't false-positive at all.

### setup wizard re-trigger heuristic
- **Where:** `src/app/[locale]/(dashboard)/dashboard/setup/actions.ts` `checkSetupRequired`
- **Status:** already flag-first (`setup.wizardComplete` wins); content-count is a
  documented fallback for pre-flag tenants. Low risk — leave unless it misfires.

---

## Checklist for any NEW destructive operation
1. super_admin (or `?key=CRON_SECRET`) gate.
2. Refuse on populated state unless `?force=true` — fail SAFE if state can't be read.
3. Tenant-scope deletes; never `where: {}` unless provably on a fresh DB.
4. Merge arrays/roles, don't clobber.
5. No fragile "looks empty" heuristic may advertise it (use node-level signals).
6. Offer `?dryRun=true` + log what would change for bulk/cross-tenant ops.
