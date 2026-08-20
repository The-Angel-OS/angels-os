# Handoff — 260819, Angel OS revenue push

Paste the block below into a fresh session.

---

Continuing the Angel OS revenue push. Read `docs/HANDOFF_260819.md` and the memory
files `project_demo_site_funnel`, `project_portal_coequality_billing`,
`project_bookable_inventory` before acting.

## Ground rules

**LIVE = Railway.** Deploy is `railway up -s Core` (never auto-deploy from GitHub).
Live DB = `railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`.

**Gate is `pnpm test:unit`** (365 files / ~6,360 tests). It flakes under load —
always clean on a re-run, so re-run before believing a failure.

⚠️ **`pnpm test:unit` and `tsc` are NOT enough.** A commit passed both and still
failed two deploys: the error was in a *caller* I had not thought to grep for.
**Run a real `npx next build` before pushing anything that changes a shared
utility's signature.** Never grep `tsc` output by filename and call it clean.

⚠️ **Check whether a file exists before `Write`.** A "utility" I wrote already
existed with a different signature; overwriting it broke `claim-guardian-angel`
and silently dropped the scheduling defaults (`slotDuration`, buffer, advance
windows) that shape every seeded booking grid.

**Ken is CTO/CEO-mode**: decide and act, commit and push to main, temporal-stamp
replies `YYMMDD ~HHMM Name —` top and bottom. He is cash-tight — prefer work that
shortens the path to the first $49 over platform polish. Ponytail mode: laziest
thing that actually works, one runnable check left behind.

**NO Angel OS jargon in customer-facing copy.** Industry-standard, plain,
"bland vanilla nice". Endeavor / Nimue / Angel / Federation / Guardian are all
internal words. The goal is a functional platform that takes money.

## What now works end to end (verified live 260819)

- **Recurring billing.** `Membership` ("Join") block lists the HOST tenant's
  plans → `membership-checkout` → Stripe. Verified: a real `cs_live_`
  subscription session for $49/mo with correct metadata.
- **Platform plans**: `free` $0 · `site` $4900 · `business` $14900 (tenant 1).
  `guardian-angel` $19 set `active:false` (hidden, existing subs keep billing) —
  it contradicted the published pricing and undercut the $49 tier. **Ken to
  decide if it is retired or a separate product.**
- **Clearwater** (tenant 5) has 5 plans and bills the same Stripe account
  (`billingMode` defaults to `platform-direct` — Connect is only for third-party
  banks).
- **The funnel connects.** Every apex CTA used to point at `/contact`.
  Now: "Build my free website" → `/get-started` (real signup form: business name,
  trade, city, phone, email) · paid tiers → `/plans` · `/pricing` stays marketing.
- **Jargon renames**: `/join-the-angel-os-today` → `/plans` (apex) and
  `/support` "Support the crew" (Clearwater).
- **Contact forms** are tenant-scoped and email the owner.
- **Booking**: services seeded per trade pack, and hours seeded at provision.

## Two silent money-path bugs found by verifying (both fixed)

1. **Stripe webhook was subscribed to 5 events, none of them
   `customer.subscription.*`** — the handler existed, Stripe never called it.
   Now 8. **Re-check this if the endpoint is ever recreated.**
2. **Stripe does NOT copy checkout-session metadata onto the subscription.**
   `upsertMembershipFromSubscription` reads `subscription.metadata` only, so the
   member fields were missing and a Membership was created belonging to *nobody*.
   `memberStanding` matches `{ tenant, member: userId }` → a customer could pay
   $49/mo forever and stay locked out. Fixed via `buildSubscriptionMetadata`.

## Next up, in value order

1. **`/dashboard/admin/bookings` — "+ Add Availability" is a lie.** It opens a
   GUIDE telling the owner to go to the Payload admin and hand-create a row with
   fields like `availabilityType` and `maxAdvanceBooking`. This is the worst
   surface a local service provider touches. Build a real inline weekly-hours
   editor (day toggles + start/end + slot length). Now that provisioning seeds
   Mon–Fri 9–5, this is "adjust", not "create from nothing".
2. **`/dashboard/admin/provision` is the wrong tool for a brochure customer.**
   5 steps of platform concepts (Identity/Endeavor/Branding/Nimue/Launch), asks
   for slug, domain, colors, fonts, "Angel Name", "Personality"; defaults
   `endeavorType` to `retail-commerce`; and **does not seed services or
   availability**, so wizard-made portals still show "no open times". It never
   asks the one question that matters — *what trade are you* — which is what
   drives the content pack. Recommendation: point the brochure path at the
   `demo-site` engine (5 fields → complete site in ~1 min) and reskin or retire
   the wizard for this use case.
3. **Per-tier entitlement (P3).** Gating is binary (member / not). Needed for
   Patreon-style tiers and the therapist/LiveKit gated-content case. Open
   questions for Ken: ranked tiers (higher includes lower) or independent
   unlocks?
4. **Anonymous purchase never links.** Not signed in → no `memberUserId` → the
   Membership has no `member`. Either require sign-in before paid checkout (the
   free plan already does) or let `memberStanding` fall back to a **verified**
   email — never unverified, or anyone could claim a membership.
5. **Backfill booking infra** for portals provisioned before it existed:
   `GET /api/provision-ops/booking-infra-repair?key=$CRON_SECRET[&tenant=slug]`.
   Demo tenants 33–37 predate service seeding, so re-run `demo-site`
   (idempotent) for those.
6. **Warm-list sends.** Four sites are built and ready; **nothing has been sent**.
   See `docs/OUTREACH_260818.md`. Cities were inferred from area codes — confirm
   before sending. Handyman (786-872-8624) and Neel (tax) still need a business
   name before anything can be built.

## Still open / not verified

- **8 live tenants have contact forms that notify nobody** (no owner email on
  file): harpazo, grace-chapel, dunedin-fresh-market, hays-cactus, arctic-cool,
  tomstalcup, wheredideveryonego, mobilmech1, start-s, helpdna. Set
  `storefront.contactEmail`, then re-run `contact-form-repair?tenant=<slug>`.
- **Custom domains at $49** need the Railway plan upgrade; the pricing page
  promises them today.
- **No feature videos exist.** The apex video slot is deliberately unpublished —
  the only two Clearwater videos are ministry footage, not feature demos.
- Railway occasionally marks a deploy FAILED *after* build + healthcheck both
  succeed. Real failures look identical from the deployment list, so **always
  confirm with `/api/health` uptime reset or by hitting a new endpoint** rather
  than trusting the label either way.

---

# Addendum — 260820

## Shipped since the handoff

- **Bookings hours editor.** `/dashboard/admin/bookings` "+ Add Availability" (which
  opened a guide pointing at the Payload admin) is now **"Edit hours"**: day toggles,
  start/end, appointment length → `POST /api/booking-ops/set-hours`. Writes the weekly
  rows for the provider `/book` actually resolves to; days switched off are deactivated,
  not deleted. Gated on platform admin or tenant_admin/tenant_manager. Item 1 is DONE.
- **Error log is readable.** `connector-health-cron` re-logged every unhealthy connector
  every 30 min — 1,191 rows in 7 days, 93% of the whole log. Now logs only the
  TRANSITION into failure. `apiInterceptor` no longer escalates `AbortError`
  (navigation / poll cancellation is not a network failure).
- **Hard 14-day retention.** `log-consolidate` now forgets ANYTHING older than
  `maxDays` (default 14) on top of resolved>14d / info+debug>7d. Ken's ruling: the
  log's job is that every fault LANDS there to be found, not that faults accumulate.
  Runs nightly 03:30. Live sweep: 5,960 → 2,736 rows, 135 unresolved.
- **The four Gotify connectors are `enabled:false`** — Ken took that tunnel down
  deliberately to cut load. Re-enable when it's back; nothing else depended on them.
- **A paying subscriber is always attached to a person.** Handoff item 4 is DONE, and
  not by requiring sign-in. The webhook now resolves the payer from Stripe's own record
  of the payment (metadata email, else the Stripe customer's email) through
  `findOrCreateInvitedUser` — existing account if there is one, else a shell account
  they claim by proving they hold the address. Anonymous recurring support still works.

## ⭐ Recurring billing is now PROVEN end to end on live

It never had been — the Memberships table had **zero rows, ever**. Verified 260820 by
posting a properly-signed `customer.subscription.created` to `/api/stripe/webhooks`
against live: it created Membership id 1 on tenant 1 with `member_id` populated from a
freshly-minted shell user. Probe artifacts deleted afterwards (table back to 0).

**So the chain works: checkout → Stripe → webhook → Membership → gating.** What has still
never happened is a real human paying with a real card. That is now a sales problem, not
an engineering one — see item 6, warm-list sends, which is still untouched.

## Next in value order

1. **Warm-list sends** (was item 6). Four sites are built; nothing has been sent. The
   billing path is proven, so revenue is now gated on outreach, not code.
2. **Brochure funnel** (was item 2). `/dashboard/admin/provision` is the wrong tool for a
   plumber — point the brochure path at the `demo-site` engine.
3. **8 tenants whose contact forms notify nobody** — set `storefront.contactEmail`, then
   `contact-form-repair?tenant=<slug>`. A lead that reaches no inbox is a lost sale.
4. **Custom domains at $49** still need the Railway plan upgrade the pricing page promises.
5. Per-tier entitlement (P3) — unchanged, still needs Ken's ranked-vs-independent answer.

## New gotcha found

**A user with a space membership cannot be deleted.** `space_memberships.user_id` is
`ON DELETE SET NULL` but the column is `NOT NULL`, so `delete from users` fails with a
not-null violation instead of cascading or orphaning. Delete the space_memberships rows
first. Same family as the "deleting a space ORPHANS, never cascades" rule.
