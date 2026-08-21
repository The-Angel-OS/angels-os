# Handoff — 260821 afternoon (continuation)

Paste the block below into a fresh session.

---

Continuing the Angel OS revenue push. Read `docs/HANDOFF_260821_B.md` first, then
`docs/HANDOFF_260821.md` and `docs/HANDOFF_260820.md` for older context. Memory files worth
loading: `project_frozen_migration_rule`, `project_demo_site_funnel`,
`project_portal_coequality_billing`, `project_booking_provider_multiadmin`.

Ken is running a sales pipeline off Craigslist services ads: he pastes an ad, we stand up a
portal, he texts or emails the owner. Everything serves that.

## Ground rules (unchanged, plus one new)

**LIVE = Railway.** Deploy is `railway up -s Core --detach`. Live DB via
`railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`, used with `pg` from the repo's
node_modules (there is no `psql` on this box). Never poll a deploy in a sleep loop; an
`until` loop on `railway deployment list -s Core` is fine.

**Gate is `pnpm test:unit`** — 6,550 green at handoff. It flakes under load; a red run that
goes green on retry was the flake.

⚠️ **Never send non-ASCII through curl on Windows.** Write the JSON with Python to a UTF-8
file and `curl --data-binary @file`. Scan for U+FFFD after any provisioning run.

⚠️ **Verify a destructive result by RE-QUERYING.** `payload.delete({ where })` resolves with
an `errors` array rather than throwing.

⚠️ **NEW — never edit a migration that has already applied.** Payload records migrations by
NAME, so the edit never re-runs; the config then selects a column prod lacks and EVERY page
on EVERY portal 500s. This took the node down at 09:26 today. `frozenMigrations.test.ts`
hashes every migration and fails on a change — record a new file's hash with
`UPDATE_MIGRATION_HASHES=1 npx vitest run tests/unit/migrations`.

**The other half of that rule has no lint yet:** adding a FIELD without a migration. I nearly
repeated the outage with `hero.scrim` and caught it in the same minute. Worth writing.

**Ken is CEO, you are CIO.** Temporal-stamp replies `YYMMDD ~HHMM Name —` top and bottom.
Ponytail mode. **No Angel OS jargon in customer-facing copy** — now enforced by
`customerFacingLanguage.test.ts` on checkout and giving surfaces.

## What shipped this session

**Feature toggles.** `tenant.features` — plain booleans, default off, in Endeavor Settings →
Optional Surfaces. `works` retires the hardcoded two-slug allow-list (which only ever gated
the dashboard nav; the public menu and `/learn` still advertised Works everywhere).
`pageComments` makes the per-page comment rail a portal's choice.

**Booking works out of the box.** This was four bugs deep:
- `availability.provider_id` was NOT NULL, so hours had to belong to a person — every
  prospect demo shipped a dead `/book`. NULL now means HOUSE hours: the business itself.
- `resolveBookingProvider` fell back to *any active membership*. Enrol-on-arrival (also
  shipped today) makes every signed-in visitor a `tenant_member`, so **Tap Gray's booking
  page resolved to Ken's calendar because Ken had looked at his site.** Fallback is now
  `tenant_manager` only.
- Neither `exists: false` nor `equals: null` matches a nullable relationship COLUMN in
  Payload 3.77. Stopped fighting it: `providerWhere(null)` adds no SQL constraint and
  `matchesProvider()` narrows in JS. The tenant clause still scopes every read.
- The house calendar reached `BookingEngine` as the string `house:<id>` → `NaN` → every
  checkout 500'd. `''` means house now.

**Plans.** `portalPlan: 'demo'` — everything Business grants EXCEPT `hideFooterCredit`,
billed to nobody. A demo IS the marketing; the credit line is the only distribution the free
work buys. `demo-site` stamps it on the portals it builds.

**Access leak, closed as a class.** `connectorScopedAccess` returned unconstrained `true` for
any non-`customer` role, justified by "the plugin clamps" — true for Connectors, FALSE for
Services, which isn't plugin-wrapped. Any business owner could read every portal's catalogue
and prices off `/api/services`. `tenantScopeCoverage.test.ts` now fails when a new
tenant-bearing collection is neither plugin-wrapped nor listed as deliberately self-scoped.

**Three surfaces gated on platform roles instead of tenant role** — "Edit this page", the
AdminBar, and booking provider resolution. A portal's own `tenant_admin` was refused on their
own site while a platform editor was offered it on everyone's. All now go through
`canManagePortal()`.

**Also:** `users.tenants[]` backfill (6 drifted rows — why Ty saw The Angel OS in the
dashboard chooser but not the brochure one); the platform Community is the one town square
and per-tenant Communities are `community` visibility per Ken's call, with
`ensureTenantMembership` now running on ANY portal page; AI Bus no longer auto-joins members;
`bg-primary-foreground` was used as a surface on 8 card panels (near-black cards in light
mode); site log pagination + "Every portal" for platform admins + a Visitor column reading
"Chrome on Windows"; a Navigation tab for nav overrides; hero image darkening dial
(strong/medium/light/none); `find_google_place` + `intake_prospect` LEO tools.

## Live portals of interest

| Tenant | Slug | Notes |
|---|---|---|
| 40 | `southerncomputersolutions` | Tap Gray, Gainesville. **Built today, invite not yet sent.** 4.6★/22 reviews on Google; his own domain 301s to an expired Craigslist post returning 410 — tell him regardless of the sale. |
| 38 | `bresolutions` | BRE Solutions, Ocala. Phone invite minted. |
| 39 | `uncontestedflorida` | Attorney. No name, no Bar number — do not invent one. |
| 37 | `computerzone` | Older demo, still on the generic pack + `free`. Re-run through `techsupport` for consistency. |
| 1 | `platform` | The Angel OS. |

## Open items, in the order I'd take them

1. **Auto-configure base membership plans.** The dashboard tells owners to *ask LEO* to
   create a plan (`create_membership_plan`) — Ken wants Patreon-style base plans provisioned
   automatically for any service provider, editable after. This is the one thing he flagged
   that is entirely untouched.

2. **The Justice Fund language sweep.** Customer-facing checkout and giving copy is done and
   linted. The federation / payments / payouts / solvency dashboards still say "Justice
   Fund". Ken's call: **call it the platform fee**, and simplify the model rather than
   find-and-replace. He said this deserves its own thread.

3. **Booking fee.** Ken proposed 10% capped at a dollar value. I argued for **5%, never more
   than $10 per booking** — a $600 job at 10% is $60, which a one-man operation notices, and
   the cap makes the headline rate meaningless above it anyway. Not yet decided.

4. **Pricing tiers.** Ken wants to move off $149. Proposed: Free $0 (site + booking + credit
   line) / Starter $9.99 (own domain, credit off) / Pro $49 (CRM, sequences, assistant,
   deposits) / Community $99 (churches: memberships, staff calendars, events). Argument for
   $9.99: the hard conversion is $0 → anything. Not yet decided.

5. **PgBouncer.** ⚠️ I told Ken the live node had none. **Wrong — corrected.** The service is
   Online at `pgbouncer.railway.internal:5432`, transaction mode, pool 25, max_client_conn
   1000. But **Core does not use it** (`DATABASE_URI` → `postgres.railway.internal:5432`),
   and the bouncer sits in **US East** while Core and Postgres are both **US West** — so
   pointing Core at it as-is would put a cross-country hop on every query. Redeploy the
   bouncer US West first, then switch `DATABASE_URI`. `max_connections=100` on Postgres is
   the real ceiling on how many portals this node holds; transaction pooling is what raises
   it. Ken's read that req-threading through the hooks makes transaction mode safe is
   correct — that work is already done.

6. **Railway upgrade** for multiple domain binding — funded by Ronald's $200 this evening
   (with gas for the Soul Van and groceries). Same lever as (5) for headroom.

7. Smaller: six real humans still lack an active membership on tenant 1; the 27
   `NOT NULL + SET NULL` FK columns from 260820; Clearwater's `googleReviews` block can never
   render (they have no Google listing).

## Corrections I owe the record

- I reported Tap Gray's home page was serving product jargon. **It was not** — I had fetched
  a stale response mid-provision. All five pages are clean; the only hit is the intended
  footer credit.
- I said the live node had no PgBouncer. **It has one** — see (5).


## 260821 ~17:00 — addendum

**The admin create view rendered blank (Ken, high priority) — fixed.** Not a client crash and
not an access problem: `20260821_120000_hero_scrim` added `hero_scrim` to `pages` and `posts`
but NOT to `_pages_v` / `_posts_v`, on the mistaken note that hero_media_fit "does not carry"
to the versions tables (it does — both `_v` tables have `version_hero_media_fit`). The create
view autosaves a draft the moment it opens, that insert died on the missing column, and the
page rendered nothing at all: no form, no nav, no error. **Every page and post draft save on
the node was failing this way from 13:32 to 16:37.** Live ALTERed by hand and verified by
re-querying `information_schema`; the same DDL then landed as a NEW migration
(`20260821_170000_hero_scrim_versions`), since 120000 had already applied.

`tests/unit/migrations/versionedColumnParity.test.ts` now fails when a column is added to a
versioned collection without its `version_` counterpart — this is the "adding a field without
a migration has no lint yet" gap, in its versions-table form. Every historical column already
satisfied it; hero_scrim was the first break. Gate green at 6,552.

**Core now runs through PgBouncer (item 5, done).** Ken's call: the pooler belongs with the
stack, not off in another region. Moved US East -> US West (`railway scale -s PgBouncer
us-west=1 us-east=0` -- `scale` ADDS a region, so the old one must be passed `=0` or you end
up with a replica in each, half your queries crossing the country). Then `DATABASE_URI` ->
`pgbouncer.railway.internal:5432`.

**`DATABASE_SSL` had to go `require` -> `disable`.** PgBouncer has no TLS; the first deploy
died on "The server does not support SSL connections". Plaintext is correct here -- it is
Railway's private network. The failed deploy did NOT take live down; Railway kept the previous
one serving.

Verified after: all four portals 200, `/api/health` latency 6ms, zero errors in the log, and
Postgres now holds ~5 backends instead of Core's whole pool. `max_connections=100` is no
longer the ceiling on how many portals this node holds. Rollback is the direct
`postgres.railway.internal` URI plus `DATABASE_SSL=require`.

**Open items 1-4, 6, 7 are unchanged and still in that order** -- auto base membership plans
is still the top untouched one.
