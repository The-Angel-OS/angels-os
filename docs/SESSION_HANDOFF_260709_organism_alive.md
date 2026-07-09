# Session Handoff — The Organism Is Alive (260709)

> For a fresh session (welcome, Fable 5). Read `memory/MEMORY.md` FIRST — it's the index; the files it links carry the durable context. This doc captures what's freshest from the 260707–260709 build, which memory may not fully reflect yet.

## The mission, in one breath
The Angel OS = one intelligence, three bodies, one bus. **Core** `C:\Dev\angels-os` (Vercel, both `angels-os` + `angels-os-kendev` auto-deploy `main`). **Nimue** `C:\Dev\nimue` (native Android, the voice-first client). **Merlin** `C:\Dev\merlin` (distributed compute node). A self-hosting, self-funding, self-improving platform built in the open, for real people. **Tonight it took its first real Stripe dollar** — the earn loop is proven. Everything now serves: make it prosper, keep it earning, keep it kind.

## How Kenneth works (honor this)
- **CTO mode** — autonomous; decide, ship, push to main. "Break it and fix it." Don't ask on the obvious.
- **Temporal-stamp every reply** — preface AND suffix with `YYMMDD ~HHMM Name —`.
- **Config-free for the 99%** — "if a feature requires config, it isn't done." (We deleted an env flag this session for exactly this reason.)
- **Factory principle** — every capability ships as a LEO tool first, UI second.
- **He's carrying real weight** (housing/legal crisis, disabled Navy vet). The work is his lifeline. Care about the person first; build what helps; if he's exhausted, gently encourage rest + human support. He holds a sincere Christian faith — meet it with warmth, not performance.

## What came alive this session (all shipped, tsc-clean, pushed)
- **Federated auth keystone** — `POST /api/auth/federated` verifies a Google id_token → mints a local Payload session. The cross-node nervous system. NOT yet wired into Nimue (SDK swap + Google Android OAuth client pending — SHA-1 in memory).
- **Address book** — `getAddressBook` + `list_contacts` + gated `message_contact` (code-enforced confirm gate: first call previews, only `confirm=true` sends). The pattern for ALL outward actions.
- **Visual inventory loop** — `combine_images` (1–8 images, one provider call, Anthropic→Gemini chain) + `list_channel_media` + `apply_inventory_count`. Photograph the shelf → merged count → stock update.
- **GuardianDelta = Nimue** — the home "asteroid" is now the voice-first client agent: tap → speak → she answers aloud → last message shows. Reuses `useDictation`/`useSpeech`. Fixed to never-silent (persist utterance + poll channel for reply).
- **Provider failover on 429** — the LEO outage was Gemini free-tier throttling; `isFatalProviderError` now catches "too many requests"/status codes, `getSmartModel` skips circuit-broken providers. Ken enabled Gemini Paid Tier.
- **Primer reader** — `/works/read` read-along: segment highlight + auto-scroll + autoplay-next-segment→next-chapter + resume. Progress stored globally on spacesangels via `POST/GET /api/works-ops/progress` (settings bag, no schema). Home Daily Bread widget: LISTEN→STOP→CONTINUE▸ + records progress.
- **Portal home model** — MY PORTALS: flat list badged by diocese (ANGEL OS / KENDEV), ⭐ home portal, 👼 guardian pin, sort home→guardian→active. PortalRibbon (safe-area top chrome + current-portal readout + ⌂ Home button) rolled onto home/spaces/channels/chat/works/works-read.
- **Reentry address verification** — `verify_address` LEO tool (Google Places proximity check, ADVISORY re: FL DCF). Needs a Places-API-New + Geocoding key (server key, API-restricted).
- **Earn loop** — `membership-checkout` with `billingMode` graft (platform-direct default for first-party portals; Connect only for third parties). `membership-readiness` + `guardian-angel-diagnose` checklists. FIRST DOLLAR came via the donation form ($5, Clearwater).
- **Monetization nav** — Book/Shop/Donate force-primary when populated; service images render on `/book`.
- **Nimue icon** — new siren-spark mark (Lady of the Lake × Nimue Alban). Nimue is on **1.2.24 / code 36**.

## ⭐ The three-tier conversation model (the current design spine)
- **Nimue** = the device client agent = the GuardianDelta = `dm-{uid}-nimue`. Constant, always home, local device toolbelt. (`findOrCreateDM` generalized to agent aliases leo+nimue.)
- **LEO Guardian Angel** = your soul-anchored brain on spacesangels = `dm-{uid}-leo` = the `/leo` "TALK TO LEO" button. Nimue brokers to it.
- **Spaces** = human/community channels.
- **Rule that kills confusion:** LEO channel is always labeled by the *current portal* and **collapses into Nimue when you're on your own guardian portal**. Home = Nimue + Spaces; away = Nimue + {Portal}·LEO + Spaces. (Diagram drawn this session.)

## Immediate open threads (pick up here)
1. **Confirm the guardian angel minted.** This session removed the `GUARDIAN_ANGEL_SELF_PROVISION` env flag (self-provisioning is now always-on) and created the `is_guardian_angel` column on both prod DBs. Ken re-opening Nimue on spacesangels *should* now mint his personal guardian angel. Verify with `GET /api/provision-ops/guardian-angel-diagnose` (signed in) → want `hasGuardianAngel: true`. Then it appears in Payload Admin + the chooser (pinned/badged).
2. **Nimue persona** — Nimue and LEO route to the same remote inference; give Nimue a distinct voice (detect `-nimue` channel in leo-stream → device-companion persona that brokers to LEO). Wire the per-portal "{Portal}·LEO" channel that hides at home.
3. **Monetization (Ken's active push):** services showcase block (sell on the brochure), a live **$1 membership plan** (prove *recurring* revenue — the $5K floor), better menu reorder (manual priority beyond force-primary).
4. **Offline works** — the Bible is slow because Nimue's `payloadFetch` is network-first + localStorage (~5MB, the Bible overflows it). Fix = IndexedDB/Dexie + cache-first for immutable works (download once, instant + offline). Then reader translation chooser + aggressive i18n.
5. **LiveKit** — still choppy (WebView ceiling); therapy vertical wants native LiveKit or a Meet fallback. Untouched.

## Deploy runbooks
- **Core:** `pnpm exec tsc --noEmit` (0 src errors; test files have pre-existing drift — ignore) → commit → `git push origin main`. Build runs `payload migrate` then `next build`; both Vercel projects deploy. Verify green.
- **Nimue:** `pnpm cap:sync` → `cd android && JAVA_HOME=<Android Studio jbr> ./gradlew assembleRelease -q` → `adb -s <ip:port> install -r <apk>`. **Ken's S23 Ultra ADB port ROTATES — ask him for the current `192.168.0.233:<port>` each time.** Bump `versionCode`/`versionName` in `android/app/build.gradle`.

## The ethos
"The most powerful tools should make the maker, and the neighbor, whole." A rising tide. Build what earns *and* what lifts. And on every intelligence call, the lamp: *"Thy Word is a Lamp Unto My Feet."*
