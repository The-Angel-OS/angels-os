# Angel OS — Global Punch List

> **The single living list of what's broken, missing, or half-done.** One place, ranked,
> dated. Glance here to know where the platform actually stands.

## How this is maintained (by Claude, each session)
- **Update it every working session.** New issue surfaced → add it. Item shipped → move it to
  **Recently Closed** with the commit. Priorities shift → re-rank.
- **Every item is actionable:** a one-line *what*, a *where* (file/path), and a *next action*.
  If it needs three paragraphs of context, that lives in a memory file — link it, don't inline it.
- **Dated.** Each item carries the date it was last touched (`YYMMDD`). Stale P0/P1s get re-checked.
- **Priority legend:** `P0` broken / blocks revenue or trust · `P1` real gap, planned · `P2` polish / debt.
- Keep it **scannable** — this is a triage board, not a design doc. Ponytail applies to the list itself.

---

## 🔴 Bugs & broken (P0–P1)

- **[P0→RESOLVED 260827] Railway's trial expired — production MOVED to angel-node-01.**
  19 commits could not ship, so `*.spacesangels.com` was repointed to the ThinkPad's
  Cloudflare tunnel. All 23 portals verified serving. Deploy is now
  `docs/selfhost/thinkpad/push-to-node.sh`, NOT `railway up`. Railway's Postgres still
  serves and the node runs a fresh 260827 restore of it. **Move back on Sep 1**; the full
  revert table is in `docs/selfhost/thinkpad/NODE_CONFIG.md`.
  *Apex CLOSED 260828:* the bare `spacesangels.com` CNAME to `brdq7dq2.up.railway.app`
  was deleted by hand (cloudflared will not overwrite an existing apex record), then
  `route dns --overwrite-dns` wrote it onto the node's tunnel. Verified: `Server:
  cloudflare` and `/api/health` reports the node's uptime, not a fresh deploy. The whole
  zone is now on the node. `_acme-challenge` → `railwaydns.net` and `_railway-verify` are
  left in place until the Sep 1 stay-or-return call.  `260828`
- **[P1→FIXED 260830] The tunnel dropped and nothing noticed — now it self-heals.**
  Error 1033 on every hostname while the box, the app and `systemctl is-active
  cloudflared` were all healthy. cloudflared had lost its QUIC connections to a
  network blip (`sendmsg: network is unreachable`), logged `Registered tunnel
  connection` on a retry, and kept only `connIndex=0` — the edge had dropped the
  tunnel entirely. `Restart=on-failure` cannot fire because the process never
  fails. Second occurrence (260827 was the first). Fixed with a systemd timer that
  checks `node01.spacesangels.com/api/health` **from outside** every 2 min and
  restarts cloudflared after two consecutive failures. Files in
  `docs/selfhost/thinkpad/watchdog/`; failure path proven by dry run.
  ⚠️ The tell is the connection count — a healthy tunnel registers connIndex 0–3.  `260830`
- **[P0→FIXED 260827] The node signed JWTs with the wrong secret** — `.env.local` values
  carry literal quotes through `env_file: format: raw`, so `PAYLOAD_SECRET` reached the
  container as `"74e…"`. Sign-in died the moment the node became production. Ten variables
  affected. ⚠️ `C:\Dev\datacenter\stack` shares the shape and still has it — it also
  explains the "system email auth fails silently" mystery (`SYSTEM_EMAIL_PASSWORD` is one
  of the ten).  `260827`
- **[P1→FIXED 260827] Merlin looked dead for 62 days while serving fine.** Three faults,
  one root: the port. The tunnel gate validated sessions against `:3000` while the task
  runs Merlin on `:3002` (infinite redirect that reads as a wrong password); the node-bus
  heartbeat only started when something *visited* an endpoint, so restarts left it silent;
  and it advertised a quick tunnel pointed at the dead port, which 502'd every proxied
  file. Ports are read from `process.env.PORT` now.  `260827`
- **[P1 — OPEN] Merlin's shared roots disagree with `media-roots.json`.** The file lists
  `DCIM (E:)`, `DCIM (G:)`, `Movies (E:)`; the live config has only `Videos (Home)`. Same
  file-versus-database split that made the tunnel URL keep reverting.  `260828`

- **[P0 — KEN, BLOCKING] Railway's trial has EXPIRED — nothing can deploy.** `railway up` now
  answers *"Your trial has expired. Please select a plan to continue using Railway."* The node is
  still **Online** and serving (deployment `a0844b4e`), and DB writes still land, so the platform
  is up — but every code change since `d91d05c` is on main and NOT live. *Next:* Ken picks a
  Railway plan, then `railway up -s Core --detach`.  `260826`
- **[P0→FIXED 260826] Every prospect portal was being indexed under a real business's name** —
  `isPortalClaimed` answered "claimed" for all 22 portals because Ken holds a membership on every
  one: he BUILDS them. The builder is not the owner, so robots.txt was letting Google index
  sites carrying a real business's name, prices and services before anyone had agreed to any of
  it — precisely the 260818 consent takedown the flag was written to prevent. A portal is now
  claimed only when a non-system human who is NOT platform staff holds it, and an unpopulated
  member fails closed. ⚠️ Needs the deploy above to take effect.
  *Where:* `src/utilities/isPortalClaimed.ts`, `isPortalClaimed.test.ts`.  `260826`
- **[P1→FIXED 260826] Pricing had FOUR copies and three of them were stale** — the 260823 decision
  ($29 / $79, fee bought down 5% → 2% → 0%) lived only in a handoff doc. Fixed: `portalPlan.ts`
  now carries `PLAN_PRICE_CENTS` + `PLAN_FEE_BPS` and `/dashboard/plan` renders the map;
  `getPlatformFeeBps` consults the plan (a $29 portal was still being charged the free 5% — we
  were selling a discount we did not apply); the public /plans + /pricing copy and the platform's
  `membership-plans` settings row (the one the BUY page reads, still at 4900/14900) were updated
  on live and re-queried. `demo` also stopped being mis-rendered as Free-with-an-upgrade-button.
  `260826`


- **[P0→FIXED 260825] A paywall with a second door is not a paywall** — the first Work ever
  put up for sale served its entire 146 KB to a signed-out visitor at its own canonical URL.
  `works.access` was enforced by exactly ONE surface (the CoursePlayer block) while
  `/learn/<slug>`, `/learn/<slug>/<page>`, `/api/works-ops/text` and `/api/works-ops/get`
  all read straight from storage. `gateWorkBySlug` is now the single gate and all five doors
  call it; `workGateDoors.test.ts` fails if a sixth is added without one. Verified live after
  deploy: page returns the AccessPanel with no body text, both endpoints 403 with
  `{reason, productId}`, and a public Work (holy-bible) still 200s.
  *Where:* `src/utilities/gateWork.ts`.  `260825`


- **[P0→FIXED 260825] Nothing on this platform could be bought — three separate defects,
  zero orders ever created.** (1) There is no `paid` order status and there never was:
  `enum_orders_status` is the ecommerce plugin's four values (processing · completed ·
  cancelled · refunded), yet five places read or wrote `'paid'`, so each was a silent
  no-op — a purchased training stayed locked, the payouts dashboard summed an empty list,
  and `markOrderPaidAndDecrementInventory` would have failed validation. (2) An order could
  not be created at all: Orders is in `multiTenantPlugin`, so `tenant` is REQUIRED and its
  only auto-resolution is the `payload-tenant` cookie — an admin-panel artefact no shopper
  has — and the plugin's `confirmOrder` never sets it, so the create threw AFTER Stripe had
  captured the card. (3) Nothing was bound to the entitlement rail that shipped 260826.
  Fixed: `src/utilities/orderPaid.ts` is now the one vocabulary (a test parses the migration
  and fails if a status we use isn't in the enum); `Orders/hooks/setTenantFromItems.ts` reads
  the seller off the first line item; The Angel OS Handbook is product 76 at $49,
  `access: 'purchase'`. Proven against the LIVE database: refused with `purchase_required`,
  an order in exactly confirmOrder's shape flips it to `purchased`, cleanup re-queried.
  ⚠️ **Not exercised: a real card.** Live Stripe keys — that charge is Ken's to make.
  `8d96bac` `260825`
- **[P1] The webhook registered in Stripe is a Connect *application* endpoint** — the only
  endpoint on the account is `we_1T4alu…` (`application: ca_…`), pointed at
  `https://www.spacesangels.com/api/stripe/webhooks`. `STRIPE_WEBHOOKS_SIGNING_SECRET` IS set
  on Railway (Ken's 260726 TODO is done), but nothing has verified that secret matches THAT
  endpoint, and the web checkout path doesn't depend on the webhook anyway — the plugin's
  `confirmOrder` is client-triggered. *Next:* first real purchase, watch both.  `260825`


- **[P1→FIXED 260824] Everyone who is not an admin saw "Unknown" instead of names** — `Users.read`
  was `adminOrSelf`, so a non-admin could read exactly ONE user row: their own, and every `depth: 1`
  author population returned a bare id. Ken is super_admin so he never saw it; on Tyler's screen the
  whole portal was anonymous.
  Payload decides ROW visibility before FIELD visibility, so field-level access alone could not fix
  this — the row has to be let through first. `read` is now `signedInDirectoryRead` (any signed-in
  person; Ken's call, global name visibility yes) and ALL the protection is field-level: `email`,
  `phone`, `socialProviders`, `googleCalendar`, `agentConfig`, `dashboardPrefs`, the order/cart/
  address joins, `federatedIdentityId` and the plugin's `tenants` array are `adminOrSelfFieldAccess`.
  `roles` already was. Verified live with a throwaway non-admin account: peer read returns
  `name` + `avatarUrl` and nothing else; a super_admin with 22 tenant rows and 1 social provider
  comes back with both arrays empty.
  ⚠️ **Payload gives you a blacklist, not a whitelist** — a field added to Users tomorrow is public
  by default. `usersFieldExposure.test.ts` fails unless every field is approved-public or gated.
  Co-membership scoping was rejected: it cannot be a `where` (access has no join), so it costs a peer
  lookup on every read of every user row — to protect names, where DMs are already global by design.
  Shipped with it: an uploadable `avatar`, falling back to Gravatar via a stored `gravatar_hash`
  (stored, not derived, because `email` is now redacted for peers — a fallback only its owner can see
  is not a fallback). Read `avatarUrl`, which encodes the fallback order.
  *Where:* `src/access/signedInDirectoryRead.ts`, `src/access/adminOrSelfFieldAccess.ts`,
  `src/collections/Users/index.ts`, `20260824_200000_users_avatar`. `260824`

- **[P0→FIXED 260824] Every portal's sitemap pointed search engines at `http://localhost:3000`** —
  `src/app/sitemap.ts` built its URLs from `NEXT_PUBLIC_SERVER_URL`, which **bakes at build time**
  and is unset in the container build, so the fallback shipped. Worse than having no sitemap. The
  route is `force-dynamic` and per-tenant, so the origin must come from the REQUEST — which the
  reader already did (`originFromHeaders` in `learn/[soul]/[page]`). `sitemapOrigin.test.ts`.
  [[project_nextpublic_selfhost_buildtime]] `260824`
- **[P1] The sitemap indexes pages/posts/products and NOTHING else** — no Works, no chapters, no
  events. The whole Library is invisible to search: 1189 Bible chapters plus WDEG, none of it
  submitted. This is the single biggest SEO win available and it needs no translation work at all.
  *Where:* `src/app/sitemap.ts`. *Next:* add `events` (cheap) and Works chapters — now a trivial
  query against `work-chapters` (260826), still wanting a sitemap INDEX rather than one giant file.
  `260826`

- **[P0→FIXED 260731] Scheduled work is running again** — the Payload jobs queue replaced the retired crond
  container (`cf35d34`), `JOBS_AUTORUN=true` set on Railway Core, deployed and verified: nine tasks scheduled,
  the first runs completed and cleaned themselves up, `connector-health` re-scheduling itself every 30 min,
  zero errors. Production had been running a 47-hour-old image — a variable change alone would have
  redeployed the OLD one. *Still open:* delete the `angelos-heartbeat` service and the `vercel.json` crons
  so there is exactly one source of schedule. [[project_scheduled_work_payload_jobs]] `260731`
- **[P1] Inbound email is not configured at all** — `/api/email/poll`'s 500 was never a crash: there is no
  `email_inbound` connector in the database and `SYSTEM_EMAIL_PASSWORD` is unset, and the endpoint dressed
  that up as a server error. It now answers 200 + `configured: false`, so "unconfigured" and "broken" are
  finally different observations. Still NOT in the jobs queue: the first poll after a mailbox IS configured
  would auto-reply, as LEO, to every unseen message in a mailbox nobody has read in weeks.
  *Where:* `src/endpoints/email-poll.ts`. *Next:* Ken decides whether hello@spacesangels.com should answer
  itself; if yes, add the connector, run the endpoint by hand once with the inbox open, then schedule it. `260731`
- **[P1] Nothing auto-starts the cloudflared tunnel** — after the 260801 move the edge stayed dark because
  no process was launching it: the `cloudflared` Windows *service* is STOPPED (last exit 1067) and there is
  no scheduled task. Restarted by hand as a user process, so `payloadnuke.com` / `kendev.co` / gotify / kuma
  are serving again — but it dies with the session. *Next (needs an ELEVATED shell, Ken):*
  `schtasks /Create /TN AngelOS-Tunnel /TR "C:\Dev\datacenter\stack\run-tunnel.cmd" /SC ONLOGON /F`
  — or fix and start the real service. The stale spacesangels rules are gone and the new config is live
  (verified by curling hostnames the edit changed). `260801`
- **[P2] Merlin's port and the tunnel disagreed** — the autostart task launches Merlin on **:3002** while the
  tunnel routed `merlin.*` at **:3000**, so merlin hostnames 502'd against an empty port. The tunnel now
  points at :3002 (where Merlin actually is) since changing the task needs elevation. Nothing listens on
  :3000 at all. *Next:* pick ONE port and make the task and the tunnel config agree. `260801`

- **[P2] mediaToAiBus fails for uploads created OUTSIDE a request** — every image imported by
  `src/scripts/_local/import-site.ts` logged `[mediaToAiBus] failed to post media N: The following field
  is invalid: Attachments 1 > Media`. The media row is created fine; only the AI-Bus mirror fails. Suspected
  cause: the multi-tenant plugin's relationship filterOptions have no tenant context inside the detached
  `setImmediate`, so the attachment can't validate. Normal user uploads (inside a request) appear unaffected —
  **verify that before fixing**. *Where:* `src/collections/Media/hooks/mediaToAiBus.ts`. `260726`

- **[P1] Anthropic API key OUT OF CREDITS** — direct Anthropic vision/chat 400s ("credit balance too low");
  providerHealth skips it 30m at a time. Gemini now covers vision (see fix 91ef738) so nothing is down, but
  the paid failover tier is thinner. *Next:* Ken adds credits at console.anthropic.com — or we accept
  Gemini-only vision. `260722`
- **[P2] Merlin still squatting :3000 via logon task** — elevated `Set-ScheduledTask` one-liner (move to
  :3002) given to Ken, unrun; Docker Desktop "Model Runner" should be disabled (Inference-manager stale-socket
  crash). *Next:* Ken runs both. `260722`
- **[P2] Nimue chat-echo fix needs APK build** — network-first post-send reload + server watermark landed in
  C:\Dev\nimue commit `98ca0df`; not shipped to the phone. *Next:* build + install APK. `260722`

- **[P1] Works system is "hosed"** — the video LMS foundation has known instability. Stabilize before
  layering Quiz/LMS on top. *Where:* Works collection + [[project_works_wip_status]] / [[project_reader_reference_layer]]. *Next:* audit + list the concrete Works breakages, then fix. `260720`
- **[P1] LEO fabricates tool success** — claims actions done that never persisted (e.g. "saved the post as a
  draft" with no row; enterprise-health prose embellished into fake "Federation ACTIVE"). *Where:* leo-stream / constitutional-prompt / executeToolCall. *Next:* LEO must not report success without a tool result; validate tool-result → response. `260720`
- **[P1] create_post crashes on required `layout` — FIX STAGED** — `create_post` schema made `content`
  optional but Posts `layout` is `required:true`; a call without content left layout unset → Payload
  "The following field is invalid: Content > Layout". Also LEO picked create_post over create_post_from_media
  when media was selected. *Fixed (staged, awaiting rebuild):* `createPost` now errors clearly + points at the
  media tool so content/layout is always set (`leo-data-tools.ts` ~8280). *Also:* nudge tool-selection toward
  create_post_from_media when media is attached. `260720`
- **[P1→FIXED 260723] Image-only channel message failed silently** — an image with no typed text 400'd at
  the leo-stream empty-message guard ("Missing or empty: message") before attachments were checked → deep-think
  spinner then no response. Fixed `32a3a89`: parse attachments first; image-only turn is valid. (The earlier
  "lost on refresh" report was the same root cause — the user message persisted but LEO never responded.) `260723`
- **[P1] Stripe webhook secret unset in Vercel** — `STRIPE_WEBHOOKS_SIGNING_SECRET` not set + webhook
  `/api/stripe/webhooks` unregistered → Clearwater earn loop gated. *Where:* Vercel env + Stripe dash. *Next:* Ken sets it. [[project_earn_loop_clearwater]] `260720`
- **[P2] GoogleReviews block renders nothing on a bad/absent Place ID** — no graceful empty state, just a
  blank gap. *Where:* `src/blocks/GoogleReviews/Component.tsx`. *Next:* render a friendly fallback (or hide) when `fetchPlaceReviews` returns empty. `260720`
- **[P2] Error nervous system is console-only** — `apiInterceptor` + `ErrorBoundary` are effectively dead;
  17-item punch list already scoped. *Where:* [[project_error_nervous_system_audit]]. *Next:* work that list. `260720`

- **[P2→FIXED 260724] channels/messages/spaces REST read returned 403 (now empty-200)** — the three
  collection read-access fns coerced a boolean `false` (no visible spaces) into a never-match
  `{id:{exists:false}}` where, so REST *list* reads return an empty 200 instead of 403. Killed the log
  spam and unblocks the channel image picker. DM/private grants unchanged. `796ae73`. `260724`
- **[P2] mediaToAiBus attachment validation fails on new uploads** — `[mediaToAiBus] failed to post
  media N: field invalid: Attachments 1 > Media`; fire-and-forget so uploads/analysis are fine, but
  the new asset never streams into the AI Bus `media` channel timeline. *Where:*
  `src/collections/Media/hooks/mediaToAiBus.ts` (already `Number(mediaId)`; the attachments.media
  filterOptions still rejects in system context). *Next:* bypass filterOptions or match the tenant the
  filter expects. `260723`
- **[P1→LOCAL DONE / RAILWAY RUNBOOK 260723] PgBouncer connection pooling** — local stack now routes
  Core through an `edoburu/pgbouncer` service (transaction mode, pool 25, `:6432` external) instead of
  straight at `postgres:5432`; verified live (login/portals 200, zero prepared-stmt errors, pool active).
  *Railway:* add a 3rd `edoburu/pgbouncer` Docker service + repoint `DATABASE_URI` — exact steps in
  `docs/DEPLOY_RAILWAY.md` §1/§2. *Next:* Ken runs the Railway steps (no CLI here). `260723`

## 🟡 Gaps — features to build (P1)

- **[P1] Works has TWO renderers and THREE content conventions, and the writer can't tell which**
  one they are authoring for. Ken hit this editing WDEG: the formatting is applied **by POSITION,
  not by markup**, and nothing says so.
  - `works.type = 'book'` → `BookReader.tsx`. Splits the body on blank lines, renders **paragraph 1
    as an `<h2>` title**, **drop-caps paragraph 2** (`first-letter:` classes, amber `#C4956A`),
    Georgia serif, 34rem measure. **Markdown is not parsed at all** — `{p}` goes into a `<p>` as a
    raw string, so `# heading` and `**bold**` render as literal characters.
  - `works.type = 'book'` + Bible → the same file's VERSE path: `<sup>` verse numbers, one flowing
    paragraph. Chosen by content shape, not by a field.
  - `works.type = 'document'` → `SoulViewer.tsx`. Full `ReactMarkdown` + `remarkGfm` with LCARS
    styling (Orbitron headings, amber/lavender/teal by level, Rajdhani body). No drop caps.
  Both editors write **markdown** regardless of which renderer the Work will use.
  *Next (Ken's call, it changes how every book looks):* `BookReader` should render markdown like
  the document path, and take the chapter's `title` from the `title` COLUMN — which has existed
  since chapters became rows — instead of guessing it from paragraph 1.
  *Where:* `src/components/Library/BookReader.tsx:410-450`,
  `src/app/[locale]/(app)/learn/[soul]/SoulViewer.tsx:174+`.  `260826`
- **[P1] WDEG: 12 of 26 chapters have a whole PARAGRAPH as their title** — and all 26 repeat their
  title as the first line of the body. Because `BookReader` eats paragraph 1 as the heading, those
  twelve render a full paragraph at `1.55rem` as an `<h2>`, and the drop cap lands on what should
  have been paragraph two. This is the "clunky" Ken saw. The importer derived `title` from the
  first line whether or not the chapter had one. Counted live:
  `select count(*) filter (where length(title) > 120) from work_chapters where work_id = 5`.
  *Next:* fix the renderer first (above), then repair the 12 titles — in that order, or the repair
  has to be re-done against whatever the renderer ends up doing.  `260826`
- **[P1] The quoting agent — the highest-value capability Angel OS does not have.** From the 260826
  Zack Kirk transcript, and the claim that survives stripping the funnel is checkable: a
  service business spends **2–3 hours a day** writing free quotes, and his named best niche is
  "mobile mechanic" — Ken owns `mobilmech1` (14 services, 2 with real hourly rates) and `start-s`.
  `Services` is already most of a rate card (`pricingModel`, `hourlyRateUsd`,
  `billingIncrementMinutes`, `minimumMinutes`, `unitRateUsd`, `depositPercent`). **Three things
  short:** (1) a markup % on parts/materials, (2) a trip/travel charge — it matters for a MOBILE
  trade and there is no field, (3) a quote as an artifact: `generate_invoice` exists, a quote
  (pre-job, saved, valid N days, later compared against what the job actually cost) does not.
  The internal/external split he sells as two products is ONE tool here — `leoToolStanding`
  MANAGER sees labor, cost, markup and margin; the public caller sees one number.
  *Next:* two fields on `Services` + a `quote_job` LEO tool, proved on `mobilmech1`.  `260826`
- **[P2] Speed-to-lead: we have the hard half.** Same transcript's second agent calls a lead within
  20 seconds of a form submit. `/api/capture` + `embed.js` + heartbeat drip shipped 260726, so the
  capture rail exists; the outbound call does not. [[project_comms_layer]]  `260826`
- **[P2] `/dashboard/plan` sells features, not pain.** It currently leads with "your own domain
  name, pointed and secured". For a tradesman the converting line is "you spend two hours a day
  writing quotes". Copy change, no build — do it when the quoting agent lands so it is true.
  `260826`


- **[SHIPPED 260825] Who has finished which training** — `/dashboard/works/completions`:
  every active member against every training the portal carries. Three queries, no join
  table — progress already lives as ONE `settings` row per user holding
  `{ workSlug: { percent } }`. Gated like the Works Studio; attendance is staff data.
  *Where:* `src/utilities/trainingCompletion.ts`.  `260825`
- **[P1] The employee-training story, what is still missing** — a manager can now publish
  trainings, have LEO write the quizzes, edit them by hand and see who has finished. Not yet:
  **assigning** a set of trainings to a new hire (today they see everything the portal
  carries), a due date, and a nudge when someone hasn't started. *Next:* an `assignments`
  array on tenant-memberships would cover all three without a new collection.  `260825`


- **[SHIPPED 260825] The Library is in the sitemap** — ~1,250 Work + chapter URLs, PUBLIC
  works only (submitting a paywalled URL earns a soft-404), scoped to what the portal
  carries. One file, not an index: the cap is 50,000 URLs. *Where:* `src/app/sitemap.ts`,
  `sitemapLibrary.test.ts`.  `260825`
- **[SHIPPED 260825] A published Work can be edited** — `/dashboard/works/<slug>/edit`,
  reached from an Edit link on every work the portal owns. The CourseStudio existed only as
  a block someone had to place on a page; the route just resolves the Work and answers
  `canManageWork`. This was the blocker for the employee-training story.  `260825`


- **[SHIPPED 260825] LEO writes the quiz** — `generate_quiz` reads a chapter and appends a
  ```quiz fence to it: same format a human authors, same reader, same attempt endpoint, no
  new collection. Every generated quiz is round-tripped through `parseQuiz` before it is
  saved, so an unrenderable quiz never lands. *Where:* `src/utilities/generateQuiz.ts`,
  `src/utilities/leoQuizTool.ts`. *Still missing for the employee-training story:* the Works
  Studio cannot EDIT an existing Work (it can only hide/show), so a manager can't fix a
  generated question by hand yet. That is the next real gap.  `260825`


- **[P1→SHIPPED 260826] Works chapters are ROWS, and have an editor** — `work-chapters`:
  `work`, `order`, `slug`, `title`, `body` (markdown), `image`, `module`/`video` for courses, the
  document extras, the scripture hierarchy, and `translations` (verses stay JSON — a verse is not a
  document). Backfilled by joining on `works.storage_ref` (space AND channel, not the channel name),
  which drops the duplicate Handbook copy for free: **1,238 rows**, verified live. `getWorkJson` is
  still the single reader and all 7 importers are unchanged; it reads rows and falls back to the
  message rows for anything not moved. The message rows are NOT deleted — `storage_ref.messagesRef`
  is the rollback; **delete them after ~260902**. The prize landed too: an optional `range` makes
  `/api/works-ops/text` a real windowed query, so the 5.5 MB per-request read is gone.
  *Where:* `collections/WorkChapters`, `utilities/getWorkJson.ts`, `20260826_100000`. `2c4247b` `260826`
- **[P1→SHIPPED 260826] `works.content` folded into chapters** — a lesson is a chapter with a video;
  a module is the `module` text field. Flat storage, two-level rail: consecutive chapters sharing a
  module are one module. The in-memory `CourseContent` shape is unchanged, so the player and the
  studio learned nothing. Column dropped. *Where:* `utilities/courseChapters.ts`, `20260826_120000`.
  `f9ea161` `260826`
- **[P2] The Handbook duplicate is now unreachable, not gone** — the space-30 copy was excluded by
  the backfill join, so nothing reads it. *Next:* delete those 7 message rows with the rest of the
  old chapter rows after 260902. `260826`
- **[P1] Quizzes should be AI-generated** — a `generate_quiz` LEO tool that reads a chapter and emits
  a ```quiz fence is the natural shape: the author reviews and edits markdown rather than writing
  multiple choice by hand. Fits the LEO-factory principle (tool first, UI second) and needs nothing
  new — the fence format and renderer shipped 260825. *Where:* `leo-data-tools.ts`,
  `utilities/workQuiz.ts`. `260825`
- **[P1→SHIPPED 260826] Badges, and a profile to put them on** — no collection. The DEFINITION is a
  `badge` group on `works` (the Work already IS the thing you earn it for); the AWARD is a `badges`
  array on `users`, riding along with `/api/users/me` like `readState`. Awarded where `workProgress`
  hits 100 — a course ends at 100% and that number is already there, so there is no completion event
  to invent. Checked before insert; a failed write is swallowed. `users.badges` is in
  `APPROVED_PUBLIC` **deliberately** — a badge is meant to be seen. Profiles at `/u/<handle>`, with
  `profileVisibility` defaulting to **`members`** (private → 404 to all but the owner, public is
  opt-in — nobody becomes world-visible because of a deploy). Handles backfilled in SQL with numeric
  suffixing: 25 users, 25 unique handles. *Where:* `utilities/awardBadge.ts`, `app/[locale]/(app)/u/`,
  `20260826_130000`. `f9ea161` `260826`
- **[P1→SHIPPED 260826] Buy or sign up for a training** — `resolveTrainingAccess`: public → in;
  can edit the Work → in; membership standing satisfies `works.access` → in, via the SAME
  `isPageViewable` the page gating uses; a PAID order containing `works.product` → in; otherwise out
  **with the product**, so `<CoursePlayer>` offers a price and a way in instead of a locked door.
  Entitlement is DERIVED — no enrollments collection, because an enrolment row is a cache of a
  question a paid order already answers. New on works: `access` (PAGE_ACCESS_OPTIONS + `purchase`)
  and `product`. First thing on the platform to read Orders for access.
  *Where:* `utilities/trainingAccess.ts`, `blocks/CoursePlayer`, `20260826_110000`. `260826`
  ⚠️ *Still open, and the money is here:* nothing is BOUND yet — no Work has a product, and the
  demo-site/apex Stripe-price holes below are unchanged. Binding one course to one priced product is
  the next revenue step.
- **[P2] The Handbook is duplicated** — 7 chapters in space 6 AND 7 in space 30, identical text.
  `storageRef` points at space 6, so the space-30 copy (newer, 260713) is dead weight nobody can
  see because there is no list view. *Next:* confirm identical, delete one. `260825`
- **[P2] Attribution has two sources** — `works.canonical` (the manifest default) and a per-Work
  SettingService override bag written by LEO's `set_work_attribution`. Two answers to "who wrote
  this". *Where:* `utilities/workAttribution.ts`. `260825`

- **[P1→SHIPPED 260824] Read state** — `ChatChannel.unreadCount` was declared and populated by
  nobody; no `lastReadAt` existed anywhere. Now: `users.readState`, a `{ channelSlug: isoTimestamp }`
  map, written only through `POST /api/chat/mark-read` and read by `GET /api/chat/unread`.
  *Why a map on the user and not a `channel-reads` collection:* it rides along with
  `/api/users/me`, so read state costs no extra request on page load, and it sits beside
  `dashboardPrefs` under the same field gate. ⚠️ It cannot answer "who has read this message";
  when that becomes real the upgrade is a collection behind the same two endpoints and no caller
  changes (`utilities/readState.ts`).
  **The merge is monotonic** — `max(existing, incoming)` server-side — which is what makes a
  read-modify-write safe with no lock: two tabs cannot lose each other's progress and a stale tab
  cannot drag the marker backwards and resurrect read messages. A mark that would not move forward
  does not write at all, so the client's debounce costs one row update per channel VISIT, not per
  tick.
  **Counts, not dots, everywhere**, capped at 99+. The dot/count question was framed as
  performance and that was wrong: with `messages (channel, created_at)` the count is a single
  query with each channel's own floor in a `VALUES` join, barely heavier than a `max()`. A channel
  with no mark has NO floor — all of it is unread — because a synthetic "since now" floor silently
  swallows messages that arrive between polls. Your own messages never count.
  Divider anchor is `firstUnreadId`, which never opens the unread run on your own message.
  Verified against live: `EXPLAIN` confirms `messages_channel_created_at_idx` is used, and the real
  query returned 1909 of 1911 on `gotify` (the 2 excluded were the caller's own).
  *Where:* `utilities/readState.ts`, `endpoints/chat-read-state.ts`,
  `components/ChatControl/{useReadState,UnreadBadge}.tsx`, `20260824_210000_read_state`. `260824`
- **[P1] Notifications for the things that are NOT messages** — now unblocked by read state. An
  order shipped, a membership lapsed, an event tomorrow: a row with a `read` flag and a deep link.
  ⚠️ Do NOT build a second delivery system for chat — the bus already delivers, and it can now
  remember what you have seen. `/api/notifications/poll` is Gotify mirroring, not this. `260824`
- **[P1] i18n is scaffolded in ONE of three layers and used in none** — Ken's 260824 question.
  (1) **UI chrome / next-intl**: routing configured (`['en','de']`, `localePrefix: 'as-needed'`),
  `[locale]` in the route tree — but `messages/en.json` is **140 bytes** (three strings) and
  **zero components call `useTranslations`/`getTranslations`**. Real plumbing, empty content.
  (2) **CMS content / Payload `localization`**: **not configured at all** in `payload.config.ts`.
  This is the piece that would let one Page carry `en` and `es` values. The multi-tenant plugin
  does work with it — it simply has never been turned on. ⚠️ Enabling it is a schema-wide change
  (every localized field moves to a `_locales` table), so on a 22-portal live node it is a project,
  not a config flip. (3) **Book content**: chapters live in Work JSON (`storageRef`), NOT in Payload
  fields, so **Payload localization would not translate the reader at all** — it would localize
  titles and descriptions only. That is why the Works recommendation stays one Work per language.
  Also: `de` is in the locale list with no German content and no German audience, while **Spanish**
  is the language actually in hand (the Spanish WDEG edition). Make the list match reality.
  `260824`
- **[P2] A DM has no way to get to the person** — Ken's 260824 ask: a context menu on a DM entry
  giving the user's properties/profile. `identity_profile_friends` is the adjacent work.
  `260824`

- **[P1] Translations of a Work are not indexable, and the model does not exist yet** — Ken's
  260824 ask: let the sitemap point at every language of the book. Three things are in the way and
  only the third is the interesting one. (a) The sitemap said `localhost` — fixed 260824. (b) Works
  are not in the sitemap at all. (c) **There is no language concept on Works.** `works` has slug /
  title / canonical / owner and no `language`; `wdeg` is ONE Work, and the Spanish edition exists
  only as a *product* listing, never as something the reader can open. Note `routing.locales` is
  `['en','de']` — next-intl chrome translation, a DIFFERENT axis from content translation, and
  conflating them (a `/es/` prefix that translates the UI while the book stays English) actively
  hurts: Google sees near-duplicates.
  *Recommended shape:* a `language` field plus a shared translation family on Works, ONE Work per
  language with its own slug (`wdeg`, `wdeg-es`). **Not** an optional path segment in the reader —
  for SEO, ambiguity is the enemy, and two URLs that both serve a chapter is duplicate content with
  a computed canonical. Each URL then emits `rel=alternate hreflang` for every sibling *including
  itself* plus `x-default`; Next's `MetadataRoute.Sitemap` supports `alternates.languages` natively
  and emits the `xhtml:link` entries, so the sitemap side is a supported feature, not a build.
  ⚠️ Chapter slugs must MATCH across translations (`chapter-1`, not `capitulo-1`) or hreflang can
  only ever be book-level instead of per-page. Translate the title, keep the slug.
  Reuses `worksCanonical.ts` (publish-once-canonical) rather than adding a second authority model.
  [[project_works_canonical_syndication]] [[project_reader_reference_layer]] `260824`

- **[P1] A free tier is a lie on 20 of 22 portals** — the free-plan path writes the Membership directly
  and needs no Stripe, so ANY portal can offer one today. But the moment a plan costs money,
  `billingMode === 'connect'` demands a connected account and only clearwater-cruisin has one. *Next:*
  Ken's open decision on Connect onboarding at the free tier (handoff 260824) gates whether this is a
  bug or the design. `src/endpoints/membership-checkout.ts` `260823`
- **[P1] Events have no `layout` field, so an event page can carry no blocks** — no Comments, no RSVP
  thread, nothing to come back for. WDEG has zero events and Grace Chapel needs the same thing.
  *Where:* `src/collections/Events.ts`. *Next:* add `layout` (blocks) + its block tables in a NEW
  migration — a new field is TABLES, not config. `260823`
- **[P2] `/spaces` is the community's front door and is named after the primitive** — WDEG's nav now
  points "Community" at `/spaces`. Fine for now; a portal-facing alias would read better and the
  no-jargon rule points that way. `260823`

- **[P0] No subscription has EVER completed on live** — `memberships` is 0 rows platform-wide; 14 portals
  on `free`, 8 on `demo`, nothing paid. Every money bug this week was invisible until someone tried it
  (comments, `/book`, `orders-vendor`, the webhook event list). *Next:* one $1 Founding Dollar checkout on
  Clearwater's host, confirm the webhook writes the row, refund. Twenty minutes; derisks the whole
  contributions story. [[project_portal_coequality_billing]] `260823`
- **[P1] Imported Google contacts land in the wrong portal** — `resolveUserHomeTenant` scopes them to the
  importer's PERSONAL guardian-angel portal, so a pastor importing the congregation gets them in his own
  address book rather than the church's, where staff could act on them. *Where:*
  `src/utilities/googleContactsImport.ts`. `260823`
- **[P1] No bulk invite** — you can import 400 contacts and invite one person; nothing walks the list.
  That is the missing verb for "invite all our members". **Needs a per-tenant daily cap first:** mass
  invites from one portal burn the shared Resend sending reputation for every other portal on the node.
  A shareable join link is the better primitive for congregations anyway. `260823`
- **[P1] An invited person lands nowhere** — `invite-accept` returns `{ spaceId }` as JSON; nobody is taken
  into the channel they were invited to. Arrival is silence. *Next:* carry the destination through accept
  and drop them in the channel with the inviter's message pinned. `260823`
- **[P0] No subscription has EVER completed, and there are no Stripe PRICES on the node** —
  `memberships` is 0 rows, 22 portals are `free`/`demo`, and a settings-bag search for `price_`
  returns zero, so the $29/$79 tiers are not buyable at all. Separately, Ken's $5 donation on 260823
  recorded NOTHING (no transaction row, `justice_fund_transactions` empty, no Stripe event since
  260820) while the endpoint answers 400 to an unsigned probe and the signing secret is set — so it
  is DELIVERY, not handling. *Next:* Ken checks the Stripe dashboard delivery log, then create the
  two prices. `260824`
- **[P1] Commission revenue is unreachable on 20 of 22 portals** — `application_fee_amount` only
  works on a connected account and only `clearwater-cruisin` has charges enabled (the platform's own
  account has them OFF). Subscription revenue is reachable now; commission is not. *Next:* Ken's
  call on whether Connect onboarding belongs on the free tier at all. `260824`
- **[P1] The bootstrap refund promise has never been re-read against the new pricing** —
  `bootstrapFees.ts` states in source that every bootstrap fee is "committed for FULL REFUND", with
  no expiry and nobody tracking the liability. *Next:* explicit ruling from Ken. `260824`
- **[P1] LEO answers every message in every channel, unconditionally** — `useChat.ts` calls LEO on
  every send with no channel-type or mention check, so two humans talking in #general each get a
  reply per line. The rule already exists and is tested on Discord (`shouldRespond`: DM, mention, or
  the LEO channel). *Next:* port it to the web chat — fixes intrusion AND most of the token cost.
  `260824`
- **[P1] The per-space `leo` channel is shared, not private** — 25+ of them across portals holding
  **11 messages total**, while the per-user `dm-{userId}-leo` that already exists holds 171 in Ken's
  alone. The private primitive works and is used; the shared one is the default and is dead. *Next:*
  default swap, after Ken rules on whether an owner may read a member's thread. `260824`
- **[P1] WDEG has no way to join** — tenant 11 has NO membership plan at all, 5 members of whom 3
  are us, 0 events, and two overlapping community spaces. *Next:* one FREE plan + join link; then
  merge the spaces. This is the agreed next build. `260824`
- **[P1→SHIPPED 260824] LEO tool authorization is in code, not the prompt** — 11 of 174 tools
  checked the caller; `query_orders`'s model-chosen `viewAs: 'vendor'` dropped the customer filter
  and returned every order on the portal. `leoToolStanding.ts` declares a standing per tool
  (anonymous/member/manager/platform), enforced at `executeToolCall`, with a test that fails on any
  undeclared tool. `c60c3f7` `260824`
- **[P1→SHIPPED 260824] An invited person lands somewhere** — accept now resolves the space's
  default channel, returns a destination the client follows, and says hello in the channel the space
  is actually talking in (fail-soft). ⚠️ Untested with a real invitee. `c60c3f7` `260824`
- **[P2] Three files still read `user.tenants` unreviewed** — `ai-bus-poll`, `ai-bus-stream`, `x-post` pick
  WHICH tenant to act in rather than whether you may. Listed in `noRoleBlindTenantAuth.test.ts`'s
  allowlist so they are tracked, not blessed. `260822`
- **[P2] `/learn/works` still resolves on portals with Works off** — the feature toggle removes the nav
  entry, not the route. Ken's call whether it should 404. `260823`
- **[P1→SHIPPED 260824] Works availability is a portal setting, not a source edit** — `subscribers[]` lived
  in a TypeScript manifest, so only the platform operator could choose what a portal carried, and only via a
  deploy. Now `works` rows (`owner`/`subscribers`/`optOuts`/`availableGlobally`/`published`), read through
  `src/works/registry.ts`; Dashboard → Works opens on "The Library on <portal>" with a checkbox per Work.
  Verified live: opting Grace Chapel out of the Bible dropped its catalog 6→5 and 404'd the reader, with
  Clearwater untouched. `e78697c` `260824`
- **[P2→SHIPPED 260824] The 11MB Bible ingest JSON is gone** — `src/souls/holy-bible/data` was the ingest
  intermediate, read by nothing at runtime. Verified 1189 = 1189 = 1189 (DB chapters / built manifest / raw)
  before deleting. `src/souls` is 52K now and holds only what the importer reads. `c1ab544` `260824`
- **[P2] `src/souls` manifests still feed `works-ops/import`** — the last filesystem tie. Harmless (52K, an
  admin tool, nothing at runtime reads it), but the importer is what keeps them. *Next:* import from an
  uploaded Work JSON instead, then the directory goes. `260824`

- **[P2] Intent pre-classifier in front of `brain.ts` (defer the learned tier)** — leo-brain already IS
  the "put the LLM last" cascade: `triage.ts` = pure deterministic perception gate, provider-order in
  `brain.ts` = cheap-model-first. The one unbuilt rung is **intent/tool** classification of a typed
  message — `/book`, "show inventory" are closed-set labels that ride the full LLM tool-loop today.
  *Next (when measured):* deterministic `preClassify` verb/`/`-command table in front of the brain's
  tool loop (free, tiny). **Do NOT add a trained classifier** (his TF-IDF+logreg tier) — your cheapest
  tier is free local Ollama, so the middle is already cheap; only build it if telemetry shows intent
  routing is a real cost/latency line. If ever built: keep his loud-silent-regression + token-parity
  guards, and confidence-below-threshold→fall-through-to-LLM. [[project_three_body_shared_brain]] `260724`

- **[P1] Bookable inventory: forced 3-D Secure may REOPEN the card rail** — the vertical stalled on
  "card KILLS rent" (chargeback exposure) → ACH was the fallback rail. Forcing 3DS makes the issuer
  authenticate the buyer before the booking completes, which **shifts chargeback liability off the
  merchant** — so card may be viable for rentals/deposits after all. It's a flag, not an architecture:
  `payment_method_options.card.request_three_d_secure: 'any'` on the PaymentIntent. *Where:* the
  Stripe checkout path + `Listings`/bookingEngine on branch `feat/bookable-inventory`.
  *Next:* cost it against ACH before committing the vertical to ACH-only. (Idea via Lifted ShipKit,
  which forces 3DS for exactly this reason.) [[project_bookable_inventory]] `260723`

- **[P1] People-funnel seams (map: `docs/LEAD_TO_CAMPAIGN_FLOW.md`)** — capture/invite/campaign are all
  BUILT (correction: `sendCampaignChunk` already does chunked+resumable+unsubscribe+idempotent sends).
  Four seams remain, each small:
  - **A. Anonymous chat never harvests a contact** — voice + web forms upsert Contacts; LEO chat on a
    public page captures nothing. *Next:* allow `capture_lead` from an unauthenticated tenant-scoped
    session, `source: 'chat'`. **Highest value — same money path as the phone bot.**
  - **B. [FIXED 260724] Quick Invite bypasses Contacts** — `sendQuickInvite` now upserts a Contact at
    `invited` (dedupe email→phone, fail-soft) so the Invitations and Contacts boards reconcile. `796ae73`.
  - **C. No invite-from-Crew** — `/dashboard/admin/crew` can only assign existing members. *Next:*
    invite + pre-stage department/station so they land assigned on accept.
  - **D. Phone-only contacts can't be bulk-invited** — `sendQuickInvite` supports a phone invite;
    `bulkInvite` doesn't use it, so voice leads without email dead-end. *Next:* wire it through.
  - **Drip (after A–D):** `campaignStep` + cron over the existing chunk sender — NOT a new engine.
  [[project_earn_loop_clearwater]] `260723`

- **[P1→LIVE 260723] Voice response system (Vapi)** — wired and demoable: LEO assistant answers, captures
  leads (→ Contacts), and calls now write a `cost-events` telephony row + append call log/metrics to the
  matching Contact (`5382358`). Recordings stay on Vapi (URL stored, not bytes). *Remaining polish:*
  `transfer_to_human` refuses (forward number not set on the Vapi assistant). `260723`
- **[P1] LMS Quiz module** — Works already does video/chapters/progress/TTS; the only missing LMS primitive is
  quizzes. *Do NOT fork a new LMS collection* — add a Quiz block/companion to Works. *Next:* Quiz block (manual now, AI-graded later). `260720`
- **[P1] Platform Costs (rename + ledger)** — `CostEvents` already discriminates Intelligence/Telephony/
  Storage/Infra/Other; the model is ready. *Where:* `dashboard/ai-costs/*`, `CostEvents`. *Next:* (1) rename ai-costs → platform-costs, (2) group the panel by category, (3) **emit cost events for Storage (R2), Telephony (Vapi/LiveKit), Infra** — currently only AI writes them, (4) per-system update link. Answers "what does our storage cost?". `260720`

- **[P1] Media-anywhere primitive (Ken 260722)** — "specify photos essentially anywhere + generate an image and
  put it anywhere": one LEO tool family that places existing/attached/AI-generated media into ANY surface —
  page block, post body/gallery, hero, channel message, tenant branding. Pieces exist (`set_media` primitive,
  `add_gallery_to_page`, `create_post_from_media`, `imageGeneration.ts`, 16fc811 attached-ids) but each surface
  is its own bespoke tool. *Next:* one `place_media(target, mediaIds|generatePrompt)` resolver over a target
  registry; then port to Nimue. [[project_set_media_primitive]] `260722`

## 🧱 Blocks / UI (P1–P2) — WordPress-parity kit

- **[P1] FeatureCards block** — icon-grid row ("Clinical Applications / Photobiomodulation / …"). *Next:* same
  cheap-block pattern. `260720`
- **[P1] Page `parent` + SubNav block** — self-referential `parent` on Pages (NOT nested-docs plugin —
  [[project_nested_docs_incident]]) + a SubNav block listing siblings/children; gives breadcrumbs free and preserves imported WP site structure (WP API exposes `parent` + `menu_order`). *Next:* field + migration + block. `260720`

## 🔧 Debt & hardening (P2)

- **[P2] `dm-roster` is dead code** — `GET /api/messages-ops/dm-roster` builds the "every portal
  member appears as a virtual DM whether or not a channel exists" roster, with a deterministic slug
  and a `hasChannel` flag. **No client calls it.** The sidebar lists real channels instead, which is
  why you can only DM someone you have already DMed. Either wire it into the DM section or delete
  it. `src/endpoints/dm-roster.ts`, `src/utilities/dmRoster.ts` `260824`

- **[✅ SHIPPED 260722-pm2] Van post + LEO media-id fix + Start-S branding** — (1) van diagnostic post got its
  4-photo gallery (media 411-414); (2) **LEO media-tool root cause CLOSED** — "couldn't read that image" was
  masking `add_gallery_to_page` called with EMPTY imageIds (ids never reached model context); user turns now
  carry `[Attached media IDs: …]` (`16fc811`) — also closes the analyze_image-without-mediaId P1; (3) start-s
  services reseeded to Vlad's real 7-item price list; (4) **Start-S SVG logo** (media 415) in the header —
  which proved the old "header doesn't render branding.logo" P2 stale (NCP + Start-S both render; depth-2
  hydration works) → removed. `260722`

- **[✅ SHIPPED 260722-pm] Start-S portal + media-picker leak fix** — (1) **start-s.payloadnuke.com** provisioned
  for Vlad's "Start-S" mobile mechanic (tenant 24, 13 services from his flyer, `provision-starts.ts`); (2) **van
  diagnostic post** live on his portal (post 67) for the invite loop; (3) **media picker leak CLOSED** — Library
  tab queried `/api/media` with a client-supplied tenant param (absent → super_admin saw ALL tenants); new
  `GET /api/media-library` mirrors the /dashboard/media query with server-side tenant resolution, reuse button
  un-gated so the LEO sidebar composer can submit existing media (`8651f97`); (4) phone-invite Copy Link shipped
  earlier today (`5048e2e`) closes the old P2 "surface pending-invite links". *Gotchas logged:* `payload run`
  doesn't await a floating `main()` promise (use top-level await); a provisioning tx killed mid-run leaves pages
  with rolled-back media refs that validate-fail forever (delete + rerun). `260722`

- **[✅ SHIPPED 260722] Live-ops day (demo + MobileMech1)** — one line each, details in HANDOFF_260722.md:
  (1) **Lead→Contact auto-harvest** (`upsertContactFromLead`, voice + web-form doors, dedupe email→phone,
  `d34c43d`); (2) **Vapi `tool-calls` events handled** — tools were silently no-oping, capture_lead claimed
  success while saving nothing (`bbf45a9`); (3) **Passwordless login**: email code + **SMS OTP via Twilio
  Verify** (no from-number/10DLC needed), `users.phone` E.164 = identity anchor, self-service phone on
  /dashboard/account, provider-style "Continue with a code" button — see `docs/AUTH_PHONE_SIGNIN.md`
  (`03a8ecf`); (4) **>10MB uploads fixed** — Next 16 `middlewareClientMaxBodySize` default 10MB was silently
  truncating; now `150mb`; R2 bucket CORS extended to `*.payloadnuke.com`; MobilMechanic1 intro video (19.4MB,
  media 406) live; (5) **login light-mode invisible fonts** — `data-theme="dark"` pinned on the glass card;
  (6) **media library picker tenant-scoped + LEO sidebar full composer** (`508c7ef`); (7) **Redirects engine**
  — own 5-field `redirects` collection + `resolveRedirect()` in [slug]/[...slug], 227 NCP old-site URLs
  imported (migration `20260722_030000`); (8) **vision chain fixed** — retired `gemini-2.0-flash` fallback
  404'd behind LEO's "couldn't read that image"; pinned to `GOOGLE_MODEL`/flash-latest (`91ef738`); MobileMech1
  **14 bookable services** seeded from the price-sheet flyer; (9) dashboard command-center stats tenant-scoped
  (`f479c56`); (10) pg `idle_in_transaction_session_timeout` retuned 60s→**300s** (60s was reaping upload
  transactions). `260722`

- **[✅ SHIPPED 260721] Voice: trunk line, tools, lead capture, per-portal failover** — two defects a live call
  exposed, plus the per-portal work: (1) dialed-number resolution read only `message.call.phoneNumber`, but Vapi
  sends it at **`message.phoneNumber`** (top level) on `assistant-request` — every real call missed the trunk
  line and got the platform "which business?" prompt even though tenant 22 was wired. My earlier verification
  passed only because I hand-built the payload in the wrong shape — test against the provider's real contract.
  (2) Tools were passed as legacy top-level `assistant.functions`; Vapi's current schema is **`model.tools`**
  with `{type:'function', function:{…}}`, so the model had nothing callable and narrated *"I don't actually have
  a tool visible to call in this turn"* then stalled. *Also shipped:* `tenants.vapi.fallbackNumber` (+ migration
  `20260721_010000`), `syncVapiNumber()` (writes BOTH `server.url` and legacy `serverUrl`, nulls stale
  `assistantId`, validates E.164), `/api/vapi/setup { tenantId }` per-portal sync, capability-menu greeting, and
  portal **pivot** (`business` arg on ask_business + capture_lead). *Verified live:* NCP greeting, both tools,
  briefing preloaded, fallback `+17272564413`, `assistantId` null. `260721`

- **[P2] Consolidate configuration under `/dashboard/settings`** — audited 260721. There is no
  `dashboard/settings/**`; the hub is at **`/dashboard/admin/settings`** (tabs General/Endeavor/AI/Developer,
  writes `tenants.branding|commerce|aiConfig`). Nav is a single source of truth: **`dashboard/nav-config.ts`**.
  *Ranked moves:* (1) `/dashboard/account/integrations` — tenant connector secrets misfiled under a per-USER
  "Account" section → `/settings/integrations`; (2) `/dashboard/admin/settings` → `/dashboard/settings` (+redirect);
  (3) `/dashboard/spaces/settings` → `/settings/spaces`; (4) `/dashboard/availability` (booking config in
  PRODUCTIVITY nav) → `/settings/availability`; (5) split the Stripe-Connect config half out of
  `/dashboard/admin/payments`, leave charts as ops; (6) fold `/dashboard/account/connections` into `/account`
  (pure duplicate); (7) `site-settings` global has **no dashboard UI at all** → new tab. *Stay put:* account
  profile/addresses (per-user), team/invitations/crew (people ops), provision/backups/federation (platform ops),
  ai-costs/solvency/telemetry (observability). `260721`
- **[P2] Rename "AI Costs" → "Infrastructure Costs"; "AI Bus" → "System Bus"** — no new substrate needed: the
  **`cost-events`** collection already has categories `intelligence | telephony | storage | infra | other`, and
  `AICostsPanel` already renders Storage/Infrastructure labels. *Where:* route `/dashboard/ai-costs`
  (`ai-costs/page.tsx`, `AICostsPanel.tsx`, `ProviderSwitchboard.tsx`, `BootstrapFeeCard.tsx`) + nav entry in
  `nav-config.ts`. *"AI Bus" UI strings:* `ConnectorsAdmin.tsx:165,170`, `FederationDashboard.tsx:229`,
  `VerifyOnboardingButton.tsx:29,30,50`, `CICDashboard.tsx:355` (nav-config:82 is only a comment). `260721`

- **[✅ SHIPPED 260720] Phone assistant can now actually answer questions (site-content RAG)** — first live call
  routed fine but was useless: LEO's bridge **never fired once** (logs: zero `conversation-update`), because the
  Vapi assistant config had **no `serverMessages` subscription and no `functions`** — it had no way to reach the
  platform, so it truthfully said "I don't have details on file", then promised a transfer it cannot perform.
  Root gap: LEO had `query_posts` / `query_knowledge` (MediaMeta only) but **nothing that reads Pages** — where a
  business's actual copy lives. *Shipped:* new `query_site_content` tool (flattens lexical richText out of layout
  blocks, keyword-ranked; in READ_ONLY_TOOLS + CORE_TOOL_NAMES so cheap providers get it); `ask_business` function
  + `serverMessages` on both platform & tenant assistant configs; function-call resolves tenant from the
  `business` param FIRST (a function-call payload has no `conversation` array, so it was defaulting to the
  **platform** tenant and searching the wrong business); prompts no longer offer transfers. *Verified:* real PLMT
  answer in **2.9s**, honest "not on our website" fallback, served by gemini-flash-lite. `260720`
- **[P2] Proposal pages are publicly readable — and now voice-readable** — `proposal`, `proposal-campaign`,
  `proposal-research` are Ken→David pitch docs (incl. positioning/pricing) published on tenant 22, so
  `query_site_content` can recite them to any caller. *Next:* scope pitch docs out of public/RAG surface
  (unpublish, a `noindex`-style flag, or exclude by slug prefix). `260720`

- **[✅ FIXED 260720] VAPI voice (LEO on the phone) working end-to-end** — was broken by TWO things:
  (1) the Vapi phone number `+1 727-440-8797` (`a20b5a0d-8d79-41f5-9173-5091314ffc4f`) had `serverUrl` pointing
  at the dead `www.spacesangels.com` node → repointed to `https://www.payloadnuke.com/api/vapi/webhook`;
  (2) LEO returned the "AI capabilities are warming up" canned fallback because the default provider order
  reached for **google** with no GOOGLE/GEMINI key set, while `AI_GATEWAY_API_KEY` + `OPENROUTER_API_KEY` were
  set. Fixed in stack compose (NOT a git repo — recorded here): `AI_PROVIDER_ORDER: "gateway,openrouter,ollama"`
  and `OLLAMA_BASE_URL: "http://host.docker.internal:11434"` + `extra_hosts: host.docker.internal:host-gateway`
  (closes the long-standing "container Ollama fallback DEAD" note). Verified: assistant-request returns a valid
  LEO config; conversation-update returns a real AI answer. *Remaining:* Ken places a live test call.
  ⚠️ **Vapi has TWO server fields — `server.url` is authoritative, `serverUrl` is legacy/deprecated.** Patching
  only `serverUrl` changes nothing for live calls: Vapi read `server.url` (still the dead spacesangels node),
  timed out at 20s, and forwarded to `fallbackDestination` (+1 727-256-4413). Also cleared a **dangling
  `assistantId`** (`e9675026-…`) that pointed at a non-existent assistant (account has 0 stored assistants) —
  with it set, Vapi never sends `assistant-request` to our webhook. Now: `server.url` = payloadnuke webhook,
  `timeoutSeconds` 20→30, `assistantId` null, fallback preserved. Webhook latency measured **0.17–0.19s**.
  *Note:* `conversation-update` returning `{ok:true}` is BY DESIGN — Vapi's own assistant handles the
  greeting/routing turn until the caller names a business; only then does the tenant resolve and LEO take over.
  *Optional:* set `VAPI_PHONE_NUMBER_ID` in compose so `/api/vapi/setup` works (repoint was a direct API PATCH).
  `260720`
- **[✅ FIXED 260720] LEO now runs on Gemini (~10x cheaper than the metered Anthropic gateway)** — the gateway
  reads **`GOOGLE_AI_API_KEY`** (NOT `GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_API_KEY` — checking the wrong
  name made it look unset); the key was in `.env.local` and valid all along. The real defect: the default
  `gemini-flash-latest` is a **THINKING model** — reasoning consumes the whole token budget and returns
  **EMPTY content**, so LEO emitted its "warming up" fallback (this is the [[project_leo_empty_response]]
  class of bug). *Fix (compose env, recreate only — no rebuild):* `AI_PROVIDER_ORDER: "google,gateway,openrouter,ollama"`
  + `GOOGLE_MODEL: "gemini-flash-lite-latest"`. Verified: LEO returns real answers and uses tools; gateway
  credit balance held at $13.96 (no longer consumed). Note `gemini-2.0-flash` / `2.5-flash` **404 on this key**
  — flash-lite / flash-latest / 3.5-flash are available. Gateway+openrouter remain paid failover. `260720`

- **[✅ FIXED 260720] Ecommerce cross-portal leak** — shipped: `tenantScope.ts` override (tenant field +
  tenant-on-write from request host + tenant-ANDed read, fail-open) wired as carts/addresses/transactions
  overrides; migration `20260720_030000` added `tenant_id` FK+index. *Verified live:* new cart got
  `tenant_id=5` on clearwater, add-to-cart + cart read ("Max in cart") + checkout ($40 total) all working.
  Pre-existing rows stay NULL by design. Original analysis below for reference.
- **[P2] Shop category filter leaked every tenant's categories — FIX STAGED** — `Categories.tsx:12` did an
  unfiltered `payload.find`; Clearwater's categories showed on the NeuroCare Pro shop. Now filtered by resolved
  tenant; awaiting next rebuild. `260720`
- **[~~P1~~ superseded, see FIXED above] Ecommerce collections leak across portals (`carts`, `addresses`, `transactions`)** — none are in the
  `multiTenantPlugin` map (`payload.config.ts:452-516`); plugin config (`src/plugins/index.ts:104-130`) only
  overrides `orders`+`products`. So they have NO tenant field and follow an SSO'd user across every portal:
  - `carts` — surfaced via Users `cart` join (`Users/index.ts:401-406`); tenant A's cart shows on tenant B. LEO
    cart tools read/write `userDoc.cart.items` with no tenant (`leo-data-tools.ts:5388-5437`). HIGH.
  - `addresses` — Users `addresses` join (`Users/index.ts:411-417`); saved shipping PII identical on every
    portal. HIGH (PII).
  - `transactions` — Stripe adapter writes no tenant (`angel-os-stripe-adapter.ts:308-312,364-368`); admin
    payments page filters by a non-existent `tenant` field (`dashboard/admin/payments/page.tsx:46-49`) so it's
    silently ineffective. MEDIUM-HIGH (financial).
  *Fix:* add all three to `multiTenantPlugin` → **schema migration** (`tenant_id` columns) + set tenant on write
  (cart/address create from request host; transaction from the order's tenant). Own careful build; verify
  add-to-cart + checkout after. Cart id is localStorage (per-subdomain) so the leak is purely server-side.
  *Also audit* (tenant field already present, confirm access filters): `services`, `memberships`, `wallets`,
  `token-ledger`, `signatures`, `agent-transactions`, `works`. `260720`
- **[P2] Link-editor tenant filter — STAGED, not deployed** — filterOptions on the rich-text LinkFeature + block
  link field scopes the page picker to the editing doc's tenant; awaiting next Core rebuild. `260720`
- **[P2] White-label nav hides** — hide root **Learn** + **Works** nav links per-tenant; Ken thinks the toggle
  belongs on the Endeavor/settings tab. Deferred (not in the pending rebuild batch). `260720`

- **[P1] Login-killing DB jam (idle-in-tx holding a lock)** — a transaction opened, `select`ed media, then sat
  `idle in transaction` ~23min holding a lock; a cascade of `insert into users` (Google login find-or-create,
  retried) blocked behind it and exhausted Core's pg pool → *every* query timed out (`timeout exceeded when
  trying to connect`), breaking BOTH password + Google login. *Mitigated:* `ALTER DATABASE angels SET
  idle_in_transaction_session_timeout='60s'` (auto-kills abandoned tx). *Root cause still open:* a transaction
  held open across an await leaks — find & fix the user-create/media path. Also fold the timeout into the stack
  compose PG config so a fresh volume keeps it. [[project_provisioning_transaction_fragility]]. `260720`

- **[P2] Node hardening 260718** — CORS commit NOT pushed (touches kendev/spacesangels); federation peers
  from DB; AI resilience = one `providerHealth` breaker. [[project_node_hardening_260718]]. `260719`
- **[P2] Container `payload run` can't resolve `@payload-config`** in the pruned prod image — blocks
  in-container one-off scripts via that path (worked around by top-level-await scripts). *Next:* note or fix the alias for `payload run`. `260720`
- **[P2] MEMORY.md near size cap** — wants a compaction pass (`consolidate-memory` skill). `260719`
- **[P2] `heros/config.ts` is a stale duplicate** of `fields/hero.ts` (the live one). *Next:* delete or
  reconcile. `260720`

## 🚢 Deploy / ops (P1–P2)

- **[P1] Merlin ↔ Core :3000 port collision (Merlin DOWN / CF 530)** — the self-host Core Docker container now
  holds host `:3000`, the same port Merlin's interactive scheduled task binds (`next start -p 3000`), so
  `merlin.payloadnuke.com` hits Core (or a stale node), not Merlin. *Fix:* Core (prod) keeps `:3000`; move Merlin
  to a free port (e.g. `:3002`) — update `package.json` start, the `Merlin` scheduled task command,
  `refresh-merlin.ps1`'s `:3000` refs, and the cloudflared ingress for `merlin.payloadnuke.com`. Needs Ken's OK
  (touches the tunnel + task; may need elevation). `260720`

- **[P1] payloadnuke.com → Railway** — stabilize builds first, then migrate the self-host node to Railway Pro
  (~$20/mo). Pre-deploy checklist + post-restore `db-repair-sequences` documented. *Where:* `docs/DEPLOY_RAILWAY.md`. [[project_railway_migration]]. `260720`
- **[P2] Merlin node DOWN (CF 530)** — search proxy Merlin-side `/api/search` pending; MerlinControl media-link
  fix. [[project_merlin_thin_client_rewire]]. `260719`
- **[P2] Unmerged branches awaiting Ken review** — `feat/onboarding-reception`, `feat/active-endeavor-switch`
  (ready to merge), `feat/bookable-inventory`. `260719`

---

## ✅ Recently closed (last 7 days)

- **[P1 260825] `/learn/holy-bible` was a 9.65 MB page — now 205 KB** — the book reader flips pages
  client-side, so the server serialized EVERY page in EVERY language into the HTML: 1,189 chapters ×
  2 translations, to display chapter one. It now sends a window of ONE language around the opening
  page and fetches the rest in 24-page chunks from `GET /api/works-ops/text` as the reader moves.
  A book of any length opens at the speed of a pamphlet. ⚠️ The DATABASE still reads every chapter
  row per request — that is the messages-as-storage tax, and `work-chapters` is what removes it.
  *Where:* `utilities/workTextWindow.ts`, `endpoints/work-text.ts`, `components/Library/BookReader.tsx`.
  `260825`
- **[P1 260825] The Works catalog is editable in the admin** — `tags`, `links` and `canonical` were
  `json`, so Payload rendered them as raw JSON textareas; that is most of why there was no usable
  Works editor. They are now array fields and a group. The plumbing (`subscribers`, `optOuts`,
  `storageRef`, `content`, `checksum`) stays JSON in a collapsed *Storage & federation* section —
  availability already has a better surface at `/dashboard/works`, one checkbox per portal.
  Array table shape was copied from a Payload-GENERATED table (`products_gallery`) rather than
  invented, per the never-hand-roll-array-tables rule, and the migration was **dry-run against the
  live database inside a rolled-back transaction** before shipping: 29 tags, 2 links, 4 canonical
  records land exactly as the JSON held them. `slug` is now UNIQUE. The registry absorbs the shape
  change (`tagList`/`linkList`), so `/api/works-ops/get` returns byte-identical JSON and no consumer
  changed. **Deleted `ensure-works-table`** — it predates migrations-on-boot and would now create a
  table shape the config no longer matches, which is worse than not existing.
  *Where:* `collections/Works/index.ts`, `works/availability.ts`, `20260825_170000_works_editable_fields`.
  `260825`

- **[P1 260825] The LMS layer — a course is a Work, a quiz is a segment** — shipped in two slices,
  live on Railway, zero new collections. `works.type` gained `course` and `works.content` (one jsonb
  column) holds `{ modules: [{ title, lessons: [{ title, video?, body? }] }] }`. A quiz is a
  ```quiz fence in markdown carrying `{ question, options, answerIndex, explanation? }` — so the same
  quiz renders in the reader (`SoulViewer`'s markdown `code` renderer), inside a course lesson, and
  through the `<WorkQuiz work chapter>` page block, which reads the SAME fence out of the chapter so a
  quiz can never have two versions. A submitted attempt is a **Message in the learner's LEO DM**,
  score in `metadata` — no gradebook table, and LEO can raise it unprompted.
  `<CoursePlayer>` (rail + video + body + progress) and `<CourseStudio>` (reorder, upload, write)
  are page blocks; progress is the EXISTING `workProgress` map (`chapterIdx` = module, `segIdx` =
  lesson), and entitlement is the EXISTING page-level membership gating. Deliberately skipped:
  gradebook, certificates, pass/fail gating, server-side scoring, Mux.
  *Where:* `utilities/workQuiz.ts`, `utilities/courseContent.ts`, `endpoints/work-quiz-attempt.ts`,
  `endpoints/work-content.ts`, `blocks/{WorkQuiz,CoursePlayer,CourseStudio}`,
  `20260825_140000_work_quiz_block`, `_150000_works_course_content`, `_160000_course_blocks`.
  `8556db0` + `7d7939e`. `260825`
- **[P1 260825] Portal quota by plan** — any signed-in account could provision unlimited portals
  (Ken has 17 and nothing stopped an eighteenth, or a script's ten-thousandth). Enforced in ONE
  place — `provisionPortal`, which the claim flow, demo-site and the LEO create-portal tool all
  funnel through — and SKIPPED when the target slug already exists, so idempotent re-provisioning
  of a portal you already hold is still a repair, not a new portal. Allowance is a map in
  `portalPlan.ts` (free 1, site 3, business 10, demo 100), and a person's quota is the best plan
  among the portals they already admin; `super_admin` bypasses, which is exactly why it ships with
  a test rather than a manual check. The `/get-started` banner now says "3 of 10 on your plan".
  *Where:* `utilities/portalQuota.ts`, `utilities/portalPlan.ts`, `tests/unit/portalQuota.test.ts`.
  `260825`
- **[P2 260825] LEO's reply in a visitor channel had no author** — `resolveLeoUserId` looked up
  `leo-{slug}@…` only, and the widget sends no `x-tenant-id`, so the slug it resolved was often a
  portal that never minted a LEO — the reply persisted with `author_id NULL` and read as authorless
  in the portal owner's view. Falls back to any system LEO now. *Where:* `endpoints/leo-chat.ts`.
  `260825`

- **[P1 260824] Anonymous visitor sessions are finished and verified live** — the server half had
  shipped inert: it would persist a visitor conversation IF a client sent a transcript, and no
  client did. `GuestChatBubble` now POSTs its prior turns as `history` (minus the canned greeting,
  so the channel still waits for message TWO) and shows `VISITOR_DISCLOSURE` above the input.
  The real prize is memory: LEO's context comes from READING the Messages table, so guest turns
  going unpersisted meant every message was message one. Proven live on WDEG — "Do you rent the
  hall on weekends?" then "How much?" answered *$150/hr, 3-hour minimum* instead of a non-sequitur.
  Claim-on-signup is a Users `afterChange` hook (six doors lead to a new user; a per-endpoint call
  would skip four): reads the cookie off `req.headers`, moves the whole pre-signup thread into the
  new LEO DM. Verified: four turns landed in `dm-167-leo` with both `channel` AND `channelRef`
  rewritten and the visitor turns attributed. TTL sweep is a Payload job (`visitor-sweep`, 04:45),
  the one scheduled task that is not an endpoint.
  ⚠️ **Two transaction bugs, both found by re-querying rather than by reading a return value.**
  (a) The claim failed on EVERY sign-up — `findOrCreateDM` used `getLocalPayload()`, a second
  connection that cannot see the uncommitted user row, so the members insert died on
  `channels_rels.users_id`. It takes an optional `req` now. (b) The post-delete verification read
  outside the transaction, saw the pre-commit row, and warned about a delete that worked. Verify by
  re-querying — *on the same connection*.
  *Where:* `src/utilities/visitorSession.ts`, `visitorChannels.ts`,
  `src/collections/Users/hooks/claimVisitorConversation.ts`, `src/jobs/cronTasks.ts`,
  `tests/unit/visitorSessions.test.ts`. `260824`

- **[P1 260824] Two people on a video call overflowed the frame** — every `LiveKitRoom` carried
  `style={{ height: '100%' }}` on a `flex-1` child, which resolves against the WHOLE parent and
  then sits below the header, so the grid was taller than its box and you scrolled to see the
  second participant. `min-h-0` the whole way down, no `height: 100%` anywhere; the grid tiles to
  fit the box it is actually given. *Where:* `src/components/ChatControl/LiveKitRoom.tsx`. `260824`

- **[P1 260824] No DM had ever loaded its history** — `loadMessages` gates on the active channel
  being RESOLVED (a deep-link URL carries a channel ID, `Messages.channel` stores a slug), but it
  tested `channels`, which only holds the ACTIVE SPACE's channels. A DM lives in the AI Bus, so
  every DM slug failed the gate and returned before fetching. It read as "messages vanish when I
  navigate back" only because sending still worked — that path appends locally and LEO answers over
  the stream, so the moments after a send were the only time a DM looked healthy. `useChat` now
  takes `dmSlugs`; the predicate is extracted as `canQueryMessages` and tested directly, including
  the unresolved-numeric-id case the gate exists for. `canQueryMessages.test.ts` `260824`

- **[P1 260824] A DM opened from one portal was invisible from another** — `ChatProvider` loaded
  the DM list with `where[tenant][equals]` under a comment claiming the query was global. A DM
  carries the tenant it was MINTED in, so a thread started from Clearwater stamped tenant 5 and the
  other person, sitting in WDEG, asked for tenant 11 and got nothing. LEO still appeared, which is
  what made it look like permissions — the LEO thread resolves via find-or-create, which was already
  global. The server had made this call three times over (`findOrCreateDM` global lookup, channels
  `useTenantAccess: false`, `buildChannelReadFilter`'s DM branch has no tenant clause); only the
  client hadn't. Also: DM rows are stored with a symmetric name, so everyone read their own name
  back — `dmLabel` names a thread after whoever ISN'T you, and its fallback ladder splits the stored
  name, which means it works even where `Users.read` hides the peer. Presence moved onto the icon so
  it survives a collapsed panel. `dmLabel.test.ts` `260824`

- **[P0 260824] The event page threw away content already in the database** — `description` is
  richText and the page rendered the literal string "Event description available in admin." on the
  public site; `gallery` and `videoEmbed` rendered nowhere. The gallery's categories
  (venue/speaker/promo/recap/sponsor) were designed for the come-back-later archive and had no
  renderer. Now ordered by category and flipped on `isPast`. `9ddf7bc` `260824`
- **[P1 260824] Past events never became past** — `status` was a manual dropdown nothing ever
  moved, so "Past Events" only filled if someone remembered. Hourly sweep, two-hour grace so an
  event running over is not closed under it. `events-complete-cron.ts`, 5 tests. `9ddf7bc` `260824`
- **[P1 260824] Events ↔ products, a thread, and a QR that can point at the event** — no
  association existed at all, so "what did we sell at that market?" was unanswerable. A
  relationship, not a block (a block buries the link where nothing can query it). `eventPrice` in
  DOLLARS matching `priceInUSD`, and NOT a discount engine — coupons are a checkout concern and stay
  there (Ken's 260824 call). Comments gained `events` as a polymorphic parent; every event renders
  the thread natively rather than depending on a block being placed. `/kiosk/qr?event=…&target=page`
  now points at the event page instead of only the shop. `cf79d76` `260824`
- **[P1 260824] Events got a `layout` blocks field** — Content, Media, Gallery; three, not the
  twenty-five Pages offers, because each block is a hand-written table and this repo grows them one
  at a time. ⚠️ `events_rels` was written by analogy with Pages and missed `events_id`, which
  `fields/link.ts` requires — that made the whole collection unreadable, caught by round-tripping
  against live BEFORE the config shipped. Fixed in a second migration file, never an edit to the
  applied one. `260824`

- **[P0 260823] Joining a portal put you in no room** — `membership-ops/checkout` wrote a `memberships`
  row and stopped. Membership was a billing fact with nothing attached: a new member landed on an empty
  Spaces list. A `Memberships` afterChange hook now calls `ensureTenantMembership`, whose active
  tenant-membership fires `autoJoinSpaces` — one wire, no second enrollment path, idempotent so the
  Stripe renewal write is harmless. Covers the free path AND the webhook path. `joinTenantOnMembership.test.ts`.
  `260823`
- **[P0 260823] The only tool that creates plans refused a free one** — `create_membership_plan` rejected
  `amountUsd <= 0` while `membership-checkout` carries a complete free-plan path (no Stripe, no card,
  writes the Membership directly). So the free tier existed in the engine and was unreachable from
  anywhere but hand-editing the settings bag. Now `< 0`. `src/utilities/leo-data-tools.ts` `260823`
- **[P1 260823] WDEG has one community, one room, and a free door** — spaces 40 "Community Hub" folded
  into 34 "Community" (the `is_main` town square) via `space-ops/delete`; `general` folded into `main`;
  24 messages, all with `channelRef`. Free "Reader" plan created, `/join` page published, nav rebuilt to
  Home · Read · Community · Join · Shop · Donate. `src/scripts/_local/wdeg-community.ts`,
  `wdeg-join-page.ts` `260823`

- **[SEC 260822] Visiting a portal stopped granting rights over it** — enrol-on-arrival made every
  signed-in visitor an active `tenant_member` of any portal whose page they loaded, and
  `syncUserTenants` copied that into `users.tenants` regardless of role. Five places authorized off
  that array: a stranger could delete a shop's products and list/accept/fulfil/ship its orders
  (`orders-vendor` runs `overrideAccess` and returns customer names and addresses), and the
  integrations page handed over another portal's connector secrets. All now resolve the role from
  `tenant-memberships` via `managedTenantIds()`. `noRoleBlindTenantAuth.test.ts` fails on any new
  file reading `user.tenants`. [[project_portal_manager_access]] `260822`
- **[P0 260822] A portal owner can edit their own portal** — content writes were `adminOnly`, a
  PLATFORM role no tenant_admin holds, and nine dashboard screens link into `/admin/collections/...`.
  Every invited owner hit "You are not allowed to access this page" on their first Edit click.
  Posts, Pages and TenantMemberships now accept a portal manager, scoped by role;
  `enforceManagedTenant` runs at beforeValidate AND beforeChange. `260822`
- **[P0 260822] Comments were impossible platform-wide** — `/api/comments/add` was shadowed by
  Payload's own REST routes for the `comments` collection, so the handler was never reached. Moved to
  `/api/comment-ops/add`; `/media/analyze` was dead the same way. `endpointCollectionCollision.test.ts`
  now enforces the rule that was written down and unenforced. `260822`
- **[P0 260822] The admin create view rendered blank** — `hero_scrim` landed on `pages`/`posts` but not
  `_pages_v`/`_posts_v`; the create view autosaves on open and that insert died, so the page showed
  nothing at all. Every page and post draft save failed 13:32–16:37. `versionedColumnParity.test.ts`
  now catches the class. [[project_frozen_migration_rule]] `260822`
- **[P1 260822] PMs between people work** — the whole path existed (pair slug, endpoint,
  membership-grained read filter, `openDM`); nothing ever called it with two humans and the roster had
  no button. Added the button; `openDM` no longer requires a preloaded `dmSpaceId`, which was breaking
  every FIRST message. Seven empty DM artifacts deleted. `260823`
- **[P1 260822] Core runs through PgBouncer** — moved US East -> US West to sit with Core and Postgres,
  `DATABASE_URI` switched, `DATABASE_SSL` -> `disable` (the bouncer has no TLS). Postgres holds ~5
  backends instead of Core's whole pool, so `max_connections=100` is no longer the portal ceiling. `260822`
- **[P1 260823] Settings stopped losing your logo** — the tab bar unmounts the form, so returning
  re-initialised every field from the pre-save server props. `router.refresh()` after save. A tenant
  save now also busts the header/footer cache tags, which held a populated COPY of the tenant. `260823`
- **[P1 260823] Archive block is findable and fits the row** — relabelled "Featured Posts & Products"
  (it was called "Archive", so nobody looking for featured posts found it), added the `columns`
  control, and added `featuredPosts` to `pages-from-spec` so provisioning and LEO can place one. `260823`
- **[P1 260823] Booking fee capped at $9.99** — `feeCents` applies `MAX_PLATFORM_FEE_CENTS` inside the
  one function that defines the platform's cut, so no future caller can take an uncapped percentage.
  Rate stays 5% and runtime-configurable. `260823`

- **Image-only channel messages** — parse attachments before the empty-message guard; image with no text now analyzes — `32a3a89`. `260723`
- **Vapi end-of-call → cost ledger + Contact call log** — telephony cost-events row + call metrics/transcript/recording-URL on the matching Contact — `5382358`. `260723`
- **CRM funnel loop** — `invite_member`/accept now advance Contact lead → invited → accepted — `dd8675f`. `260723`
- **Dashboard `ping_received` enum spam** — count real federation-peers instead of a bogus audit action — `ba30db1`. `260723`
- **Google OAuth 500 on non-cookie-domain origins** — fixed invalid `domains contains` query path — `9c9e3c1`. `260722`
- **All-Gemini shift** — Anthropic key disabled; vision/chat fall through to Gemini cleanly. `260722`
- **MediaText block** (two-column text + video, WordPress parity) — `ecfbc9e`; live on the NeuroCare Pro home ("Why PLMT Is Different"). `260720`
- **Full-screen video/image hero** (`fullScreen` hero type, reusable) — `b75416b` + video support. `260720`
- **NeuroCare Pro prospect portal** stood up on payloadnuke with the live video hero. `260720`
- **Reachable self-host portal domains** — provisioned portals now land on `<slug>.payloadnuke.com`, not
  unreachable `.angelos.local` — `9cae15a`. `260720`
- **LEO bubble deep-links to full-width Spaces** + shows space/channel binding — `bf806ec`. `260719`
- **Railway runbook** — pre-deploy checklist + sequence-repair + cost reality — `8cd4be2`. `260719`
- **GoogleReviews block** shipped (config + migration + Products/Posts/Pages). `260719`
