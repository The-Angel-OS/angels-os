# Nimue Android Client + Payload 4 + CI/CD — Master Plan

**Date:** 2026-05-29
**Author:** Claude (CTO mode) + Kenneth
**Status:** Proposed — awaiting one decision (deploy target, see §4.1)
**Repos in scope:**
- `angels-os` (`C:\Dev\angels-os`, github.com/The-Angel-OS/angels-os) — the platform (Payload 3.x + Next 16), source of truth.
- `nimue` (`C:\Dev\mediaserver`) — the "Angel OS Node": Next 15 client shell, future Android/iOS app.

---

## 0. TL;DR

**North star:** Nimue becomes the **Mobile Starfleet OS Client** — a full, offline-first Angel OS *node* in your pocket (federation participant + capture device), not just a viewer. v1 is a faithful client that runs in a graceful limited-capacity mode when offline; Starfleet-grade federation/on-device-LEO features are a deliberately-scaffolded v2 track (§9).

Four workstreams, sequenced so each unblocks the next:

1. **Nimue → faithful, offline-first Angel OS client** — port the real streaming chat (Merlin/Leo/Nimue) from angels-os, then move the data layer from on-device Next API routes to direct remote Payload calls with an **`idb`-primary store + outbox/sync engine** (offline-first, not just a cache — §2.4).
2. **Package as Android** — install Capacitor, static-export the client behind a `mobile` build flag, `cap sync android`, build an APK/AAB in Android Studio.
3. **Payload 4 readiness** — tag `v3-stable`, open a long-running `major/payload-v4` branch, gate transitional code behind `PAYLOAD_MAJOR`, define rollback = redeploy the tag.
4. **CI/CD** — extend angels-os CI with integration tests + a migration-safety gate + an explicit deploy step, and add a separate Android build workflow for Nimue.

The single biggest hidden cost is **#1's data-layer swap**: `nimue/src/lib/payload-client.ts` caches with Node `fs` and the UI calls on-device `/api/*` routes. On a phone there is no Node server and no fs — so "client-only" means rewriting the fetch+cache layer to run in the browser against the IONOS-hosted Payload.

---

## 1. Current State (verified 2026-05-29)

### Nimue (`mediaserver`)
- Next 15.5, React 19, `nimue@2.0.0`, "Angel OS Node".
- **Routes already mirrored**: `book`, `cameras`, `cic`, `connect`, `content`, `inbox`, `infra`, `inventory`, `keys`, `learn`, `leo`, `log`, `media`, `recording`, `spaces`, `youtube`.
- **Offline/native infra present**: `@ducanh2912/next-pwa`, `idb`, `livekit-client/server`, `better-sqlite3`, `axios`.
- **`src/lib/payload-client.ts`**: live→cache→offline fallback — but caches via Node `fs` under `data/payload-cache/` (server-only).
- **`capacitor.config.ts`**: present and well-formed (`appId: com.angels.nimue`, `webDir: 'out'`), but **Capacitor packages are not installed yet** and there is no `npx next export` wired.
- **Chat gap**: `src/app/leo/page.tsx` is a simple non-streaming chat → POSTs to local `/api/angels/leo` with modes `chat | chapters | hashtags | optimize`. No SSE, no persona routing, no LEO tool calls.

### angels-os
- Real chat lives in `src/components/ChatControl/useChat.ts` (SSE), `src/endpoints/leo-stream.ts`, 118 LEO tools, Merlin/Leo/Nimue personas (per project memory).
- **CI** (`.github/workflows/ci.yml`): `typecheck` (tsc --noEmit) + `unit-tests` (pnpm test:unit) + `build`, plus a Resend failure-email job. **No** integration tests, deploy step, or tags.
- Branches include `client/lite` (prior lite-client attempt — **reviewed, see §1.1**).
- Production: IONOS leased server runs Postgres + always-on; `www.spacesangels.com` served from there (recent session fixed tenant/domain resolution).

### 1.1 `client/lite` → `angel-client` (the chosen base, reviewed 2026-05-29)
Branch off **angels-os**, checked out as a worktree at **`C:\Dev\angel-client`** (`angel-client` v0.1.0, Next 16). Harvested + stripped angels-os (~521k deletions) into a lean client. Three commits: baseline harvest → Dexie offline mirror + sync engine → TDD foundation + photo-inventory.
- **Real:** `src/lib/sync-engine.ts` (242 LOC, Dexie-4 offline mirror, *pull* side, abstracted `payloadFetch`/`payload-client`); `src/lib/inventory.ts` (407) + `src/components/inventory/CameraCapture.tsx` (204) + 229-LOC test (capture-first, TDD).
- **Stubs (17 LOC each — same gaps as mediaserver-Nimue):** `src/app/leo/page.tsx` (chat, TODO "reuse useChat.ts"), `src/app/keys/page.tsx` (identity/DID, empty).
- **Missing:** outbox/write-replay (only pull is built), Capacitor, real chat, identity. Still carries `payload` deps (not fully client-only yet).

**Decision (§7.5):** `angel-client` is the **canonical Nimue base** — it owns the hard data layer. Rebrand it Nimue, add the WDEG Capacitor shell (§3.1), build the outbox/write half, port the real SSE chat, and bring `mediaserver`'s media/LiveKit features in as modules. `mediaserver` itself is repurposed as the separate media-server/ingestion/PAN service (§7.5), not a client.

---

## 2. Workstream 1 — Nimue as a Faithful Angel OS Client

### 2.1 Port the real chat (the explicit ask: Merlin/Leo/Nimue)
- Bring over from angels-os, adapted to Nimue's `components/ui`:
  - `ChatControl/` (the streaming chat surface), `MessageInput.tsx` (rAF resize fix from memory), and the SSE consumption logic in `useChat.ts`.
- **Point the SSE at the mothership, not a local route.** Replace `/api/angels/leo` with the remote `leo-stream` endpoint on IONOS, e.g. `POST {ANGEL_OS_URL}/api/leo-stream`. Carry the persona selector (Merlin/Leo/Nimue) and the `Authorization: JWT` header.
- Keep memory's known fixes intact when porting: depth=1 in `useChat`, the `case 'images':` SSE handler, history truncation >2000 chars, no collection-slug endpoint prefixes.
- **Replace `useChat`'s polling with pure SSE** for the mobile target (polling drains battery; the stream already pushes).
- Acceptance: from Nimue, send a message and watch tokens stream in; switch personas; render an image LEO emits mid-stream.

### 2.2 Become a true client of Payload (the "transpile to client-only" ask)
This is the load-bearing change. Today the UI calls on-device Next routes; that can't ship on a phone.

- **Introduce a build/runtime target flag**: `NEXT_PUBLIC_TARGET = 'desktop' | 'mobile'`.
  - `desktop` (today): Node server, local-disk media (`movies`/`stream`/`thumbnail`), fs cache — unchanged. This keeps the always-on media server working; **do not blow it out.**
  - `mobile`: static export, no Node routes, all data via remote Payload + `idb`.
- **New browser data layer** (`src/lib/payload-remote.ts`): `fetch` directly to `{ANGEL_OS_URL}/api/<collection>` (REST) — or GraphQL where lighter — with an `idb`-backed cache mirroring today's live→cache→offline contract. Retire the `fs` paths from `payload-client.ts` for the mobile target (keep them for desktop).
- **Auth**: Payload REST `/api/users/login` → JWT stored in Capacitor `Preferences` (secure) → attach `Authorization: JWT <token>` to every fetch + the SSE request. Refresh on 401. **Never** persist passwords; login UI collects credentials, app stores only the token.
- **Audit every `/api/*` call the client makes** and classify:
  - (a) Pure Payload data → swap to remote REST/GraphQL.
  - (b) Desktop-only (local disk: media/stream/thumbnail/srt) → hide behind `desktop` target; these are not mobile features.
  - (c) Genuinely needs a server (e.g., signing LiveKit tokens) → must hit a remote angels-os endpoint, and is **online-only** (degrade gracefully offline).
- Acceptance: with `NEXT_PUBLIC_TARGET=mobile pnpm build && npx next export`, the `out/` bundle loads, logs in against IONOS, browses CMS content, and chats — with airplane-mode showing cached content + an offline badge.

### 2.3 Faithful UI parity
- Reuse angels-os Tailwind tokens/theme so the look matches 1:1. Diff the two `globals.css` / design tokens and reconcile.
- Port shared primitives the chat depends on; avoid re-styling.

### 2.4 Offline-first, limited-capacity mode
The mobile target is **offline-first**, not online-with-a-cache. `idb` becomes the *primary* store the UI reads from; the network is a sync layer that refreshes it. The app is always usable; capability degrades gracefully when disconnected and the UI says so plainly (a connection pill — Nimue already has `ConnectionPill.tsx` + `@capacitor/network`).

**Capability tiers (what works at each connectivity level):**

| Capability | Offline (cached) | Online |
|---|---|---|
| Browse CMS content (pages, spaces, posts) last synced | ✅ read-only | ✅ live |
| Read past chat threads / messages | ✅ from `idb` | ✅ live |
| **Send a chat message to LEO/Merlin/Nimue** | ⏸ queued (outbox) → sends on reconnect | ✅ streams |
| Local on-device LEO (tiny model, canned/tool-free replies) | ✅ *stretch* (see §9) | ✅ full model |
| Create/edit content (drafts, notes, captures) | ✅ stored locally, sync-on-reconnect | ✅ |
| Media capture (camera/photo/voice) | ✅ saved to device | ✅ + upload |
| Federation / dispatch / payments / image-gen | ❌ online-only, degrade with clear notice | ✅ |
| Auth | ✅ if token still valid (cached JWT) | ✅ refresh |

**Mechanics:**
- **Outbox pattern** for all writes (chat sends, content edits, captures): queue to `idb` with a client-generated id + status (`pending|syncing|synced|failed`), replay against remote Payload on reconnect, reconcile ids. This is the single most important offline primitive — build it once, reuse everywhere.
- **Sync engine**: on reconnect (Capacitor Network event) run a delta sync — pull updated collections since `lastSyncedAt`, push the outbox. Last-write-wins to start; flag conflicts for later CRDT work (§9).
- **Token survival**: cached JWT in Capacitor Preferences keeps the app authenticated offline until expiry; queued writes carry it.
- **Honest UX**: every online-only action shows *why* it's unavailable offline rather than failing silently; queued actions show a "will send when back online" state.
- Acceptance: airplane mode → browse cached spaces, read threads, compose a chat message (it queues), take a photo; turn network on → outbox drains, chat send streams a reply, capture uploads.

### 2.5 Faithful UI parity / deliverables

**Deliverables:** streaming persona chat in Nimue; `payload-remote.ts` + `idb` primary store; **outbox + sync engine**; `NEXT_PUBLIC_TARGET` flag threaded through next.config + data layer; connection-tier UX wired to `@capacitor/network`; route audit table committed to `mediaserver/docs/`.

---

## 3. Workstream 2 — Android Packaging

Prereqs: Android Studio updated (in progress), JDK 17, Android SDK + platform-tools.

1. `pnpm add @capacitor/core @capacitor/cli @capacitor/android @capacitor/preferences @capacitor/network @capacitor/splash-screen @capacitor/status-bar` (add `@capacitor/ios` later).
2. Wire static export: `output: 'export'` gated by `NEXT_PUBLIC_TARGET=mobile` in `next.config.js` (Nimue's config comment already anticipates this). Resolve any `dynamic`/SSR-only code paths under the mobile flag.
3. `npx cap add android`; confirm `webDir: 'out'`.
4. Dev loop: `CAP_SERVER_URL=http://192.168.0.234:3000 npx cap run android` (live-reload against the desktop dev server) — already supported by `capacitor.config.ts`.
5. Release build: `NEXT_PUBLIC_TARGET=mobile pnpm build && npx next export && npx cap sync android` → open in Android Studio → `assembleRelease` / `bundleRelease`.
6. Config the remote endpoint: ship `NEXT_PUBLIC_ANGEL_OS_URL=https://www.spacesangels.com` (or the API host) so the APK talks to production by default.
7. Native niceties: splash/status bar already configured; add `@capacitor/network` to drive the offline badge; map LiveKit permissions (camera/mic) in `AndroidManifest.xml`.

**Deliverables:** installable debug APK on a device hitting production Angel OS; documented release-build steps; signed AAB checklist (keystore handling — keystore **never** committed).

### 3.1 Proven reference — WDEG (`com.wdeg.devotional`)

This pipeline is **not theoretical on Kenneth's machine** — the WDEG app ("Where Did Everyone Go?", published to Play Store 2026-02-15) is the same architecture, already shipped via Android Studio. Forensics from the installed APK (ADB pull, 2026-05-29):

- `assets/capacitor.config.json`: `{ appId: "com.wdeg.devotional", webDir: "out", server.androidScheme: "https" }` — **Capacitor wrapping a Next.js App Router static export**.
- `assets/capacitor.plugins.json`: `[]` — zero native plugins.
- `assets/public/_next/static/...` with route group `(frontend)` and `book/[chapter]` pre-rendered via `generateStaticParams` to 26 static `book/page-NNN/index.html` files. No `api/` routes, no `route.js` — pure static, no `server.url`.

**WDEG is the "everything baked in" extreme of the same spectrum Nimue lives on.** It proves the toolchain, JDK, SDK, and signing keystore all work here. Nimue's only delta from WDEG:

| | WDEG (shipped) | Nimue (target) |
|---|---|---|
| Shell | Capacitor `webDir:out` | same |
| Web | Next static export | same |
| Content | baked into APK (static HTML) | remote Payload + idb cache |
| `server.url` | none (bundled offline) | optional (dev live-reload only) |
| Plugins | `[]` | +Preferences/SplashScreen/StatusBar |
| Auth | none | anonymous-first, opt-in JWT→DID |
| Routes | `book/[chapter]`→26 static | static **shell** + dynamic data hydration |

Implication for §2.2/§2.4: the **shell** can pre-bake exactly like WDEG (static export of the route tree), while **data** hydrates from idb→remote. This "static shell + dynamic data" hybrid is the concrete target; WDEG shows the shell half already works end-to-end. Mirror WDEG's minimal config first, then add the data layer — don't over-configure plugins up front.

---

## 4. Workstream 4 — Payload CMS 4 Major Flag + Rollback

A framework major can't be runtime-flagged; the flag belongs in **git + deploy**, with a thin app-level constant for transitional branching.

1. **Tag the known-good v3 state now:** `git tag -a v3-stable -m "Last Payload 3.x release before v4 migration"` and push. This tag *is* the rollback target.
2. **Snapshot the production DB** before any v4 work (Payload 4 may require schema migration that isn't trivially reversible).
3. **Long-running branch:** `major/payload-v4` off `main`. All v4 work lands there; `main` stays v3 and deployable until cutover.
4. **App-level constant** `PAYLOAD_MAJOR = 3 | 4` (env-driven) for the handful of places that must branch during the transition window (plugin option shapes, type imports). Delete it after cutover — it is a transition shim, not a permanent feature flag (per repo norms: no long-lived compat shims).
5. **Migrations:** generate + commit every migration (memory rule). Keep v4 migrations isolated on the branch; never auto-apply against prod without the snapshot in hand.
6. **Rollback runbook (write it down):** redeploy `v3-stable` tag → restore DB snapshot → invalidate caches. Target: < 15 min to green.
7. **Cutover:** when `major/payload-v4` is green in CI (incl. integration + a staging deploy), tag `v4.0.0`, merge to `main`, deploy, monitor.

**Deliverables:** `v3-stable` tag + DB snapshot; `major/payload-v4` branch; `PAYLOAD_MAJOR` shim; `docs/planning/PAYLOAD4_ROLLBACK_RUNBOOK.md`.

---

## 5. Workstream — CI/CD for angels-os

Build on the existing `ci.yml` rather than replacing it.

### 5.1 Deploy target — DECIDED 2026-05-29: Vercel auto-deploy
**Kenneth chose Vercel auto-deploy (status quo).** Vercel's Git integration keeps deploying `main`; **CI stays verify-only** and CD reduces to a post-deploy smoke check. No new deploy infra.

Implications carried forward:
- The Vercel pool limit (max=3) and serverless cold-starts remain a known constraint — keep the depth=1 + `tenantCache` mitigations in place; do not regress them.
- The IONOS box stays as Postgres host + always-on services; it is **not** a deploy target for the app.
- The v4 branch should get its own Vercel **preview/staging** deployment (Vercel does this per-branch automatically) so cutover is validated before merge to `main`.

### 5.2 Extend CI
- **Integration tests:** add a job that boots Payload against a Postgres **service container** and runs `pnpm test:int` (~23s locally). Cache pnpm; provide ephemeral `DATABASE_URI`/`PAYLOAD_SECRET`.
- **Migration-safety gate:** fail the build if collection fields changed without a committed migration (`payload migrate:status` / diff check). Directly enforces the memory rule that bit us in Sprint 44.
- **Known-failure allowlist:** quarantine the documented pre-existing failures (bookingEngine 13, federation-heartbeat-cron 1) so CI signal stays honest.

### 5.3 CD (Vercel auto-deploy — decided §5.1)
- **Branch protection:** require typecheck + unit + int green before merge to `main` (Vercel deploys `main` after merge).
- **Post-deploy smoke test:** a CI job (or Vercel deploy hook) that, after a production deploy, hits `/`, `/api/health`, and a tenant page; alert via the existing Resend failure job on red.
- **Staging:** rely on Vercel's automatic per-branch preview deploys for `major/payload-v4` — validate the v4 cutover on its preview URL before merging.
- **Rollback:** Vercel "Promote previous deployment" (instant) for app-level regressions; for the Payload-4 major, rollback = redeploy the `v3-stable` tag + restore the DB snapshot (§4).

### 5.4 Android build workflow (Nimue, separate file)
- `.github/workflows/android.yml`: on Nimue tags → setup-node + JDK 17 + Android SDK → `NEXT_PUBLIC_TARGET=mobile pnpm build && npx next export && npx cap sync android` → Gradle `bundleRelease` → upload AAB artifact (Play Store track later; keystore from GH secrets).

**Deliverables:** integration + migration-gate jobs; CD per §5.1; branch protection; `android.yml`.

---

## 6. Sequencing

```
Phase A (client core)      W1.1 chat port  →  W1.2 data-layer swap  →  W1.3 UI parity
Phase B (ship it)          W2 Capacitor/Android   (depends on W1.2 static export)
Phase C (platform hygiene) W5 CI int+migration gate  →  W5 CD   (parallel to A/B)
Phase D (big bump)         W4 v3-stable tag + DB snapshot (do TODAY, cheap insurance)
                           →  major/payload-v4 branch  →  cutover when green
```

Do **Phase D step 1 (tag `v3-stable` + DB snapshot) immediately** — it's near-free and de-risks everything else. Phases A and C can run in parallel.

## 7. Open Questions
1. ~~Deploy target~~ — **RESOLVED 2026-05-29: Vercel auto-deploy (§5.1).**
2. Mobile auth UX — **RESOLVED 2026-05-29: anonymous-first.** Client is fully usable with no account (read + capture, like WDEG which needs no login). Identity is opt-in, only for sync/federation: v1 = email/password → JWT in Capacitor Preferences + biometric unlock; v2 = device-held keypair/DID (the `keys/` route) for teleportable identity. Behind a swappable credential-provider interface so v1→v2 doesn't churn callers.
3. ~~`client/lite` scaffold?~~ — **RESOLVED 2026-05-29: yes, and it wins the base.** See §1.1.
4. Play Store vs sideload — **RESOLVED 2026-05-29: sideload (debug APK over ADB) until v1 is solid, then Play Store.** Kenneth already runs a Play Store account + a published Capacitor app (WDEG), so the publish path is proven and available when ready; no need to gate v1 dev on review latency.

## 7.5 Architecture Decisions — locked 2026-05-29 (Kenneth deferred to judgment)
- **Nimue = the client.** Any/all client surfaces are branded **Nimue** — the "maximal control panel into everything." (The name moves to the client; see §1.1.)
- **Media server is a SEPARATE service.** Ingestion + PAN aggregator is its own backend, distinct from the client. The current `mediaserver` repo becomes that dedicated media service; the client does not *contain* the media server, it's a control panel *onto* it (and onto the rest of Angel OS).
- **Base = `angel-client` (client/lite), rebranded Nimue.** It owns the hard data layer (Dexie sync-engine + capture-first + TDD). Add the WDEG Capacitor shell (§3.1); port media/LiveKit in as modules. Supersedes the earlier "finish mediaserver-Nimue" stance now that the better foundation exists.
- **Storage = pluggable connector layer.** Google Keep is PRIMARY ("tree sap → amber" — fast, massive infra), Google Docs next, other connectors after; Vercel blob is only the default fallback, not lock-in. Keep `payload-remote.ts`/storage transport-agnostic so any node writes to the nearest cheap store.

## 8. Non-Goals / Guardrails
- **Do not blow out the running media server** (`mediaserver`) — it is repurposed as the standalone media/ingestion/PAN service (§7.5); its local-disk movies/stream/thumbnail features stay intact. The Nimue *client* is now built on `angel-client` (§1.1), not on `mediaserver`.
- No permanent compat shims; `PAYLOAD_MAJOR` is deleted post-cutover.
- Never commit secrets, keystores, or DB snapshots to git.
- Always commit migrations with the field changes that need them.

---

## 9. North Star — The Mobile Starfleet OS Client

Nimue's end state is not "a content viewer with a chat box." It is **a full Angel OS node that fits in your pocket** — a federation participant, offline-capable, that happens to render the same UI as the web platform. The phased plan above gets us a faithful client; this section names where it evolves so today's primitives (outbox, sync engine, `idb`-primary store, federation lib) are built to grow into it.

**What "Starfleet OS Client" means, concretely:**
- **A node, not a terminal.** Nimue already ships `lib/federation.ts` + `lib/angels.ts`. The mature client registers as a federation node, sends capacity heartbeats (memory: heartbeats carry live WorkUnit snapshots), and can *receive* dispatched work when online — your phone becomes a unit in the swarm, not just a screen onto it.
- **LCARS-grade operational surface.** The Star Trek motif is already in the codebase (Scotty = federation ops, LEO/Merlin/Nimue personas). The client's "bridge" view: connection status, node identity, federation peers, queued outbox, sync state, available capacity — the ship's console for *your* node.
- **On-device LEO (limited).** Stretch goal: a tiny local model (or rules + cached tool results) gives a real answer offline — greetings, recall from `idb`, "I've queued that, will run it when we're back online." Full model + 118 tools require the mothership; the local one is the away-team tricorder when comms are down.
- **Capture-first.** The phone's edge advantage is sensors: camera, mic, GPS, the Daily-rollup capture pipeline. Captures land in `idb` immediately (works offline), sync up as Media + content when connected. This is the inbound half of the Soul Quest corpus.
- **Teleportable identity.** Per the Google Keep vision (memory: "users teleport between servers because their Keep IS their state") — the client holds enough local state (token + synced collections + outbox) that signing into any Angel OS node rehydrates the same experience. The device is a thin, portable shell over a federated soul.

**Design implications for the work we do NOW (so we don't rebuild later):**
- Build the **outbox + sync engine (§2.4) as the universal write path** — federation dispatch, captures, chat, and content edits all ride it. Don't special-case chat.
- Keep `payload-remote.ts` **transport-agnostic** (REST today; GraphQL/federation RPC later) so the data layer can later talk to *the nearest node*, not only the mothership.
- Make node identity a first-class local object from day one (device id + optional federation registration), even if registration is a no-op until the federation client lands.
- Treat connectivity as a **tier**, not a boolean — the capability matrix (§2.4) is the contract the whole UI honors.

**Sequencing:** this is post-v1. v1 = faithful client + offline limited mode (Phases A–B). Starfleet features (federation node, on-device LEO, capture pipeline, teleport) are a v2 track that the v1 primitives are deliberately shaped to support.
