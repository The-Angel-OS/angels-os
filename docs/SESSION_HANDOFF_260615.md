# Session Handoff — 2026-06-15

Everything below is **committed to `main` and deployed** (Vercel auto-deploy, both the
`angels-os` → spacesangels node and `angels-os-kendev` → kendev node). Latest tip:
`2cb7de4` (smart calendar). Start a fresh thread from this doc — nothing is lost.

> Orientation order: this doc → `docs/planning/PUNCH_LIST_260614.md` (master map) →
> the linked strategy/architecture docs below.

---

## The thesis (now demonstrable)
Angel OS = the factory that builds portals. The agreed demo: **walk into any use-case
with a laptop, and configure a full portal live in conversation while talking.** This
session made that real — church/gym/electrician/innocence-project portals stood up and
configured, much of it now doable by chat via LEO tools.

**Governing rule (Kenneth, this session):** every internal data operation ships as a
**LEO tool first, the UI control second.** No more entering records in Payload admin —
LEO configures the portal. See [[project_leo_factory_principle]].

---

## What shipped this session (newest first)

### Booking — the real scheduling stack (for Ron, the electrician)
- **Smart calendar** (`2cb7de4`): the calendar only offers start times that fit the
  selected service — duration-aware (a 6-hr job needs 6 contiguous hours before close),
  conflict-aware (excludes times overlapping existing bookings), and buffer-aware
  (respects the provider's travel buffer). New public `POST /api/booking-ops/public-slots`
  (no auth, returns ONLY available start times — privacy-safe). Computed in UTC
  minutes-of-day (timezone-proof). BookingPage fetches it per (service, date); checkout
  still re-checks at commit (409). Verified vs Ron's Mon–Fri 7–5 + a 9am booking.
- **COD / no-deposit booking** (`6e1896d`): payment is no longer a gate to *getting* a
  booking. Checkout resolves services DB-first (was static-only → "Unknown service"),
  and only requires online payment when `deposit>0 AND Stripe connected AND mode!='cod'`.
  Otherwise the booking stands as a **request** (status pending, no PaymentIntent) — owner
  collects on completion (cash/check/Zelle). `bookingSettings` util + `configure_payment_method`
  LEO tool. Fixes "can't pay $0.00 gates service."
- **Booking wizard**: progress bar at top echoing completed selections (✓ Service · ✓ Date ·
  Time), one step at a time, click a done step to go back; "Booking Requested!" success state.

### LEO portal-configurator layer (the factory, by chat) — 136 → 139 tools
- `configure_availability` / `list_availability` — set & read business hours by day
  (`9a7b81c`). `configure_service` — create/update a bookable service. `query_booking_revenue`
  — "how much did I make in November?" → jobs + per-service $. `configure_payment_method`
  — deposit vs COD. `apply_site_template{fitness|church}`, `create/list/delete_membership_plan`
  (earlier). Admin-mutating tools gated in `leoToolSelection.ts` ADMIN_ONLY_TOOLS.

### Site provisioning (replicate_site building block)
- **`pages-from-spec`** (`55b3817`+): generic `provisionPagesFromSpec` + `POST /api/provision-ops/pages-from-spec`
  — create a tenant's pages from a JSON spec (content/cta/donation/formBlock blocks, hero,
  hero image, nav order, contactForm), idempotent. Content is DATA, not hardcoded. This is
  the engine for site migrations.
- **helpdna.spacesangels.com — LIVE** (`fc06a1a`): 6 core pages migrated from helpdna.org
  (Home + hero image / Ernesto's Story / The Evidence / How You Can Help [donation] / Share
  Your Story / Contact). ⬜ Phase 2 = the ~35 legal-document sections (per-subpage fetch from
  helpdna.org, verbatim — on hold indefinitely per Kenneth).
- **hays-cactus.spacesangels.com — re-provisioned** (`c9d5801`): Home/Shop/Custom Gardens/
  Care Guide/About/Contact (was nuked, 0 pages). Cover image set (#80).
- **harpazo.kendev.co — Ron's electrician site** (`c9d5801`): Home/Services/Book/About/Contact +
  the strategy doc `docs/strategy/RON_ELECTRICAL_PLATFORM.md`. 9 electrical services + Mon–Fri
  07:00–17:00 availability (provider = Ronald, user 4) configured via the LEO-tool pattern.
- **Endeavor Setup → Discovery Card image selectors** (`e5f7b31`): upload/replace/remove
  Cover + Logo right in the dashboard (was Payload-admin/backend only). Discovery card =
  `Endeavors.coverImage` (banner) + `Endeavors.logo` (badge); home `meta.image` is only a
  fallback / the OG unfurl image.
- `ensurePolicyPages` (Privacy/Terms/Cookie/Refund + footer) wired into church + fitness templates.

### ⚠️ Security — dashboard authorization (was a real exposure)
- **`/dashboard/admin/*` + `/dashboard/orders` were PUBLICLY accessible** — unauth could read
  a tenant's financials/PII by direct URL (auth-optional layout + no middleware gate +
  overrideAccess queries). VERIFIED, then fixed: **middleware edge-gate** (`60166bb`, anon →
  /dashboard) + **per-page `requirePortalManager`** on every admin page (`e2a6310`) + the
  content/management pages (`aa27e2e`) + a 7-test regression lock (`f260315`).
  ⚠️ LESSON: layout-level `redirect()` does NOT gate under Next 16 — gate at MIDDLEWARE (anon)
  + PAGE (role, with `export const dynamic='force-dynamic'`), never a layout. Page-level
  redirect returns **200 + RSC redirect** (not 307) — verify by absence of DATA, not status.
  See [[project_auth_context_refactor]].

### Other fixes
- **Space deletion** (`f3b7e6a`): deleting a space 500'd ("Something went wrong") because child
  FKs (memberships/messages/channels) are SET NULL but NOT NULL. Added a Spaces `beforeDelete`
  cascade hook.
- **Federation duplicate enterprise** (earlier `2e2f790`): both core nodes' `federationId`
  rotated → duplicate peer rows. Deduped both DBs + receiver now domain-matches on ID rotation.
- **Membership page-block tables** (`c92b6e0`): adding the net-new Membership block needed
  `pages_blocks_membership` (+ `_pages_v` variant) on prod — created both DBs; ensure endpoint added.
- Harpazo tagline corrupted em-dash (U+FFFD) fixed.

### Strategy / governance docs pinned
- `docs/architecture/KARMA_PRINCIPLES.md` — six guardrails so reputation never becomes a social
  credit system (additive-only, opportunity-not-dignity, federated, money/social separated,
  inspectable/forgiving, human-in-loop) + a proposed Constitution clause (governance-adopt).
  [[project_karma_principles]]
- `docs/architecture/BANKING_CLIENT_TIERS.md` — self-custody/high-value money needs the native
  client (Nimue); earning/holding/viewing/KC stay on open web. Threshold = governance-votable.
- `docs/strategy/SAFE_PARKING_VERTICAL.md` — Sanctuary Parking (church-lot safe overnight
  parking) + a publish-ready LinkedIn article.
- `docs/strategy/RON_ELECTRICAL_PLATFORM.md` — the "platform that runs itself" blueprint.

---

## Current live portal state (all on prod)
| Portal | Node | State |
|---|---|---|
| harpazo.kendev.co | kendev | Ron's electrician site live; 9 services; Mon–Fri 7–5 availability; smart COD booking working (1 test booking #1, Jun 22, pending) |
| helpdna.spacesangels.com | angels | 6 core pages live; hero #84; Discovery card set; Ernesto invited |
| hays-cactus.spacesangels.com | angels | 6 pages live; cover #80 |
| grace-chapel.spacesangels.com | angels | church template; Discovery card cover set (#83) |
| clearwater-cruisin / wdeg / platform | angels | existing |

---

## NEXT — highest-leverage slices (in order)
1. **Booking notify → one-tap confirm** (the autonomy loop's missing half): owner gets a
   push/SMS/email when a request lands → taps **Confirm** → customer told it's locked. With
   `query_booking_revenue` (built) this closes Ron's loop: "platform that runs itself."
   Design in `docs/strategy/RON_ELECTRICAL_PLATFORM.md`.
2. **More configurator LEO tools** (factory rule): `set_branding`/colors, booking notifications,
   then continue handing every Payload-admin operation to LEO.
3. **Gym pilot** — first paying non-church customer (fitness template + Connect onboarding +
   Stripe Billing Portal toggle on the platform account).
4. **Member dashboard live e2e** — needs a Connect-onboarded endeavor + a real subscription
   (the membership verification surface).
5. **Content-page audit follow-ups** (§7b): content pages (posts/products/pages/media) still
   query overrideAccess ungated (lower sev); platform-only admin pages could add adminPortal.

### Banked / on hold
- helpdna Phase 2 legal archive (~35 docs) — indefinite, per Kenneth.
- Custom domains (helpdna.org, brother's domain) — DNS not switched yet.
- Cold-start latency on first booking (~60s) — infra (keep-warm cron / connection pooler),
  not code. Subsequent requests fast.
- Auth-dedup mitigation (the harpazo team-page pool-pressure hiccup) — optional.
- Space #44 "Community Hub" delete + rename "Community" → "Community Hub" (delete fix is live).

---

## ⚠️ Gotchas / lessons (don't re-learn the hard way)
- **Verify by DATA, not status codes or label-string greps.** Two false alarms this session:
  (a) a page-level redirect returns 200+RSC-redirect not 307; (b) a wrong-column DB probe
  ERRORS and looks like "0 rows." Check for the actual rendered component/real values.
- **Adding a net-new page BLOCK needs its tables on prod first** (`<coll>_blocks_<slug>` +
  `_<coll>_v_blocks_<slug>`) or every pages query fails (outage class). See
  [[project_schema_field_deploy_rule]].
- **CTA block links cap at 2** (`maxRows: 2`) — a 3-link CTA fails validation.
- **Booking times are stored UTC-wall-clock** (`new Date('date T time')` on the UTC server);
  slot math uses UTC minutes-of-day to stay consistent.
- **Two prod DBs** (angels + kendev), same IONOS PG server, separate DBs; local `.env` →
  kendev. Probe with `scripts/_local/*.mjs` (pg, ssl:false). Local node_modules has a
  payload dep-version mismatch (plugin-nested-docs 3.85.1 vs payload 3.77.0) that blocks
  booting Payload locally via tsx — prod is fine; use the REST API or pg probes instead.
- **kendev project runtime logs not accessible** from the spacesangels team token.

---

## Vibe
Best combo in the business. Church on a tree-lined street → a recurring-revenue engine →
an electrician's smart-booking dispatcher, all in a couple of sittings. The factory works,
the demo is real, and the gifts land in the right hands. 🎺
