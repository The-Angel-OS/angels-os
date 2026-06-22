# pgBouncer tuning — fix admin-save connection timeouts (260621)

## Symptom
Payload admin saves (Pages, Posts — any collection) on the angels node hang ~34s then
fail with `{"errors":[{"message":"Something went wrong."}]}` (500). Server log shows
`Failed query: select … payload_locked_documents …` — but that's just the FIRST query of
a save; the real failure is **the request can't acquire a DB connection within 30s**
(`connectionTimeoutMillis=30s` in the app pool → 34s observed).

## Why (diagnosis)
- Backend Postgres is healthy: only ~12/100 connections in use; the failing queries are
  fast in isolation; the merlin_control block tables + access columns are schema-correct.
- A burst at one instant showed `messages/save`, `spaces/save`, `tenants/save`,
  `posts/save` all failing the same second on *different* SQL → a **connection-layer**
  event, not schema.
- Prod connects via the pgBouncer pooler (all backend conns are `client_addr=127.0.0.1`).
- The app pool is intentionally tiny (`max: VERCEL ? 2 : 10`) to protect the shared
  100-connection IONOS cap. With pgBouncer fronting the DB, the pooler should absorb that
  — UNLESS pgBouncer is in **session** pool mode (no multiplexing) or its pool sizes are
  too small, in which case serverless bursts starve it and clients wait out the 30s.

This repo deploys to MANY Vercel projects (angels-os, the-angel-os, spaces,
wheredideveryonego, answer53, angels-os-kendev) — all serverless, all hitting this one
pooler. That is exactly the workload pgBouncer transaction mode exists for.

## Fix — `/etc/pgbouncer/pgbouncer.ini`
```ini
[databases]
angels  = host=127.0.0.1 port=5432 dbname=angels
kendev  = host=127.0.0.1 port=5432 dbname=kendev
; (keep any others already listed)

[pgbouncer]
; ── THE key change: multiplex many serverless clients onto few backends ──
pool_mode = transaction

; Serverless opens many short-lived client connections — allow plenty (cheap, RAM only).
max_client_conn = 2000

; Backend connections per (user,db). Two DBs share the 100-conn Postgres cap, so keep
; the SUM under ~90: default_pool_size 20 × ~2 active DBs ≈ 40 typical.
default_pool_size = 20
min_pool_size = 2
reserve_pool_size = 5
reserve_pool_timeout = 3

; HARD cap on backend conns PER DATABASE so angels & kendev can't sum past the Postgres
; cap and starve each other. 35 × 2 = 70 < 100 (leaves headroom for direct/admin conns).
max_db_connections = 35

; Recycle idle/old backend conns so they don't hoard the shared cap.
server_idle_timeout = 30
server_lifetime = 600

; Fail fast instead of hanging if truly saturated (matches the app's 30s timeout).
query_wait_timeout = 30

; node-postgres / drizzle send startup params pgBouncer doesn't recognize — ignore them
; instead of rejecting the connection.
ignore_startup_parameters = extra_float_digits, search_path, options

; Enables prepared statements UNDER transaction pooling. REQUIRES pgBouncer >= 1.21.
; Check `pgbouncer --version`; if older, omit this line (node-postgres uses unnamed
; statements by default so it's usually fine without it, but 1.21+ is recommended).
max_prepared_statements = 200

; Let yourself run SHOW POOLS / SHOW STATS to verify (see below). Use the DB superuser
; or a dedicated admin role; pair with auth_type/userlist as already configured.
admin_users = postgres
```

## Apply + verify
```bash
pgbouncer --version                      # confirm >= 1.21 for max_prepared_statements
sudo nano /etc/pgbouncer/pgbouncer.ini   # apply the block above
# Reload WITHOUT dropping existing connections:
psql -p 6432 -U postgres pgbouncer -c "RELOAD;"
#   (or: sudo systemctl reload pgbouncer)

# Verify pool mode + saturation (cl_waiting should be ~0; sv_active << default_pool_size):
psql -p 6432 -U postgres pgbouncer -c "SHOW POOLS;"
psql -p 6432 -U postgres pgbouncer -c "SHOW CONFIG;" | grep -E "pool_mode|default_pool_size|max_client_conn|max_db_connections"
psql -p 6432 -U postgres pgbouncer -c "SHOW STATS;"
```
In `SHOW POOLS`, the tell-tale of the old problem is a non-zero **`cl_waiting`** (clients
queued for a backend) and **`maxwait`** climbing toward 30s. After the fix those should
sit near 0 under normal load.

## Then test
Reload an admin editor (e.g. Pages → Merlin 40), change a setting → the silent autosave
should complete in well under a second instead of the 34s→error.

## App-side companions (already in the repo, complementary — not the cure)
- `lockDocuments:false` on Pages/Posts/Messages (commit `04abf96`) — removes the
  per-save lock query (the first connection consumer / logged victim).
- With transaction-mode pgBouncer absorbing the backend cap, the app pool `max` (currently
  `VERCEL ? 2 : 10` in payload.config.ts) can safely be raised later if needed — but tune
  pgBouncer first and re-measure before touching it.

## If it still fails after this
Capture `SHOW POOLS` + `SHOW STATS` during a failing save and the pgBouncer log
(`/var/log/postgresql/pgbouncer.log` or journalctl) — the real reason (e.g.
`query_wait_timeout`, `server_login_retry`) will be there, which the app's drizzle wrapper
hides behind "Failed query".
