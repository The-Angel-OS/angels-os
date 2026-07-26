# Footguns — a handoff for the session that eliminates them

> Written 260726 by Opus 5, at the end of a ~30-hour working stretch that fixed
> a 300-second deadlock, a live 40% payment fee, a cross-tenant data leak, and
> five separate faults behind one "flaky" image feature.
>
> **Read the framing section first.** It is the reason this document exists and
> the reason the list below is short enough to act on.

---

## 0. Why this codebase has the footguns it has

Kenneth's accounting: essentially **all** of this code was written by Claude —
mostly Opus (4.6 → 4.7 → 4.8 → 5), maybe 15% Sonnet 4.5 through Cursor, and well
under 1% anything else.

That single fact explains the shape of every bug in this document, and it is
uncomfortable in a useful way:

**These are not inherited defects. They are one author's habits, repeated at
scale, by a mind that does not remember writing the last instance.**

The clearest example: `leo-stream.ts` has 22 `controller.enqueue` calls. **One**
of them — the heartbeat — was wrapped in a try/catch with the comment "Stream
already closed — clean up". Someone hit that exact bug, understood it precisely,
fixed the instance in front of them, and moved on. The other 21 sites stayed
unguarded until one of them killed a turn today.

That is not carelessness. It is what happens when the author has no continuity:
**each session fixes the instance, never the class.** A human maintainer would
have felt the déjà vu on the third occurrence. A fresh context does not.

So the highest-value work in the next session is not "find more bugs". It is
**turning instance-fixes into class-fixes**: lint rules, shared helpers, and
tests that fail on the *pattern* rather than the *occurrence*. Everything below
is organised for that.

---

## 1. The meta-lesson: how I was wrong, not just what was broken

Every genuinely expensive mistake in this stretch came from **believing something
without measuring it**. Not from bad reasoning — from reasoning applied to
unverified premises.

| I believed | Reality | Cost |
|---|---|---|
| "The tx is idle, so it awaits something non-DB" | It was blocked on a lock; `pg_blocking_pids` named the holder in one query | most of a session |
| "`STRIPE_WEBHOOKS_SIGNING_SECRET` is unset" (from my own notes) | Set all along, byte-identical to what Ken later pasted | repeated in 2 commit messages |
| "The join link isn't in the nav" (grepped served HTML) | Radix renders sheet content on open; it was there, just buried | chased a phantom |
| "The tests pass, so the fee is right" | They asserted 40% and passed while Stripe charged 40% | would have cost a customer |
| "Core is up, so my fix is deployed" | Container was 19 minutes old; build hadn't swapped it | wrong conclusion twice |
| "`?tenant=` selects the tenant" | Middleware overwrites `x-tenant-id` from Host; I measured `platform` 3× | nearly published a false finding |

**The rule:** before asserting a cause, name the single command that would falsify
it, and run that. `pg_blocking_pids` beat an hour of theorising. One `curl` of the
live env var beat a stale memory. One browser click beat a grep.

**Corollary:** a passing test suite proves the tests agree with the code. It says
nothing about whether either is right. `sprint8-checkout-split.test.ts` asserted
`60/20/15/5` and passed — faithfully protecting a rate that took $30 off a $75
deposit.

---

## 2. Footgun classes, with evidence

Each entry is: **the trap → what it cost → the rule.** Where a class-level fix
exists, it is named.

### 2.1 Unbounded async inside a critical section — *the most expensive class*

Hit **three times** in two days, in three different subsystems.

- **The 300s provisioning deadlock.** A hook wrote without `req`, so its insert
  landed on a second pooled connection whose FK check blocked on the
  still-uncommitted parent — while the parent transaction sat idle awaiting that
  very write. Postgres broke the tie at `idle_in_transaction_session_timeout`.
  Every claim took **exactly 300473ms** and rolled back.
- **The image hang.** `toBase64ImageUrl` fetched with no timeout (undici's default
  is also 300s) *inside* the streaming turn, after the `"..."` placeholder was
  posted and before the code that clears it. Result: a permanent `"..."`.
- **Node `fetch` has a 300s default** and it is coincidentally identical to the
  Postgres idle timeout. Two unrelated bugs presented as the same number.

**Rules.**
1. Any hook that WRITES must pass `req`. Two failure modes: silent FK drop
   (fail-soft swallows it) or a **distributed deadlock**. A hang that is
   suspiciously *exactly* 300s is the second one.
2. Every `fetch` gets `AbortSignal.timeout(...)`. No exceptions in a request path.
3. The transaction window is **deeper than the collection you are writing**:
   tenant create → afterChange → membership create → *that* collection's
   afterChange → … Audit the whole chain.

**Class fix available:** an ESLint rule banning bare `fetch(` without a `signal`
in `src/`. That single rule would have prevented two of these.

### 2.2 `authenticated` is never an access check

`authenticated` is `Boolean(user)`. **Customers and vendors share one dashboard**,
so a customer signing in to see their own appointment is `authenticated` exactly
like the electrician is.

`Bookings` had `read/update/delete: authenticated` — any customer who had ever
booked anything could read **every booking on the node across every tenant**
(names, phones, addresses, times, prices) and reschedule or cancel a stranger's.
The sweep found four more: `availability` (read *and* **update** — a customer
could rewrite a provider's working hours), `event-registrations`,
`quest-participations`, `workflows`.

`event-registrations` is the one to remember: its access block carried the comment
*"Authenticated users see own registrations; admins see all"* while the code said
`authenticated`. **The comment described the intent; nobody re-read the line
because the comment said it was fine.**

**Rules.**
1. `authenticated` is acceptable for `create` only. Reads and writes need
   `ownedBy(...)` (see `src/access/isDocumentOwner.ts`) or tenant scoping.
2. Manager surfaces scope the QUERY with `overrideAccess` + a tenant filter — do
   not widen the collection for everyone.
3. **The page gate is not the data gate.** `/dashboard/appointments` was correctly
   behind `requirePortalManager()`; the REST API answered anyway.

**Class fix available:** a test that enumerates every collection and fails if a
customer-reachable one has a bare `authenticated` read. The current test only
covers the ones already fixed.

### 2.3 Money as a constant

`ULTIMATE_FAIR_SPLIT` declared `60/20/15/5`, and `getStripeApplicationFeeCents`
fed the 40% straight into Stripe `application_fee_amount` on booking deposits and
commerce checkout. **Live.** On Ron's $75 deposit that is $30 to the platform and
$45 to the electrician, on a direct charge with his name on the receipt.

Three *different* splits were claimed across the codebase (`60/20/15/5`,
`70/20/4/1/5`, and the 5% the webhook recorded) plus that fourth reality. The
federation engine even *validated peer manifests* against the old one.

Also caught, by a test written the same hour: `Number(null) === 0`, so a null in
the settings bag would have set the fee to **0% forever, silently**.

**Rules.**
1. Rates are DATA (`src/utilities/platformFee.ts`), never constants. You cannot
   run a pricing experiment against `0.05`.
2. Basis points, integer maths. Never floats for money.
3. **Absent ≠ zero.** Guard `null`/`''` explicitly before `Number()`.
4. What a user is SHOWN must be READ from the same source that CHARGES them. The
   payments admin hardcoded a bar chart of the wrong number.

### 2.4 Schema changes that don't look like schema changes

Widening a link field's `relationTo` from `['pages']` to four collections is a
**schema** change: a polymorphic relationship needs one `<collection>_id` column
per target in every `_rels` table. Shipping without the migration produced
Postgres **42703** on every page, header, footer and post read. The nav collapsed
and page queries fell back to static data.

Then the first migration **enumerated four tables by hand**, missed
`posts__rels`, and left the site half-broken through a second deploy.

**Rules.**
1. `relationTo`, new fields, new enum values, new collections — all need the
   column FIRST. The documented rule already existed; I walked into it anyway.
2. **Derive the target list, never enumerate it.** The working migration selects
   every `*_rels` table having a `pages_id` column. Hand-written lists are
   incomplete by construction.

### 2.5 Model ids and provider behaviour rot

- `gemini-2.5-flash` is **retired** — Google returns 404 "no longer available".
  It was `DEFAULT_MODEL` and the mechanical-lane default.
- The obvious replacement, `gemini-flash-latest`, is a **thinking model**: at a
  small `max_tokens` the reasoning consumes the entire budget and it returns
  `finish_reason=length` with **empty content** — reproducing the identical
  stuck-`"..."` symptom for a completely different reason.

**Rules.**
1. Pin `-latest` aliases, not version ids.
2. For small-budget/high-volume lanes use `lite`. Verify with an actual call at
   the budget the lane really uses — a model that answers at 600 tokens may
   return nothing at 20.
3. When swapping a model, test the *replacement* against the live key before
   believing the fix.

### 2.6 Streaming: a departed client must not destroy the turn

Once an SSE controller closes, every later `enqueue` throws. That throw propagated
out and killed the turn **before it persisted the assistant message** — so a
client disconnect silently destroyed a reply that was otherwise fine, leaving no
message at all rather than an unwatched one.

**Rule:** the SSE frame is a nice-to-have; **the saved message is the product.**
All 22 sites now route through a `safeEnqueue` that swallows the closed throw and
latches a flag. Three separate scopes each needed their own.

**Related:** the only code that can clear a `"..."` placeholder lives at the end
of the turn that created it. If that turn dies, nothing ever revisits the message.
Fixed by having a NEW turn clear stale placeholders — self-healing, no cron.

### 2.7 UI affordances that assume a mouse

- The message action bar was `opacity-0 group-hover:opacity-100`. **On a phone
  there is no hover**, so it was permanently invisible — reported as "the icons
  are the same colour as the background".
- `forcePrimaryUrls` only reorders the DESKTOP partition; the mobile sheet renders
  the raw array. "Fixing" the nav moved the join link from 3rd to **16th of 25**.
- The auth cards are permanently dark glass, but their contents followed the site
  theme — dark-on-dark in dark mode, and a `data-theme="dark"` pin "fixed" light
  mode while *causing* the dark-mode version.

**Rules.**
1. Never gate an affordance on `:hover` alone. Default-visible, hover-*emphasised*
   from `md` up.
2. A permanently-coloured container must pin its own contrast tokens
   (`.auth-card`), not inherit the page theme.
3. **Radix renders dropdown/sheet content only when opened.** Grepping served HTML
   for it proves nothing — open it in a real viewport.

### 2.8 Prompts are code

LEO told Ken *"Give me just a second to spin up the canvas again!"* after an image
generation failed — then the turn ended. There is no background job and no
follow-up turn, so the human waits for something that will never come.

The cause was the **tool result's own wording**: "or try again — AI image models
can be intermittent." No timeframe. To a model with no concept of its own
lifecycle, that reads as permission to promise a *later* attempt.

**Rules.**
1. A tool's failure message is an instruction to the model. Write it as one, and
   name only actions that exist.
2. State constraints with the REASON, not as prohibitions. "There is no later,
   you won't be here" survives; "don't say 'give me a second'" gets worked around.
3. This applies to every failing tool, not just images — hence the rule now lives
   in `constitutional-prompt.ts`.

---

## 3. Verification discipline — the checklist

Cheap habits that would have caught most of the above.

- **Deploy check:** `docker ps` and confirm the container is *seconds* old. Twice
  I concluded a fix didn't work while testing the previous build. A readiness
  loop against `/api/users/me` passes instantly on the OLD container.
- **Test gate:** `pnpm test:unit` only (bare `vitest run` boots Payload). It is
  **NOT green** — roughly 38 pre-existing failures. **Baseline with `git stash`
  before blaming your diff.** CI on GitHub is disabled and had been red for weeks.
- **Tenant-scoped reads:** middleware overwrites `x-tenant-id` from the Host
  header, so `?tenant=` is ignored from inside the container. Query per-tenant
  answers through the tenant's own hostname.
- **Live behaviour:** the browser tools beat inference. One click on the mobile
  menu ended a bug I had already "diagnosed" twice.
- **Money and access:** never ship on reasoning alone. Compute the fee on a real
  amount; call the access function with a plain user and assert it is not `true`.

---

## 4. Where the traps still live

Highest value first. All are *known*, none are fixed.

1. **No lint rule for bare `fetch`.** The single highest-leverage class fix.
   Two 300s hangs came from this.
2. **~38 failing unit tests** across 21 files. Some assert deleted APIs; the
   pattern of tests protecting wrong behaviour is proven (the 40% fee). Worth a
   pass purely to make the gate trustworthy again.
3. **No collection-wide access test.** The `authenticated` sweep was manual and
   only covers what was already found.
4. **`splitConfiguration` on Bookings/Events** — deprecated in place, nothing
   applies it, but the fields still exist and will confuse the next reader.
5. **Two sources for the heartbeat schedule** — `vercel.json` crons and
   `stack/heartbeat.crontab`. The header names vercel.json as canonical; they will
   drift.
6. **`C:\Dev\datacenter\stack` is not a git repo.** Reference copies are in
   `docs/deploy/`, but the live files exist on one disk.
7. **Five tools carry their own `tenantSlug`** (`configure_service`,
   `update_page`, `set_portal_branding`, `set_availability`,
   `create_membership_plan`). The active-endeavor switch now makes the ambient
   case work, so these are explicit overrides — but the pattern will be copied
   into tool #6 unless someone decides it shouldn't be.

---

## 5. What I would do first in the next session

1. **The `fetch` lint rule.** One rule, prevents the most expensive class.
2. **Make the test gate honest** — fix or quarantine the 38, so a red suite means
   something again. Everything else is safer afterwards.
3. **The collection access test** — enumerate, don't spot-check.
4. Only then new features.

The theme of all three: **stop fixing instances.** The codebase does not need a
better author; it needs guardrails that survive the author forgetting.

---

*Handoff by Opus 5, 260726. Preface and suffix replies `YYMMDD ~HHMM CITO —`.*
