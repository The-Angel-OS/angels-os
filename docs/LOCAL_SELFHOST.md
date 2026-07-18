# Local self-host — build & run the whole stack

Angel OS Core runs **self-hosted on Ken's always-on Windows laptop**, in Docker,
public over HTTPS at `*.payloadnuke.com` via a Cloudflare tunnel. This is the
cost-saving primary; Railway is the paid failover; `spacesangels.com` is still on
Vercel until its DNS is cut over. **No cloud build step is needed to ship a change.**

## TL;DR — ship an edit

```
edit code in  C:\Dev\angels-os
run           C:\Dev\datacenter\stack\rebuild.cmd
```

That rebuilds the Core image, restarts the container (which auto-runs DB migrations
on boot), and prints health for localhost + `www` + a tenant. Your change is live at
`https://www.payloadnuke.com` in ~1–3 min. Postgres and the tunnel are left running.

Equivalent by hand:
```bash
cd C:\Dev\datacenter\stack
docker compose up -d --build core
```

## The pieces (all on the laptop)

| Container / task | What | Notes |
|---|---|---|
| `angelos-pg` | Postgres 17 — DBs `angels` (spacesangels tenants) + `kendev` | volume `angelos_pgdata`; `restart: unless-stopped` |
| `angelos-core` | Core (this repo's `Dockerfile`) → `angels` DB | `:3000`; `restart: unless-stopped` |
| `AngelOS-Tunnel` | cloudflared `merlin` tunnel → `*.payloadnuke.com` → Core | boot-time **SYSTEM Scheduled Task**, no login needed |

Compose file: `C:\Dev\datacenter\stack\docker-compose.yml`. Secrets come from this
repo's `.env.local` (via `env_file`); the compose `environment:` block overrides
`DATABASE_URI` (→ local pg), `NEXT_PUBLIC_SERVER_URL=https://www.payloadnuke.com`,
`COOKIE_DOMAIN=.payloadnuke.com`, `DEFAULT_TENANT_SLUG=platform`, `DATABASE_SSL=false`.

**How a tenant resolves:** Core matches the host's first label against a tenant
`slug` (`fetchTenantByDomain`), so `clearwater-cruisin.payloadnuke.com` serves the
Clearwater tenant regardless of the apex. `www` / apex / unmatched → the `platform`
tenant (via `DEFAULT_TENANT_SLUG`).

## First-time setup (fresh machine)

1. **Docker Desktop** installed + set to start automatically.
2. **Postgres container** with the prod data:
   ```bash
   docker volume create angelos_pgdata
   # bring up pg from compose (uses PGUSER/PGPASS from stack/.env)
   cd C:\Dev\datacenter\stack && docker compose up -d postgres
   # restore dumps (from a backup bundle or a fresh IONOS pull — see below)
   docker exec angelos-pg createdb -U postgres angels   # if not present
   docker exec angelos-pg pg_restore -U postgres -d angels --no-owner --no-acl /tmp/angels.dump
   ```
3. **cloudflared** authed (`cloudflared tunnel login` once) with the `merlin` tunnel
   creds in `C:\Users\kenne\.cloudflared\` + `config.yml` (ingress `*.payloadnuke.com`
   → `http://localhost:3000`). DNS: `cloudflared tunnel route dns merlin "*.payloadnuke.com"`.
4. **Auto-start the tunnel** (elevated, one time):
   ```
   schtasks /create /tn "AngelOS-Tunnel" /tr "C:\Dev\datacenter\stack\run-tunnel.cmd" /sc ONSTART /ru SYSTEM /rl HIGHEST /f
   schtasks /run /tn "AngelOS-Tunnel"
   ```
5. `rebuild.cmd` to build + start Core.

## Operate

```bash
docker logs -f angelos-core                 # Core logs
docker compose restart core                 # restart without rebuild
docker exec -it angelos-pg psql -U postgres -d angels   # DB shell
docker compose ps                           # what's up
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel info merlin   # tunnel connectors
```

## Backups & fresh data pull

- Recurring dump: `scripts/_local/backup-db.ps1` (+ `register-backup-task.ps1`, 3h).
- Fresh pull from live IONOS prod (direct `:5432`, **not** the `:6432` pooler —
  pg_dump can't go through PgBouncer): `sslmode=disable`, same `postgres` creds as
  `.env.local`'s `DATABASE_URI`. Restore = stop core → `dropdb --force` + `createdb`
  → `pg_restore` → start core.

## Gotchas

- **Google login** needs correct `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in
  `.env.local`; `redirect_uri` = `https://www.payloadnuke.com/api/auth/google/callback`
  (register it in the Google console). Reload with `docker compose up -d core`.
- **New collection/field** → generate a migration (container runs `payload migrate`
  on boot, not `push`). ⚠️ auto-gen currently trips on pre-existing MCP-column drift;
  hand-write the migration to isolate it.
- The Windows **cloudflared *service*** is intentionally **Disabled** (its bare
  ImagePath won't run a tunnel) — the SYSTEM Scheduled Task is what serves.
- **Apex → www**: needs a Cloudflare dashboard Redirect Rule (the apex DNS record
  won't yield to `cloudflared tunnel route dns`).
