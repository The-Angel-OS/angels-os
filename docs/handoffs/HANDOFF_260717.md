# Handoff — 260717 (self-host night)

Continuation brief for a fresh session. You are CTO-mode: decide, ship, verify;
temporal-stamp replies `YYMMDD ~HHMM Name —`. Read `AGENTS.md` + `docs/LOCAL_SELFHOST.md`.

## 🏠 THE HEADLINE — the platform is self-hosted on Ken's laptop, public, ~$0/mo

Overnight 260717 we moved the whole thing onto Ken's always-on Windows laptop
(32 GB), in Docker, public over HTTPS at `*.payloadnuke.com` via a Cloudflare tunnel.
Cost play: local = primary, Railway = paid failover, `spacesangels.com` still on
Vercel until its DNS cuts over. Runbook: **`docs/LOCAL_SELFHOST.md`**. Deep state:
memory `project_local_selfhost_stack`.

**Running on the box (all reboot-persistent):**
- `angelos-pg` — Postgres 17, DBs `angels` (13 tenants, incl. clearwater-cruisin/
  grace-chapel/…) + `kendev` (9), **fresh from live IONOS prod**. Volume `angelos_pgdata`.
- `angelos-core` — Core from this repo's `Dockerfile`, `:3000`, → local `angels` DB.
  Env: `NEXT_PUBLIC_SERVER_URL=https://www.payloadnuke.com`, `COOKIE_DOMAIN=.payloadnuke.com`,
  `DEFAULT_TENANT_SLUG=platform`, `DATABASE_SSL=false`.
- `AngelOS-Tunnel` — boot-time **SYSTEM** Scheduled Task runs cloudflared `merlin`
  tunnel → `*.payloadnuke.com` → Core. (Windows cloudflared *service* is Disabled —
  bare ImagePath, never ran a tunnel.)
- Compose: `C:\Dev\datacenter\stack\docker-compose.yml`. **Ship an edit:** `rebuild.cmd`.

**Verified live:** `www.payloadnuke.com` (platform root) + every tenant subdomain
serve 200 over HTTPS; "super fast" on cellular (Cloudflare edge). Google OAuth init
→ 302 with the right `redirect_uri`.

⛔ Claude's shell here is **non-elevated** and can't create scheduled tasks / manage
services — Ken runs those in an elevated PowerShell (both `schtasks` for the tunnel
and the DB uninstall were his). DNS records made via `cloudflared tunnel route dns`
(cert.pem) — the Cloudflare MCP is **Workers-only, no DNS tools**.

## Also shipped this session (feature branches, NOT merged)

- **`feat/active-endeavor-switch`** (3 commits) — the new-user flow keystone:
  validated `active-endeavor` cookie override for smooth in-app portal↔endeavor
  switching (no subdomain reload); `commission_endeavor` lands you inside the new
  endeavor; conversational first-run Circle driver; Google People API contact import
  + `import_google_contacts` LEO tool. All verified. Memory `project_active_endeavor_switch`.
- **`feat/native-site-log`** (uncommitted) — self-hosted per-Endeavor analytics (the
  DNN site-log replacement). Slice 1 written + typechecks: `page-views` collection,
  cookieless `/api/site-log/collect` beacon (CF-geo enriched), `<SiteLogBeacon>` in
  the (app) layout. **Paused**: migration auto-gen tripped on pre-existing unrelated
  MCP-column drift — hand-write the `page-views` migration. Then slice 2 = rollup +
  prune jobs (Ken wants this), slice 3 = per-tenant dashboard.
- **main**: `0ca9e2f` fix — per-item remove (×) button on the checkout order summary
  (deployed to Vercel).

## Open threads (none blocking; the platform is up)

1. **Google login click-through** — creds fixed + loaded; Ken to confirm the full
   round-trip on `www.payloadnuke.com` completes.
2. **Apex `payloadnuke.com` → `www`** — Cloudflare dashboard Redirect Rule (apex DNS
   record won't yield to the tunnel CLI).
3. **Native Site Log** — finish the migration → rollup/prune → dashboard.
4. **`SYSTEM_EMAIL_PASSWORD`** has a `$` that docker-compose interpolation blanks —
   pass via a literal env-file so OTP emails work.
5. **Ancillary services** (Merlin/Gotify/Uptime-Kuma = the kendev.co surface) into the
   compose stack + tunnel ingress.
6. **New-user flow** — merge `feat/active-endeavor-switch` once the Nimue Card Stage
   port lands.
7. **Railway** stays the warm failover; when the IONOS $80 clears, add `spacesangels.com`
   as a second custom domain for a soft cutover, then cancel Vercel + IONOS.

## Durable gotchas (hard-won)
- IONOS box is **Core's DATABASE**, not Core (Core is/was on Vercel). Losing it = Core
  loses its DB. Fresh dumps: IONOS `:5432?sslmode=disable` (NOT `:6432` PgBouncer).
- New collection/field needs a **migration** (container runs `migrate`, not `push`).
- Tenants resolve by **subdomain-slug** regardless of apex — the reason `*.payloadnuke.com`
  Just Works.
