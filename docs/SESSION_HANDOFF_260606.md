# Angel OS — Session Handoff (2026-06-06)

## Project
Multi-tenant Payload CMS 3.77 + Next.js 16 (Turbopack) + PostgreSQL.
Repo: github.com/The-Angel-OS/angels-os — branch `main` (push = Vercel auto-deploy).

**Two live sovereign nodes, separate DBs on one IONOS Postgres (74.208.87.243:5432):**
- Node A: `spacesangels.com` / `platform.spacesangels.com` (Vercel project `angels-os`, DB `angels`)
- Node B: `federation.kendev.co` (Vercel project `angels-os-kendev`, DB `kendev`)

**Local dev now points at KENDEV** (changed this session): `.env` and `.env.local` both
`DATABASE_URI=…/kendev`. The launcher (`scripts/dev-with-env.mjs`) loads `.env.local`
first, so it wins. To verify against production `angels` data (e.g. clearwater-cruisin
posts), flip the DB name `kendev`→`angels` (6-char change) — now SAFE because of the
push toggle below.

---

## ⚠️ Critical operational notes (read first)

- **`PAYLOAD_SKIP_PUSH=true`** (new, added to `payload.config.ts`, default unchanged):
  set it to run `next dev` against a remote/prod DB **without** mutating schema or
  hanging on the interactive migration prompt. This is what makes local-dev-against-prod
  safe. **Always set it** when pointing local dev at angels/kendev.
- **MCP schema bloat (known, prod-safe):** the MCP generator (bd5dbc8) makes
  `@payloadcms/plugin-mcp` create **one api-key column per tool (~122 columns)** in
  `payload_mcp_api_keys`. Production is **unaffected** (Vercel runs prod-mode, which
  doesn't auto-push — those columns just don't exist, only matters for per-tool MCP
  API-key scoping). But local `next dev` WITHOUT `PAYLOAD_SKIP_PUSH` hangs on the
  create-vs-rename prompt. Proper fix later: a migration to add the columns, OR rethink
  per-tool-column scoping.
- **Never orphan dev servers.** This session a repeated start/kill cycle left 25 orphaned
  node/Turbopack workers (~7 GB RAM) → 97% RAM → swap thrash → hung browsers. Bring up
  exactly ONE instance via `preview_start`, tear down via `preview_stop`. Nimue runs on
  :3000, so Angel OS dev lands on :3001.
- **Disk:** C: was at 98% after the video concat (49 GB free). Watch it; low headroom
  hurts swap.

---

## What shipped this session (all on `main`, deploying)

### AI provider system — the big arc
- **`75981a2`** `provision_tenant` LEO tool + shared `provisionPortal()` — LEO can stand
  up a complete custom-domain tenant (tenant + endeavor + nav/pages + ALL baseline spaces
  + admin link), the same path the super_admin Provision Portal uses. Idempotent.
- **`bd5dbc8`** MCP surface generated from `LEO_TOOLS` — every LEO tool reachable over MCP
  (was 2 of 122 hand-wired). `leoMcpTools.ts`; identity-gated via `selectToolsForUser` in
  `overrideAuth`. (Caused the 122-column thing above.)
- **`102c698`** Ollama local tier + health-aware failover (`ai-gateway.ts`). Env-gated on
  `OLLAMA_BASE_URL`. 30s health probe; local-first with cloud fallback.
- **`86db545`** Groq provider (OpenAI-compatible, reuses `createOpenAICompatible`).
- **`f875681`** Ordered provider registry — `getSmartModel` walks `resolveProviderOrder()`
  (env `AI_PROVIDER_ORDER`, default `ollama,groq,gateway`), first-available-for-tier wins.
  `attemptOllama/attemptGroq/attemptGateway`. This is the "configured = used" engine.
- **`7c927c2`** Tool subsetting for small/free providers (`selectToolsForModel` →
  `CORE_TOOL_NAMES`, ~18 tools for groq/ollama; gateway gets all). **Plus** space-create
  tenant fallback (below). **Plus** `PAYLOAD_SKIP_PUSH`.
- **`c37f13b`** Per-response telemetry into `Messages.metadata` (provider, model that
  ACTUALLY served, tier, in/out/total tokens, costCents, latencyMs, ttftMs, finishReason,
  toolCalls, failedOver). `aiUsage.ts` (pricing + cost). Fail-soft. Fixes the failover
  mislabel.

### Error observability (the "make LEO tell you when it can't" loop)
- **`d5c6330`** Surface the real provider error on the failed message + auto-recover on an
  error-part (retry on the high/gateway tier) + `logError` it to the AI Bus errors channel.
- **`3fc9bc1`** Render failed messages AS errors in chat — red bubble, hover "Show error"
  chip, click to expand a copyable monospace block (`MessageList.tsx` + `useChat` maps
  `metadata.error`/`errorDetail`).

### Bug fixes from live testing
- **`7c927c2`** "Could not resolve tenant" on `federation.kendev.co` space creation —
  hostname → slug "federation" (no such tenant). Now falls back to the user's own tenant.
- **`3ef72d1`** Related-posts cards showed "No image" — single-post page fetched at
  `depth:1`, leaving related posts' nested images as IDs. `loadRelatedPosts()` re-fetches
  at depth 2.

### Non-code (video pipeline)
- **F: dashcam concat** (`scripts/_local/concat_dashcam_f.py`, gitignored): 8 of 9 drive
  sessions from `F:\CARDV\Movie_F` concatenated losslessly into
  `C:\Users\kenne\Videos\Daily` (`YYMMDD Front HHMM-HHMM Dashcam.mp4` + .md). 1 session
  skipped for the 45 GB disk floor: **`260603 Front 1522-1751`** (~34 GB) — re-run the
  (idempotent) script after freeing ~35 GB. Keep the F: card until then.
- **260427 8K rollup:** concatenated 37 segments →
  `E:\DCIM\Daily\260427 - Dunedin Marina\_segments_260427\260427 8K Rollup Dunedin Marina.mp4`
  (8K HEVC + AAC, 39:06, 17.67 GB, verified). The earlier failure was a corrupt segment
  since fixed by a second-pass rebuild; all 37 probed byte-uniform first. `-c copy` +
  `-video_track_timescale 30000` (the mandatory dashcam timescale fix).

---

## KEY DECISION: Groq free tier is a dead end for LEO
Live testing proved it. The new error UI surfaced the real cause: **Groq free = 8000 TPM**,
but LEO's request is ~10–12k tokens. Tool subsetting cut it 12234→10103 (tools were ~2k),
but the remaining ~8000+ is **LEO's system prompt + conversation context** — which IS LEO;
can't trim below the ceiling without lobotomizing it. And Groq **Dev Tier is blocked from
new subscriptions**. So:
- **User set `AI_PROVIDER_ORDER=gateway,ollama,groq` on both Vercel nodes** → gateway is
  primary (instant answers, no per-turn Groq-fail→failover tax); Groq is last-resort.
- The failover **works** (Groq 413 → retry on Claude → streams back) — confirmed in prod.
- **The real free-intelligence path is the local Ollama node** (no TPM cap; `num_ctx` set
  big enough for LEO's full payload). Groq was the interim probe; it proved the failover
  and taught us the system-prompt floor.

---

## Config state (what the user has set)
- `GROQ_API_KEY`: both Vercel nodes (NOT in local `.env`).
- `AI_PROVIDER_ORDER=gateway,ollama,groq`: both Vercel nodes.
- `OLLAMA_BASE_URL` / CF Access vars: **not yet** (waiting on IAM0 + Cloudflare tunnel).
- Local `.env`/`.env.local`: `DATABASE_URI=…/kendev`; local has `ANTHROPIC_API_KEY` only
  (so local LEO answers via Claude direct, not Groq).

## kendev node access (for local dev / testing)
3 users in the kendev DB, all created by `scripts/_local/seed_kendev_node.mjs` with the
**same temp password `KendevTemp2026!`** (super_admin): `kenneth.courtney@gmail.com`,
`clearwatercruisin@gmail.com`, `tylersuzanne84@gmail.com`. (Repo seed uses different
accounts: `hello@spacesangels.com` / `angelos`.)

---

## Open work / todos
- **#18 `ai-usage` collection** — aggregation table (cost/tenant/day, tokens by model, p95
  latency). New prod table → careful additive-table-first migration. Per-message metadata
  already covers queryable today.
- **#17** Spaces/Channels chooser name truncation (UI polish).
- **#10 / #8** DB-backed provider order + drag-drop AI settings panel.
- **#12–#15 ITSM** (Incidents → Problem → Requests → CMDB) — model on ServiceNow; LEO as
  L1 agent. The recurring error-log entries (IMAP, youtube-poll) are textbook Problems.
- **#16** Unified Person/identity (Users ⇄ Contacts ⇄ everything) — the "hanging flower
  pot" keystone; foundational under CRM + ITSM.
- **IAM0 / Cloudflare Tunnel / Ollama** — stand up the local free-intelligence node
  (`OLLAMA_BASE_URL` + CF Access service-token; recommend model `qwen2.5:7b`). Runbook in
  the conversation.
- **MCP 122-column migration** — so per-tool MCP api-key scoping works in prod.
- **Community space + name on kendev** — heal via
  `GET federation.kendev.co/api/provision-ops/ensure-spaces?tenant=kendev`; name options:
  "Community Hub" / "The Commons" / "Town Square".
- **Verify after deploy:** related-posts thumbnails (live), Groq→gateway routing, the
  per-response telemetry (open a message's `metadata` in Payload Admin).
- **Finish 260603 dashcam session** (~34 GB) once C: has room.

## Standing orders / philosophy
- Push to main when done (Vercel auto-deploys). Always `pnpm build` before commit.
- Never run `pnpm dev` against a prod DB WITHOUT `PAYLOAD_SKIP_PUSH=true`.
- Schema changes on prod = the #1 outage risk (Sprint 44). New tables = additive/lower
  risk; Tenants-field changes = column-first-or-outage. Do schema deliberately.
- "Configured = used" — providers are opt-in by config; support as many as possible with
  visibility into which actually served.
- CTO mode: autonomous, make it work; "break it and fix it"; headless/API-first.
- Decaying polls everywhere; `select` to limit fields; thread `req` for transactions.
