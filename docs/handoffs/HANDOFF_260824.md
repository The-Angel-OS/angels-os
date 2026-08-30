# Handoff — 260824

Paste the block below into a fresh session.

---

Continuing Angel OS. Read `docs/GLOBAL_PUNCH_LIST.md` first — it is the living issue board and
was updated 260824. Then `docs/HANDOFF_260823.md` for the prior thread. Memory files worth
loading: `project_works_canonical_syndication`, `project_portal_coequality_billing`,
`project_guardian_angel_monetization`, `project_earn_loop_clearwater`, `project_leo_capability_ladder`.

**Ken is CEO, you are CIO.** Temporal-stamp replies `YYMMDD ~HHMM Name —` top and bottom.
Ponytail mode. No Angel OS jargon in customer-facing copy — a visitor to a church website should
never learn what we are.

## Ground rules

**LIVE = Railway.** Deploy `railway up -s Core --detach`. Live DB via
`railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`, used with `pg` from the repo's
node_modules (no `psql` on this box; put the script IN the repo dir so node resolves `pg`). Poll a
deploy with an `until` loop on `railway deployment list -s Core | sed -n 2p` — match only the TOP
row, or you match an older SUCCESS and return instantly.

**Gate = `pnpm test:unit`** — 6,602 green at handoff. Three tests flake under load and pass on
retry every time: `sprint19/vapiWebhook`, `sprint44b-endeavor-truncation`, `sprint6-commerce`.
A red run on those three is the flake, not your diff. `npx tsc --noEmit` is clean in `src/`;
`tests/` carries pre-existing errors — compare counts, and filter with `grep -v "^tests/"`.

⚠️ **Never edit an applied migration.** New column = new file. Record with
`UPDATE_MIGRATION_HASHES=1 npx vitest run tests/unit/migrations`.

⚠️ **A new field is TABLES, not config.** Versioned collections need the `_v` twin, a new block
needs its block tables, a polymorphic relationship needs its `<target>_id` on the rels table. Miss
it and the admin renders BLANK with no error.

⚠️ **Bash heredocs choke on apostrophe-heavy TypeScript.** Writing `leoMemberTools.ts` through a
heredoc died on `unexpected EOF`. Use the Write tool for any file with prose in it. Python
heredocs for edits are fine — but use RAW strings for anything with backslashes.

⚠️ **`pg` needs an explicit cast for a jsonb parameter** — `set opt_outs = $1::jsonb`, never bare
`$1`, or you get "could not determine data type of parameter".

⚠️ **The tenant cache is 120s in prod.** A `business_type` or `features_*` change does not show on
the site for up to two minutes. Do not debug what is only the TTL.

⚠️ **Verify destructive results by RE-QUERYING.** `payload.delete({where})` resolves with an
`errors` array rather than throwing.

## What shipped 260823–24

**Works availability moved off the filesystem, and a portal owner can pick their own Library.**
`subscribers[]` lived in a TypeScript manifest, so choosing what a portal carried was an
edit-and-deploy only the platform operator could do. Now `works` rows: `owner` / `subscribers` /
`optOuts` / `availableGlobally` / `published`, read through `src/works/registry.ts` (React-cached
per request), rules in `src/works/availability.ts` (pure, unit-tested). `optOuts` is the new verb —
a portal switching OFF a Work offered to everyone; the OWNER always carries its own. Dashboard →
Works opens on "The Library on \<portal\>", one checkbox per Work. Every read surface resolves from
the DB: /learn, /works, the chapter viewer, the Header nav, works-ops list/get/checksums,
`dailyBread`, `workAttribution`. Re-importing no longer clobbers availability an owner chose.
`src/souls/` is 52K and read only by the importer — the 11MB Bible ingest JSON is deleted and
gitignored (verified 1189 chapters three ways before deleting). `e78697c` `c1ab544`

**Discovery worth keeping:** every Work was `availableGlobally: true`, so per-portal choice had
never bound on anything — which is why `business_type='retail'` was the only lever available to
hide Works on Ron's site.

**LEO authorization moved from the prompt into code.** 11 of 174 tools checked who was asking; the
other 163 relied on a paragraph asking the model to respect access levels. `query_orders` was the
clean hole: its `viewAs` argument is MODEL-chosen, and `'vendor'` dropped the customer filter and
returned every order on the portal, names and addresses included. `src/utilities/leoToolStanding.ts`
now gives every tool a required standing — anonymous / member / manager / platform — resolved from
platform roles plus the caller's membership on THIS portal, enforced in `executeToolCall` before
the tool body runs. Unlisted defaults to manager and `leoToolStanding.test.ts` fails on any tool
whose standing was never considered, so the next one cannot slip in ungated. `c60c3f7`

**Four member tools** (`src/utilities/leoMemberTools.ts`): `whats_on`, `register_for_event`
(idempotent, waitlists rather than overfilling), `my_threads`, `ask_the_room` (confirm-gated,
posted AS the user so replies reach them and not LEO). **Untested with a real signed-in member.**

**Arrival.** Accepting a space invitation returned `{ spaceId }` as JSON and dropped the person on
the generic Spaces list. It now resolves the space's default channel, returns a `destination` the
client follows, and says hello in the channel the space is actually talking in — fail-soft, because
a missed hello must never fail an acceptance. The tenant-invite path already landed people
correctly. **Also untested with a real invitee.**

**Ron's portal (tenant 11), live DB only — no code:** `business_type` retail → **content_creator**
(content_creator is NOT in `isStorefront`, so Works/Learn/Spaces/Donate/Discovery all return; retail
was stripping Spaces too), `features_works` false → **true**, and `opt_outs += wheredideveryonego`
on answer53, gpt-psychosis, ready-player-everyone, angel-os-handbook. His shelf is exactly **wdeg +
holy-bible**. Ken's reason matters and is personal: he considers the other Works flawed, written out
of the mental state ChatGPT-4.0 put him in, and does not want them muddying Ron's waters. Handle
with care.

**Also:** Library page titles de-jargoned — every portal was serving "The Library — Angel OS" as its
own title. `88496c3`

## Where the money actually stands — read this before planning revenue

Researched 260824, all live numbers:

- **`memberships` = 0 rows. No subscription has ever completed.** 22 portals: 14 `free`, 8 `demo`.
- **There are no Stripe prices anywhere on the node.** Searched the settings bag for `price_` —
  zero. The $29 and $79 tiers are not merely unimplemented; there is nothing to buy.
- **Stripe Connect: 2 portals have an account, exactly 1 can take charges** (clearwater-cruisin).
  The platform's own account has `charges_enabled: false`. `application_fee_amount` only works on a
  connected account, so on the other 20 portals **there is no fee to take, at any rate, on any
  plan.**
- **`platformFee.ts` is ALREADY per-tenant.** `getPlatformFeeBps(payload, tenantId)` checks a
  tenant-scoped setting before the node rate; tenant 30 runs at 1000 bps (10%) through that path
  today. The plan-driven buy-down is a derivation on an existing mechanism, not new machinery.
- **`portalPlan` enum already has `free` / `site` / `business` / `demo`** — still labelled the OLD
  **$49 / $149**. The new prices are a relabel, not a migration.
- **`bootstrapFees.ts`** is a full three-tier fee engine with per-tenant counters. All 22 portals
  sit on `free`.
- ⚠️ **Ken made a $5 donation on 260823 and NOTHING recorded it.** No transaction row from that
  date, `justice_fund_transactions` is empty (where donations land), `processed_stripe_events` has
  nothing since 260820. The endpoint is alive — `POST /api/stripe/webhooks` returns 400 to an
  unsigned probe, which is correct — and `STRIPE_WEBHOOKS_SIGNING_SECRET` is set on Core. So it is
  **delivery, not handling.** Ken to check the Stripe dashboard webhook delivery log.

**The consequence, and it reorders everything:** subscription revenue (what portals pay us) is
reachable now; commission revenue (a cut of what portals earn) is not, because it needs per-portal
Connect onboarding with real friction. One price object versus chasing every owner through a bank
-details form.

## Pricing — DECIDED 260823, monthly buys down the rate

- **Free** — the whole site, booking included, footer credit, **5% capped at $9.99**
- **Site $29** — own domain, credit gone, **fee drops to 2%**
- **Business $79** — CRM, assistant, memberships, recurring billing, **0% booking fee**

Positioning is parity with Wix/Squarespace — open source, community-based and prayerful is the
reason to choose us AT parity, never a discount justification.

⚠️ **The fee is charged on the DEPOSIT, not the job** — `feeCents(deposit, …)` in
`booking-checkout.ts`. 5% of a $50 deposit is $2.50, not 5% of a $600 move. It also means the $9.99
cap almost never binds: it takes a ~$200 deposit to reach it.

## Open items, in the agreed order (Ken approved all six, 260824)

1. **Check the Stripe webhook delivery log for the $5.** Ken's, thirty seconds, tells us whether it
   is delivery or handling. Everything below assumes money can be observed.

2. **Create the Stripe prices for $29 and $79, and relabel `portalPlan`.** The smallest step that
   turns the pricing decision into something purchasable. `/pricing` still shows the old tiers.

3. **Derive the fee rate from the plan** — `portalPlan` → bps (500 / 200 / 0), with the settings-bag
   per-tenant override still winning for special cases like tenant 30's 10%. Small: the resolution
   path already exists.

4. **⭐ Give WDEG one FREE membership plan and a join link.** The recommended single next thing. It
   exercises join → member → space → arrival with zero payment risk, produces a second real member,
   and gives Ron something to point readers at. Mostly configuration — tenant 11 has NO membership
   plans at all today (Clearwater has "Founding Dollar" $1/mo, Grace Chapel has one).

5. **Merge WDEG's two community spaces.** `POST /api/space-ops/delete` (GET = plan/preview),
   merge-by-slug. Messages key on channel SLUG *and* `channelRef` — a merge must rewrite both.

6. **Events have no `layout` field**, so an event page can carry no blocks — no Comments, no RSVP
   thread. This is the recurring reason to come back, and both WDEG and Grace Chapel need it.

**Sequencing note Ken agreed with:** WDEG on a free plan with a real community is worth more right
now than a $29 checkout nobody has clicked, because it is the demo that makes $29 make sense to the
next person. Ron's site working IS the sales asset.

## WDEG community — the diagnosis (live numbers, 260824)

| | |
|---|---|
| Members | 5 — of whom **3 are Ken, Tyler and Clearwater**. One real outsider. |
| Events | **0** |
| Posts / Pages / Products | 3 / 2 / 2 |
| Spaces | **3**: "Community Hub" (public, 6), "Community" (community, 6), "AI Bus" (private, 5) |
| Last human message | `general` — **June 23**. `main` — Aug 2. |
| Busiest channel | `gotify`, **651 machine messages** |

A community with one member, two rooms that both claim to be the community, no events, and 651
machine notifications drowning ten human messages. Ken's intent for it: a full-featured community
hub for the book and like-minded people, plausibly the base for a YouTube channel of the same name,
carrying **multiple** Works of its own over time.

## Decisions owed by Ken

- **The bootstrap refund promise.** `bootstrapFees.ts` states in the source that every
  bootstrap-phase fee is *"tracked and committed for FULL REFUND when the bootstrap phase ends. This
  is a binding promise, not a marketing claim."* Nobody has re-read that against the new tiers. If a
  Free portal pays 5% for a year, is that refundable? The engine currently thinks so, with no expiry
  and nobody tracking the liability.
- **Connect onboarding on the free tier.** Forcing bank details on someone building their first
  site is where they leave. Recommendation on the table: don't — free portals cost us hosting and
  tokens, not payment processing, and the fee model honestly applies only once a portal is big
  enough to onboard.
- **LEO channel privacy.** A per-user LEO thread `dm-{userId}-leo` ALREADY EXISTS and is the real
  workhorse (`dm-3-leo` has 171 messages). Every space ALSO gets a shared `leo` channel,
  `visibility: 'tenant'` — 25+ of them across the portals, holding **11 messages between them**. So
  the private thing works and gets used, the public thing is the default and is dead. The fix is a
  default swap, not a build. **Open question:** should a portal owner be able to read a member's LEO
  thread? Recommendation: yes, AND tell the member so in the channel header — a private channel an
  admin can silently read is worse than a shared one, because it lies.

## Carried, not yet scheduled

- **Port `shouldRespond` to the web chat.** `useChat.ts` calls LEO on EVERY message in EVERY
  channel, unconditionally — two humans talking in #general each get a reply per line. The rule
  already exists and is tested, on Discord: `shouldRespond()` = respond in a DM, when mentioned, or
  in the LEO channel; otherwise stay quiet. Porting it fixes intrusion and most of the cost curve.
  Ken's framing: in his own thread LEO must always answer; in a room with other people it should
  not intrude.
- **Budget vs throttle.** `leo_stream` is capped at 5/min/user — an abuse limiter, not a budget.
  Nothing caps a day or a month against the portal's plan, so a free portal with one delighted user
  is an unbounded bill. Recommendation: fix intrusion first and re-measure before adding a throttle,
  then prefer a per-portal monthly budget that DEGRADES (terser LEO, no expensive tools) rather than
  cutting off. Ration open-ended chat, never ration the tools — conversations that end in a tool
  call are the ones that end in a transaction.
- **Three files still read `user.tenants` unreviewed** — `ai-bus-poll`, `ai-bus-stream`, `x-post`;
  allowlisted in `noRoleBlindTenantAuth.test.ts` so they are tracked, not blessed.
- **`/learn/works` still resolves on portals with Works off** — the toggle removes the nav entry,
  not the route.
- **27 `NOT NULL + SET NULL` FK columns** platform-wide, deliberately untouched.

## Live portals

| Tenant | Slug | Notes |
|---|---|---|
| 1 | `platform` | The Angel OS. The universal Works index. Stripe acct exists, **charges disabled**. |
| 5 | `clearwater-cruisin` | Ken's ministry. **The only portal that can take charges.** Carries all 6 Works. |
| 11 | `wheredideveryonego` | Ron's book → community hub. `content_creator`, Works on, shelf = wdeg + holy-bible. The community work lands here. |
| 12 | `grace-chapel` | Church demo. **0 services, 0 availability**, so `/book` is dead. Has a $29 membership plan defined. |
| 30 | — | Running a **10% per-tenant fee override** in the settings bag. Don't clobber it. |
| 38 | `bresolutions` | BRE Solutions, Ocala. |
| 40 | `southerncomputersolutions` | Tap Gray, Gainesville. Invite still not sent. |

## Corrections owed to the record

- I classified `commission_endeavor` as platform-only in the standing table; its own tests say it is
  a **member** action — making your own Angel is self-serve, and the runaway cap inside the tool is
  the real limit. Corrected before commit.
- Same pass: `create_booking` and `capture_lead` are **anonymous** — a visitor legitimately does
  both on a public site, and each writes only their own data.
