# Review & Test Guide — 260626 session

What this session built across the four repos, how to verify each piece, and the
pre-push safety checklist. Goal: tie off loose ends → test → one Core push.

**Repos:** Core `C:\Dev\angels-os` · Merlin `C:\Dev\merlin` · Nimue `C:\Dev\nimue` · Brain `C:\Dev\angel-brain` (`@angel-os/brain`)

---

## 0. TL;DR — what's shippable

| Area | Repo(s) | Deploy? | Status |
|---|---|---|---|
| Thread 4 — Merlin directory browser (tunnel-first + LAN-direct + Core-proxy) | Core + Merlin | Core deploy | built, tsc green |
| Crew → People (nav move) | Core | Core deploy | built |
| Membership self-heal fix (un-broke 3 callers) | Core | Core deploy | built, tsc green |
| Thread 7 — intelligence broker (resolve endpoint) | Core | Core deploy | built |
| Ollama provider — `:cloud` auth + model pin | Brain | free (rebuild dist) | built, **verified live** |
| Merlin `/api/ai` gateway (+ token metering) | Merlin | free | built |
| Brain broker-aware `resolveProvider` + `gateway` provider | Brain | free | built |
| Nimue cortex wired on (borrowed mind, cloud-first) | Nimue | free (app build) | built, tsc green |

**Migration safety: CLEAR.** No Core collection/field/global changed → no new
migration needed (verified — see §5).

---

## 1. Migration safety (DO THIS FIRST — the make-or-break check)

Core builds with `payload migrate && next build` (committed migrations, NOT dev push).
This session changed **only endpoints, UI, nav, and utilities** — no collections,
fields, or globals. Verify before pushing:

```powershell
cd C:\Dev\angels-os
# payload-types.ts must show NO content change (EOL-only is fine):
git diff --ignore-all-space src/payload-types.ts   # → empty = safe
# No new migration files expected:
git status --short src/migrations/                 # → empty
```

If `git diff --ignore-all-space src/payload-types.ts` is **non-empty**, STOP — a
schema change crept in and needs `pnpm migrate:create` before deploy.

---

## 2. Thread 4 — the Merlin directory browser

**What:** Core's MerlinControl "Media" tab is now a real filterable file browser
(replaced the iframe). Links resolve tunnel-first → LAN-direct → Core-proxy.

**Files:** Core `src/blocks/MerlinControl/View.tsx`, `src/endpoints/node-ops.ts`
(`nodeFilesPostHandler`, `nodeFilesGetHandler`, `nodeFileProxyHandler`); Merlin
`src/lib/nodeSkills.ts` (`listBrowsableFiles`, `resolveSharedRef`),
`src/app/(app)/api/shared/file/route.ts`, `src/lib/node-bus.ts` (`list_files` cmd + sentinel).

**Test (local, before deploy):**
1. Start Merlin dev; ensure it's registered to an endeavor and has a SHARED root
   (Shares page → mark a drive shared).
2. In Core (or `federation.kendev.co` after deploy) open the endeavor's MerlinControl
   → Media tab. Expect: a file list (not an iframe), a filter box, and a reachability
   line (green=tunnel / neutral=LAN / amber=node-network-only).
3. Filter by a filename substring → list narrows.
4. Click a file:
   - **tunnel on** → opens via `tunnelUrl/api/shared/file?ref=…`
   - **same LAN, no tunnel** → opens via `localIp:3000/api/shared/file?ref=…`
   - **remote, no tunnel** → friendly "open on the node's network" (no broken link)
5. Security: confirm a `ref` outside a shared root 404s (`resolveSharedRef` returns null).

**Bus path note:** the structured result rides the message text behind
`@@ANGELS_RESULT@@:<requestId>:<json>` because Core's `/api/chat/send` drops metadata.
Core parses it in `nodeFilesGetHandler`. Keep the sentinel in sync across repos.

---

## 3. Ollama `:cloud` + the Merlin gateway

**What:** `@angel-os/brain` can now use `:cloud` models (Bearer auth, routed to
`ollama.com`); Merlin `/api/ai` fronts Ollama with auth + policy + token metering.

**Files:** Brain `src/providers.ts` (`callOllama` cloud routing, `resolveProvider`
cloud pin); Merlin `src/lib/leoAgent.ts`, `src/lib/store.ts` (Settings +
`ollamaUrl/Model/ApiKey`), `src/globals/NodeSettings.ts`, `src/app/(app)/api/ai/route.ts`.

**Verified live (this session):** `nemotron-3-super:cloud` via local daemon →
HTTP 200, **structured `tool_calls`** (not hallucinated), ~1.2s, zero local GPU.

**Re-test the brain provider path:**
```powershell
# Daemon proxies :cloud when you're signed in (ollama auth login). Tool-call probe:
$body = '{"model":"nemotron-3-super:cloud","messages":[{"role":"user","content":"weather in Clearwater? use get_weather"}],"tools":[{"type":"function","function":{"name":"get_weather","parameters":{"type":"object","properties":{"city":{"type":"string"}}}}}],"stream":false}'
Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/chat" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90 -UseBasicParsing | Select-Object -ExpandProperty Content
# Expect message.tool_calls = [{ function: { name: "get_weather", arguments: { city: ... } } }]
```

**Test the Merlin gateway (`/api/ai`):**
1. Set on the node: `NODE_AI_KEY` (or reuse `NODE_SKILL_KEY`/`NODE_REGISTER_KEY`),
   and NodeSettings → Keys → `ollamaModel=nemotron-3-super:cloud`, `ollamaApiKey=<token>`.
2. POST to `http://<merlin>:3000/api/ai` with header `x-node-key: <key>` and body
   `{ "messages":[{"role":"user","content":"hello"}] }`.
3. Expect: the Ollama reply **plus** `angel_os.metrics` `{ tokensIn, tokensOut,
   tokensPerSec, evalMs, totalMs }` (the ~300 tok/s shows here), and an `ai-gateway`
   row in the activity log carrying the same metrics in `metadata`.
4. Policy checks: a model not in `MERLIN_AI_ALLOWED_MODELS` (when set) → 403; a
   `:cloud` model with no token → 400; an oversize prompt → 413; wrong/missing key → 403.

---

## 4. Thread 7 broker + Nimue cortex

**Broker (Core):** `GET /api/ai-broker/resolve?endeavor=&model=` →
`resolveProviderNodes()` ranks the node registry by `compute.models` + reachability
+ recency; returns ranked providers or `fallback:"cloud"`.
**Test (after Core deploy):** call it as an endeavor member; with a Merlin online
advertising `compute.models` incl. the model → `best.providerUrl` is that node's
`/api/ai`; with no provider → `fallback:"cloud"`.

**Brain broker resolution:** `resolveProvider` gains `brokerUrl/brokerEndeavor/
brokerModel/gatewayKey`; falls back to a `gateway` provider that POSTs to a peer's
`/api/ai`. Order: local key → local Ollama → broker → null.

**Nimue cortex (free, app build):** `installCortex()` now called post-auth in
`chat/page.tsx` (idempotent); `providerConfig` is cloud-first (`nemotron-3-super:cloud`
from Preferences/`NEXT_PUBLIC_OLLAMA_*`).
**Test (running app + token):** trigger a high-triage event (e.g. an `alert.posted`),
expect a `cortex.suggestion` event on the loop + a local signal-log entry. With no
token/provider it fails silent (reflexes still fire) — that's expected.

---

## 5. Pre-push checklist (Core)

```powershell
cd C:\Dev\angels-os
git diff --ignore-all-space src/payload-types.ts   # empty (no schema change)
git status --short src/migrations/                 # empty (no new migration)
npx tsc --noEmit *>&1 | Select-String "^src/"      # 0 src/ errors (tests/scripts ok to fail)
```

Staged Core changes that will deploy:
- `src/blocks/MerlinControl/View.tsx` — file browser
- `src/endpoints/node-ops.ts` — files browser + broker handlers
- `src/utilities/nodeBus.ts` — `resolveProviderNodes`
- `src/payload.config.ts` — route registrations only (no schema)
- `src/app/[locale]/(dashboard)/dashboard/nav-config.ts` — Crew→People
- `src/utilities/ensureTenantMembership.ts` + `autoActivatePendingMembership.ts`
  + `TenantMemberships/hooks/autoJoinSpaces.ts` + `layout.tsx` — membership self-heal
- `src/endpoints/booking-checkout.ts`, `src/endpoints/stripe-webhooks.ts`,
  `src/collections/EventRegistrations.ts` — `ensureTenantMembership` 2-arg caller fixes

**Free/local (no deploy) — already on disk:**
- `@angel-os/brain` rebuilt `dist` (copied into Merlin + Nimue node_modules)
- Merlin: gateway, settings, leoAgent, nodeSkills, node-bus, shared-file route
- Nimue: cortex wiring

**Deploy:** push to `main` → GitHub Action → Vercel. `payload migrate` runs first
(no-op this time) then `next build`.

---

## 6. Known loose ends (NOT blockers)

- **Crew/Tyler "hiccup":** code is sound; likely data (no Endeavor on the tenant, or
  Tyler lacks a tenant-membership). Confirm with the exact error post-deploy.
- **`snap_camera` over the bus:** Merlin handles it locally; no Core dispatcher yet.
- **Stale test files** (`ensureTenantMembership.test.ts`, `createLogger.test.ts`,
  `federation-domain.test.ts`) reference old signatures → fail tsc but are excluded
  from the Vercel build. Fix in a follow-up.
- **Economy metering → Core aggregation/mint:** designed (Thread 7 addendum); the
  meter now emits (`angel_os.metrics` + activity-log metadata) but Core-side
  aggregation + token mint is later.
- **Broker quota-balancing + Core↔Core compute federation:** later (Thread 7).
