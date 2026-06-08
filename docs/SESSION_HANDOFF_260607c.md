# Session Handoff — 2026-06-07 (late) · Opus 4.8

All work committed + pushed to `main` (0 unpushed). Both Vercel projects auto-deploy
from `main`: **angels-os** (spacesangels.com) and **angels-os-kendev** (federation.kendev.co).

---

## What shipped this session

1. **Header polish** — shadcn `NavigationMenu` (replaced hand-rolled "More" dropdown);
   Angel OS brand glyph `AngelIcon` (replaced the Payload logo); avatar **account dropdown**
   (Dashboard/Account/Logout) + **cart icon w/ badge**; PortalSwitcher now shows the current
   portal **name** (discoverable). Files: `components/Header/*`, `components/icons/AngelIcon.tsx`,
   `components/Cart/OpenCart.tsx`, `components/PortalSwitcher`.

2. **Metered email campaigns** — Contacts admin **Campaign tab**: `sendCampaignChunk` (audience
   filter, dedupe, per-tenant Resend/SMTP, `{{name}}/{{email}}/{{unsubscribe_url}}`, client-paced
   metering), `getCampaignAudience`, public `/unsubscribe/[token]`. New Contacts fields
   (`unsubscribeToken`/`lastEmailedAt`/`emailCount`) + migration. The import already handles
   Clerk export — just drop the file.

3. **Invite-only provisioning + founder seed** — `provisionTenant` + `new-endeavor` gated to
   ADMIN_ROLES (was open to any logged-in user). `FOUNDER_ACCOUNTS` (ken/ty/clearwatercruisin)
   always seeded as super_admins (idempotent; never resets a password).

4. **Repo attribution rewrite** — `kenneth@angelostech.com` (hallucinated) → `Kenneth Courtney
   <kenneth.courtney@gmail.com>` across all 442 commits via filter-branch, force-pushed. 6 extra
   worktrees removed; **angel-client extracted to its own repo** (`../angel-client.bundle`).
   Safety nets parked: `../angels-os-rewrite-backup.bundle`, `refs/original/*`, `backup/*` tags
   (delete once GitHub confirmed good).

5. **Test suite FULLY GREEN** (264 files / 5517 tests). All drift was stale fixtures, not
   regressions: federation heartbeat tests mocked old `endeavors` collection (now `federation-peers`);
   bookingEngine used a hard-coded `2026-03-15` date that expired into the past (now `now`-relative).

6. **Federation Discovery cross-node** — `aggregatePeerHolons` + the **heartbeat-carried-endeavors
   gossip** fix (producer attaches endeavors → inbound caches to `federation-peers.endeavors` →
   consumer reads local; immune to the render-time fetch block). Shared `buildLocalHolons`.
   Filter widened to `not_in [revoked,suspended]` (was a too-narrow allow-list excluding the peer).

7. **Invite flow fixes** — email link now points to the **tenant subdomain** (was apex);
   accept **lands the user inside the tenant**; accept **no longer 504s** (returns after membership
   activation; contact-update + space-join are fire-and-forget); **Resend button** on Team +
   `resendTenantInvitation`. People/Invitations **consolidated** (Team=roster, Invitations=funnel).

8. **DB pool / cron storm fix** — 6 crons all fired on `:00` → connection storm on max=3 pool →
   cascading 500/504s. **Staggered** the cron schedules in `vercel.json`.

9. **Presence (MMORPG-hub Slice 1)** — `Presence` collection (global) + `/presence-ops/ping` +
   `/online`; `usePresence` hook (focus-aware, poll-only mode); status ring on header avatar,
   **"N online"** in public + dashboard headers, online dots + "N online" in the space MemberPanel.

---

## Open / next (priority order)

1. **Verify Discovery shows KenDev.Co** after commit `7145dde` (filter fix) deploys. If not, the
   `[FedDiscShape]` console.warn in `federationDiscovery.ts` logs the exact jsonb shape of
   `peer.endeavors` — read it (query single token "FedDiscShape"; Vercel log search is flaky on
   multi-word) and adjust `coerceEndeavors`. **This is a 5-min finish.** See
   `memory/project_federation_discovery_finding.md`.
2. **Connection pooler** — the REAL fix for the chronic heartbeat 500s: Cloudflare Hyperdrive or
   PgBouncer in front of IONOS Postgres so serverless instances multiplex onto few PG connections.
   (Cron staggering bought headroom; this removes the ceiling.)
3. **Verify the invite loop end-to-end** — send Tyler a FRESH invite (links to
   `clearwater-cruisin.spacesangels.com`), accept should be instant now. Confirm
   `COOKIE_DOMAIN=.spacesangels.com` is set in BOTH Vercel projects.
4. **Presence true per-space counts** — currently the MemberPanel dots = global online ∩ space
   members. For real per-space, thread the active spaceId into the ONE global pinger (ChatProvider).
5. **Generic "sell anything" checkout** — the stated sellable milestone (one-off + subscription,
   not booking/donation-shaped). Plus the Enterprise-shared **lead pool** (solar use case): re-grain
   Contacts to Enterprise + assignment/routing via the dispatch engines.

---

## Gotchas (read before touching these areas)

- ⚠️ **NEVER parallelize Payload writes** (`Promise.all`/`allSettled`) in a request handler — on the
  max=3 pool each create grabs a connection while its hooks need another → deadlock → 504 + cascade.
  Use sequential loops. (This bit us twice on the accept handler.)
- ⚠️ **`pnpm generate:types` is broken locally** on an unrelated `pino` ESM-resolution error (tsx CLI
  only; Vercel/turbopack build is fine). `payload-types.ts` lacks `presence` — endpoints use
  `as never` casts. `tsc --noEmit` is the reliable local check.
- ⚠️ **`pnpm migrate:create` is interactive** + surfaces unrelated `payload_mcp_*` drift — hand-write
  idempotent migrations (modeled on existing ones) + register in `migrations/index.ts`.
- **Vercel log search** truncates the message column + fails on multi-word/special-char queries —
  query single distinctive tokens. Use the Vercel MCP `get_runtime_logs`.
- **Both nodes auto-deploy from `main`** — a push deploys spacesangels AND kendev.
- **Build exit-code gotcha** (prior handoff): `next build | tail`/`grep -c` can mask the real exit
  code — check the actual exit status.

---

## Verification still pending (deploys were in flight at session end)
- Discovery KenDev.Co card (filter fix `7145dde`).
- Tyler's accept is instant (accept fix `919e202`) + resend button works.
- Presence renders (status ring + "N online") once `f88f8c5` deploys; first ping after deploy may
  no-op briefly while dev-push creates the `presence` table.

Memory index: `MEMORY.md`. Key new files:
`project_presence_mmorpg.md`, `project_federation_discovery_finding.md`, `project_session_state_260607.md`.
