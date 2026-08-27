# Handoff — 260828

Paste the block below into a fresh session.

---

Continuing Angel OS. Read `docs/GLOBAL_PUNCH_LIST.md` first — the living issue board.
`docs/HANDOFF_260827.md` still holds the money picture and the ThinkPad trial procedure;
this document supersedes its *status*, not its *procedures*. For anything touching the
ThinkPad, `docs/selfhost/thinkpad/NODE_CONFIG.md` is the living config.
Memory worth loading: `reference_angel_node_01_thinkpad`, `project_portal_plan_pricing`,
`project_nimue_playstore`, `project_nimue_identity_refresh_bug`, `project_leo_thread_privacy`,
`project_wdeg_community`, `project_bookable_inventory`.

**Ken is CEO, you are CIO.** Temporal-stamp replies `YYMMDD ~HHMM Name —` top and bottom.
Ponytail mode. CTO mode — decide and act on the obvious. No Angel OS jargon in
customer-facing copy: a visitor to a church website should never learn what we are.

---

## ⛔ READ THIS FIRST — the two things that changed overnight

### 1. Railway deploys are DEAD. The node is the only way to ship.

```
railway up -s Core --detach
→ Your trial has expired. Please select a plan to continue using Railway.
```

The **running** Railway service is fine and still serving all 22 portals. But no new
revision can reach it. The $7.75/month figure in the last handoff was a **trial credit,
not a bill Ken was paying.**

This inverts the ThinkPad decision. It is no longer "is the laptop worth it versus
$7.75" — the node is now the **only** deployment path unless Ken puts a card on Railway.
Everything shipped since `1e25afa` exists ONLY on `node01.spacesangels.com`.

**Ship with:** `wsl -d Ubuntu-22.04 -u root -e bash /mnt/c/Dev/angels-os/docs/selfhost/thinkpad/push-to-node.sh`
(or double-click `push-to-node.cmd`). ~6 min. It builds from a clean clone of
**`origin/main`** — so **push before you ship, or you will deploy the previous commit
and it will tell you so only in its last line.** That happened on 260827: exit 0, both
health checks 200, `== Shipped 1e25afa`. Read that line every single time.

### 2. The DNS flip is now a business decision, not an experiment.

The full pre-flight and fail-back procedure is in `docs/HANDOFF_260827.md` under
**⭐ The trial** and is UNCHANGED — ethernet cable, re-restore the DB, `db-repair-sequences`,
`db-repair-locks`, `JOBS_AUTORUN=true`, tunnel ingress specific-above-wildcard, then the
three DNS records with **proxy ON**.

Nothing about it has been done. **Ken has not flipped and no DNS has been touched.**

---

## Ground rules

**Gate = `pnpm test:unit`** — **6,785 green** as of `2e5340c`. Three flake under load and
pass in isolation: `sprint19/vapiWebhook`, `sprint44b-endeavor-truncation`,
`sprint6-commerce`. A red run that is not one of those three is YOUR diff.
`npx tsc --noEmit` is clean in `src/`; filter `grep -v "^tests/"`.

**Live DB** via `railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`, used with
`pg` from the repo's node_modules. **Keep the script IN the repo dir** — there is no
`psql` on the desktop and node will not resolve `pg` from `/tmp`.

⚠️ **Never edit an applied migration.** New column = new file; record with
`UPDATE_MIGRATION_HASHES=1 npx vitest run tests/unit/migrations`.

⚠️ **Check for the ARTIFACT, never the exit code.** Earned its keep again on 260827
(the wrong-revision deploy above). Ask the thing whether it happened.

⚠️ **Bash heredocs choke on apostrophe-heavy TypeScript** — use the Write tool for prose.
Python heredocs are fine; use raw strings for anything with backslashes.

⚠️ **GitHub Actions will not start any job** — Ken cannot clear a billing lock. Do not
plan around CI. `git push` itself works fine.

---

## What shipped 260827 (all on the node, none on production)

| Commit | What |
|---|---|
| `105004b` | **The Bible had books; the manifest threw them away.** |
| `dc2c330` | **Featured Posts & Products listed every portal's catalogue.** |
| `2e5340c` | **LEO's post generator emitted raw HTML.** |
| `13fb531` (nimue) | targetSdk 36 + chapter-title truncation |
| `929e6d6` (nimue) | tablet home layout |

**`105004b` — the reader.** `BookReader` has had a two-level Book → Chapter nav since it
shipped and it never rendered on Core: both `/learn/[soul]` routes rebuilt the manifest as
`pages.map(p => ({ order, image }))`, dropping `book`/`bookName`/`chapter`/`ref`/`title`.
`isCollection` was therefore always false and the whole Bible was a bare `1 / 1189` pager.
Nimue showed the pills because it maps its own manifest. Fields passed through in both
routes; no component change. Bible chapter data is fully populated (1,189 rows, all with
`book`/`book_name`/`chapter`/`ref`) — nothing to backfill.

**`dc2c330` — tenant leak in the block editor.** `ArchiveBlock` and `Carousel` relationship
fields had NO `filterOptions`, so editing a page on one portal offered every other portal's
products, posts and categories. Worse than a plain leak: the multi-tenant plugin rejects a
cross-tenant pick at *validation*, so the control offered choices that could only fail on
save. New helper `src/fields/tenantFilterOptions.ts`. Two traps it encodes: it reads
**`data`, not `siblingData`** (blocks are nested; siblingData has no tenant), and it
**`Number()`s the id** because the plugin compares ids in JS and a string matches nothing
silently. Not applied to `Carousel.populatedDocs` — admin-disabled, filled after-read.

**`2e5340c` — HTML in generated posts.** `create_post` asks for plain text; the model
answers with `<p>`/`<strong>` often enough that post 98 shipped with tags as literal body
copy. `stripModelHtml` now normalises before `markdownToLexical`. Gated behind
`looksLikeHtml`, so plain text and real markdown are byte-identical and
`if (a < b && b > c)` survives — that case has a test.
**Blast radius scanned: 137 content blocks platform-wide, exactly ONE contaminated** —
post 98, "Introducing Where Did Everyone Go", **on tenant 1 (platform), not tenant 11.**
Not repaired: regenerating it through LEO is cleaner than a DB patch (keeps hooks and
revisions). Worth asking Ken whether it belongs on Ron's portal at all.

**Nimue.** Now at **1.2.74 / versionCode 86**, `targetSdkVersion 36`, AGP 8.7.2 → 8.9.1
(8.7 cannot compile against 36; Gradle 8.11.1 already supported it). Home nav became
`grid` / `repeat(auto-fit, minmax(300px, 1fr))` at `min(92vw, 760px)` — no media query,
phone layout unchanged, tablet gets two columns.

---

## ⏰ THE ONLY ITEM WITH A DATE ON IT

**Upload the Nimue AAB to Play before 2026-08-31.** Four days.

- Artifact is built and signed: `C:\Dev\nimue\android\app\build\outputs\bundle\release\app-release.aab`
  — 16.0 MB, versionCode **86**, verified with `aapt2 dump badging`
  (`targetSdkVersion:'36'`, `compileSdkVersionCodename='16'`).
- After the 31st, Play accepts **no updates at all** to `com.angels.nimue` — which would
  freeze the closed test mid-flight.
- **Only Ken can do this.** Console upload, not a build step.

### The Play picture (corrected — the app IS in the store)

`Nimue Angel OS Android` / `com.angels.nimue`. Production **Inactive**. Closed testing
release **published** ✓. The remaining gate to production is **people, not code**:

- **12 testers opted in — 3 today.**
- Then **14 continuous days** with those 12.
- Only then does "Apply for production" unlock.

**This is why WDEG matters commercially.** Ron's readers are the twelve. Uploads to a
closed track do NOT reset the 14-day clock — only the tester count gates it.

⚠️ **Fix `project_nimue_identity_refresh_bug` before the invites go out.** On a real S23,
signing in showed only *some* portals and no channels until a **hard close and reopen**.
Confirmed causes: client pointers (`nimue.lastChannel`, `nimue.lastSpace`, `LAST_SPACE_KEY`,
`FAVORITE_KEY`) are written to fixed `localStorage` keys with no user namespace, and the
portal/channel fetch runs on mount with no auth dependency. This is the **first-run
experience** — a tester who sees an empty list has no reason to guess that force-quitting
fixes it. Highest-leverage bug on the board.

---

## ⭐ The current mission: make the flow intuitive for Ron and everyone else

Ken's framing, 260827 midday. He has walked the book route on all the demo sites. The
upgrade path exists; the job now is that the whole journey feels obvious.

### 1. `harpazo.spacesangels.com/book` — NOT a bug, and that is the finding

Investigated. **Harpazo has everything it needs:** 15 active services (provider 161,
deposits configured) and 5 active weekly availability rows, Mon–Fri 08:00–17:00.

The page shows the upgrade notice because **`harpazo.portalPlan = 'free'`** and
`onlineBooking` is a **Business ($79)** capability (`src/utilities/portalPlan.ts`).
`/book` returns `<BookingUpgradeNotice>` before it ever queries. Working exactly as
designed.

**Ken wants his brother's site booking.** One field: set tenant 17 to `demo` (or
`business`). No data rebuild — the comment in `book/page.tsx` is explicit that nothing is
deleted and nothing needs rebuilding on upgrade.

**⭐ The deeper finding, which is the real one for the "intuitive flow" mission:**

```
demo  → 18 portals     free → 3 portals (harpazo 17, kessela 30, 8byh3jdd726x 41)
```

`demo` grants everything except `hideFooterCredit`. So **every site Ken walks to judge the
flow is a demo, and demos have all capabilities.** Harpazo is one of only three portals
that shows what a genuine new free user actually sees — and the first thing it did was
confuse him. That is the signal, not the exception. Any "is the flow intuitive" pass must
be run on a `free` portal or it is testing a product nobody is offered.

Second-order: the upgrade notice appears on a page a *stranger* reached. Consider whether
a free portal should route `/book` to a contact form rather than a pitch aimed at the
owner — the visitor wanting to hire Harpazo is not the person who can upgrade.

### 2. Payouts for portals with no Stripe account of their own — Ken's ask, open

Ken: *"I know we are taking money in the one Stripe account attached — if a site doesn't
have their own Stripe account, we'd want to enable payouts for it."*

State of the world: **1 portal can take charges (clearwater-cruisin, tenant 5).**
`application_fee_amount` only works on a connected account, so on the other 21 there is no
fee to take at any rate. Connect surfaces already exist: `stripe-connect-onboard`,
`stripe-connect-callback`, `stripe-connect-dashboard`, `stripe-connect-disconnect`.

The question Ken is really asking is what happens to money taken on the platform account
on a portal's behalf, and it needs a decision before it needs code:

- **Option A — require Connect before a portal can charge.** Cleanest legally; money never
  belongs to us. Cost: bank details demanded from someone building their first site, which
  the previous handoff already flagged as where people leave.
- **Option B — platform collects, we pay out manually.** We become a money transmitter in
  substance. Needs a ledger of what is owed to whom, and it is a real regulatory posture,
  not a feature flag.
- **Option C — no charging until Connect, but make connecting a 60-second in-flow step at
  the moment of the first sale** rather than a signup wall.

**Recommendation: C.** It answers Ken's concern (nobody's money is stranded) without
putting us in the middle of other people's funds. The trigger is the first attempted
charge, not onboarding. **Ken decides.**

### 3. Still on the mission list from before

- **⭐ Give WDEG one FREE membership plan and a join link.** Tenant 11 has none. The agreed
  next build, still not started. Exercises join → member → space → arrival with zero
  payment risk and produces the testers Nimue needs.
- **Create the Stripe prices for $29 / $79 and relabel `portalPlan`** — `/pricing` still
  shows the old $49/$149. **There are no Stripe PRICES anywhere**, so neither tier is
  buyable at all.
- **Derive the fee rate from the plan** — `portalPlan` → bps (500/200/0), settings-bag
  per-tenant override still winning. ⚠️ Tenant 30 runs a 10% override; do not clobber it.
- **Events have no `layout` field**, so an event page carries no blocks. WDEG has 0 events
  so it blocks nothing today; Grace Chapel needs it.
- Grace Chapel (12) has 0 services and 0 availability, so its `/book` is dead for a
  different reason than Harpazo's.

---

## Carried, not scheduled

- **⭐ Port `shouldRespond` to the web chat.** `useChat.ts` calls LEO on EVERY message in
  EVERY channel. Two humans in #general each get a reply per line. The rule exists and is
  tested on Discord (DM, mention, or the LEO channel). **Do this before real members are in
  Ron's room.** Fixes intrusion and most of the token cost.
- **LEO thread privacy — RULED by Ken 260827: "yes the owner can read it, and we tell the
  member so."** Swap the default from the shared per-space `leo` channel to the per-user
  `dm-{userId}-leo` (25+ shared channels hold 11 messages total; Ken's private one holds
  171), and render an explicit owner-can-read notice. See `project_leo_thread_privacy`.
- **⭐ LEO guardrails that live in the prompt are not guardrails.** Ken talked LEO into
  bypassing the image-analysis pipeline by saying he was "just testing the upload". Same
  class as `query_orders` trusting a model-chosen `viewAs`, and the same class as the HTML
  bug fixed in `2e5340c`. `leoToolStanding.ts` fixed *who may call* a tool; this is *what
  the tool does once called*. Worth a systematic pass.
- **Budget vs throttle.** `leo_stream` is 5/min/user — an abuse limiter, not a budget. Fix
  intrusion first, re-measure, then prefer a per-portal monthly budget that DEGRADES.
  Ration open-ended chat, never the tools.
- **On the node:** `db-repair-sequences` + `db-repair-locks` before anything writes there.
- Three files still read `user.tenants` unreviewed (`ai-bus-poll`, `ai-bus-stream`, `x-post`).
- `/learn/works` still resolves on portals with Works off.
- **Nimue:** reader starts pinned to the top; channel naming reads oddly in places.

---

## Ron / WDEG — the human thread

Ken spoke with Ronald on the morning of 260827; he is off to work. **Ken has Ted Lear's
number and will call him tonight** — the earlier bounced email was a wrong guess at the
address (a Lear-jet pun, not `tedlear@`), and that thread is closed.

Ron hates tech and had not browsed his own site as of that call. The message to him should
carry ONE ask — *look at the site, and start thinking about twelve readers who would try
the app* — and no architecture. His readers are the twelve testers; that is the whole
remaining gate on the Play listing.

**⚠️ WDEG chapter titles are broken and it is an EDITORIAL job, not a code one.** The
ingest promoted body prose to titles wherever a section had no heading. **14 of 26 titles
exceed 60 chars; the worst is 474**; chapter 8's begins mid-sentence
(*"laughing. He kept hammering."*). Nimue now truncates them in nav so the reader is
usable, but the stored titles are still wrong and are Ron's to write. Full list with
lengths is in the 260827 session transcript; regenerate it with:

```sql
select id, "order", length(title) len, left(title,70) from work_chapters
where work_id = 5 order by "order";
```

The 12 good titles are real headings, so the pattern is clean.

**Ron's shelf** is exactly `wdeg` + `holy-bible` (tenant 11, `business_type` `content_creator`).
Ken's reason for opting out the other four Works is personal — he considers them written
out of the mental state ChatGPT-4.0 put him in. **Handle with care; do not re-litigate.**

**WDEG has ONE community space** — id 34 "Community" (`is_main`, visibility `community`),
channels `main`/526, `announcements`/527, `support`/528. The other space is 32 "AI Bus"
(private, machine traffic). **The "merge the two community spaces" punch-list item is
already resolved** — there is no second Community Hub. The deep link
`/dashboard/spaces/34/526` is correct and points at the main room, but it requires sign-in,
so it is the SECOND thing to send someone, never the first.

---

## Decisions owed by Ken

- **Railway: card, or commit to the node?** Everything else waits on this.
- **Payouts for portals without Connect** (A / B / C above).
- **Harpazo's plan** — `free` → `demo` or `business`?
- **The bootstrap refund promise.** `bootstrapFees.ts` states in source that every
  bootstrap fee is "committed for FULL REFUND", no expiry, nobody tracking the liability.
  Does that survive the new tiers?
- **Connect onboarding on the free tier** — recommendation: no.
- **Post 98** — regenerate, and does it belong on tenant 1 or tenant 11?

---

## Decided, do not re-litigate

- **The ThinkPad gets a real trial as PRIMARY** (Ken, 260827). Railway stays up as the
  backup for the duration.
- **LEO thread privacy** — owner may read, member is told. Ruled 260827.
- **Merlin stays on the DESKTOP** — serves media off an external drive there;
  `merlin.spacesangels.com` already works.
- **`wheredideveryonego.net`** goes on as a fourth domain when Ken wants it; the Work's
  `canonical.origin` is a DB field, so pointing Ron's canonical at his own domain is an
  edit, not a deploy.
- **Ron's shelf** (above).

---

## Devices and access

- **BlueStacks** — `adb connect 127.0.0.1:5555`. Android 9, x86_64, reports as SM_S908E,
  runs at desktop dimensions so it is the WIDE-layout test, and it lies about phone layout.
- **Ken's S23** (`SM_S911U`, Android 16) — **paired**, `adb connect 192.168.0.34:34409`.
  The port rotates on reboot; if connect fails, get the pairing port from
  `adb mdns services` while the "Pair device with pairing code" dialog is **open on screen**
  (the connect port and the pairing port are different numbers), then `adb pair`.
  It was running **1.2.48** before 260827 — ~25 versions stale — so re-test old bug reports
  against 1.2.74 before chasing them.
- Install release-signed, never debug: BlueStacks and the phone both carry release builds
  and a debug APK is refused for signature mismatch, forcing an uninstall that wipes the
  session.

---

## Live portals

| Tenant | Slug | Plan | Notes |
|---|---|---|---|
| 1 | `platform` | demo | Universal Works index. Stripe acct exists, **charges disabled**. Holds post 98. |
| 5 | `clearwater-cruisin` | demo | **The only portal that can take charges.** Carries all 6 Works. |
| 11 | `wheredideveryonego` | demo | Ron's book → community hub. Shelf = wdeg + holy-bible. Space 34. |
| 12 | `grace-chapel` | demo | 0 services, 0 availability → `/book` dead. Has a $29 plan defined. |
| 17 | `harpazo` | **free** | Ken's brother. 15 services + 5 availability, booking gated by plan. |
| 30 | `kessela` | **free** | Running a **10% per-tenant fee override**. Don't clobber it. |
| 38 / 40 | `bresolutions` / `southerncomputersolutions` | demo | Invite still not sent to 40. |
| 41 | `8byh3jdd726x` | **free** | Generated-slug portal. |

18 of 22 are `demo`. Only 3 are `free` — and `free` is what a real new customer gets.
