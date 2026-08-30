# Angel OS — start here

Loaded automatically every session. **This file is the current state of the stack.**
If something here is wrong, fix it here in the same commit as the change that made it wrong.

Handoffs in `docs/handoffs/` are journal entries — a point in time, never the present.
`docs/GLOBAL_PUNCH_LIST.md` is the living issue board. Read that second.

---

## Where production runs, right now

**`*.spacesangels.com` is served by `angel-node-01`, a ThinkPad T440s on Ken's desk.**
Railway's trial expired on 260827; the account is **demoted**, `railway up` refuses,
and the last Railway DNS record was deleted 260828. There is no Railway in the path
any more — not the apex, not the wildcard, not `www`.

Two vestigial Railway DNS records remain on purpose (`_acme-challenge` CNAME and the
`_railway-verify` TXT). They are inert, and they are the cheap half of ever going back.

```bash
# Deploy. NOT `railway up`, NOT `git push`.
MSYS_NO_PATHCONV=1 wsl -d Ubuntu-22.04 -u root -e bash \
  /mnt/c/Dev/angels-os/docs/selfhost/thinkpad/push-to-node.sh
```

It builds from **committed, pushed `main`** — commit first or you ship the previous
commit. Migrations run on container boot.

**Telling environments apart:** `Server: cloudflare` = the node. `railway-hikari` would
be Railway, and should now never appear.

### Reaching the box — one machine, three addresses

| Address | Use |
|---|---|
| `node01.spacesangels.com` | its own tunnel hostname; what the watchdog checks |
| `100.70.52.74` | Tailscale — `mstsc /v:100.70.52.74`, survives the LAN IP moving |
| `192.168.0.171` | LAN, **and it moves** |

```bash
ssh -i ~/.ssh/angel_node angel@192.168.0.171
sudo docker exec angelos-core  node_modules/.bin/payload run src/scripts/_local/<script>.ts
sudo docker exec angelos-pg    psql -U postgres -d angels
```

Containers: `angelos-core`, `angelos-pg` (pg18), `angelos-pgbouncer` (:6432, transaction
mode, no TLS), `angelos-registry`. Logs: `lazydocker`, or `docker logs -f angelos-core`.
Full config and the revert table: `docs/selfhost/thinkpad/NODE_CONFIG.md`.

**The tunnel runs on `http2`, not QUIC.** Every drop this box has had (260827, and twice
on 260830) was `sendmsg: network is unreachable` on a UDP dial, while SSH and HTTPS over TCP
never faltered — this network loses UDP routes. `protocol: http2` in
`/etc/cloudflared/config.yml`; revert is `config.yml.bak-260830-quic`. A watchdog checks the
tunnel **from the open internet** every 2 min and restarts cloudflared on a failed check plus
retry, because `Restart=on-failure` cannot help: cloudflared does not fail, it keeps one dead
connection and reports `active`. A healthy tunnel registers connIndex 0-3 — that count is the tell.

**Backups:** `/opt/angelos/backup.sh` nightly at 03:17 (root cron). 14 days kept locally in
`/opt/angelos/backups`, and each one is pushed offsite to R2 under `backups/`. The script
fails loudly — it once wrote 20-byte "backups" for two nights and said nothing (260825-26),
so it now checks size and gzip integrity before calling a dump done.

### What is NOT on the node

- **Media is on Cloudflare R2** (`pub-ed4eb11a…r2.dev`), not the node's disk. A script
  run anywhere can write media; it is the DATABASE that pins you to the node.
- **Merlin** is a separate machine (`merlin.spacesangels.com`, own tunnel, port **3002**,
  no Access gate). `push-to-node.sh` does not touch it.

---

## Ports (they have bitten us three times)

| | |
|---|---|
| Merlin | **3000** by DNS/tunnel config, **3002** in the scheduled task — reads `process.env.PORT` |
| Core (local dev) | **3001** — Merlin owns 3000 |
| PgBouncer | **6432** |

---

## ⚠️ Known-stale, do not trust

- **The local dev database holds STALE DATA, though its schema is now current.**
  Migrations were caught up 260830 (it had been stuck at `20260731`, missing columns the
  config selects). The schema matches production; the rows do not — it is an old copy and
  it is nobody's preview of production. Run `pnpm migrate` after pulling.
- **`C:\Dev\datacenter\stack` still has the `.env.local` quote bug.** Values carry literal
  quotes into the container through `env_file: format: raw`. It is why "system email auth
  fails with nothing in any log" — `SYSTEM_EMAIL_PASSWORD` is one of ten affected vars.
  The node was fixed 260827; the desktop stack was not.
- **`migrate:create` diffs against that stale local DB.** A generated migration will sweep
  in a month of unrelated drift. Hand-write migrations against the live schema instead
  (`\d <table>` on the node), and never edit an applied one.

---

## The rules that cost us the most

Full list in `docs/FOOTGUNS.md` and the punch list. These are the ones that took the site down.

- **Never edit an APPLIED migration.** Payload keys on the name, so the edit never runs and
  the config then selects a column prod lacks. Took the whole node down 260821.
  `frozenMigrations.test.ts` hashes them; record new ones with
  `UPDATE_MIGRATION_HASHES=1 pnpm vitest run tests/unit/migrations`.
- **Verify a destructive result by RE-QUERYING.** `payload.delete({where})` resolves with an
  `errors` array instead of throwing; it has reported "1 deleted" over a row still serving.
- **Never send non-ASCII through curl on Windows.** Em-dashes arrive as `U+FFFD` and get
  baked into live copy — 31 rows across 5 tenants served `□` for months. Pass text as a pg
  parameter or a UTF-8 `--data-binary @file`.
- **A new collection needs its `<slug>_id` column on `payload_locked_documents_rels`**, or
  every admin save fails: `GET /api/provision-ops/db-repair-locks?key=$CRON_SECRET`.
- **A hook that writes without `req` deadlocks for exactly 300s.** Linted by
  `hookWritesPassReq.test.ts`.
- **Test gate is `pnpm test:unit`** — bare `vitest run` boots Payload and cascades timeouts.

---

## Working agreement

Ken is CEO, Claude is CIO. CTO mode: decide and act on the obvious, commit and move.
Temporal-stamp replies `YYMMDD ~HHMM Name —` top and bottom. Ponytail mode.

**No Angel OS jargon in customer-facing copy** — a visitor to a church website should never
learn what we are.

Vocabulary is locked (Ken's 260715 ruling, do not re-litigate): **Enterprise** = root /
AI-bus, never a tenant. **Tenant** = the primitive. **Endeavor** = a tenant you organize
around. **Circle** = family.
