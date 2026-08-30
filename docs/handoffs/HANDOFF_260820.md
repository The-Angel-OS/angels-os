# Handoff — 260820

Paste the block below into a fresh session.

---

Continuing the Angel OS revenue push. Read `docs/HANDOFF_260820.md` first, then
`docs/HANDOFF_260819.md` for the older context. Memory files worth loading:
`project_demo_site_funnel`, `project_portal_coequality_billing`,
`project_bookable_inventory`, `project_error_nervous_system_audit`.

## Ground rules

**LIVE = Railway.** Deploy is `railway up -s Core` (never auto-deploy from GitHub).
Live DB = `railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`.

⚠️ **Railway paused deploys platform-wide for ~2 hours on 260820** and queued builds
for 30+ minutes without saying so. `railway deployment list -s Core` tells you the
truth; the CLI's "Failed to stream build logs" does NOT mean the deploy failed.
**Never sit in a polling loop waiting for a deploy** — fire it, move on, check later.

**Gate is `pnpm test:unit`** (372 files / 6,474 tests). It flakes under load; a red
run that goes green on retry was the flake, not your diff.

⚠️ **`pnpm test:unit` and `tsc` are NOT enough.** Run a real `npx next build` before
pushing anything that changes a shared utility, a config file, or a collection.

**Ken is CTO/CEO-mode**: decide and act, commit and push to main, temporal-stamp
replies `YYMMDD ~HHMM Name —` top and bottom. He is cash-tight — prefer work that
shortens the path to the first $49. Ponytail mode: laziest thing that works, one
runnable check left behind. **No Angel OS jargon in customer-facing copy.**

## ⭐⭐ Three outages found on 260820 — all the same shape

**An FK that NULLs a row its consumer assumes is present.** Look for more.

1. **`carts_items.product_id` bricked 27 carts platform-wide, silently, for a month.**
   ON DELETE SET NULL left dangling lines when a product was deleted; the ecommerce
   plugin's add-item does `item.product.id` inside a `findIndex`, which throws — killing
   add-item *and* remove-item for that whole cart. Ken found it because "Buy now" did
   nothing and the ✕ wouldn't clear "This item is no longer available". **Nobody had
   reported it: a cart that silently refuses an item produces no complaint.** Fixed
   (CASCADE + cleanup + 43 subtotals recomputed).
2. **Membership join tables** were NOT NULL *and* ON DELETE SET NULL — contradictory, so
   deleting a user failed outright. 4 columns migrated to CASCADE.
3. **27 more NOT NULL + SET NULL columns still exist.** Deliberately untouched — each
   needs its own answer. Probe:
   `delete_rule='SET NULL'` joined to `is_nullable='NO'` in `information_schema`.
   See `src/migrations/20260820_150000_membership_fk_cascade.ts` for the reasoning.

**And: registering a new collection took the whole admin down.** A new collection needs
its `<slug>_id` column on `payload_locked_documents_rels`, not just its own table —
Payload builds the admin's doc-lock query from the live config, so every admin save
(media uploads included) fails with `Failed query: select distinct
payload_locked_documents…`. Fix live with
`GET /api/provision-ops/db-repair-locks?key=$CRON_SECRET`; put the ALTER in the migration.

## What shipped 260820

- **Booking capacity.** A slot can hold more than one person — `Availability.capacity`
  (default 1), counted against overlapping bookings. `/book` shows "N seats left" on
  group sessions; the overbooking guard fails CLOSED. Group booking never worked before.
- **Bookings hours editor.** `/dashboard/admin/bookings` "+ Add Availability" used to open
  a *guide* telling the owner to hand-create a row in the Payload admin. Now day toggles,
  start/end, appointment length, people-per-slot → `POST /api/booking-ops/set-hours`.
- **A paying subscriber is always attached to a person.** The webhook resolves the payer
  from Stripe's own record through `findOrCreateInvitedUser` — no forced sign-in.
  **Recurring billing is now proven end to end on live** (was never proven: Memberships
  had zero rows, ever).
- **Site Log** — the DNN Site Log module rebuilt. `/dashboard/admin/site-log`, 8 reports,
  capture in the public app layout, no IP stored (daily-rotating salted visitor hash),
  90-day retention on the nightly janitor. Already collecting real traffic.
- **Leo writes real formatting.** `markdownToLexical` — headings, lists, bold/italic/code,
  links; a bare `***` is dropped rather than printed. Leo also now says where the thing it
  made lives (editor link for a draft, both links once published).
- **Error log is readable.** Connector-health cron logs only the *transition* into
  failure (was 93% of the log); `AbortError` no longer escalates; hard 14-day retention.
  Anonymous 401/403s no longer log. Live swept 5,960 → ~140 rows.
- **Services tenant leak closed.** `Services` had `read: () => true` — `/api/services`
  served every portal's catalog, prices and all, to anyone. Now tenant-manager scoped.
- **Endeavor cards on the apex are real links** (they were inert `<article>`s under text
  saying "click any of them"); logo renders as a contained badge, not a cropped banner.
- **Post share descriptions** auto-fill from the body (`fillMetaFromContent`), plus
  `/api/post-ops/meta-repair` to backfill. 11 posts filled platform-wide.
- **Tenant settings no longer show a stale image after save** — nothing ever busted the
  120s tenant cache; Tenants `afterChange` now does.
- **`next.config.js` upload cap was never in force** — `middlewareClientMaxBodySize` sat
  at the top level where Next 16 rejects it, so the cap stayed at 10MB. Now
  `experimental.proxyClientMaxBodySize`.
- **Clearwater**: 7 new $25/hr services (cleaning, deep clean, move-out, lawn with your
  mower, helping hands, senior helper, errand run), Tyler's portrait on the cleaning
  ones; nav fixed to Home/Book Us/Shop/Posts/Support the Crew/Contact.

## Next in value order

1. **Warm-list sends.** Four sites built, **nothing sent**. See `docs/OUTREACH_260818.md`.
   Billing and booking are both proven now — revenue is gated on outreach, not code.
2. **Brochure funnel.** `/dashboard/admin/provision` asks a plumber for a slug, hex
   colours and an "Angel Name", and never asks what trade they are. Point the brochure
   path at the `demo-site` engine; reskin or retire the wizard for this use case.
3. **8 tenants whose contact forms notify nobody** — set `storefront.contactEmail`, then
   `contact-form-repair?tenant=<slug>`. A lead reaching no inbox is a lost sale.
4. **Custom domains at $49** need the Railway plan upgrade the pricing page promises today.
5. **Audit the remaining 27 SET NULL + NOT NULL columns** (see above).
6. **Per-tier entitlement (P3)** — still needs Ken's ranked-vs-independent answer.

## Open threads / gaps

- **4 Clearwater video posts have no share description** — their body is an embed with no
  prose, so the auto-fill correctly found nothing. They need a human sentence:
  Philippe Park Dolphins · Distinct Designs Cabinet Timelapse · 8K Morning Nature Walk ·
  260819 Video Journal.
- **`/support` H1 still reads "Support the crew"** (lowercase c). The page title and nav
  say "Support the Crew"; the H1 is the hero block's own field. Left alone — Ken's copy.
- **`provisionPortal` still doesn't create an owner membership**, so every new business
  portal needs one added by hand before `/book` resolves a provider.
- **Gotify connectors are `enabled:false`** — Ken took that tunnel down deliberately to
  cut load. Re-enable when it's back.
- **Railway Postgres CVE patch** is scheduled for the Sat 10:00–Sun 18:00 UTC window.
  Ken's call whether to patch now for a predictable restart.
- **`guardian-angel` $19 plan is `active:false`** — Ken to decide: retired, or a separate
  product?
- **Anonymous checkout** is handled, but per-tier entitlement is still binary.

## Durable rules learned today

- **Never poll a deploy in a loop.** Fire it and move on.
- **Report what happened, not what was attempted.** `post-meta-repair` claimed it filled 8
  posts when only 4 got text; it now re-reads the doc and splits `filled` / `needsAuthor`.
- **Check before `Write`** and **verify with a real build** (carried over from 260819 —
  both still earned their place today).
