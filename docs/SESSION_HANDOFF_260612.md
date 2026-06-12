# Session Handoff — 2026-06-12

Continuing the Angel OS thread (`C:\Dev\angels-os`, branch `main`).

> Read the auto-memory first (`MEMORY.md` + linked files) — especially
> `project_token_economy`, `project_catalog_offerings`, `project_processor_pipeline_audit`,
> `project_schema_field_deploy_rule`, `project_deep_link_navigation`, `project_draft_mode_404`.
> They hold the deep detail; this is the live state + open threads.

## Shipped recently (all on prod, both DBs)

- **Observability:** `createLogger` + `ExecutionTrace`; LEO tool-chain audit on
  `executeToolCall` (→ `Message.metadata.toolChain`); connector-agnostic
  `dispatchEscalation` (gotify / telegram / webhook).
- **Token economy:** hash-linked `tokenLedger` → `TokenLedger` + `Wallets`
  collections → `creditQuestPayout` (quest approval pays AT from the Diocese float)
  → `fundFloat` (controlled issuance) → `GET /api/wallet-ops/balance` (read API).
  Proven end-to-end on the kendev DB. Bambara → Phase-3 appendix
  (`docs/vision/ANGEL_CHAIN_TECH_APPENDIX.md`).
- **Catalog / Offerings (Option B):** `Services` collection (promoted from the static
  `bookableServices`) + `resolveServices` (DB-first, static fallback) → shared
  `OfferingConfigurator` UI → Business Ops nav (Services + Quests) → **three pricing
  models** (fixed / hourly / per-unit) → **metered hourly billing** (`meterHourly` +
  `POST /api/booking-ops/clock|add-cost|finalize`, state on
  `Bookings.metadata.workSession`). Ron's $50/hr hourly service created on Harpazo.
- **Spaces:** shared persisted `surfaceStore` so the main Spaces tab
  (`DashboardContext`) and the chat side viewer (`ChatProvider`) sync the
  space/channel and survive navigation.
- **Diagnostics:** `GET /api/provision-ops/tenant-doctor` (read-only ownership map).

## Open threads (pick up here)

1. **spacesangels.com Discovery cards show no images.** The platform tenant
   (id 1, slug `platform`, domain `www.spacesangels.com`) has **no home-page
   `meta.image`** set and **no Header/Footer doc** — so its nav is the code default
   (which is why the new `/contact` page never appeared in nav). Fixes: set the
   platform home page meta image; create a platform Header doc, or a scoped
   `nav-repair?only=/contact` (the existing `nav-repair` appends *all* missing
   defaults — too blunt for a curated nav).
2. **Dead-code cleanup.** `settings` collection + `SettingService` have **zero
   consumers** (confirmed) — remove or wire. `site-settings` (donate page, app
   layout, LEO tools) and Endeavor settings are live — keep. A **broader dead-code
   audit** was offered (unused exports, orphaned files, registered-but-unhit endpoints).
3. **Catalog next:** dashboard **clock widget** over the booking-ops endpoints;
   **LEO tools** (`create_service`, `create_quest`, `clock`); migrate booking
   consumers from sync `getBookableServices` → async `resolveServices`; per-quest
   `tokenKind` field on `quests.payout`.
4. **Token economy next:** convertibility exchange (AT → USD, KYC-gated,
   Justice-Fund/float-backed; KC non-cashable); dashboard wallet widget; Phase-3 chain.
5. **Latent:** posts + pages still have the draft-mode 404 bug (only products fixed —
   `project_draft_mode_404`); ~25 pre-existing `tsc` errors in test files
   (`recordCostEvent`, `federation-domain`); `settings` table missing on the angels DB
   (harmless while the collection is dead).

## Critical operational gotchas

- **Two prod DBs from one `main`:** `angels-os` (spacesangels.com → **angels DB**) +
  `angels-os-kendev` (kendev.co / harpazo → **kendev DB**), both auto-deploy from main.
- **Prod runs neither Payload push nor deploy-time migrations** → a new collection
  needs the 3-step ritual: `db-repair-locks` (rels `<collection>_id` cols) + an
  `ensure-*-table` endpoint (CREATE TABLE/TYPE via the node's own pool) + a local pool
  script for the kendev DB. New tables don't cause a site-wide outage by themselves;
  the rels-column drift does.
- **Local `.env` points at the kendev DB.** Reach the angels DB **read-only** by
  swapping `/kendev` → `/angels` in `DATABASE_URI` with a **raw `pg` client** — never
  `getPayload` (push risk against the live prod schema).
- **A green git push ≠ live** — verify the Vercel deploy reaches `READY`
  (`list_deployments` via the Vercel MCP). `db-repair-locks` / `ensure-*-table`
  endpoints are gated by `?key=<CRON_SECRET>`.
- **Avoid all-caps Payload field names** — they snake_case ambiguously (use `priceUsd`,
  not `priceUSD`).

## Suggested first move

Confirm the next target. The obvious candidates are **#1** (Discovery images /
platform Header doc) and **#2** (dead-code cleanup, starting with `settings` /
`SettingService`).
