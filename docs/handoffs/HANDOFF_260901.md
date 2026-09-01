# Handoff — 260901

> Journal entry, not the present. `CLAUDE.md` is the current-state runbook;
> `docs/GLOBAL_PUNCH_LIST.md` is the living board. Read both before this.

**Two visual companions to this document:**

- **State of play** — the nine stages from stranger to revenue, what is built vs hollow, and
  six runbooks for exercising it: https://claude.ai/code/artifact/13518389-0c30-4514-b357-97f5fa31d445
- **Portal ownership model** — why "16 of 100" disagreed with itself, and the plan/quota/role
  map: https://claude.ai/code/artifact/eaaf20f2-f307-4dcf-997c-86500a756270

---

## Start here (paste this into the next session)

> Continue the 260901 plans-and-SEO lane on Angel OS. Read `CLAUDE.md`, then
> `docs/handoffs/HANDOFF_260901.md`, then `docs/GLOBAL_PUNCH_LIST.md`.
>
> **There are 5 unpushed commits on local main** — 3 mine, 2 from a parallel
> domains lane. Confirm with `git log --oneline origin/main..HEAD` before doing
> anything. Ken deliberately held the push until the P1s were resolved; they now
> are, so **ask whether to push before touching anything else.**
>
> Ken is CEO, you are CIO, CTO mode, ponytail, temporal stamps top and bottom.
> The goal behind all of this is the FIRST PAYING CUSTOMER — see
> `project_angel_os_is_the_livelihood`. A partner pitch to Raj Veepuri
> (Celersoft) and Trace Tervo (Advantage International) is drafted and waiting on
> the items in "What Ken owes" below.

---

## What shipped today

Six commits, one pushed (`e12e807`), five not.

| Commit | What |
|---|---|
| `e12e807` **pushed** | A/B testing, site-wide JSON-LD, and the MediaText outage |
| `57236e7` *(other lane)* | Portal owners can bind their own domain |
| `03d2517` *(other lane)* | wheredideveryonego.net zone docs |
| `2fc0f49` | One answer to "which portals are yours"; the free tier can open again |
| `107de93` | A payment can move a portal's plan; the domain gate means something |
| `e3aa15d` | The agency tier |

### A/B testing — `src/utilities/abVariant.ts`

Middleware buckets every visitor `a`/`b` in `aos_ab` (180d, first-party, not
httpOnly so client-side experiments can read it) and forwards `x-ab-variant`,
because the cookie set on a response is not readable on that same request — and
the first request is the landing page, which is what an experiment is usually
about. `site_visits.variant` stores it.

A conversion is **a visit to a goal path** (`?goal=/x`, defaulting to
`/thank-you` and friends). `GET /api/site-log/report?type=variants` returns
per-arm rates, a two-proportion z-test, and a verdict that **refuses to call a
winner below 100 visitors per arm**. UI: an "A/B test" tab on
`/dashboard/admin/site-log`.

**Ceiling:** ONE concurrent experiment. A second becomes
`aos_ab=<experiment>:<bucket>`; nothing else in the pipeline changes. Also:
nothing on any site currently varies by bucket — the machinery is live and idle.

### Structured data — `src/utilities/structuredData.ts` + `src/components/JsonLd.tsx`

Organization/LocalBusiness with the schema.org subtype **derived from
`businessType`** (a church emits `Church`), plus WebSite, Article, Event,
BreadcrumbList. Wired into the app layout, `posts/[slug]`, `events/[slug]`.
Tenants gained `storefront.address` — Google renders no local result without a
PostalAddress. Every builder returns `null` rather than a thin graph.

### The MediaText outage

`width`, `side` and `playback` were added to the block config with no migration,
so **every Page, Post and Product carrying a Media + Text block 404'd** on any
database built purely from migrations — which is what production is. Same
footgun as the 260728 `aspect` incident, same fix: derive the table list from
`video_on_right`, never enumerate it.

### Portal ownership — `src/utilities/portalQuota.ts`

`getOwnedPortals()` is now **the** definition of "your portals": `tenant_admin`,
active, uncapped. The apex home card's list and its count both read one query.
Previously the list asked for any active membership capped at `limit: 20`, so it
rendered 20 buttons above "16 of 100" and silently hid everything past the 20th.

**Guardian angels no longer count toward `used`** (they still count toward the
allowance). They were consuming the entire free quota of 1, so a free user's next
portal — the actual business — was refused. That closed the free tier at exactly
the step it exists to open.

### Billing — `src/endpoints/portal-plan-checkout.ts`

**Nothing on this platform had ever written `tenants.portalPlan` from a payment.**
The `/dashboard/plan` button linked to `spacesangels.com/plans?portal=…&plan=…`
and no route has ever read those params. That is why no portal has ever been on a
paid plan.

`POST /api/plan-ops/checkout` mints a Stripe subscription session on the
**platform** account (spacesangels.com is the merchant — no Connect, same shape
as `guardian-angel-checkout`), metadata `angelOs_type: 'portal_plan'`.
`applyPortalPlanFromSubscription` in `stripe-webhooks.ts` writes the field.

The write is in the **webhook, never the endpoint**: a session that is created is
not a payment. Lapsed → `free`, never a remembered middle tier. A `demo` portal
is never touched. Only `site` and `business` are purchasable.

### The domain gate

`portalCan(tenant, 'customDomain')` in `domain-ops.ts` → 402 with an upgrade
pointer. **On `add` only** — a portal that lapses keeps the domains it already
bound. Taking a live customer's site off its address to enforce a billing state
is out of proportion to the miss.

### The agency tier — Ken's 260901 ruling

`portalPlan: 'agency'` — Business's capabilities exactly, `PORTAL_QUOTA = 100`,
platform fee 0. The features were never the wall; the allowance was.

**An agency allowance is room to HOLD portals, not a grant of Business to each of
them.** A client site still carries its own plan. Quota answers "how many", plans
answer "what may each one do".

Granted by hand like `demo`. **The $299 is Claude's placeholder, not Ken's
price** — `agency` is absent from `PURCHASABLE_PLANS` so nothing can charge it,
and two tests assert that.

---

## ⚠️ Durable lessons from today

- **A hand-written list of plan literals is a footgun.** `planOf` was an `||`
  chain and `bestPlan` used `indexOf` over an ordered array. Both silently forgot
  `agency`: an agency portal read back as `free`, and the person on the most
  generous plan would have been reported as being on the least. Both now derive
  from records, so the next tier is a type error. **Check for the same shape
  anywhere else plans or roles are enumerated by hand.**
- **Two answers to one question always drift.** The home card is the case study:
  a list and a count that each asked their own version of "your portals".
- **A block field with no migration is a live outage**, and it surfaces as a 404
  rather than a schema error. Grep new block fields against `src/migrations/`.

---

## What Ken owes (nothing below is a code task)

1. **`STRIPE_WEBHOOKS_SIGNING_SECRET`**, and register `customer.subscription.created /
   updated / deleted` on the **platform** Stripe account — *not* a Connect account.
   Without it checkout succeeds, the card is charged, and the plan never moves.
2. **Buy a Site plan on a throwaway portal with a real card** and confirm
   `portalPlan` flips. Zero paid portals and zero orders in the platform's
   history; this is the one thing code cannot verify.
3. **Set the agency price**, then add `agency` to `PURCHASABLE_PLANS`.
4. **Fill `storefront.address`** on the church and local-business portals. Today's
   structured-data work is inert on exactly the portals it was built for until
   this is done.
5. **Pull Google Search Console** — impressions, clicks, top queries, 28 days. The
   partner email claims organic reach and nothing has verified it.
6. **Decide the push.**

---

## Hanging chads for the next session

- **The partner rollup screen.** The apex card now carries the right set —
  portals you administer, uncapped. Add one visits-per-week number per row
  (`GROUP BY tenant_id` over `site_visits`, scoped to `getOwnedPortals`) and a
  **Portals** card on the dashboard home when you manage more than one. Small
  now that the set is settled. **Do not scope it to `super_admin`** — an agency
  partner holds no platform role.
- **Run an actual experiment.** Nothing varies by bucket yet. The obvious first
  one is the apex hero headline or the CTA on `/get-started`.
- **Verify the domain UX end to end.** Binding works; it is unverified whether the
  UI tells the customer which CNAME/A record to create at their registrar. Check
  before demoing it.
- **The MediaText class of bug.** One block had three fields with no migration.
  Audit the other blocks the same way before something else 404s.
- **Rich Results Test.** Nothing has been through it. Three or four live URLs.

---

## State of the tree

```
e3aa15d  feat(plans): an agency tier                      ← HEAD, unpushed
107de93  feat(plans): a payment can move a portal's plan   unpushed
2fc0f49  fix(portals): one answer to "which portals..."    unpushed
03d2517  docs: the wheredideveryonego.net zone             unpushed (domains lane)
57236e7  feat(domains): bind your own domain               unpushed (domains lane)
e12e807  feat(analytics,seo): A/B, JSON-LD, MediaText      pushed
```

**Migrations applied locally, not in production:**
`20260901_090000_ab_variant_and_address`,
`20260901_093000_media_text_width_side_playback`,
`20260901_120000_portal_plan_agency`. They run on container boot; the second one
is the outage fix and matters most.

**Gate:** `pnpm test:unit` — 426 files, 6,841 passing. The 11 unhandled
rejections mentioning `LEO_TOOLS` / `buildConfig` are pre-existing and confirmed
on clean HEAD; re-run before chasing them.

**Deploy is `railway up -s Core`.** `git push` does not deploy.

**Parallel lane:** a second session owns `SettingsHub.tsx` and `domain-ops.ts`.
Say so before editing either. This lane touched `domain-ops.ts` twice today (the
plan gate and a one-word `prefer-const` fix) — both announced.
