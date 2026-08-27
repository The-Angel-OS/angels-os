# angel-node-01 — operating notes for Claude Code running ON this box

You are on the ThinkPad itself, not on Ken's Windows desktop. That changes what
is yours to do. Deploy target for the PLATFORM is still Railway; this box is a
second node.

**Ken is CEO, you are CIO.** Temporal-stamp replies `YYMMDD ~HHMM Name —` top and
bottom. Ponytail mode: the laziest thing that actually works. Decide and act on
the obvious; ask only where being wrong is expensive.

The full picture — hardware, history, every scar — is in the repo at
`docs/selfhost/thinkpad/NODE_CONFIG.md`. Read it before anything structural.

## What is yours, and what is not

**Yours (do it here):**
- Anything under `/opt/angelos` — compose, tunnel, backups, restores.
- `docker compose` up/down/logs, `journalctl`, systemd units.
- The Plasma session: KRdp, display, drivers, desktop packages.
- Restoring a database dump and running the repair endpoints after it.

**NOT yours (belongs on the 32 GB desktop or in CI):**
- **Building the Core image.** `next build` needs more headroom than this whole
  machine has. It will thrash, then OOM, then someone will wrongly conclude the
  hardware is too small. The image arrives prebuilt:
  ```bash
  # on the desktop:
  docker build -t angelos-core:local C:/Dev/angels-os
  docker save angelos-core:local | gzip | ssh -i ~/.ssh/angel_node angel@<node> 'gunzip | docker load'
  ```
- **Deploying the platform.** Live is Railway (`railway up -s Core --detach`).
  Nothing you do here reaches the 22 live portals.

## The hard rules

⚠️ **This node is NOT production.** Railway serves `*.spacesangels.com`. This box
serves a RESTORE on `node01.spacesangels.com` — same tenants, same content, a
different database. Two admin panels that look identical. The blue `ENV_LABEL`
strip tells them apart — but ONLY inside the admin panel after sign-in.

⚠️ **`COOKIE_DOMAIN` is the HOST, never `.spacesangels.com`.** An apex cookie
would be sent to Railway too, and against a restored database the same session
id means a different user row. Do not "fix" this to match the desktop stack.

⚠️ **Compose INTERPOLATES `env_file`.** Any secret containing a `$` is silently
blanked — measured here: 17 characters raw, 0 in the container. Every env_file
entry must be:
```yaml
env_file:
  - path: /opt/angelos/.env.local
    format: raw
```

⚠️ **postgres:18 wants the volume at `/var/lib/postgresql`**, one level ABOVE the
classic `/var/lib/postgresql/data`. Mount the old path and it refuses to start,
citing data it cannot use — even on an empty volume.

⚠️ **Never break your own uplink without a self-cancelling guard.** Wi-Fi is the
only link. A rollback timer must be cancelled by the script's own connectivity
check, not by a human on the next round-trip — an `ssh host 'bash -s'` heredoc
dies with the connection, which is how a working migration got auto-reverted on
260826. You are running locally, so you have more rope here than a remote
session does; use it carefully anyway, because Ken may not be at the keyboard.

⚠️ **Verify destructive results by RE-QUERYING.** Never trust a success message
for a delete or a restore.

## Current state (260826)

| | |
|---|---|
| Postgres 18 | ✅ `angelos-pg`, 127.0.0.1:5432 |
| PgBouncer | ✅ `angelos-pgbouncer`, 127.0.0.1:6432, transaction mode |
| Core | ✅ up — image loaded, /api/health 200, public 200 |
| Database | ✅ restored — 22 tenants, 26 users, 6 works, 4,697 messages |
| Cloudflare tunnel | `angel-node-01` → `node01.spacesangels.com`, script at `/opt/angelos/tunnel-setup.sh` |
| Wi-Fi | NetworkManager-managed on purpose; the `99-angel-unmanaged.conf` fence is DELETED and must stay so |
| KRdp | autostart on; shares the RUNNING Plasma session, so a reboot needs a console login first |
| ufw | inactive — every service port is bound to 127.0.0.1 and the tunnel is the only ingress |

## Done as of 260827 — the node serves

Tunnel up (4 edges, enabled at boot), database restored, Core running, and
`https://node01.spacesangels.com` returns 200 through the tunnel.

Still open: `db-repair-sequences` (id sequence drift is guaranteed after any
restore) and `db-repair-locks`, both needing `CRON_SECRET` from
`/opt/angelos/.env.local`. Then Merlin, which wants a clone + `npm ci` +
`npm run build` + a systemd unit, and an ingress entry in
`/etc/cloudflared/config.yml` above the catch-all.

Verify identity by asking the CONTAINER, not the page: `docker exec angelos-core
printenv | grep -E 'ENV_LABEL|DATABASE_URI'`. A DATABASE_URI pointing at
`pgbouncer` is the local restore by definition — there is no network path from
here to Railway's database. The blue ENV_LABEL strip is mounted at
`admin.components.beforeNav`, so it renders ONLY inside the admin panel after
sign-in; its absence on the public site or the login screen means nothing.

## Repo conventions that still apply here

- Test gate is `pnpm test:unit` (bare `vitest run` boots Payload and cascades
  into timeouts). Three tests flake under load and pass on retry:
  `sprint19/vapiWebhook`, `sprint44b-endeavor-truncation`, `sprint6-commerce`.
- Never edit an applied migration — new column, new file.
- A new collection needs its `<slug>_id` column on `payload_locked_documents_rels`
  or every admin save fails.
- `limit: 0` means UNLIMITED. Count-only reads use `payload.count()`.
- Don't send non-ASCII through curl; pass text as a parameter or a UTF-8 file.
