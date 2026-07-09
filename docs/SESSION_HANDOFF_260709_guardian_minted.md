# Session Handoff — The Guardian Minted, The Nervous System Quieted (260709)

> For a fresh session (welcome, Opus 4.8). Read `memory/MEMORY.md` FIRST — it's the index; the files it links carry the durable context. This doc captures what's freshest from the 260709 build (Fable 5 session), which memory may not fully reflect yet.

## The mission, in one breath
The Angel OS = one intelligence, three bodies, one bus. **Core** `C:\Dev\angels-os` (Vercel, both `angels-os` + `angels-os-kendev` auto-deploy `main`). **Nimue** `C:\Dev\nimue` (native Android, now **1.2.27 / code 39**, on Kenneth's S23). **Merlin** `C:\Dev\merlin` (distributed compute node, untouched this session). Tonight: **Kenneth's own guardian angel minted for the first time** (`4274h72tadqy.spacesangels.com`), the root cause of why it hadn't been found and fixed, and a wide honesty/reliability pass across donations, unfurls, and the error nervous system.

## How Kenneth works (honor this)
- **CTO mode** — autonomous; decide, ship, push to main. "Break it and fix it." Don't ask on the obvious.
- **Temporal-stamp every reply** — preface AND suffix with `YYMMDD ~HHMM Name —`.
- **Config-free for the 99%** — if a feature needs config, it isn't done.
- **Factory principle** — every capability ships as a LEO tool first, UI second.
- **He's carrying real weight** — housing crisis (must resolve $1,100 shortfall by end of month; a plasma donation and a $660 cashier's-check payment to the landlord's assistant already happened this session), disabled Navy vet, active legal matter (Rainmaker case), and now also a GPD (VA transitional housing) referral in motion via St. Vincent de Paul Cares — a call-back to "David" is outstanding. He's converting his van to an RV (DMV trip planned 260710; Florida requires an Affidavit for Change of Body Type + form HSMV 82040 MV; expect ~$75–85 corrected title + $27.60/$47.10 annual reg depending on weight class — full detail in conversation, not yet in a doc). He also reached out to a wealthy acquaintance (Robert Thor) for Clearwater Cruisin' Ministries board membership + possible bridge funding — message sent, awaiting reply. **Care about the person first.** He holds a sincere Christian faith; meet it with warmth, not performance.

## ⭐ THE HEADLINE: guardian angel minted, root cause fixed
Kenneth's personal guardian angel is **live and verified**: tenant 13, `4274h72tadqy.spacesangels.com`, `guardian-angel-diagnose` → `hasGuardianAngel: true`, re-claim is idempotent.

**Root cause chain (all fixed, `faeceb3` + `2c0642d`):**
1. The `Tenants.isGuardianAngel` field had been surgically removed on 260707 to stop an outage (the column didn't exist on the platform DB yet). This session: confirmed the column now exists on **all three** prod nodes (spacesangels, www.kendev.co, federation.kendev.co) via `/api/provision-ops/ensure-guardian-angel-column`, then **restored the field**.
2. First claim attempt still lost its owner-membership row — traced via Vercel runtime logs to a **PgBouncer idle-in-transaction kill**: `autoCreateOwnerMembership` ran pages+nav+space creation in **parallel** (`Promise.allSettled`) inside the tenant-create transaction on the max=3 connection pool; the starved tx connection idled past PgBouncer's timeout and the membership insert rolled back silently *after* its sibling hooks had already committed side effects elsewhere — maddening partial state, and the reason `diagnose` kept reading false.
3. **Fixed at both ends**: `autoCreateOwnerMembership` sequentialized (no more parallel writes on the fragile pool); `provisionPortal` step 5 now does **verify-after-write** — re-checks the membership on a fresh connection, retries once, logs `verified`/`self-healed` loudly instead of failing dark.
4. A duplicate guardian tenant (14) minted during the debugging — properly decommissioned via the existing `decommission_tenant` LEO tool / CLI script (dry-run first, confirmed zero rows elsewhere, executed). **One guardian angel now exists: tenant 13.**

Also surfaced during cleanup: `contacts` table was missing 3 columns on the spacesangels DB (added by hand), and `permissions`/`vendors` tables don't exist there at all (decommission script crashes uncaught on them — logged, not yet hardened). Full detail: `memory/project_provisioning_transaction_fragility.md`.

## What else shipped this session (all pushed, tsc-clean)

**Donations — honesty + editability:**
- Every portal's `/donate` is now **CMS-overridable** (author a Pages doc with slug `donate`; falls back to the built-in surface). Seeded Clearwater (page 43) and HelpDNA (page 48, "Support the Ernesto Behrens Innocence Project").
- The donate form's money-breakdown line was **hardcoded false** ("100% to the Justice Fund, no platform fees" — untrue on any Connect-enabled endeavor). New `src/utilities/donationRouting.ts` resolver + `GET /api/donation-ops/routing` (public) render the ACTUAL split per portal — destination charge (95/5) vs platform-stewarded vs pure Justice Fund — shared with the real charge logic so shown always matches charged. 11 unit tests, all passing.

**Unfurls — every portal now previews correctly:**
- `generateMeta` is now tenant-aware (absolute URLs, portal's own siteName/branding, image ladder: page meta → portal cover → fallback).
- The OG fallback image **never existed** (`website-template-OG.webp` 200'd with an HTML page — every unfurl silently had no thumbnail). Replaced with a real generated `public/og-fallback.jpg`.
- `/book` and `/donate` both wired with `generateMetadata`.

**Error nervous system — two live Gotify-surfaced issues root-caused and fixed:**
- `leo-health.query — pendingOrdersRes failed` (firing on EVERY LEO turn, hours): querying order status `'pending'`, which doesn't exist in the `OrderStatus` enum (`processing|completed|cancelled|refunded`). Fixed to query `'processing'`.
- `nimue/dictation — No match / Didn't understand`: benign auto-listen-loop outcomes (silence, or the Delta button interrupting mid-listen) were escalating to the errors channel + Gotify. Now console-only; real recognizer faults still escalate.

**Test suite — 105 failures triaged, ~84 fixed:**
- Root cause of most: `logError` lazy-imports `@payload-config` (boots Payload against a live DB) — 12 endpoint test files never mocked it, so error-path tests hung 30s each. Mocked across all 12.
- `federation-election` (12 tests): endpoint moved proposal storage to the Settings spine; test stub lacked `find`/`update` — built a stateful fake settings store, 17/17.
- `chat-send` (1 test): attachments moved to a deliberate two-phase create-then-attach flow (same rollback-hardening pattern as the guardian bug); test updated to assert the two-phase contract, 16/16.
- **Still stale, mapped, not yet fixed**: `booking-checkout` (6 — hangs deeper in provider/engine flow even with mocks), `aiGateway` (6 — model-map drift), `bookManifestServer` (5), `souls/subscriptions` (2), `emergentNetwork` (1), `provisionTenant` nav (1). None touch money paths or this session's shipped code.
- Added `tests/e2e/global-teardown.ts`: sweeps timestamped Playwright residue users (`checkout-e2e-<ts>@test.local` etc.) after every run. Also manually purged 115 already-accumulated residue users from spacesangels DB (154 → 39), keeping every durable fixture, seed account, system LEO user, and real human.

**Nimue — the offline reader + guest bridge:**
- **IndexedDB cache-first reader** (`bcad639`): the Holy Bible (13.6MB in one API response) was unreadable — network-first fetch with a 6s timeout aborted on mobile data ("Work not found"), and the old localStorage cache silently failed past ~5MB so it never cached at all. New `lib/idbCache.ts` (zero-dep IndexedDB kv) + `cacheMode: 'cache-first'` in `payloadFetch` + 60s timeout on `getWork`. **Measured: first open ~10s network, every open after = 46ms for all 1,189 chapters, fully offline.**
- **CORS fix** (`0cb1654`): browser-dev Nimue (`localhost:3002`/`:3097`) couldn't even log in — no `Access-Control-Allow-Origin` was emitted for those origins, so every credentialed call read as "Failed to fetch." Native Capacitor origins were already fine; only dev-server origins were missing.
- **`/welcome` guest bridge** (`9bccf3d`): "Look around first" used to land on a dead `/browse` (0 spaces, everything auth-gated). New page surfaces what genuinely works unauthenticated — THE LIBRARY, DAILY BREAD (live, deep-links into the reader), THE FEDERATION — plus honest 🔒 locked tiles for what sign-in unlocks, and one CTA: **GET YOUR GUARDIAN ANGEL — FREE**.
- **Dictation quieted** (`7784159`) — see error nervous system above.
- Nimue is now **1.2.27 / code 39**, installed on Kenneth's S23 (ADB port rotates — ask him for the current `192.168.0.233:<port>`).

## The monetization ladder — gamed out this session (worth re-reading in full transcript if picking this up cold)
Six rungs: **Visitor** (shared link, now unfurls correctly) → **Participant** (gives/books, no account) → **Citizen** (signs in, guardian auto-mints free) → **Creator** (commissions a named endeavor — still free) → **Earner** (Stripe Connect onboarding — platform takes a share only once THEY earn) → **Patron** (recurring, usage-tier). Discovery mechanisms discussed but **not yet built**: a thank-you-moment CTA on donation/booking success ("This runs on The Angel OS — get your own angel"), a "Powered by The Angel OS" footer, Nimue first-run quest cards, and a `commission_endeavor` LEO tool that provisions + returns a web-handoff card Nimue can render (open the browser, keep chat open underneath). All named as small, well-scoped next slices.

## Immediate open threads (pick up here)
1. **Robert Thor / Clearwater board + bridge funding** — text sent (Stripe fee math included: $500→$485.20 net, etc.). No reply yet as of session end. Check in on this human thread.
2. **David / St. Vincent de Paul GPD referral** — a callback is owed; message drafted this session with the housing situation + RV conversion context. Confirm it was sent / follow up.
3. **DMV RV registration** — trip planned 260710, Pinellas County. Details in conversation (Affidavit for Change of Body Type, HSMV 82040 MV, ~$75–85 title + weight-based annual reg).
4. **Anonymous guest LEO** — the `/welcome` bridge covers Works/Federation; a rate-limited, tool-less "concierge" LEO channel for guests is the named next slice (node-trust doctrine already defines anon = quarantined).
5. **`commission_endeavor` LEO tool** — the missing piece completing the "talk to Nimue → get a minted site → link delivered, chat stays open" loop. Core-only work.
6. **Stale test files** (6 files, ~21 tests) — mapped above, none urgent, none touching money paths.
7. **Schema drift housekeeping** — `permissions`/`vendors` tables absent on spacesangels prod DB; `decommission_tenant` should skip-not-crash on missing tables (currently uncaught).
8. **kendev DB parity check** — the `contacts` column fix was applied by hand to spacesangels only; verify/apply on kendev too.

## Deploy runbooks (unchanged from last handoff)
- **Core:** `pnpm exec tsc --noEmit` (0 src errors; test files may have pre-existing drift, see above) → commit → `git push origin main`. Both Vercel projects auto-deploy `main`.
- **Nimue:** `pnpm cap:sync` → `cd android && JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease -q` → adb install to the current rotating port. Bump `versionCode`/`versionName` in `android/app/build.gradle` each release.
- **adb** lives at `C:/Users/kenne/AppData/Local/Android/Sdk/platform-tools/adb.exe` (not on PATH in this shell).

## The ethos
"The most powerful tools should make the maker, and the neighbor, whole." Tonight the organism proved it can find its own wounds (Gotify → root cause → fix) and heal its own provisioning (verify-after-write, no more silent partial state). And on every intelligence call, the lamp: *"Thy Word is a Lamp Unto My Feet."*
