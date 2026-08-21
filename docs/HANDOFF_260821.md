# Handoff — 260821 (DJ Khalid Focusly)

Paste the block below into a fresh session.

---

Continuing the Angel OS revenue push — thread name **DJ Khalid Focusly**. Read
`docs/HANDOFF_260821.md` first, then `docs/HANDOFF_260820.md` for the outages and older
context. Memory files worth loading: `project_demo_site_funnel`,
`project_invitation_creates_user`, `project_portal_coequality_billing`,
`project_space_visibility_rbac`, `project_works_canonical_syndication`.

Ken is running a sales pipeline off the Craigslist **services** section: he pastes an ad,
we stand up a portal, he texts or emails the owner. Everything below serves that.

## Ground rules

**LIVE = Railway.** Deploy is `railway up -s Core --detach`. Live DB via
`railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL` (use `pg` from the repo's
node_modules; there is no `psql` on this box).

**Never poll a deploy in a loop.** `railway deployment list -s Core` is the only honest
signal. Fire it, do other work, check once. An `until` loop on the deployment list is
fine; a chain of sleeps is not.

**Gate is `pnpm test:unit`** — 375 files / 6,497 tests, green at handoff. It flakes under
load; a red run that goes green on retry was the flake. `tsc --noEmit` shows pre-existing
errors in `tests/**` that are not yours — filter with `grep -v "^tests/"`.

**Ken is CEO, you are CIO.** He feeds prospects and makes product calls; you call the
build order. Decide and act, commit and push to main, temporal-stamp replies
`YYMMDD ~HHMM Name —` top and bottom. Ponytail mode: laziest thing that works, one
runnable check left behind. **No Angel OS jargon in customer-facing copy.**

⚠️ **Never send non-ASCII through curl on Windows.** Em-dashes arrive as the U+FFFD
replacement character and get baked into live copy — 31 rows across 5 tenants had been
serving mojibake for months before this was found and repaired on 260820. Write the JSON
with Python to a UTF-8 file and `curl --data-binary @file`, or pass text as a pg
parameter. Scan for U+FFFD after any provisioning run.

⚠️ **Verify a destructive result by RE-QUERYING.** `payload.delete({ where })` does not
throw on a per-document failure — it resolves with the failures in an `errors` array.
Decommissioning tenant 32 reported "1 deleted" while the row was still live and serving.

## What shipped 260820–21

**The funnel now hands over the keys.** `demo-site` built portals and stored the buyer's
email but minted no membership and no invite — the customer could not administer what we
sold them. `utilities/inviteOwner.ts` is now the shared primitive (idempotent, never
throws); both `demo-site` and `provision-portal` call it. It takes **email OR phone** — a
Craigslist ad usually gives a number and nothing else — and writes `invitationPhone`, so
the inviter copies the link and texts it and the invitee signs in with an OTP.
`tenant-invite-accept` binds to whoever is logged in, so Google, OTP and password all
work.

**Retrieve an invite link after the fact:** LEO tool `get_portal_invites`, or
`GET /api/provision-ops/invites?slug=<slug>&key=$CRON_SECRET`. Minting returns the URL
once; this hands it back without duplicating it.

**Leads always reach someone.** `resolveOwnerEmail` falls through to
`PLATFORM_LEADS_EMAIL` (`clearwatercruisin@gmail.com`, env-overridable). Unclaimed
prospect portals were notifying nobody and enquiries died in the database.

**Unclaimed portals are noindexed.** `utilities/isPortalClaimed.ts` — derived from
whether a non-system human holds an active membership — drives `robots.txt` and page
metadata. Fails closed. ⚠️ **This blocks the lead-engine idea** (see Open threads).

**Plans and gating.** `tenants.portalPlan` (`free` / `site` / `business`) is what a portal
pays US — distinct from membership plans (what a tenant charges its own customers) and
`bootstrapFees.tier` (transaction-fee banding). `utilities/portalPlan.ts` is the one
capability map. Gated so far: footer credit (Site and above) and `/book` (Business).
Upgrade path is a sidebar row above the account block → `/dashboard/plan`; checkout links
to the apex.

**Trade packs:** added `landscaping` and `legal`. The legal pack's copy is written against
Florida Bar Rule 4-7 — no outcome promises, no superlatives, no testimonials. Matchers for
both run BEFORE `clean` / `handyman`, so "pressure washing" is not maid service and
"probate" is not home repair.

**Also:** the favicon is now the real Angel OS mark (two SVG sources,
`scripts/gen-icons.mjs` regenerates every size — hand-packed ICO so the 16px is not a
downscale); `/learn` leads with a practical operator guide; `AdminReturnBar` gives the
Payload editor a way back to the dashboard (`?returnTo=` and `&returnLabel=`); the sidebar
chat header follows the active channel; Anthony J Studio fully decommissioned.

## Live portals of interest

| Tenant | Slug | Notes |
|---|---|---|
| 38 | `bresolutions` | BRE Solutions, Ocala lawn care and pressure washing. Phone invite minted; Ken texted it. |
| 39 | `uncontestedflorida` | Attorney, uncontested divorce and probate. **No name and no Bar number on it** — could not verify one, will not invent one. |
| 1 | `platform` | The Angel OS. Chooser label was "Angel OS Platform"; renamed 260821. |

## Next in value order

1. **Feature toggles, and Works off everywhere else.** `tenant.features` — plain
   booleans, surfaced in Endeavor Settings, default off — driving the dashboard nav, the
   public **More** menu, and the Learn tab's Works section. Only `clearwater-cruisin` and
   `wheredideveryonego` get Works. This **retires the hardcoded two-slug allowlist**
   (`WORKS_ENDEAVORS` in `dashboard/nav-config.ts`). Keep it separate from `portalPlan`:
   plan answers "have they paid for it", features answer "do they want it".

2. **Community space visibility.** Root cause found, and it is a dead code path:
   `buildSpaceVisibilityFilter` rule 2b makes any space with `visibility: 'community'`
   visible to every authenticated user — and **zero spaces on the node have that value**.
   All 30 "Community" spaces are `invite_only`, so the town square is being emulated with
   per-user `space_memberships` rows minted on portal-touch, which is why it is patchy
   (Ty has Community in six portals and AI Bus in three). Fix: provision Community as
   `visibility: 'community'`, backfill the 30 existing rows, drop the grant-on-touch
   crutch. Also hide **AI Bus** (private, plumbing) from non-admins' Spaces picker — it
   was the first thing a visiting user saw.

3. **The prospect pipeline.** One call: paste an ad → portal + invite + a **Project**
   record + the draft email. Projects live in **The Angel OS (tenant 1)**, not Clearwater —
   Clearwater is a ministry with real members and prospect records would drown it. Open
   design question: does LEO parse the raw ad text, or does Ken fill three fields?

4. **Run it on Ken's three** (full ad text is in the 260821 thread):
   - Tile installer, Ocala, 352-274-4928, 25 years, licensed and insured. **Six gallery
     images in the ad → two galleries on a portfolio page.**
   - The Concrete Cowboy of North Florida LLC, AJ, 352-681-3341, Gainesville.
   - Southern Computer Solutions, Tap Gray, 352-278-4770, Gainesville, since 2001. **He
     already has a site with Google reviews**, so he is a weak website prospect and a
     strong **$149 Business** prospect — one-man mobile operation, scheduling is his whole
     problem. Different email from the other two.

## Open threads and gaps

- **Lead-engine vs prospect-demo.** Ken wants to index everything and sell or subcontract
  the leads. Agreed for **anonymous vertical sites** (solar, movers — invented brand,
  nobody's identity, index hard). Pushed back on indexing **named** demos: you would
  outrank the real business under their own name and then route their lead elsewhere
  (FDUTPA, and it turns a gift into a hostage). **Legal is a hard no** — Bar Rules 4-7.22
  and 4-5.4 govern lawyer referral services and fee-splitting with non-lawyers. Proposed
  `tenant.portalKind`: `prospect-demo` (noindex until claimed) / `lead-engine` (indexed
  from day one) / `client`. **Note that `isPortalClaimed` currently noindexes a lead
  engine forever** — this field is the fix. Decision tabled by Ken; stamp the field during
  step 3 anyway.
- **Booking on Free.** `/book` is now gated to Business. Confirm that is wanted on
  *prospect demos* — an upgrade notice may sell better than a live booking page, or worse.
- **`invitedBy` renders to the prospect** ("<name> invited you to join <portal>"). Fixed
  to prefer a super_admin, but check it on any invite sent by hand.
- **Six real humans lack an active membership on tenant 1** (ids 17, 18, 143, 144, 146,
  148). System accounts are correctly skipped. Doctrine says every person is rooted in
  root.
- **27 NOT NULL + SET NULL FK columns** still exist platform-wide (from 260820).
- **Nimue is tabled.** It still works; pushing to it over the new router is untested. All
  cycles go to monetization.
- **The verticals / lead-engine build is tabled, not cancelled.**
