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
| **Git** | branch `main`. **2 unpushed commits**: `a862570`, `2f63363`. |

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

## 2. 🔴 THE ACTIVE BUG — provisioning hangs exactly 300s (UNRESOLVED)

**Symptom.** `POST /api/provision-ops/claim-guardian-angel` takes **300473ms** then 500s.
The tenant is rolled back. Measured on the REAL :3001 container, not a test rig.

**What is proven.**
- 300s is *exactly* postgres `idle_in_transaction_session_timeout`. Container log at the
  moment of death: `terminating connection due to idle-in-transaction timeout` (SQLSTATE
  **25P03**), then every in-flight operation errors in the same millisecond.
- **Idle** is the key word: the tenant-create transaction is NOT running a slow query. It is
  sitting open with nothing executing, `await`ing something that isn't the database.

**Ruled out (do not re-investigate).**
- pgbouncer — reproduces direct-to-postgres too.
- Env / container isolation — real prod does it; earlier "only isolated containers hang" was wrong.
- **FK-visibility of the uncommitted tenant row** — was a genuine bug, fixed in `2f63363`,
  hang reproduces unchanged after the fix.
- `revalidatePage` hook — uses `revalidatePath`/`revalidateTag`, purely local, no fetch.
- No `beginTransaction` anywhere in `src/`; Payload opens/commits a tx per local-API op.
- No `fetch()` / AI / external call in `provisionPortal.ts` or the Tenants hooks.

**Next move — one probe settles it.** Start a claim, and *while it hangs* run:
```bash
docker exec angelos-pg psql -U postgres -d angels -c "select pid, state, wait_event_type, wait_event, now()-xact_start as tx_age, left(query,140) as last_query from pg_stat_activity where datname='angels' order by xact_start nulls last;"
```
- `state = 'idle in transaction'` → confirms a non-DB await; **`last_query` is the statement
  immediately BEFORE the stall**, which brackets the culprit to one call site.
- `state = 'active'` + a `wait_event` of `Lock` → it's a lock wait after all, and `last_query`
  names the blocked statement.

Remaining suspects once bracketed: a Media/upload path, a hook making an HTTP call, or
`ensureMainSpace` / channel seeding awaiting something external.

**Repro harness.** `scratchpad/claimtime.mjs` — creates a user, logs in, claims, prints
per-step ms. Run: `node <path>/claimtime.mjs` (env `BASE_URL`, default `http://localhost:3001`).
⚠️ Node's global fetch is undici with a **300s default timeout** — which is why this bug and
the client abort look identical. Raise it if you need to see past 300s.

**Why it matters:** the north star is paste-to-Endeavor. That cannot take five minutes.

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

- **Purge loadtest rows from prod `angels`:** users matching `%@loadtest.invalid%` — user
  **156** (`slowtest-*`) and `claimtime-1785006938983@*` — plus any guardian tenants they
  spawned. (Tenant 25 "Slow" already rolled itself back.)
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
- **`.env.local`** `DATABASE_URI` still points at the **dead** IONOS box `74.208.87.243`.
  Repoint to `localhost:6432/angels`. Harmless for the container (compose env wins) but host
  `pnpm dev` is broken until then.

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
  connection blind to the uncommitted parent → FK failure → silently dropped. **But** a
  write-with-`req` that throws poisons the parent transaction — audit/log writes must be
  transaction-isolated (`afterOperation` or a queue).
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
4. **CITO:** run the `pg_stat_activity` probe during a hung claim (§2) — one shot brackets the
   300s culprit.
5. **CITO:** purge the loadtest users (§4).
6. **CITO:** once provisioning is fast, start `companies` + the `capture_entities` LEO tool (§6).

*260725 ~1530 CITO —*
