# Handoff — 260825 evening

Paste the block below as the opening message of the next session.

---

260825 ~1520 Handoff from the previous session.

Continuing Angel OS. Read `docs/GLOBAL_PUNCH_LIST.md` first — the living issue board.
Memory files worth loading: `project_course_is_a_work`, `project_works_canonical_syndication`,
`project_reader_reference_layer`, `project_membership_gating`, `project_users_directory_read`,
`project_identity_profile_friends`, `project_works_wip_status`.

Ken is CEO, you are CIO. Temporal-stamp replies `YYMMDD ~HHMM Name —` top and bottom.
Ponytail mode. CTO mode — decide and act, don't ask on the obvious. No Angel OS jargon
in customer-facing copy.

## The job

Four things, in this order. **Slice 1 is a session on its own** — do not start slice 2
until the reader has been running on rows.

1. **`work-chapters`** — give Works chapters a real collection, so there is an editor.
2. **Fold `works.content`** into chapters. Free today, expensive later.
3. **Buying / signing up for a training** — one derived entitlement, three ways in.
4. **Badges, and a profile to put them on.**

---

## The premise, decided 260825 — do not re-litigate

A course is a Work. A quiz is a segment. **Chapters belong in their own collection.**

That last one is new and it is not a reversal. `docs/planning/WORKS_AS_JSON.md` always
said storage-of-record is swappable behind the JSON contract — *"files (today), DB rows,
or messages"*. Messages was the expedient. Rows is the design working as intended. The
interchange format, the checksum, and federation gossip are **untouched**.

What is still true and still forbidden: no `courses`, `modules`, `lessons`, or
`enrollments` collections. If you reach for one, the answer is a field on `works`, a
field on `work-chapters`, or a derived check.

---

## Slice 1 — `work-chapters`

### Why (the evidence, already gathered — don't re-measure)

A chapter is a `messages` row with `metadata.kind = 'work_chapter'`, filed under a
`channel` **string**. There are **zero `work-*` rows in `channels`**, so every chapter's
`channelRef` is null and the channel it claims to live in does not exist. Consequences,
all live:

- **No editor.** Payload gives you an editor per COLLECTION. Chapters have none, so the
  best you can do is edit raw JSON in a chat message's metadata box. This is the entire
  reason Ken cannot "just go and edit works".
- **27% of the Messages table is book content** — 1,245 of 4,687 rows, 5.5 MB.
- **Every read is `overrideAccess: true`**, because chapters borrow space-visibility RBAC
  and then have to defeat it.
- **`getWorkJson` reads all 1,189 Bible chapters to serve one page**, because `order` is a
  JSON key, not a column. The 9.65 MB → 205 KB fix on 260825 cured the WIRE; the database
  still reads the whole book per request. **This slice is what fixes that.**

### Shape

```ts
// src/collections/work-chapters/index.ts
slug: 'work-chapters'
fields:
  work         relationship → works, required, index
  order        number, required, index          // 0-BASED — matches metadata.order today
  slug         text, index                      // chapterSlug (documents) / page slug (books)
  title        text
  body         code, language: 'markdown'       // Monaco — a real editor for a chapter
  image        upload → media                   // book pages
  module       text                             // course grouping; see slice 2
  video        text                             // course lessons; see slice 2
  // document-work extras, currently in metadata
  tier, badge, badgeColor, date, description    text
  // scripture hierarchy, currently in metadata
  book, bookName, ref                           text
  chapter                                       number
  translations                                  json   // verse arrays STAY json
```

**Verses stay JSON on the chapter.** 1,189 chapters × 2 translations is right; 31,000
verse rows is not. A verse is not a document.

Access: `read` — public when the parent Work is published (mirror `Works.read`, which is
`() => true`); `create/update/delete` — platform admin or a `tenant_admin`/`tenant_manager`
of `works.owner`. The same rule `endpoints/work-content.ts` already implements — lift it
into a shared helper rather than writing it twice.

### ⚠️ Gotchas, in the order they will bite

1. **`payload_locked_documents_rels` needs `work_chapters_id`.** A new collection without
   it takes the WHOLE admin down — every save, media uploads included. Put the `ALTER
   TABLE` in the migration; run `GET /api/provision-ops/db-repair-locks?key=$CRON_SECRET`
   after deploy as belt and braces. [[project_locked_documents_rels_rule]]
2. **Do not hand-invent the array/table shape.** Copy it from a Payload-GENERATED table.
   `products_gallery` is the reference used on 260825: `_order` int NOT NULL, `_parent_id`
   int NOT NULL → parent `ON DELETE CASCADE`, varchar `id` PRIMARY KEY, `_order` and
   `_parent_id` indexes, **`_order` is 1-based**.
3. **`payload migrate:create` goes interactive** and diffs far wider than your change
   (it asks create-or-rename for columns that already exist). Hand-write the migration
   and **dry-run it against the live DB inside a rolled-back transaction** — that pattern
   is in the 260825 history and it caught nothing only because the SQL was right.
4. **The Handbook is duplicated** — 7 chapters in space 6 AND 7 in space 30, identical.
   `storage_ref` points at space 6. **Backfill by joining on `storage_ref`**, which drops
   the orphan copy for free. Do not backfill by channel name alone or you get 14 chapters.
5. Works has **no drafts**, so there is no `_works_v` twin. Decide whether `work-chapters`
   gets `versions: { drafts: true }` — recommended yes, it is what an editor wants — and
   remember that adds `_work_chapters_v*` tables to the migration.

### Backfill

```sql
INSERT INTO work_chapters (work_id, "order", slug, title, body, ...)
SELECT w.id,
       (m.metadata->>'order')::int,
       COALESCE(m.metadata->>'chapterSlug', m.metadata->>'slug'),
       m.metadata->>'title',
       COALESCE(m.content->>'text', ''),
       ...
FROM messages m
JOIN works w
  ON  w.storage_ref->>'channel' = m.channel
  AND (w.storage_ref->>'space')::int = m.space_id
WHERE m.metadata->>'kind' = 'work_chapter';
```

Expect **1,238** rows (1,245 minus the 7 orphaned Handbook chapters). Verify by
re-querying, never by trusting the return value.

### Rewrite

`getWorkJson` is the single reader — **7 files import it** and none of them should
change. Point it at `work-chapters` with `where: { work: { equals: id } }, sort: 'order'`
and the reader contract is preserved. Then the three write paths in `endpoints/works.ts`
(import, pull, and the doc branch around lines 369 / 415 / 539).

**Do not delete the message rows.** Leave them for a week; `storageRef.kind` becomes
`'rows'` and the old value is the rollback.

### The prize

Once `order` is a column, `/api/works-ops/text` becomes a real windowed query and the
per-request 5.5 MB database read dies. That is the second half of the 9.65 MB fix.

---

## Slice 2 — fold `works.content`

`works.content` (jsonb, added 260825) holds a course as
`{ modules: [{ title, lessons: [{ title, video?, body? }] }] }`. It exists **only**
because chapters had no editable home. Once slice 1 lands, a lesson is a chapter with a
video, and it should live where every other chapter lives.

- Lesson → a `work-chapters` row, `order` sequential across the whole course.
- Module → the `module` text field on that row. Flat storage, two-level rail. No nesting,
  no second table.
- `CourseStudio` keeps its SPA reorder/upload UX and writes chapters instead of one JSON blob.
- Then drop the `content` column.

**All six works have `content = null` — there are zero courses to migrate. This is free
today and it stops being free the day someone builds one.**

---

## Slice 3 — buying / signing up for a training

### The decision: entitlement is DERIVED, never stored

There is no `enrollments` collection. An enrolment row would be a **cache of a question
we can already answer**, and caches drift. The one thing it would add — "when did you
enrol" — the first `workProgress` write already tells us.

`resolveTrainingAccess(payload, user, work)` → `{ allowed, reason, product? }`:

1. `work.access === 'public'` and no product bound → **allowed**
2. platform admin, or a manager of `works.owner` → **allowed**
3. membership standing satisfies `work.access` → **allowed** — reuse `isPageViewable`
   from `utilities/pageAccess.ts`, do not write a second standing check
4. a **paid order** containing `work.product` → **allowed**
5. otherwise → **not allowed**, return the product so the caller can offer checkout

That is the three ways in Ken asked for: **bought**, **included with a membership**, and
**free (just sign in)** — one resolver, no new storage.

### New fields on `works`

```ts
access   select: public | authenticated | members | good_standing | purchase
         // same vocabulary as PAGE_ACCESS_OPTIONS + one, so nobody learns two systems
product  relationship → products      // what unlocks it when access === 'purchase'
```

### The order query, confirmed against the live schema

`orders.customer_id`, `orders.status = 'paid'`, `orders_items.product_id`. In Payload:

```ts
payload.find({ collection: 'orders', limit: 1, depth: 0, overrideAccess: true,
  where: { and: [
    { customer: { equals: user.id } },
    { status: { equals: 'paid' } },
    { 'items.product': { equals: productId } },
  ] } })
```

⚠️ **Nothing in the codebase reads Orders for access today** — this is the first such
check. Products/Orders exist for goods; the membership rail (checkout → webhook →
`Memberships` → `getMemberStanding` → page gating) is complete and separate. Do not
confuse the two: `Memberships` is the recurring-dues collection, `tenant-memberships` is
who administers a portal.

### The surface

`<CoursePlayer>` calls the resolver server-side and renders either the course or a buy
panel (price, what's included, checkout button). Today it renders the course to anyone
who can load the page and relies entirely on whoever placed the block having gated the
page correctly. That is the actual hole.

---

## Slice 4 — badges, and a profile to put them on

### Badges: no collection

- **Definition** — a `badge` group on `works`: `{ name, image (upload), criteria (text) }`.
  One badge per Work — "finished this" — covers 99%. The Work already IS the thing you
  earn it for.
- **Award** — a `badges` array on `users`: `{ work (slug), name, image (url), awardedAt,
  score }`. Append-only; **check before insert so nobody earns the same badge twice**.
  Rides along with `/api/users/me`, exactly like `readState`.
- **Awarded when** `workProgress` percent hits 100 for a Work that has a badge. Progress
  already exists and every course ends at 100 — award there rather than inventing a
  completion event. Carry the last quiz score onto the badge if there was one.
- **Evidence** stays as the quiz-attempt Messages already landing in the learner's LEO DM.

⚠️ **`users.badges` must be added to `APPROVED_PUBLIC` in
`tests/unit/access/usersFieldExposure.test.ts`** — deliberately. Payload gives you a
blacklist, not a whitelist, so that test fails until someone approves the field. A badge
is *meant* to be seen; that is the point of it. Say so in the diff.

### Profiles: the one decision that is Ken's

There is **no public profile today** — only `/dashboard/account`. `Users.read` is a
signed-in directory (260824), with everything sensitive gated field-by-field.

Plan:

```ts
handle             text, unique, index     // the /u/<handle> address; derived from name, editable
bio                textarea                 // public
profileVisibility  select: private | members | public   // DEFAULT 'members'
```

Route `/u/[handle]` — name, avatar (`avatarUrl` already encodes the Gravatar fallback),
bio, badges, optionally works in progress. The route honours `profileVisibility`:
`private` → 404 to everyone but the owner, `members` → signed-in only, `public` → anyone.

> **🔶 Ken decides:** `public` makes a profile world-readable, which extends the 260824
> call (directory = signed-in only). **Recommendation: default `members`, opt in to
> `public`.** Nobody should become world-visible because of a deploy. Ship with the
> default and let people choose.

⚠️ `handle` backfill across 100+ existing users needs collision suffixing — the same
shape as `guardianSlug.ts` already does for portal slugs. Reuse it.

---

## Shipped 260825, do not re-derive

- **Quiz segment** — a ```quiz markdown fence carrying
  `{ question, options[], answerIndex, explanation? }`. Renders in the reader, in a course
  lesson, and via `<WorkQuiz work chapter>`. An attempt is a Message in the learner's LEO
  DM. `8556db0`
- **Course player + studio** — `works.type: 'course'`, `works.content` jsonb, progress on
  the existing `workProgress` map. `7d7939e`
- **Portal quota** — a map in `portalPlan.ts` (free 1, site 3, business 10, demo 100),
  enforced only in `provisionPortal`, skipped when the slug already exists. `502d598`
- **The 9.65 MB reader page → 205 KB** — windowed text + `/api/works-ops/text`. `47fc3f9`
- **The Works catalog is editable** — `tags`/`links` are arrays, `canonical` is a group,
  plumbing collapsed. `ensure-works-table` deleted (predated migrations-on-boot). `47fc3f9`
- **Training series outline** — `C:\Dev\angels-os-training\TRAINING_OUTLINE.md`, 12
  episodes with click paths; EP01 scripted. **EP10–EP12 are blocked on this handoff's
  work** and say so in the file.

## Ground rules

LIVE = Railway. `railway up -s Core --detach`, poll with an until-loop on
`railway deployment list -s Core | sed -n 2p` — match only the TOP row. Live DB via
`railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`, used with `pg` from the
repo's `node_modules` (no `psql` on this box, and `/tmp` paths do not resolve for `node`
— copy to the repo dir and delete after).

Gate = `pnpm test:unit`. **6,703 green** at handoff. The "9–11 errors" line is
pre-existing; judge by the FAILED count. `npx tsc --noEmit`, filter `^src/`.

New migration → register in `src/migrations/index.ts`, then
`UPDATE_MIGRATION_HASHES=1 npx vitest run tests/unit/migrations`.
⚠️ **NEVER edit an applied migration.** New column = new file.

⚠️ Verify the RESULT by re-querying, not the return value.
⚠️ Several repo files are CRLF — read with `newline=''`, normalise, write back the same.
⚠️ Bash heredocs choke on apostrophe-heavy TypeScript. Use the Write tool.

## Also open

- **The sitemap indexes pages/posts/products and nothing else** — no Works, no chapters,
  no events. 1,189 Bible chapters invisible to search. Once `work-chapters` exists this
  becomes a trivial query and a sitemap INDEX. Biggest SEO win available.
- **AI-generated quizzes** — a `generate_quiz` LEO tool reading a chapter and emitting a
  ```quiz fence. The format and renderer already ship; this is small and Ken asked for it.
- **Attribution has two sources** — `works.canonical` and a SettingService override bag
  written by LEO's `set_work_attribution`. Two answers to "who wrote this".
- The rest of the list at the foot of `docs/HANDOFF_260824_visitor_sessions.md` still
  stands — mentions first.
