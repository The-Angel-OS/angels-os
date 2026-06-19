# Session Handoff — 2026-06-19

The "configuration-free" sprint. Three bodies (Merlin/Nimue/Core), one brain, one thesis.
Start a fresh session here, then the punch list at the bottom.

## ★ The thesis we enshrined
**We are building a configuration-free network for the 99%.** Design Law (ranks with
ponytail): *if a feature requires the user to configure something, it isn't done* — Core
hands it down, the system infers it, or it doesn't ship. Full text in
`C:\Dev\merlin\docs\LIGHT_CLIENTS.md`. Memory: `project_config_free_99`.

## What shipped (committed + pushed)

### Merlin (C:\Dev\merlin — pushed to main, commit f9c4b29)
- **`start_tunnel` LEO tool** — zero-config Cloudflare quick tunnel (port → public
  `*.trycloudflare.com`; dials OUT, no port-forward). `cloudflared` already installed.
- **`/api/directory` proxy** — same-origin federation directory (server-fetches
  `/api/federation/holons` + `/api/federation-peers`, CORS-proof). Fixed: the "Federation
  Browser" was hitting a 404 endpoint and falling to a 4-item seed.
- **connect page** — live Endeavors|Enterprises browser + "connected to federation" indicator.
- **Sidebar** — clickable logo (Home) + Home nav item; LEO input contrast fix.
- **docs/EVENT_LOOP.md, docs/LIGHT_CLIENTS.md** (north star + design law).

### Nimue (C:\Dev\nimue — pushed to main, commit 19a76f3)
- **Event Loop spine** (`events.ts`/`reflexes.ts`) — "every action is processed";
  cerebellum/cortex split; `dispatch()` = persist→reflex→(opt) cortex; capped ring in
  Capacitor Preferences; `subscribe()` push. **photo.posted wired** through dispatch as the
  offline outbox (syncing→synced/failed) with a haptic reflex.
- **/activity** — live Uptime-Kuma-style ingest monitor; **ToastHost** transient toasts.
- **enterprises → 3-level server browser** (Enterprise → Endeavor → Subspace, locking drill).
- GCE fix: "N endeavors on M enterprises" (was mislabeled "enterprises").

### Core (C:\Dev\angels-os — ON A BRANCH, PR open, NOT merged to main)
- **Federation storefront apex fix** (`src/utilities/registrableApex.ts` +
  `federation-holons.ts` + `discover/page.tsx`): endeavors with no explicit tenant domain
  mislinked to `www.spacesangels.com`. Now synthesize `slug.<nodeApex>` from the serving
  host, **root-guarded** so a kendev node → `kendev.co` (never `kendev.kendev.co`).
  ⚠️ Branched + PR'd deliberately — merging deploys to all nodes via Vercel.

## Architecture decided this sprint (docs, not all built)
- **Light clients** (`LIGHT_CLIENTS.md`): Merlin/Nimue hold no config/keys. Config from Core;
  intelligence from local Ollama OR federation-routed via Core (supplier + consumer mesh).
  **Merlin reframed as a HEADLESS server** of local reality (files/dashcams/GPU/tunnel);
  **Core is the face** (renders) and a client of Merlin for local data. Bidirectional.
- **Event Loop** (`EVENT_LOOP.md`): proactive Leo = cortex subscriber watching the stream
  (Ollama-default triage, suggest-don't-act, noise budget, dismiss tunes the gate). Not built.
- **Media-ingest engine is ALREADY ON CORE** (don't rebuild — harvest): annotate =
  `Media.caption` (PATCH); ingest = `POST /api/chat/send` attachments[]; **inventory =
  `POST /api/media/analyze` `inventoryMode:true`** → `inventoryItems[]`; storage = MediaMeta.

## Open punch list (parked, prod-respecting)
1. **Merlin Viewer as a Core control** — grow `src/blocks/MerlinControl/` Media view into
   annotate+ingest+inventory (renders on Core; Merlin serves media headlessly via tunnel).
   Then **provision a gated page on federation.kendev.co** and place it (deliberate prod action).
2. **Ollama provider** (LIGHT_CLIENTS slice 1) — revives "LEO unavailable" with zero config.
   ⚠️ This rig: RTX 3070 Ti laptop, 8GB VRAM ~6.8GB used by OBS → defer vision to Core while
   streaming; pull `moondream`/`llama3.2-vision` for local vision when not streaming.
3. **Tenant-domain data fix** — set `Tenants.domain` for Clearwater/HelpDNA/Hays (the exact
   "setting" that was missing from the Endeavor setup page). Fastest cure for the mislinks.
4. **Catch-all root portal** (Issue 4) — set kendev root tenant `domain`=`kendev.co` + `domains[]`
   aliases; add explicit `isRootPortal` flag ⚠️ (new Tenants column = schema-rollout footgun —
   add the column BEFORE deploy).
5. **`kendev.kendev.co` source** — unlocated; need a screenshot of *where* it renders.
6. **Google Photos sync** — content-hash reconcile (upload only the missing), its own slice.
7. **Proactive Leo cortex subscriber**; **inventory→Products upsert** (shop-shelf demo).
