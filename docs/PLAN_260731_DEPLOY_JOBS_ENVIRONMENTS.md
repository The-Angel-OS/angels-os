# Plan — 260731: auto-deploy, scheduled work, and what the laptop is now

Written the night production moved to Railway (260730 ~22:00). Three pieces of
unfinished business, in the order I'd do them. Each section is written so it can
be executed without the conversation that produced it.

**Current state as of writing:**

- **Production = Railway.** `spacesangels.com`, `www`, and `*.spacesangels.com`
  resolve to Railway (CNAMEs, DNS-only). Core + Postgres + PgBouncer online.
  Certificates valid. Every tenant serving, Kessela storefront verified end to
  end (gallery, cart, checkout, admin).
- **The laptop serves only `payloadnuke.com` and `kendev.co`**, via the `merlin`
  Cloudflare tunnel, plus Merlin itself, Gotify and Uptime Kuma.
- **Nothing deploys automatically, anywhere.**
- **Nothing scheduled runs, anywhere.** The local heartbeat was stopped
  deliberately to prevent the laptop's database diverging from Railway's.

---

## Gap 1 — Auto-deploy: GitHub → Railway

Today `railway up` uploads the working directory from whatever machine runs it.
That is fine for one person with a terminal and terrible for everything else:
production can only be updated from a specific laptop, and "it says it shipped"
is indistinguishable from "it shipped".

### 1.1 Connect the repo

Railway dashboard → **Core** service → **Settings → Source** → Connect Repo:

- Repo: `The-Angel-OS/angels-os`
- Branch: `main`
- Root directory: `/`

Railway detects `railway.json` and builds the `Dockerfile`. Health check is
already `/api/health`.

### 1.2 Gate it — this is the "limit checkins" part

Three controls, all needed:

1. **Wait for CI.** Railway service settings → enable *Check Suites* / wait for
   GitHub checks. Without this, a push deploys while CI is still running and a
   red build reaches production first.
2. **Branch protection on `main`.** GitHub → Settings → Branches → require a PR
   and require the `ci` workflow to pass. Then `main` is only ever green code,
   and the deploy trigger becomes trustworthy by construction.
3. **Watch paths.** Railway service settings → Build → watch patterns, so a
   docs-only commit doesn't rebuild production:

   ```
   /**
   !/docs/**
   !/**/*.md
   ```

   Roughly half the commits in the last week touched only `docs/`.

### 1.3 Enable Skipped Builds

Feature flag, **GitHub-source only** — which is why it was useless before this
section. With the repo connected it skips the build step when the same source
was already built. Safe; turn it on with 1.1.

**Leave `Railway Express` OFF.** It is an early preview build system. The build
takes ~4 minutes and runs twice a week; there is nothing here worth preview-
software risk on the only production deploy path.

### 1.4 Verify

1. Push a trivial change to `main` (a comment in a source file — not docs, or
   the watch paths will correctly ignore it).
2. Watch the deployment in Railway.
3. `curl https://spacesangels.com/api/health` — `uptime` should reset to seconds.
4. Confirm the change is live.

**A version probe that actually works:** hit an endpoint that only exists in the
new code. `/api/message-ops/heal-stalled` returns **401** when present and
**404** when stale — that is how the 12-day-old build was caught on 260729.

### 1.5 Rollback

Railway keeps prior deployments: service → Deployments → the previous one →
Redeploy. Under a minute. Test this **once**, deliberately, before relying on it.

---

## Gap 2 — Scheduled work: move it into Payload's jobs queue

`jobs` is not configured at all today — no tasks, no workflows, no `autoRun`.
Scheduled work was an Alpine container running `crond`, hitting HTTP endpoints
with a shared secret. That design failed three ways in two days:

- A Windows editor wrote CRLF into the crontab, so every job's redirect targeted
  `/proc/1/fd/1\r` and **no job ran for twenty hours** while the container looked
  healthy. (FOOTGUNS 2.7c)
- The crontab hard-codes `http://core:3000`, so the moment Core moved it would
  have gone silently dead anyway.
- Failures were log lines in a container nobody reads.

Payload's queue fixes all three: schedules live in the app, run wherever the app
runs, and every attempt is a row in `payload-jobs` you can query.

### 2.1 Shape

In `payload.config.ts`:

```ts
jobs: {
  tasks: [ /* one per job below */ ],
  autoRun: [
    { cron: '*/5 * * * *', queue: 'frequent' },
    { cron: '17,47 * * * *', queue: 'hourly' },
    { cron: '30 3 * * *', queue: 'nightly' },
  ],
  shouldAutoRun: async () => true,   // kill switch for local dev
  access: { run: ({ req }) => isCron(req) },  // do NOT leave the run endpoint open
}
```

**`autoRun` needs a long-lived process.** A Railway container qualifies;
serverless would not. One more quiet argument for the move.

### 2.2 The jobs to port

From `C:\Dev\datacenter\stack\heartbeat.crontab` — the source of record, now
retired:

| task | schedule | current endpoint |
|---|---|---|
| heal stalled LEO placeholders | every 5 min | `/api/message-ops/heal-stalled` |
| sequence drip tick | every 5 min | `/api/sequence-ops/tick` |
| federation heartbeat | every 5 min | `/api/federation/heartbeat-cron` |
| notifications poll | every 5 min | `/api/notifications/poll` |
| inbound email poll | every 2 min | `/api/email/poll` ⚠️ **currently 500s** |
| connector health | 17,47 hourly | `/api/connector-ops/health` |
| YouTube poll | hourly | `/api/youtube/poll` |
| provisioning self-heal | nightly 03:00 | `/api/provision-ops/verify-onboarding?all=1` |
| "Dreams" log consolidation | nightly 03:30 | `/api/log-ops/consolidate` |
| solvency briefing | daily 13:00 | `/api/solvency-ops/briefing` |

`heal-stalled` was every minute; every 5 is plenty — its threshold is 10 minutes.

### 2.3 Do it without duplicating logic

Do **not** have a task HTTP-call its own app. Extract each endpoint's body into a
plain function taking `payload`, then have both the endpoint and the task call it:

```
src/endpoints/heal-stalled-messages.ts   →  handler (HTTP, keeps CRON_SECRET)
src/jobs/healStalledMessages.ts          →  runHealStalled(payload)  ← shared
```

Keep the endpoints — they are useful for manual triggering and for anything
external. They just stop being the *scheduled* path.

### 2.4 Verify

- `payload-jobs` collection has rows with completion state after ~5 minutes.
- Deliberately fail one task; confirm the failure is visible as a row, and that
  retry/backoff behaves.
- Then delete the `angelos-heartbeat` service from `docker-compose.yml` and the
  `crons` block from `vercel.json`, so there is exactly one source of schedule.

### 2.5 Fix `/api/email/poll` separately

It returns **500** and has since before the crontab broke — so inbound email →
AI Bus has been down longer than anyone noticed. It uses `imapflow` against
`imap.ionos.com` with config from a connector record, not env. Its own job.

---

## Gap 3 — What the laptop is now: dev/staging on kendev.co + payloadnuke.com

The laptop still runs a full stack and still serves two domains. That is useful
— but only if the rule is unambiguous.

### 3.1 The rule

> **Railway is the only place production data is written.** The local stack is a
> development environment whose database is a *restore*, never a source.

Two Angel OS instances writing to two databases is how you get a Tuesday where
neither is right and nobody can tell which.

### 3.2 Domains

- `payloadnuke.com`, `*.payloadnuke.com` → local Core (`:3001`) via the `merlin`
  tunnel. ⚠️ The **apex currently serves an IONOS parking page in German** — a
  stale record from the retired IONOS box. Fix or delete.
- `kendev.co`, `*.kendev.co` → local Core. ⚠️ The **apex has no DNS record at
  all**; `www` and the wildcard work.
- `uptimekuma.kendev.co` / `.payloadnuke.com` → Kuma (`:8071`)
- `gotify.kendev.co` / `.payloadnuke.com` → Gotify (`:8070`)
- `merlin.payloadnuke.com`, `merlin.spacesangels.com` → Merlin (`:3000`)

### 3.3 Clean the tunnel config — do this first

`C:\Users\kenne\.cloudflared\config.yml` still contains rules for
`spacesangels.com`, `www.spacesangels.com` and `*.spacesangels.com` pointing at
`localhost:3001`. Those are now **dormant and dangerous**: if anything ever
resolves to that tunnel again, it serves a stale origin instead of failing
loudly. Delete those three rules.

⚠️ **cloudflared reads its config once, at start.** After editing, restart it and
verify by curling a hostname the edit *changed* — never one that already worked.
That mistake hid a broken kendev route for a day and a half. (FOOTGUNS 2.7d)

⚠️ Write the file with **LF endings**. `io.open(p,'w')` on Windows produces CRLF
and silently breaks anything a Linux container parses. (FOOTGUNS 2.7c)

### 3.4 Refreshing local from production

```bash
# 1. dump from Railway
railway run --service Postgres -- \
  docker run --rm -v "C:/Dev/datacenter/backups:/out" postgres:18 \
  pg_dump "$DATABASE_PUBLIC_URL" -Fc -Z6 -f /out/prod.dump

# 2. restore locally
docker exec -i angelos-pg pg_restore --no-owner --no-privileges \
  --clean --if-exists -U postgres -d angels < prod.dump

# 3. MANDATORY — repair id sequences, or the first write fails on a duplicate id
GET /api/provision-ops/db-repair-sequences   (super_admin)
```

Gotchas learned the hard way on 260729:

- `DATABASE_URL` is `*.railway.internal` and unreachable from outside. Use
  **`DATABASE_PUBLIC_URL`**.
- Expand it in the shell `railway run` injects into — not inside a nested
  `docker run`, where it silently becomes empty and psql tries a local socket.
- `MSYS_NO_PATHCONV=1` before `docker run -v` on Git Bash.
- Railway Postgres is **18.4**, local is **17.10**. Use the `postgres:18` image
  as the restore client.

### 3.5 Make it obvious which one you are on

Set an env label on the local stack and render it in the admin chrome. Every
hour lost this week to "which environment am I looking at" is an hour that a
coloured banner would have saved.

---

## Order

1. **Gap 3.3** — delete the stale spacesangels rules from the tunnel. Five
   minutes, removes a live trap.
2. **Gap 1** — connect GitHub, gate with CI + branch protection + watch paths,
   verify with a real push, test rollback once.
3. **Gap 2** — port the schedules into Payload jobs, verify in `payload-jobs`,
   then delete the heartbeat container and the `vercel.json` crons.
4. Then `/api/email/poll`, and the two apex records.

## Not in this plan, but adjacent and worth remembering

- **LEO should say "exists but unpublished", not "not found".** Page 113
  (`pelvic-floor`) was invisible to LEO while sitting in draft. Same for
  products. That one change would have caught four separate incidents this week.
- **Merlin is still on Payload 3.86 with a manual start.** Its autostart task
  launches on **:3002** while the tunnel expects **:3000** — after a reboot it
  comes up on the wrong port and `merlin.*` goes dark. Needs an elevated fix.
