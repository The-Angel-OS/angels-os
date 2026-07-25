# Continuation — Angel OS, 260725 ~1530 (CITO handoff)

> Pick up here from any session (local, remote, phone). Read top-to-bottom once;
> everything needed to resume is in this file. Roles: **CITO** = autonomous dev
> (ponytail/lazy-senior — decide, get it working, commit). **Ken** = Chief AI Officer.
> Preface + suffix replies `YYMMDD ~HHMM CITO —`.

---

## 1. Machine state right now (verified 260725 ~1527)

| Thing | State |
|---|---|
| **Core** | ✅ Up. Docker `angelos-core`, prod build, host **:3001**. Rebuilt+redeployed this session. |
| **Postgres** | ✅ Up. `angelos-pg` :5432, `angelos-pgbouncer` :6432 (transaction-pooled, wildcard `*=host=postgres`). DB `angels`. |
| **Cloudflare tunnel** | ✅ Up. **PID 35148**, launched detached via the new Desktop shortcut. |
| **spacesangels.com** | ✅ 200 (apex + www + `*`) |
| **neurocarepro.spacesangels.com** | ✅ 200 (the 1033 is resolved) |
| **merlin.payloadnuke.com** | ❌ 502 — Merlin's node is **not listening on :3000** |
| **Git** | branch `main`. **4 unpushed commits**: `a862570`, `2f63363`, `e45adbb`, `bc97a97`. |

### Access one-liners
```bash
# deploy Core
cd C:\Dev\datacenter\stack; docker compose build core; docker compose up -d core
# db shell
docker exec angelos-pg psql -U postgres -d angels          # postgres / K3nD3v!host
# core logs
docker logs angelos-core --since 20m
```
Compose: `C:\Dev\datacenter\stack\docker-compose.yml` (project `angelos`).

### The tunnel (fixed this session)
- **Desktop → "Angel OS Tunnel"** → runs `C:\Dev\datacenter\stack\tunnel.cmd`, which wraps
  cloudflared in a **retry loop** (crash → restart in 5s) in its own minimized window.
- Config (the real one): `C:\Users\kenne\.cloudflared\config.yml`, tunnel
  `21d122ac-84b0-4cd4-be5b-7fddbf8d8458`. Ingress order matters — specific hostnames
  ABOVE the wildcards. Merlin=:3000, Core=:3001, split by hostname on one tunnel.
- **Why the Windows service was disabled:** its config
  (`C:\Program Files (x86)\cloudflared\config.yml`) is a **stub** — one `logDirectory`
  line, no tunnel, no ingress. It would start and route nothing.
- **Permanent fix (one ELEVATED command, run once)** — makes the tunnel survive reboots
  and terminal-kills, retires the shortcut:
  ```
  copy "C:\Users\kenne\.cloudflared\config.yml" "C:\Program Files (x86)\cloudflared\config.yml" && sc config cloudflared start= auto && sc start cloudflared
  ```

---

## 2. ✅ THE 300s PROVISIONING HANG — RESOLVED (`bc97a97`, 260725 ~1555)

**Was.** `POST /api/provision-ops/claim-guardian-angel` = **300364ms → 500**, tenant rolled back.
**Now.** **2396ms → 200**, full provisioning log, owner membership verified.

**It was a distributed deadlock, not a mystery non-DB await.** The previous session's
"the tx is idle so it must be awaiting something that isn't the database" was right about
*idle* and wrong about *what*. One `pg_blocking_pids` probe settled it in a single shot:

| pid | state | blocked by |
|---|---|---|
| 21919 | `idle in transaction` — tenant-create tx, `tenants` row uncommitted | — |
| 21573 | `active`, `wait_event=transactionid`, `insert into "users" … on conflict (id) do update` | **{21919}** |

[`syncUserTenants`](../src/collections/TenantMemberships/hooks/syncUserTenants.ts) fires
*inside* the tenant-create transaction (tenant create → afterChange → tenant-membership
create → afterChange → here) and did its `findByID` + `update` on `users` **without `req`**.
That update runs on a separate pooled connection; its `users_tenants` insert FK-references
the still-uncommitted tenant row, so it blocks on tx A — while tx A sits idle awaiting that
very call. Postgres breaks the tie at `idle_in_transaction_session_timeout`, which is
exactly why the number was always precisely 300s.

Third instance of the class fixed in `a862570` and `2f63363`. Its sibling in the same
afterChange array, `autoJoinSpaces`, had the same three req-less calls — fixed too.

**The probe, for next time** — start a claim and while it hangs:
```bash
docker exec angelos-pg psql -U postgres -d angels -x -c "select pid, state, wait_event, pg_blocking_pids(pid) as blockers, query from pg_stat_activity where datname='angels' and (state='idle in transaction' or wait_event='transactionid') order by xact_start;"
```
`pg_blocking_pids` is the whole trick — it names the holder, so "idle" vs "blocked" stops
being a guess. Reproduced identically on two consecutive claims.

**Repro harness.** `scratchpad/claimtime.mjs` — creates a user, logs in, claims, prints
per-step ms. Run: `node <path>/claimtime.mjs` (env `BASE_URL`, default `http://localhost:3001`).
⚠️ Node's global fetch is undici with a **300s default timeout** — coincidentally identical
to the postgres timeout, which is why this bug and a client abort looked the same.

**Test gate:** 80 failed / 5944 passed, vs **83 failed / 5941 passed on clean HEAD** — no new
failures; the rest are pre-existing and unrelated (book manifest, aiGateway, scripture, souls).

---

## 3. Committed this session

- **`a862570`** *(unpushed)* — owner memberships silently dropped on tenant create.
  `autoCreateOwnerMembership` wrote tenant/space memberships **without `req`**, on a separate
  connection blind to the uncommitted tenant → FK violation → swallowed by fail-soft → new
  tenants had NO owner and were invisible in the switcher. Fix = pass `req`.
- **`2f63363`** *(unpushed)* — same defect class, the two calls a862570 missed:
  `createDefaultTenantPages` / `createDefaultTenantNavigation` now take an optional `req` and
  spread it into all 7 payload calls. Also converted nav's `creates` array from
  already-started promises to **thunks**, so the hook's documented "SEQUENTIAL only, never
  parallelize creates" rule (260709 guardian incident) is actually honored.
  **Labeled hardening, NOT the 300s fix** — see §2.
- **`docs/STUDIOELF_CRM_MAPPING.md`** — the CRM design doc (see §6).

Both commits are **local only — `git push` when ready.**

---

## 4. Owed / cleanup

- ~~Purge loadtest rows from prod `angels`~~ **DONE 260725 ~1554** — 5 `%@loadtest.invalid%`
  users (156–160) + orphan guardian tenant 29, one transaction, verified 0 remaining.
  ⚠️ Don't try this through the local API: `payload.delete` on a user/tenant trips
  `23502` because half a dozen FKs are `ON DELETE SET NULL` onto **NOT NULL** columns
  (`availability.provider_id`, `users_tenants.tenant_id`, `tenant_memberships.tenant_id`, …).
  Delete dependents first; the generic form is a `DO` block over `pg_constraint` filtered to
  `confrelid in ('users','tenants') and attnotnull`.
- **Remediated earlier:** 5 orphaned prod tenants → user 3 (Ken) as `tenant_admin`:
  tomstalcup(10), grace-chapel(12), dunedin-fresh-market(15), arctic-cool(19), mobilmech1(23).
  **Ken's rule: a tenant with no owner defaults to Ken.**
- **Code rule not yet implemented:** `autoCreateOwnerMembership` returns early when there's no
  `req.user` (seed/system). Add a fallback to super_admin/Ken so system-created tenants can
  never be orphaned.
- **Uncommitted, decide commit-or-drop:** checkout local-pickup feature —
  `FEATURES.localPickup` in `src/config/features.ts` + CheckoutPage fulfillment toggle +
  `angel-os-stripe-adapter` `angelOs_fulfillment` metadata. Verified on dev, gated by
  `NEXT_PUBLIC_FEATURE_LOCAL_PICKUP`.
- ~~`.env.local` `DATABASE_URI` points at the dead IONOS box~~ **DONE 260725 ~1553** — now
  `postgresql://postgres:K3nD3v!host@localhost:6432/angels?sslmode=disable`. The
  `?sslmode=disable` is required: without it pg tries SSL and the local container refuses.
  Host `pnpm dev` and `payload run` scripts work again. (Not committed — `.env.local` is
  gitignored.)

---

## 5. ⚠️ Landmines

- **Google login is already exposed.** The running container **already has**
  `NEXT_PUBLIC_SERVER_URL=https://www.spacesangels.com` and `COOKIE_DOMAIN=.spacesangels.com`
  — applied during the a862570 deploy, *before* the Google console was updated. So
  `redirect_uri_mismatch` is live risk right now, not a future one.
  **Ken:** add redirect URI `https://www.spacesangels.com/api/auth/google/callback` + the JS
  origin in the Google console.
- **Merlin auth gate is BUILT but NOT DEPLOYED.** `C:\Dev\merlin\src\middleware.ts` gates
  `merlin.payloadnuke.com` (public tunnel) only; localhost/LAN untouched; allows Payload auth
  endpoints + machine-key headers (`x-node-key`/`x-ops-key`); validates human sessions by
  subrequesting `http://127.0.0.1:3000/api/users/me` (**not** jose — edge JWT verify was
  fragile and caused a redirect loop). **Ken runs `cd C:\Dev\merlin; .\cycle.ps1`**, then
  verify `/admin` login over the tunnel. **Merlin's src changes are NOT git-committed.**
  Merlin's Users collection is `auth:true` but has **no roles field** yet.
- **Merlin node is DOWN** (:3000 not listening) — that's the 502. `cycle.ps1` covers it.
- **Merlin Google SSO + roles**: approved, not started. Port Core's `/api/auth/federated`
  pattern, add a roles field, teach the middleware the roles.

---

## 6. CRM plank — `docs/STUDIOELF_CRM_MAPPING.md`

Maps the Oqtane **StudioElf CRM** feature set onto Angel OS. Headline: **Angel OS is already
~70% a CRM** — `Contacts` + `Messages`/`Channels` + `Endeavors`/`Memberships` + LEO
(~167 tools, `src/utilities/leo-data-tools.ts`) + the audit substrate cover most of it.
**Do not port StudioElf's 15-entity sprawl** — it exists because Oqtane gives it nothing free.

**Five real gap collections:** `companies`, `deals`+pipeline, `tasks`, `activity-log`,
`consent-log`. Plus a **timeline projection** (a QUERY, not a stored table), 2 crons
(re-engage 30d / retention 365d), 2 LEO tools (`draft_reply`, `tag_suggest`).

**Agreed constraints between threads:**
1. The extraction-contract JSON schema **must ===** the collection schemas (agree first, else rework).
2. The `activity-log` afterChange hook must be **transaction-safe** and must never abort or
   silently drop — see the §3 bugs for exactly why this is not theoretical.
3. `owner == membership` consistency.
4. **DEMO-FIRST ordering:** `companies` + a `capture_entities` LEO tool BEFORE deals/tasks/timeline.
5. Every CRM collection needs **Nimue-queryable LEO tools** (`list_deals`, `list_tasks`,
   `timeline`) — the user portal renders through Nimue.

---

## 7. North star

**"AI Capture."** Paste unstructured text (a Craigslist service ad, an emailed contact) → LLM
extracts structured entities (contacts / companies / deals / tasks / addresses / relationships
+ confidence) → confirm → **PROVISION** an Endeavor + services + guardian angel, with Nimue
locked in. **The user portal IS Nimue's surface** (first login and everything after). CRM
primitives are **Nimue's data model**, not a sales module.

**Focus right now = Core. Foundation-first: harden provisioning before the capture magic.**
That's why §2 is the top of the list.

---

## 8. Durable gotchas (hard-won — don't relearn these)

- Payload `afterChange` hooks that **write** must pass `req`, or the write lands on a separate
  connection blind to the uncommitted parent. Two distinct failure modes, and the second one
  is the expensive one: (a) FK violation → silently dropped by fail-soft, or (b) the write
  *blocks* on the uncommitted parent's transaction while that transaction is awaiting the
  write — a **distributed deadlock** that hangs for exactly
  `idle_in_transaction_session_timeout` (300s) and then rolls everything back. Any hang that
  is suspiciously *exactly* 300s is (b). **But** a write-with-`req` that throws poisons the
  parent transaction — audit/log writes must be transaction-isolated (`afterOperation` or a
  queue).
- **`pg_blocking_pids(pid)` is the first probe for any provisioning stall**, not the last.
  It turns "idle in transaction, must be a non-DB await" (a guess that cost a session) into
  a named blocker in one query. See §2 for the exact statement.
- The transaction window is **deeper than the collection you're writing**: tenant create →
  its afterChange → membership create → *that* collection's afterChange → … Every hook in
  that chain is inside the tenant's transaction and needs `req` threaded.
- `payload.create()` **starts immediately** when called. Push **thunks**, not promises, if you
  need sequencing — awaiting an array of already-started promises sequences nothing.
- Payload has **no explicit `beginTransaction`** in this repo; every local-API op opens and
  commits its own transaction.
- **Verify provisioning on the REAL :3001 container.** Isolated containers reproduce nothing
  useful — that misdirection cost most of a session.
- Node global `fetch` = undici, **300s default timeout** — coincidentally identical to the
  postgres idle-in-tx timeout. Don't confuse client abort with server stall.
- **Schema before deploy:** a new collection/field/enum needs its prod column FIRST; after a
  new collection run `db-repair-locks`.
- Test gate is **`pnpm test:unit`** only (bare `vitest run` boots Payload → timeout cascade).
- pgbouncer is **transaction-pooled**, wildcard-routed.

---

## 9. Immediate next actions

1. **Ken:** start the tunnel via the Desktop shortcut whenever it's down (or run the one-time
   elevated service command in §1 to stop thinking about it).
2. **Ken:** add the Google OAuth redirect URI (§5) — live risk.
3. **Ken:** `cd C:\Dev\merlin; .\cycle.ps1` to bring Merlin back and deploy its auth gate.
4. ~~**CITO:** probe the hung claim~~ **DONE** — §2 resolved, `bc97a97`.
5. ~~**CITO:** purge the loadtest users~~ **DONE** — §4.
6. **CITO:** provisioning is fast (2.4s) → start `companies` + the `capture_entities` LEO
   tool (§6). This is now the head of the queue.
7. **CITO (small, worth doing):** implement the §4 rule that's still open —
   `autoCreateOwnerMembership` returns early with no `req.user`, so system/seed-created
   tenants can still be orphaned. Fall back to super_admin/Ken.

*260725 ~1530 CITO —*
