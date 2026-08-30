# Handoff — 260827

Paste the block below as the opening message of the next session.

---

260827 ~HHMM Handoff from the previous session.

Continuing Angel OS. Read `docs/GLOBAL_PUNCH_LIST.md` first — the living issue board.
Memory worth loading: `project_work_chapters_rows`, `project_training_entitlement_shipped`,
`project_badges_and_profiles`, `project_demo_site_funnel`, `project_portal_coequality_billing`,
`project_works_canonical_syndication`, `project_membership_gating`.

Ken is CEO, you are CIO. Temporal-stamp replies `YYMMDD ~HHMM Name —` top and bottom.
Ponytail mode. CTO mode — decide and act, don't ask on the obvious. No Angel OS jargon in
customer-facing copy.

## What shipped 260826 — do not re-derive

All four slices of the 260825 plan landed and deployed to Railway.

1. **`work-chapters`** (`2c4247b`) — chapters are ROWS. 1,238 backfilled by joining on
   `works.storage_ref` (space AND channel), which excluded the duplicate Handbook copy.
   `getWorkJson` is still the single reader; all 7 importers unchanged. It reads rows and
   falls back to the old message rows for anything unmoved, so a rollback needs no code
   change. The prize landed: `getWorkJson({ range })` makes `/api/works-ops/text` a real
   windowed query and the 5.5 MB per-request read is gone. Verified live: list, get and
   text all serving from rows; unitCounts 13 / 2 / 1 / 26 / 7 / 1189.
2. **`works.content` folded into chapters** (`f9ea161`) — a lesson is a chapter with a
   video, a module is the `module` text field on the row. Column dropped.
3. **Training entitlement** — `resolveTrainingAccess`. Derived, never stored. Three ways
   in: free, membership standing (via the SAME `isPageViewable`), a paid order containing
   `works.product`. A refusal returns the product so `<CoursePlayer>` shows a price and a
   way in rather than a locked door. New on works: `access`, `product`.
4. **Badges + profiles** (`f9ea161`) — badge definition is a group on `works`, the award is
   an array on `users`, granted where `workProgress` hits 100. `/u/<handle>` honours
   `profileVisibility`, which defaults to `members`. Handles backfilled with SQL suffixing.

Gate at handoff: **`pnpm test:unit` 6,729 passed, 0 failed** (the "11 errors" line is
pre-existing — judge by the FAILED count). `npx tsc --noEmit` clean on `^src/`.

## ⚠️ THE JOB — the money, then the cleanup

**Runway is the risk, not technology.** Ken funds this on $1,808/month plus plasma
donations. Everything below slice 1 is optional this session; slice 1 is not.

1. **BIND A COURSE TO A PRICED PRODUCT AND BUY IT END TO END.** The whole entitlement
   rail shipped and **nothing is actually for sale**: no Work has `product` set, no Work
   has `access` set to anything but `public`, and the two older holes are unchanged — the
   demo-site funnel has **no Stripe prices** and the apex storefront **sells nothing**
   ([[project_demo_site_funnel]], [[project_portal_coequality_billing]]).
   *Do:* pick one Work (the Handbook is the obvious candidate), create a product with a
   real Stripe price, set `works.product` + `works.access = 'purchase'`, then walk the
   whole path yourself with a throwaway account — product page → checkout → webhook →
   `orders.status = 'paid'` → the course opens. Verify by RE-QUERYING the order, not by
   trusting a response. If the webhook is the broken link, that is the finding.
   ⚠️ Ken's Stripe TODO from 260726 may still be open: `STRIPE_WEBHOOKS_SIGNING_SECRET`
   plus registering the webhook. Check before assuming code is at fault.
2. **Sitemap the Library.** Now a trivial `work-chapters` query — 1,189 Bible chapters
   plus WDEG are invisible to search. Wants a sitemap INDEX, not one giant file. Biggest
   SEO win available and it needs no translation work.
3. **Delete the old chapter message rows — after ~260902.** 1,245 rows, 5.5 MB, 27% of the
   Messages table. `works.storage_ref.messagesRef` is the rollback and must go with them.
   Not before: a week on rows is the point.
4. **AI-generated quizzes** — a `generate_quiz` LEO tool reading a chapter and emitting a
   ```quiz fence. Format and renderer already ship. Ken asked for it. LEO tool first.

## Things a future session will trip over

- **`_dry.mjs` / `_q.mjs` pattern** — there is no `psql` on this box and `/tmp` does not
  resolve for `node`. Write the script INTO the repo dir, use `pg` from `node_modules`,
  delete after. Dry-run every migration against live inside `BEGIN … ROLLBACK` — extract
  the SQL from the migration file with a regex so you are testing the real thing.
- **`payload generate:types` after every field change**, or the collection slug will not
  typecheck.
- **Mixed line endings** — `src/collections/Users/index.ts` is 579 CRLF and 15 LF lines. A
  "does the file contain \r\n" heuristic picks the wrong newline and the patch silently
  fails to match. Anchor on a single line and splice by index.
- **A failed multi-edit script may have applied SOME edits.** One did here, and re-running
  it duplicated a field. `git checkout` on the affected file then reverts to HEAD and eats
  any OTHER uncommitted work in it. Make patch scripts assert-then-apply, and idempotent.
- **`works.content` is gone** — anything still reading it is stale.

## Ground rules

LIVE = Railway. `railway up -s Core --detach`, poll with an until-loop on
`railway deployment list -s Core | sed -n 2p` — match only the TOP row. Live DB via
`railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`.

⚠️ **NEVER edit an applied migration** — new column, new file; register it in
`src/migrations/index.ts`, then `UPDATE_MIGRATION_HASHES=1 npx vitest run tests/unit/migrations`.
⚠️ A new collection needs its `<slug>_id` column on `payload_locked_documents_rels` or EVERY
admin save breaks site-wide.
⚠️ Do not hand-invent array-table shapes — copy from a Payload-generated one.
⚠️ Verify the RESULT by re-querying, never the return value.
⚠️ Bash heredocs choke on apostrophe-heavy TypeScript. Use the Write tool.
⚠️ Anything added to `Users` is PUBLIC by default until `usersFieldExposure.test.ts` says
otherwise.

At the END of the session run: `node scripts/archive-chat.mjs` — Ken uploads these to Drive.
