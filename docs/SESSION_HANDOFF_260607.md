# Angel OS — Session Handoff (2026-06-07)

You are Claude Code (Opus 4.8), CTO mode: autonomous, make it work, **push to main when done**
(Vercel auto-deploys both nodes). Repo: `C:\Dev\angels-os` (multi-tenant Payload 3.77 +
Next 16 + Postgres). Read the auto-loaded memory first (esp.
`project_ai_provider_system.md` and `project_comms_layer.md`).

## Standing rules (non-negotiable)
- **`pnpm build` must pass before every commit.** Push to main = prod deploy to both nodes.
- **Local dev against a prod DB is safe ONLY with `PAYLOAD_SKIP_PUSH=true`** (in `.env.local`).
  Local `.env`/`.env.local` → `kendev` DB; flip the db name to `angels` (6 chars) to verify
  Node A prod data. Bring up ONE dev server via `preview_start` (lands on :3001; Nimue owns
  :3000), tear it down after — never orphan node workers.
- **SCHEMA DISCIPLINE is the #1 outage risk.** Two traps, both hit this sprint:
  1. New **Tenants field / select-enum option** without the prod column/value FIRST = outage.
     Adding a value to a `select` field = a Postgres `ALTER TYPE ... ADD VALUE` on each prod DB
     before/with deploy. Prefer storing config in existing `json` fields to avoid enum churn.
  2. New **collection** needs its table created on each prod DB (Vercel prod-mode does NOT
     auto-push) **AND** a per-collection FK column `<slug>_id` added to
     `payload_locked_documents_rels` (Payload's `checkDocumentLockStatus` joins one column per
     collection — miss it and EVERY create/update/delete throws "column does not exist", e.g.
     LEO silently fails to save). Keep writers fail-soft so deploy is safe before the DDL lands.
- Two live nodes: `spacesangels.com` (DB `angels`, Vercel `angels-os`) ⇄
  `federation.kendev.co` (DB `kendev`, Vercel `angels-os-kendev`), same IONOS PG (74.208.87.243).
- DB ops helper: `node scripts/_local/<x>.mjs`; pg lives at
  `node_modules/.pnpm/pg@8.16.3/node_modules/pg`. tsx CLI:
  `node ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs <script>`.

---

## What shipped recently (all on `main`, deployed)
- **Operating-Costs system (complete):** `cost-events` ledger (categories
  intelligence|telephony|storage|infra|other), AI Costs panel `/dashboard/ai-costs` +
  `GET /api/cic/ai-costs`, per-tenant AI budgets + **gated** BYOK enforcement
  (`AI_BUDGET_ENFORCEMENT=true`), fee reconciliation (surplus→Justice, non-extractive). Cost
  sources: leo-stream (AI), vercel-spend (infra), `/api/webhooks/livekit` (telephony),
  `/api/cost-ops/storage-probe` (storage). ~47 unit tests. See `project_ai_provider_system.md`.
- **Lexical legacy-list fix:** `src/components/RichText/normalizeLegacyLexical.ts` — rewrites
  pre-3.x `unordered-list`/`ordered-list` nodes → modern `list` so old pages stop rendering
  "unknown node" / crashing. Verified live.
- **cost-events lock-rels fix:** added `cost_events_id` to `payload_locked_documents_rels` on
  both prod DBs (the regression above). Verified.

## Pending operational toggles (safe defaults; flip when ready)
- Schedule `/api/cost-ops/storage-probe` monthly (cron / `vercel.json`); ran once for 2026-06.
- Point LiveKit project webhooks at `/api/webhooks/livekit`.
- `AI_BUDGET_ENFORCEMENT=true` per node when validated.
- No Payload **migration file** for `cost-events` yet — fresh federation nodes need the table
  (and the locked-rels column) created. `scripts/_local/create_cost_events_table.mjs` holds the
  verified DDL (incl. the locked-rels column).

---

## ✅ PRIMARY TASK — Gotify connector — DONE (2026-06-07)

Shipped on `main` (commits `f3c7f5d` connector, `7f34909` relocation, `2ab2352`
owner guard). Receive-poll + transmit + escalation (error/warning wired via
logError; budget/failover are a documented seam), probe, AI-Bus `gotify` channel,
+25 tests. Enum `gotify` added to BOTH prod DBs. Endpoint live + auth-gated on
both nodes. Connector UI moved to **Account → Integrations** (owners self-serve).
Full operator guide: [`docs/integrations/GOTIFY.md`](integrations/GOTIFY.md).
**To go live:** create a Gotify connector (or set `GOTIFY_*` Vercel env) per node
+ point Gotify/Uptime-Kuma at the app token.

<details><summary>Original task spec (for reference)</summary>

## PRIMARY TASK — Gotify connector (receive + transmit + escalation configurator)

Stand up **Gotify** (`https://gotify.kendev.co`) as a first-class **Connector**, behaving like
every other connector (Connectors collection, ConnectorsAdmin UI, connector-test,
connector-health-cron, AI-Bus routing, fail-soft). Reference the existing patterns:
`src/collections/Connectors/index.ts`, `src/endpoints/connector-test.ts`,
`src/endpoints/connector-health-cron.ts`, `src/endpoints/email-poll.ts`,
`src/endpoints/youtube-poll.ts`, `src/endpoints/bridge-inbound.ts`, the AI-Bus (Messages +
`getAiBusActivity`), and `logError`.

### Gotify primer (two token types — important; Gotify prefix tells them apart: `A…`=app, `C…`=client)
Server: `https://gotify.kendev.co`. **All tokens are in `.env.local` (gitignored) — reference by
name, never paste raw values into committed files. For prod, set them as Vercel env vars on each
node (or store in the connector `config` jsonb, encrypted).**
- **App token** (Gotify → Apps) = **SEND**. `POST {server}/message` header
  `X-Gotify-Key: <appToken>` (or `?token=`), body `{title, message, priority, extras}`.
  Per node: `GOTIFY_APP_TOKEN_FLAGSHIP` (→ angels/spacesangels), `GOTIFY_APP_TOKEN_KENDEV`
  (→ kendev). `GOTIFY_APP_TOKEN` = this node's own (local defaults to the kendev one).
- **Client token** (Gotify → Clients) = **RECEIVE**. `GET {server}/stream?token=<client>`
  (WebSocket) or `GET {server}/message?token=<client>&since=<id>&limit=N` (REST poll).
  `GOTIFY_CLIENT_TOKEN` (client name `spacesangels`).

### Requirements
1. **Add connector type `gotify`** to `Connectors.type` (select). ⚠️ Enum value = prod
   `ALTER TYPE enum_connectors_type ADD VALUE 'gotify'` on BOTH DBs before/with deploy. Put all
   Gotify settings (serverUrl, appToken, clientToken, lastSeenMessageId, escalation policy) in
   the existing `config` json field — **no other schema change**.
2. **RECEIVE (inbound):** mirror Gotify messages onto the AI Bus the same way email/youtube
   polls do — so the dashboard + LEO see what the Android client sees (e.g. the Uptime-Kuma
   up/down alerts for "KenDev Next Commerce Admin", "KenDev Notes", etc.). **Serverless-friendly
   = POLL** `GET /message?since=<lastSeenMessageId>` from `connector-health-cron` (or a new
   `gotify-poll`), dedupe by Gotify message id, persist new ones as Messages (messageType e.g.
   `system` or a new `gotify_message`) routed to the connector's channel. Update
   `lastActivity`/`error_message` like other connectors. (A WebSocket `/stream` variant can run
   on a long-lived node like Nimue later; Vercel uses the poll.)
3. **TRANSMIT (outbound):** `src/utilities/gotifyNotify.ts` — fail-soft `POST /message` with the
   app token. Title/message/priority/extras. Resolve the gotify connector per tenant (or a
   platform-level one).
4. **ESCALATION CONFIGURATOR:** an escalation policy stored on the connector `config` — which
   Angel OS event types push to Gotify and at what Gotify priority. Candidate sources already in
   the system: `logError` (errors/warnings → AI Bus errors channel), AI **budget exceeded** /
   cost thresholds (cost system), provider **failover**, vercel-spend criticals, federation
   admission/trust, new orders/donations, booking events, (future) ITSM incidents. UI:
   `dashboard/admin/connectors` (ConnectorsAdmin) — toggles per event type + min severity +
   priority mapping, exactly like configuring any other connector. Central **dispatcher** taps
   those sources and fans matching events to enabled gotify connectors (fail-soft, deduped,
   rate-limited so we don't recreate the Uptime-Kuma flap-storm).
5. **connector-test:** "Test" sends a test Gotify notification (validates app token) and/or
   fetches latest messages (validates client token); report success/error into the connector.
6. Tests: unit-test `gotifyNotify` (fail-soft + payload mapping), the poll dedupe/parse, and the
   escalation policy matcher. Build-gate, commit, push.

### Suggested build order
scaffold type+config (json, no enum churn locally) → `gotifyNotify` + connector-test (prove
send) → inbound poll → escalation dispatcher + ConnectorsAdmin config UI → add the prod enum
value on both DBs → deploy → wire the app token. Discuss the plan briefly, then build.

</details>

---

## Secondary / still-open
- ITSM (#12–15: Incidents→Problem→Requests→CMDB, ServiceNow-style, LEO as L1) — the Uptime-Kuma
  flapping (KenDev Next Commerce Admin 500s, ECONNRESET) is a textbook Problem to auto-open.
  Gotify inbound is a natural feeder for this.
- #16 Unified Person/identity (Users ⇄ Contacts).
- #17 Spaces/Channels chooser truncation (add `title` tooltips).
- #10/#8 DB-backed provider order + drag-drop AI settings panel.
- Flip AI Costs panel spend source to the ledger once it has history.
- **8K video (done, not filed):** fixed Dunedin rollup (omit seg_033, lossless) is at
  `C:\Users\kenne\AppData\Local\Temp\seg_fix\260427 8K Rollup Dunedin Marina.mp4` (14.75 GB,
  30:24, hvc1). Move it out of %TEMP% to E: when convenient; the broken original is still on E:.
  `seg_fix/` holds ~19 GB of `.ts` intermediates that can be deleted.

## User preferences
- Push to main when done. "CTO mode" autonomous. "Break it and fix it." Headless/API-first.
- Decaying polls everywhere; `select` to limit fields; thread `req` for transactions.
