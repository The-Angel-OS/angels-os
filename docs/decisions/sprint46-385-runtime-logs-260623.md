# Payload 3.85.1 outage — runtime-log finding (260623, from Iam0)

Companion to the IONOS schema-diff doc (`sprint46-385-schema-diff-260623.md`, lives on
the IONOS box). This captures the runtime evidence the IONOS thread was blocked on
(its Vercel MCP was 403; Iam0's is authorized).

## What was pulled
- Project `prj_18HdwoPYXit5bEWMgSthSQ32PofF`, failed deploy `dpl_AtyUPFHeaN4vUbz4fiqwSqzgouTg`
  (commit `0f8da7c`, PR #133 merge, Payload 3.85.1).
- Deploy **built clean (state READY)** — the failure was purely at runtime.

## The signal
Every route 500'd from the first request, identically:
`/`, `/admin`, `/api/messages`, `/api/presence-ops/online`, `/api/node-ops/chat`,
`/api/gotify/poll`, `/api/email/poll`, `/api/presence-ops/ping`. **Total outage**,
07:02–07:05 UTC window.

All log lines are the generic Next 16 prod wrapper `Failed to handle /…?nxtP…` —
Next swallows the underlying exception, so Vercel runtime logs do **not** expose the
stack. Full-text searches against the deploy's logs for `does not exist`, `column`,
and `tenant` ALL returned **zero** matches.

## Interpretation
- It is **not** a single missing-column / relation-does-not-exist Postgres error
  (that text never appears, and a per-collection schema gap would not take down a
  near-static `/` and `/admin` identically on the very first hit).
- The shape — every route, including `/admin`, failing from request #1 — is the
  signature of a **Payload init-time failure** (`getPayload()` throws once, every
  route that awaits it 500s). Consistent with "error initializing Payload."
- This squares with the schema-diff finding: prod runs with **push off**, and 3.85's
  startup against the drifted live `angels` schema throws at init. 3.85 boots + pushes
  cleanly against a *fresh* DB (proven on `angelsdev`), so the bump is sound — the
  failure is schema-STATE, surfaced at init, not bad code.

## Decisive next experiment (best run on IONOS — it has pg + angelsdev + scripts)
Reproduce prod exactly to capture the hidden init stack:
1. Clone live `angels` (3.77) schema into a scratch DB (`angelsdev2`).
2. Run 3.85 Payload init against it with `PAYLOAD_SKIP_PUSH=true` (prod-mode: push off).
3. The thrown init error IS the stack Vercel hides — that names the exact column/table/enum.

## Forward path (de-risked, unchanged in shape)
3.85.1 is re-appliable. Land it via a **preview deploy** (never straight to prod):
- Point a preview at `angelsdev` (already holds the full 3.85 schema) and smoke it
  (home, /admin, save a page, re-publish page 40) BEFORE merge.
- For prod cutover, the live `angels` schema must be brought to 3.85 first — either a
  one-time controlled push or idempotent migrations for the structural delta
  (`permissions`, `vendors`, contacts campaign cols, MCP tool cols, drop
  `pages_breadcrumbs`) — matching this repo's existing onInit self-heal pattern
  (payload.config.ts ~L823–1027).

## FINAL VERDICT (260623, after two repros) — DECISION: parked on 3.77

Both schema/init theories are **disproven** by isolated repros:
- **Repro #1 (init, push off):** 3.85.1 `getPayload()` init succeeds against the 3.77
  schema — no throw, no missing-column error. (payload.config.ts has no `onInit`; the
  `/provision-ops/*` self-heal endpoints are manual, so this wasn't masked.)
- **Repro #2 (local prod build of the failed merge `0f8da7c`):** `next build` passes,
  `next start` serves `/`→200 and `/admin`→200, degrading gracefully even against a bare
  DB (static fallbacks, 403/503) — **no 500s**. The outage does NOT reproduce locally.

**Conclusion:** the outage is **Vercel-environment-specific** — the Turbopack prod bundle
on Vercel's serverless/edge runtime, not our code, Payload init, or schema. (Build warned
the `middleware` convention is deprecated → `proxy` in Next 16.2 — a candidate.) The 3.85
bump itself is sound.

**Decision (Ken, 260623):** PARK on stable 3.77. Prod is healthy on the revert (`3047410`).
Revisit 3.85 later in a dedicated Vercel-preview debug session (deploy `0f8da7c` as a
preview with deployment-protection OFF → `get_runtime_logs`; candidate quick-fix = webpack
prod build instead of Turbopack + `middleware`→`proxy` rename).

**Latent landmine to fix on its own:** `main`'s package.json pins
`@payloadcms/plugin-nested-docs` at `^3.85.1` while the rest of the Payload family is
`^3.77.0` — a fresh `pnpm install` on main pulls a 3.85 plugin into a 3.77 core. nested-docs
owns `pages_breadcrumbs` (the original publish-500 surface). Worth a deliberate cleanup.

**Reusable artifacts (untracked, kept):** `scripts/repro-385/repro-init.ts` (+README) —
guarded seed/probe harness, reusable for the future Vercel debug session.
