# Continuity Runbook — keeping the lights on without Ken

> **Who this is for:** a competent technical person who did NOT build this and may
> have never seen it before, who now needs to keep it running for days or weeks.
>
> **What it is for:** keeping live tenants served and real customers unharmed. It
> is *not* a guide to developing the platform — that's
> [ENGINEERING_HANDBOOK.md](ENGINEERING_HANDBOOK.md) and
> [FOOTGUNS.md](FOOTGUNS.md). If you only read one other file, read FOOTGUNS.
>
> **The bar is "nothing gets worse."** Shipping features is optional. Not losing
> data, not breaking a paying customer's site, and not silently dropping someone's
> booking is not.
>
> Last verified `260726`.

---

## 0. The three things that matter most

1. **The whole platform runs on one Windows laptop, in Docker.** If that laptop is
   off, everything at `*.payloadnuke.com` is down. Turning it back on and running
   `docker compose up -d` fixes most outages.
2. **Pushing to git does NOT deploy anything.** Vercel deploys are disabled for
   `main` (`vercel.json` → `deploymentEnabled.main: false`). Deploying means
   running `rebuild.cmd` on the laptop. See §4.
3. **Migrations run on container boot.** So a code change that adds a DB field is
   only safe once the container has restarted. A missing column shows up as
   Postgres error `42703` on every read of that collection.

---

## 1. The map

| What | Where | How to check |
|---|---|---|
| Core app | Docker container `angelos-core`, host `:3001` → container `:3000` | `docker ps`, `docker logs -f angelos-core` |
| Postgres 17 | `angelos-pg`, host `:5432`, volume `angelos_pgdata` | `docker exec -it angelos-pg psql -U postgres -d angels` |
| PgBouncer | `angelos-pgbouncer`, host `:6432` (transaction mode) | `docker ps` — fronts Postgres, stops login stampedes |
| Heartbeat (cron) | `angelos-heartbeat` — runs the 8 scheduled jobs | `docker logs angelos-heartbeat` |
| Public HTTPS | Cloudflare tunnel `merlin` → `*.payloadnuke.com` → Core | Scheduled Task `AngelOS-Tunnel`; `cloudflared tunnel info merlin` |
| Stack files | `C:\Dev\datacenter\stack` — **not a git repo** | reference copies in [`docs/deploy/`](deploy/) |
| App code | `C:\Dev\angels-os` (this repo) | |
| Secrets | `C:\Dev\angels-os\.env.local` — the ONE env file the container reads | never commit it, never paste it into a ticket |

Merlin (`C:\Dev\merlin`) owns host `:3000` and is a separate node. Nimue
(`C:\Dev\nimue`) is the Android client. Neither is required for Core to serve.

**How a tenant resolves:** the first label of the hostname is matched against a
tenant `slug`. `clearwater-cruisin.payloadnuke.com` → the Clearwater tenant.
`www`, the apex, or anything unmatched → the `platform` tenant.

---

## 2. Daily — is it alive?

Two commands. If both look right, the platform is fine.

```bash
docker ps
```
Expect four containers `Up`: `angelos-core`, `angelos-pg`, `angelos-pgbouncer`,
`angelos-heartbeat`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.payloadnuke.com/api/health
```
Expect `200`.

**Also confirm the heartbeat is beating** — it is the platform's pulse. Without it
there is no inbound email, no connector health, and no nightly self-heal for
partial tenant provisions:

```bash
docker logs --tail 50 angelos-heartbeat
```

**Backups:** `scripts/_local/backup-db.ps1`, registered as a scheduled task every
3 hours. Confirm recent dump files exist. **If you do one thing before touching
anything else, take a fresh dump.**

---

## 3. The failures you will actually see

### "Everything is down"
The laptop rebooted, or Docker Desktop didn't start. Start Docker Desktop, then:
```bash
cd C:/Dev/datacenter/stack
docker compose up -d
```
Then check the tunnel task is running (`schtasks /query /tn "AngelOS-Tunnel"`).

### "The site loads but nobody can log in"
Almost always connection-pool exhaustion from a session stuck idle-in-transaction.
PgBouncer now fronts Postgres, which mostly prevents this. To confirm and clear:
```sql
SELECT pid, state, query_start, left(query, 80)
FROM pg_stat_activity WHERE state = 'idle in transaction';
```
Terminate the stuck pid with `SELECT pg_terminate_backend(<pid>);`.

### "Something hangs for exactly 300 seconds"
Not a slow query — a distributed deadlock, caused by a hook writing without `req`.
Don't theorise; run the probe:
```sql
SELECT pid, pg_blocking_pids(pid), left(query, 100)
FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;
```
Full explanation in [FOOTGUNS.md §2.1](FOOTGUNS.md).

### "One collection 500s on every read"
A schema change shipped without its column. Postgres error `42703`. The fix is to
run the migration — restarting `angelos-core` does it automatically, since
migrations run on boot.

### "A tenant's site shows the wrong content"
Tenant resolution fell through to the default. Check the hostname's first label
actually matches a tenant `slug`.

---

## 4. Deploying a change

```
edit code in C:\Dev\angels-os
run          C:\Dev\datacenter\stack\rebuild.cmd
```

That rebuilds the Core image, restarts the container (which runs migrations on
boot), and prints health. Live in 1–3 minutes. Postgres and the tunnel keep running.

Three rules that will bite you:

- **`NEXT_PUBLIC_*` values are baked at BUILD time.** Changing one requires
  `docker compose up -d --build core`, not `--force-recreate`.
- **A green push is not a deploy.** See §0.2.
- **Verify the container is actually new.** `docker ps` and confirm the age is
  *seconds*. A health check passes instantly against the OLD container, which has
  repeatedly produced the wrong conclusion.

Before shipping anything, run the test gate:
```bash
pnpm test:unit
```
It was made green on `260726` (333 files, ~6,047 tests). **A red run means your
change** — that was not true before that date, so ignore older advice about
baselining. Use `pnpm test:unit` only; a bare `vitest run` boots Payload and
cascades into timeouts.

---

## 5. Money

- **Payments run through Stripe Connect.** Card data never touches this system;
  Stripe holds it. You do not need PCI knowledge to operate here.
- **The platform fee is DATA, not a constant** — `src/utilities/platformFee.ts`,
  default 5%, changeable without a deploy.
- ⚠️ **[docs/REVENUE.md](REVENUE.md) describes a 70/20/4/1/5 split. That is
  aspirational doctrine, NOT what the code charges.** A 40% application fee was
  live on real bookings until `260725` and was removed. If anyone asks what the
  platform takes, read `platformFee.ts`, not a doc.
- **Never change a fee to "test something."** It applies to live charges
  immediately, on real people's money.
- Refunds and payouts: do them in the Stripe dashboard, not by editing rows.

---

## 6. People who are depending on this

The platform serves real businesses. Breaking their site is the worst outcome
available to you — worse than being down, because it is silent.

| Who | What they have | If something breaks |
|---|---|---|
| Clearwater Cruisin | Live tenant + the flagship content | Ken's own; safe to sit on |
| KenDev | Commercial tenant | Ken's own |
| Tyler | user 15 / guardian-angel tenant 20 | a real person's portal — don't delete |
| NeuroCare Pro (David Christenson) | Demo portal `neurocarepro.payloadnuke.com` + a live proposal | **Active sales conversation.** See below. |

> **Fill in before this is needed:** other live tenants, who to contact for each,
> and which ones are paying. — _Ken_

**On NeuroCare Pro specifically:** David has been given a portal, admin access, and
a written proposal ($500 two-week test, then optionally $3,500 for his own stack).
If Ken is unavailable, the honest move is to tell David plainly rather than let the
thread go quiet. He is direct and will respect a direct answer far more than a
delay. **Do not take his money for work that cannot be delivered on time.**

---

## 7. Safe to ignore

Not everything red is a fire. These are known and are not emergencies:

- ~36 TypeScript errors, all in `tests/` — pre-existing, none in `src/`.
- The Anthropic API key is out of credits; Gemini covers vision. Nothing is down.
- Merlin squatting port `:3000` — cosmetic conflict, doesn't affect Core on `:3001`.
- Federation features are flagged off deliberately. Peers being unreachable is
  expected, not broken.
- The [Global Punch List](GLOBAL_PUNCH_LIST.md) is long by design. `P2` items are
  debt, not outages.

---

## 8. Break glass — the laptop is gone

Railway is the paid failover and the runbook is
[DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md). Three services: Core (from this repo's
Dockerfile), managed Postgres (db name `railway`), and PgBouncer.

Order of operations:
1. Restore the most recent dump from `scripts/_local/backup-db.ps1` output.
2. Stand up Railway Core against it, per DEPLOY_RAILWAY.md.
3. Repoint DNS. Media lives on Cloudflare R2 and is unaffected — the container is
   stateless.

If sequence errors appear after a restore (`unique on id`), that's ID sequence
drift: run the `db-repair-sequences` op. After adding a collection, run
`db-repair-locks`.

---

## 9. Where the knowledge actually is

- [FOOTGUNS.md](FOOTGUNS.md) — the traps, why they exist, and the rules. **Read
  this before changing anything.**
- [LOCAL_SELFHOST.md](LOCAL_SELFHOST.md) — the stack in full detail.
- [docs/deploy/README.md](deploy/README.md) — reference copies of the stack files
  that live on one disk.
- [GLOBAL_PUNCH_LIST.md](GLOBAL_PUNCH_LIST.md) — what's broken, ranked.
- [ENGINEERING_HANDBOOK.md](ENGINEERING_HANDBOOK.md) — how to develop here.
- `C:\Users\kenne\.claude\projects\C--Dev-angels-os\memory\` — the accumulated
  context an AI assistant reads at the start of each session. Not required to
  operate, but it is where the "why" lives.

---

## 10. What Ken would want you to know

Written by Claude, `260726`, at Ken's request, against the possibility that he is
not reachable for a stretch.

The platform is the third full rebuild of this architecture — the first two were
deliberately thrown away. It is over 1,400 commits and it was, essentially
entirely, written by one person and one AI lineage working together. That is why
it is coherent, and also why so much of the operating knowledge lived in one head
until this document existed.

Keep it boring. Keep it up. Don't optimise anything. If you are unsure whether an
action is safe, the answer is to take a database dump first and then ask.

> **For Ken to complete:** who has authority to make decisions in your absence,
> what you want said to clients, and where the credentials that aren't in
> `.env.local` are kept.
