# Handoff — 260823

Paste the block below into a fresh session.

---

Continuing Angel OS. Read `docs/GLOBAL_PUNCH_LIST.md` first — it is the living issue board and
was updated 260823. Then `docs/HANDOFF_260821_B.md` for the prior thread. Memory files worth
loading: `project_portal_manager_access`, `project_frozen_migration_rule`,
`project_demo_site_funnel`, `project_portal_coequality_billing`.

**Ken is CEO, you are CIO.** Temporal-stamp replies `YYMMDD ~HHMM Name —` top and bottom.
Ponytail mode. No Angel OS jargon in customer-facing copy.

## Ground rules

**LIVE = Railway.** Deploy `railway up -s Core --detach`. Live DB via
`railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`, used with `pg` from the repo's
node_modules (no `psql` on this box). Poll a deploy with an `until` loop on
`railway deployment list -s Core`, never a sleep loop.

**Gate = `pnpm test:unit`** — 6,579 green at handoff. It flakes under load; a red run that goes
green on retry was the flake. `npx tsc --noEmit` has **47 pre-existing errors**, all in
`tests/unit/federation-domain.test.ts` — that is the baseline, not your diff. Compare counts.

⚠️ **Never edit an applied migration.** New column = new file. `frozenMigrations.test.ts` hashes
them; record a new one with `UPDATE_MIGRATION_HASHES=1 npx vitest run tests/unit/migrations`.

⚠️ **A new field is TABLES, not config.** Versioned collections need the `_v` twin
(`versionedColumnParity.test.ts`), a new block needs its block tables, and a polymorphic
relationship needs a `<target>_id` column on the rels table. Miss it and the admin renders BLANK
with no error — the create view autosaves a draft on open and that insert dies.

⚠️ **Never send non-ASCII through curl on Windows.** Pass text as a pg parameter or a UTF-8
`--data-binary @file`, then grep for U+FFFD afterwards.

⚠️ **Python heredocs: use RAW strings for anything containing backslashes.** A non-raw heredoc
turned a regex word-boundary into a literal BACKSPACE character (0x08) in the source on 260823 —
it looked correct on screen and silently never matched. The repo is currently clean of control
characters; keep it that way. Bash heredocs also choke on apostrophe-heavy prose — use the Write
tool for documents.

⚠️ **Verify destructive results by RE-QUERYING.** `payload.delete({where})` resolves with an
`errors` array rather than throwing.

## What shipped 260822–23

**Security — the big one.** Enrol-on-arrival makes every signed-in visitor an active
`tenant_member` of any portal whose page they load, and `syncUserTenants` copies that tenant into
`users.tenants` **with no role**. Five places authorized off that array, so a stranger who merely
looked at a shop could delete its products and list/accept/fulfil/ship its orders
(`orders-vendor` runs `overrideAccess` — customer names and addresses). The integrations page was
the same shape and handed over another portal's connector secrets. All six now resolve the role
from `tenant-memberships` via `managedTenantIds()`. **`noRoleBlindTenantAuth.test.ts` fails on any
new file reading `user.tenants`** — three files sit in its allowlist as NOT YET REVIEWED
(`ai-bus-poll`, `ai-bus-stream`, `x-post`; they pick which tenant to act in, not whether you may).

**Portal owners can edit their own portals.** Content writes were `adminOnly` — a PLATFORM role no
tenant_admin holds — while nine dashboard screens link into `/admin/collections/...`. Every
invited owner hit "not allowed" on their first Edit click. Posts, Pages and TenantMemberships now
accept a portal manager, scoped by role; `enforceManagedTenant` runs at beforeValidate AND
beforeChange, because plugin hook ordering is not safe to assume when being wrong means a write
onto someone else's portal.

**Also:** comments were impossible platform-wide (`/api/comments/add` was shadowed by Payload's
own REST routes for the `comments` collection — now `/comment-ops/add`, with
`endpointCollectionCollision.test.ts` enforcing the rule); the admin create view rendered blank
(`hero_scrim` missing from the `_v` tables); PMs between people (the whole path existed, nothing
ever called it with two humans, and the roster had no button); Core through PgBouncer; the Archive
block relabelled "Featured Posts & Products" with a `columns` control and a `featuredPosts` spec
section; the Comments block on Pages; the booking fee capped at $9.99.

## Pricing — DECIDED 260823, monthly buys down the rate

- **Free** — the whole site, booking included, footer credit, **5% capped at $9.99**
- **Site $29** — own domain, credit gone, **fee drops to 2%**
- **Business $79** — CRM, assistant, memberships, recurring billing, **0% booking fee**

Replaces Free/$49/$149. Rationale: the booking fee and the old $149 tier competed for the same
value, so charging both was double-dipping and it is why $149 was hard to sell. Positioning is
parity with Wix/Squarespace — open source, community-based and prayerful is the reason to choose
us AT parity, never a discount justification. **Not yet implemented in code or on `/pricing`.**

⚠️ **The fee is charged on the DEPOSIT, not the job** — `feeCents(deposit, …)` in
`booking-checkout.ts`. 5% of a $50 deposit is $2.50, not 5% of a $600 job. Plan revenue on that
basis. And `application_fee_amount` only works on a **connected** account, while most portals are
`platform-direct` — the money lands in Ken's own Stripe, so there is no fee to take. Stripe
Connect onboarding per portal is an unresolved prerequisite for the whole model.

## Open items, in the order I would take them

1. **⭐ No subscription has EVER completed on live.** `memberships` is 0 rows; 14 portals on
   `free`, 8 on `demo`. Every money bug this week was invisible until someone actually tried it.
   Run ONE $1 checkout on Clearwater, confirm the webhook writes the row, refund. Twenty minutes,
   and it derisks everything downstream of it.

2. **⭐ Works: per-portal availability, and finish getting off the filesystem.** See below — the
   best-defined piece of work on the list.

3. **Implement the new pricing** — plan flags, the per-plan buy-down of the fee rate, `/pricing`.

4. **Community loop for the Nimue beta and Grace Chapel.** Three gaps: imported Google contacts
   land in the importer's PERSONAL portal rather than the org's (`resolveUserHomeTenant`); there
   is no bulk invite (needs a per-tenant daily cap first — mass invites from one portal burn the
   shared Resend sending reputation for every portal on the node); and an invited person lands
   NOWHERE (`invite-accept` returns `{spaceId}` as JSON, nobody is taken into the channel). A
   shareable join link probably beats mass email for congregations anyway.

5. **Events have no `layout` field**, so they can carry no blocks — no Comments, no Archive.
   Churches want event pages with an RSVP thread. Giving Events a layout is the unlock.

6. **Church hall booking needs no new code.** A hall is a *service named after the room* plus
   house hours (`provider_id = NULL` means the business itself, shipped 260821). Grace Chapel (12)
   has **0 services and 0 availability**, which is the only reason its `/book` is dead. The
   unmerged `feat/bookable-inventory` branch is NOT needed for facilities — Listings only earns
   its keep for date ranges (campground) or per-unit inventory.

7. Smaller: `/learn/works` still resolves on portals with Works off (the toggle removes the nav
   entry, not the route); six real humans lack an active membership on tenant 1; the 27
   `NOT NULL + SET NULL` FK columns from 260820.

## ⭐ The Works job (item 2), specced

**Ken's two goals turn out to be one piece of work.** He wants (a) per-portal configuration of
which Works a portal carries, and (b) everything in the database — "the platform should just be a
presentation engine for content stored in the database."

**The content is ALREADY in the database, which is the good news.** `works.storageRef` is
`{"kind":"messages","space":N,"channel":"work-<slug>"}` — every Work's text lives as messages.
Verified live: `work-holy-bible` = **1189 messages** (exactly the number of chapters in the
Bible), `work-wdeg` = 26, `work-angel-os-handbook` = 14, `work-answer53` = 13.

**What is still on the filesystem — `src/souls/`, 11MB total:**

- `src/souls/holy-bible/data/*.json` — **11MB of Bible JSON, i.e. the entire size**. This is the
  IMPORT SOURCE for content that already lives in the DB. Verify chapter-for-chapter, then delete.
- `src/souls/<slug>/manifest.ts` — metadata plus the availability config.
- `src/souls/index.ts` (`getAllSouls`) and `src/souls/subscriptions.ts`.

**`subscriptions.ts` IS the feature Ken says never materialized — it exists, but in the source
tree.** Its own header states the model: `canonical.endeavor` is the owner,
`manifest.subscribers[]` are the additional carrying endeavors, `availableGlobally` means
everywhere, `platform` is the implicit universal index, and — verbatim — "Keyed by tenant SLUG…
**No DB, no schema change — by design**."

So configuring which Works a portal carries currently means **editing a TypeScript file and
deploying**. A portal owner cannot choose their own. That is precisely the gap.

**The job:** move availability out of the manifests into the DB — a `works` ↔ `tenants`
many-to-many, or a `subscribers` relationship on `works`, keeping `owner` as it is. Then
`isWorkAvailable` / `isWorkPublished` / `subscribersForWork` read the DB, `getAllSouls()` reads
`works` rows, and the manifests stop being load-bearing. That one change delivers both goals at
once: owners configure their own Works from Settings, and `src/souls/` can go.

**Concrete first customers:** Ron's site (`wheredideveryonego`) should carry **wdeg AND
holy-bible**; Clearwater keeps all of them. Today wdeg is owned by `wheredideveryonego` and
holy-bible by `platform`, so the second one needs exactly the subscriber mechanism above — it is
the smallest real test of the feature.

⚠️ The schema rule applies: the new relationship needs its join table or rels column in a NEW
migration, shipped before the config that selects it.

## Live portals

| Tenant | Slug | Notes |
|---|---|---|
| 1 | `platform` | The Angel OS. The universal Works index. |
| 5 | `clearwater-cruisin` | Ken's ministry. Montserrat/Lato. Carries most Works. |
| 11 | `wheredideveryonego` | The book. ⚠️ `business_type='retail'` strips Works/Learn/**Spaces**/Donate from the nav — set 260822 to hide Works, but it hides Spaces too, which CONFLICTS with using this portal as the Nimue-beta organizing base. Ken's call: `business_type=null` plus nav overrides hiding `/works` and `/learn`. |
| 12 | `grace-chapel` | Church demo. 0 services, 0 availability, so `/book` is dead. |
| 40 | `southerncomputersolutions` | Tap Gray, Gainesville. Invite still not sent. |
| 38 | `bresolutions` | BRE Solutions, Ocala. |

## Corrections owed to the record

- I flagged Media create being bare `authenticated` as a possible problem. **Ken: it is
  deliberate** — Media create is the shared upload path for LEO, Spaces channels and users.
  Leave it alone.
- I described the DM leftovers as living in Clearwater's Community space. **They are in the AI Bus
  space (18).** What is in Community (6) is `nimue` and `nimue-wear` — and `nimue` has 0 messages
  by `channelRef` but 2 by slug, so it wants a merge, not a delete.
