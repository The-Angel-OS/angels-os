# Session Handoff — Make Nimue a Genuine Starfleet Client (260707)

> Paste-able context for a fresh session. Angel OS = multi-tenant Payload 3.77 + Next 16 + Postgres. Core `C:\Dev\angels-os` (Vercel, both `angels-os` + `angels-os-kendev` auto-deploy `main`). Nimue `C:\Dev\nimue` (Next+Capacitor Android). Merlin `C:\Dev\merlin` (Windows scheduled-task node on :3000). Read `memory/MEMORY.md` first.

## THE GOAL
Make Nimue come to life as a real Starfleet client. The thesis: **the Guardian Angel channel is Nimue-LEO = Core-LEO — one brain, with the whole Payload store at its disposal.** Everything below serves that.

## What shipped THIS session (all pushed, tsc-clean)
**Core (angels-os):**
- Guardian-Angel funnel: `guardianUsage` + `guardian-angel-status`, media→AI-Bus invariant, opaque slug + vanity, mutable slug rename, gmail⇔angel 1:1 + soft cap, base domain = spacesangels.com, personal angels out of Discovery, **provision-free-first + Stripe subscription charge side** (`guardian-angel-checkout`, platform-direct), guardian-aware invite (`activatePendingInvites`), default-availability seed.
- Planner: `buildPersonalAgenda` + `GET /api/planner-ops/agenda`, `get_agenda` + `set_availability` LEO tools.
- Daily Bread streak: `dailyBreadProgress` (settings-backed) + `GET/POST /api/works-ops/daily/progress`.
- `web_search` LEO tool (Tavily→Brave→DuckDuckGo). Active quest routing: `sequenceRoute` + `POST /api/dispatch-ops/route`.
- Nav: mobile menu now **scrollable** + guarantees Works/Learn (was the "no Works on mobile" bug). PortalSwitcher: **same-dashboard-page on switch + most-recent ordering + filter box (>6 portals)**.
- ⚠️ **`isGuardianAngel` field was REVERTED (`f8657e0`)** — it deployed before the `is_guardian_angel` column existed on the platform DB → tenant-read OUTAGE (login/browse broke). RE-ADD only after running `GET /api/provision-ops/ensure-guardian-angel-column` on EVERY prod DB (platform + www + kendev) and confirming ok:true. This is the schema-before-deploy rule, learned the hard way.

**Nimue (`13716c6`+):** magnetic anchor (`ensureGuardianAngel` on login), camera-recovery (appRestoredResult, fixes photo-dumps-app), **logged-out home v2** (Continue-with-Google, quiet "Look around first", enterprise switch tucked). Build+install: `pnpm cap:sync` → JBR gradle `assembleRelease` (keystore.properties present) → `adb install -r`. ⚠️ Ken's phones are ACTIVE devices — ASK which is safe before installing; don't `pm clear` his live phone.

## NEXT — the Nimue-comes-to-life punch list (Ken's priorities)
1. **Cross-portal communications.** The Guardian Angel channel spans portals. Same brain (portable `leoBrain`), full Payload store. Design: LEO on any node can read/act across the federated identity's portals; comms flow over the `{space,channel,message}` node bus. See `[[project_node_bus_comms]]`, `[[project_three_body_shared_brain]]`.
2. **THE KEYSTONE — Google id_token federation.** Currently switching enterprises forces re-auth per node (Ken: "have to manually re-authorize"). Fix: native Google sign-in → an **id_token** that ANY node verifies + mints a local JWT (no web-OAuth redirect, no re-auth). This ALSO lets the guardian-angel check fire from any node. **One endpoint (`/api/auth/federated` / verify-google-id-token), two wins: transparent cross-node auth + kills the ugly HTML sign-in.** Needs a Google OAuth client set up (Android client: package `com.angels.nimue`, SHA-1 `5C:CC:24:71:2D:8A:32:D5:11:76:BC:DF:69:97:B1:32:A2:5B:6B:0B` + a Web client for server verification).
3. **Portal chooser filter — TWO choosers.** `PortalSwitcher` (header + dashboard sidebar) already got filter+recent. There is a SECOND chooser on the brochure/public site and/or an admin one — find it and give it the same filter (+recent). Ken: "there are two portal choosers."
4. **Quest / Daily Bread reader with progress tracking.** Clicking Daily Bread should ZOOM to a detail view showing the body text like the Works reader, and TRACK where in the work the person is (the `dailyBreadProgress` streak API exists; wire the reader Next-button + verse dial + progress display to it). Generalize: a **Quest Reader control** that tracks position through ANY work — reusable for **training/onboarding** ("complete these quests"). See `[[project_illustrated_primer_bible]]`.
5. **Modular Quest confirmation workflow (Uber-Eats-style).** A quest control that switches confirmation methods at process gates: PIN entry → QR/barcode scan (scan item pre-checkout) → AI-powered identity checks (verify Tyler's running it). Modular gates per quest step. Big vision; the Quest Reader (item 4) is the first concrete slice. See `[[project_quests_economic_type]]` (active routing shipped this session).

## Constraints / runbook
- Merlin restart: it's the interactive scheduled task 'Merlin' — `pnpm build` in `C:\Dev\merlin` then `Stop-ScheduledTask -TaskName Merlin; Start-ScheduledTask -TaskName Merlin` (or `refresh-merlin.ps1 -NoPull`). Can't kill the PID directly (access denied).
- Test gate `pnpm test:unit`; `pnpm exec tsc --noEmit` before every push. Both Vercel projects deploy `main`.

## Human note (important)
Ken is carrying a real housing/legal crisis (eviction, the Rainmaker landlord case) on very little sleep, in pain, as a 70% service-connected disabled Navy vet. He is the priority, not the backlog. If he's spun-up or exhausted, gently encourage rest + human support (Veterans Crisis Line 988→1; Homeless Veterans 877-424-3838; local legal aid for the eviction). Do NOT help build grand litigation theories as a coping path. Build what helps; care about the person first.
