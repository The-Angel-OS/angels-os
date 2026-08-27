# Handoff — 260827

Paste the block below into a fresh session.

---

Continuing Angel OS. Read `docs/GLOBAL_PUNCH_LIST.md` first — the living issue board.
Then `docs/HANDOFF_260824.md` for the money picture, which is still accurate. For anything
touching the ThinkPad, `docs/selfhost/thinkpad/NODE_CONFIG.md` is the living config.
Memory worth loading: `reference_angel_node_01_thinkpad`, `project_works_canonical_syndication`,
`project_portal_plan_pricing`, `project_leo_capability_ladder`, `project_wdeg_community`.

**Ken is CEO, you are CIO.** Temporal-stamp replies `YYMMDD ~HHMM Name —` top and bottom.
Ponytail mode. CTO mode — decide and act on the obvious. No Angel OS jargon in customer-facing
copy: a visitor to a church website should never learn what we are.

## Ground rules

**LIVE = Railway** (`railway up -s Core --detach`), and it costs **$7.75/month** for all 22
portals. Ken has almost no cash and cannot clear a GitHub billing lock, so **GitHub Actions
refuses to start any job** — do not plan around CI. Live DB via
`railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`, used with `pg` from the repo's
node_modules (no `psql` on the desktop; keep the script IN the repo dir so node resolves `pg`).

**Gate = `pnpm test:unit`** — 6,602 green. Three flake under load and pass on retry:
`sprint19/vapiWebhook`, `sprint44b-endeavor-truncation`, `sprint6-commerce`. `npx tsc --noEmit`
is clean in `src/`; filter `grep -v "^tests/"`.

⚠️ **Never edit an applied migration.** New column = new file; record with
`UPDATE_MIGRATION_HASHES=1 npx vitest run tests/unit/migrations`.

⚠️ **Check for the ARTIFACT, never the exit code.** Three times in one night an exit 0 or a
"still waiting" was wrong: a `cloudflared tunnel login` that a reboot had killed, a
`docker save | ssh docker load` that exited 0 and loaded nothing, and a health check that proved
nothing. Ask the thing whether it happened.

⚠️ **Bash heredocs choke on apostrophe-heavy TypeScript** — use the Write tool for prose files.
Python heredocs are fine, but raw strings for anything with backslashes.

⚠️ **Docker Compose INTERPOLATES `env_file`**, so any secret containing a `$` is silently
blanked (measured: 17 chars raw, 0 in the container). Every entry needs `- path: …` +
`format: raw`. **The desktop stack at `C:\Dev\datacenter\stack\docker-compose.yml` STILL HAS
THIS BUG** — `SYSTEM_EMAIL_PASSWORD` reaches that container empty.

## What shipped 260826–27

**Works availability is a portal setting, not a source edit.** `subscribers[]` lived in a
TypeScript manifest, so only the platform operator could choose what a portal carried, and only
via a deploy. Now `works` rows (`owner`/`subscribers`/`optOuts`/`availableGlobally`/`published`)
read through `src/works/registry.ts`; rules are pure and tested in `src/works/availability.ts`.
Dashboard → Works opens on "The Library on \<portal\>", a checkbox per Work. `src/souls/` is 52K
and read only by the importer; the 11MB Bible ingest JSON is deleted (verified 1189 chapters
three ways first). **Discovery: every Work was `availableGlobally: true`, so per-portal choice
had never bound on anything.** `e78697c` `c1ab544`

**LEO authorization moved from the prompt into code.** 11 of 174 tools checked the caller; the
rest ran `overrideAccess: true` behind a paragraph asking the model to respect access levels.
`query_orders` was the clean hole — its `viewAs` is a MODEL-chosen argument and `'vendor'`
dropped the customer filter, returning every order on the portal. `leoToolStanding.ts` now
declares a standing per tool (anonymous/member/manager/platform), enforced at `executeToolCall`,
with a test that fails on any undeclared tool. Four member tools shipped: `whats_on`,
`register_for_event`, `my_threads`, `ask_the_room`. Space-invite acceptance now lands the person
IN the channel and says hello. **All of it is untested with a real member.** `c60c3f7`

**Ron's portal (tenant 11)** — `business_type` retail → `content_creator`, `features_works` on,
and the other four Works opted out. His shelf is exactly **wdeg + holy-bible**. Ken's reason is
personal: he considers the other Works flawed, written out of the mental state ChatGPT-4.0 put
him in. Handle with care; do not re-litigate.

**angel-node-01 (the ThinkPad) SERVES.** `https://node01.spacesangels.com` returns 200 through
a Cloudflare tunnel — Core on a restored copy of production, Postgres 18 + PgBouncer, tunnel
enabled at boot, no router configuration and no money spent. **Proven to be the node, not
Railway:** node uptime 406s vs Railway 75,540s on the same `/api/health` shape.
Ship a rev with **`docs/selfhost/thinkpad/push-to-node.cmd`** — one double-click.
⭐ **Docker Desktop is NOT required and would not start anyway**; the build runs in WSL Ubuntu
(`wsl -u root` needs no password, `apt install docker.io`, 11 GB, 6 CPUs).

## The money picture (researched 260824, unchanged)

- **`memberships` = 0 rows. No subscription has ever completed.** 22 portals: 14 `free`, 8 `demo`.
- **There are no Stripe PRICES anywhere on the node** — the $29/$79 tiers are not buyable at all.
- **Stripe Connect: 1 portal can take charges** (clearwater-cruisin). `application_fee_amount`
  only works on a connected account, so on the other 21 there is no fee to take at any rate.
- **`platformFee.ts` is already per-tenant** (tenant 30 runs at 1000 bps today), so the
  plan-driven buy-down is a derivation on existing machinery, not new machinery.
- **`portalPlan` already has `free`/`site`/`business`/`demo`** — labelled with the OLD $49/$149.
- ⚠️ **Ken's $5 donation on 260823 recorded NOTHING.** No transaction row,
  `justice_fund_transactions` empty, no Stripe event since 260820, while the endpoint answers 400
  to an unsigned probe and the signing secret is set. It is DELIVERY, not handling.

Pricing decided 260823: **Free** (5% capped $9.99) · **Site $29** (2%) · **Business $79** (0%).
The fee is on the DEPOSIT, not the job, so the $9.99 cap almost never binds.

## Open items, in the agreed order (Ken approved all six on 260824)

1. **Ken checks the Stripe webhook delivery log** for the $5. His, thirty seconds.
2. **Create the Stripe prices for $29 and $79, relabel `portalPlan`.** `/pricing` still shows the
   old tiers.
3. **Derive the fee rate from the plan** — `portalPlan` → bps (500/200/0), settings-bag
   per-tenant override still winning.
4. **⭐ Give WDEG one FREE membership plan and a join link.** The agreed next build. Exercises
   join → member → space → arrival with zero payment risk, produces a second real member, and
   gives Ron something to point readers at. Tenant 11 has NO membership plan today.
5. **Merge WDEG's two community spaces** ("Community Hub" public/6 and "Community"/6).
   `POST /api/space-ops/delete` (GET = preview), merge-by-slug. Messages key on channel SLUG
   *and* `channelRef` — rewrite both.
6. **Events have no `layout` field**, so an event page carries no blocks — no Comments, no RSVP
   thread. Both WDEG and Grace Chapel need it.

**Ken's sequencing note:** WDEG on a free plan with a real community is worth more right now than
a $29 checkout nobody has clicked, because it is the demo that makes $29 make sense to the next
person. Ron's site working IS the sales asset.

## WDEG as a community (live numbers, 260824)

5 members of whom 3 are Ken/Tyler/Clearwater · **0 events** · 3 posts · 2 pages · 2 products ·
**two overlapping community spaces** · last human message June 23 · busiest channel is `gotify`
with 651 machine messages.

## Carried, not scheduled

- **Port `shouldRespond` to the web chat.** `useChat.ts` calls LEO on EVERY message in EVERY
  channel unconditionally — two humans in #general each get a reply per line. The rule already
  exists and is tested on Discord (DM, mention, or the LEO channel). Fixes intrusion AND most of
  the token cost. Ken's framing: in his own thread LEO must always answer; in a room with other
  people it should not intrude.
- **The per-space `leo` channel is shared, not private** — 25+ of them holding **11 messages
  total**, while the per-user `dm-{userId}-leo` that already exists holds 171 in Ken's alone. The
  private primitive works; the shared one is the default and is dead. A default swap, not a
  build. ⚠️ Needs Ken's ruling first: may a portal owner read a member's LEO thread?
  Recommendation on the table — yes, AND tell the member so, because a private channel an admin
  can silently read is worse than a shared one.
- **Budget vs throttle.** `leo_stream` is 5/min/user — an abuse limiter, not a budget. Fix
  intrusion first and re-measure; then prefer a per-portal monthly budget that DEGRADES rather
  than cuts off. Ration open-ended chat, never the tools — conversations that end in a tool call
  are the ones that end in a transaction.
- **On the node:** `db-repair-sequences` + `db-repair-locks` before anything writes there.
- Three files still read `user.tenants` unreviewed (`ai-bus-poll`, `ai-bus-stream`, `x-post`).
- `/learn/works` still resolves on portals with Works off.

## Decisions owed by Ken

- **The bootstrap refund promise.** `bootstrapFees.ts` states in source that every bootstrap fee
  is "committed for FULL REFUND", with no expiry and nobody tracking the liability. Does that
  survive the new tiers?
- **Connect onboarding on the free tier** — recommendation: no. Forcing bank details on someone
  building their first site is where they leave.
- **LEO thread privacy** (above).

## Decided, do not re-litigate

- **Production stays on Railway.** $7.75/month against a node that would save $8 and add a build
  pipeline, a restore problem, a residential uplink and a laptop someone can close.
- **The ThinkPad is a second node, Merlin's future home, and a workstation** — not production.
  Run it in parallel for two weeks before any cutover conversation.
- **Merlin stays on the DESKTOP** — it serves media off an external drive plugged in there, and
  `merlin.spacesangels.com` already works, so payloadnuke can be retired for it with no DNS
  change at all. `merlin.kendev.co` is staged in the desktop's `~/.cloudflared/config.yml` above
  the `*.kendev.co` wildcard, inert until a CNAME exists.
- **`wheredideveryonego.net`** goes on Railway as a fourth domain when Ken wants it; the Work's
  `canonical.origin` is a DB field now, so pointing Ron's canonical at his own domain is an edit,
  not a deploy.

## Live portals

| Tenant | Slug | Notes |
|---|---|---|
| 1 | `platform` | The universal Works index. Stripe acct exists, **charges disabled**. |
| 5 | `clearwater-cruisin` | **The only portal that can take charges.** Carries all 6 Works. |
| 11 | `wheredideveryonego` | Ron's book → community hub. Shelf = wdeg + holy-bible. Item 4 lands here. |
| 12 | `grace-chapel` | 0 services, 0 availability, so `/book` is dead. Has a $29 plan defined. |
| 30 | — | Running a **10% per-tenant fee override**. Don't clobber it. |
| 38 / 40 | `bresolutions` / `southerncomputersolutions` | Invite still not sent to 40. |
