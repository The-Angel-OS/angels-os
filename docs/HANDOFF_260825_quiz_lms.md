# Handoff — 260825: Quiz segments, then the course player

Paste the block below as the opening message of the next session.

---

260825 ~HHMM Handoff from the previous session.

Continuing Angel OS. Read `docs/GLOBAL_PUNCH_LIST.md` first. Memory files worth
loading: `project_illustrated_primer_bible`, `project_works_canonical_syndication`,
`project_reader_reference_layer`, `project_membership_gating`,
`project_guardian_angel_monetization`, `project_video_upload`.

Ken is CEO, you are CIO. Temporal-stamp replies `YYMMDD ~HHMM Name —` top and
bottom. Ponytail mode. CTO mode — decide and act, don't ask on the obvious. No
Angel OS jargon in customer-facing copy.

## The premise, decided 260825 — do not re-litigate

**A course is a Work. A quiz is a segment. Neither is a new collection.**

Four of the five layers an LMS needs already exist and are in production:

| Concept | Angel OS equivalent | State |
|---|---|---|
| Course | `works` row, `type: 'course'` | one enum value to add |
| Chapter / Module | chapter in the Work JSON | exists |
| Lesson | segment: `text` \| `video` \| `quiz` | the thing being built |
| Progress | `src/utilities/workProgress.ts` | **exists, generic, untouched** — `{ [soulId]: { chapterIdx, segIdx, percent } }`, settings bag, zero schema, `/api/work-progress` |
| Purchase / enrollment | Products + Memberships + gating | shipped 260814 (Pages + Posts) |
| Video hosting | Media, R2 in Phase 2 | planned |
| **Authoring UX** | — | **the actual build** |

There must be NO `courses`, `modules`, `lessons`, or `enrollments` collections.
That is four collections and four migrations to re-model the Library, plus a
second progress tracker to keep in sync with the first one. If you find yourself
reaching for one, the answer is a field on `works` or a segment kind.

## Slice 1 — the quiz segment (do this first, ship it alone)

The smallest slice that proves the segment model, and useful on its own for Bible
study, WDEG, and church volunteer training before a single course exists.

1. **Segment schema.** A chapter segment gains `kind`. `quiz` carries
   `{ question, options[], answerIndex, explanation? }` — multiple choice only in
   v1. Skipped: free text, multi-select, question banks, randomisation, timers.
2. **Render inline in the reader.** The reader already walks segments, so a quiz
   segment renders where it sits. This is the primary surface.
3. **One page block: `<WorkQuiz work="..." chapter="...">`** — the same renderer,
   embeddable on a landing page or as a standalone assessment. `src/blocks/`,
   registered in `RenderBlocks.tsx`, and remember the importmap rule if any admin
   client component changes.
4. **Where attempts go — the split matters:**
   - *Resume state* (current question, saved answers) → the settings bag beside
     `work_progress`. Zero schema, established pattern.
   - *A submitted attempt* → **a Message in the learner's LEO DM**, score in
     `metadata`. No migration, the portal owner can see it, and LEO gets it for
     free: "you scored 4/10 on the safety module, want to go back over it?" That
     is the thing a bought LMS cannot do and it costs one `payload.create`.
     ⚠️ Thread `req`. ⚠️ Messages carry BOTH `channel` and `channelRef`.

Skipped deliberately: gradebook, certificates, pass/fail gating on the next
chapter. The attempt data is queryable when a real portal asks for them.

## Slice 2 — the course player and studio

Only after slice 1's segment renderer exists, because both blocks reuse it.

**The one real dependency, decided:** Works content is NOT in the database — Phase 1
shipped the catalog, chapters are still file-based souls, and an editor must write
chapters. Do **not** do Works-as-JSON Phase 2 first. Add **one `content: json`
column to `works`** and put the course JSON there. A course is tens of lessons —
kilobytes. One column, one migration, no new tables, and Phase 2 later absorbs it
by reading the same JSON.

⚠️ New column = NEW migration file, never an edit to an applied one. Round-trip
the field against the live DB BEFORE shipping the config, then run
`db-repair-locks`. Record hashes with
`UPDATE_MIGRATION_HASHES=1 npx vitest run tests/unit/migrations`.

Two page layout blocks, both SPA-style inside the block (Ken's call):

- **`<CoursePlayer work="...">`** — learner side. Video pane, lesson rail,
  progress bar off `workProgress`, quiz inline, LEO in the corner with the current
  lesson as context. Gate it with the existing membership gating; do not invent a
  second entitlement check.
- **`<CourseStudio work="...">`** — author side. Reorder lessons, upload video,
  write a quiz. This is the part that was genuinely good in the Code-with-Antonio
  NextLMS build (`C:\Data\Dev\Fullstack\LMS\NextLMS`) and the part we have no
  version of. Everything else in that repo is already covered here and better.

Video: reuse the `Video` block's upload/URL handling. Media → R2 is Phase 2 of the
video slice; do not block on it, and do not add Mux until bandwidth actually hurts.

## Slice 3 — portal quota by plan (independent, half a day)

Today any signed-in account can provision unlimited portals. Ken has 17.

- `portalQuota: number` on the Plan. **Free = 1**, config-free default.
- Enforce in **ONE** place: the provisioning entry point. `clone_portal`,
  `demo-site`, and the LEO create-portal tool all funnel through provisioning —
  guard there, not in three call sites.
- Count = active `tenant-memberships` where the user is owner/admin.
- `super_admin` bypasses. **Which is why Ken will never see it break — it needs a
  test, not a manual check.**
- Over quota → the `over_free` checkout path Guardian Angel monetization already
  designed. Reuse it. Do not invent a second upgrade flow.
- Free side effect worth taking: `src/components/AlreadyOnboardedBanner/index.tsx`
  becomes "17 of 20 portals" instead of an unlabelled wall of green buttons.

## Also open

- **LEO's replies in a visitor channel land with `author_id` null** —
  `resolveLeoUserId` misses when no `x-tenant-id` header is sent. Cosmetic (they
  still render as LEO) but it means the reply has no author in the portal owner's
  view. `src/endpoints/leo-chat.ts`.
- The rest of the "Also open" list at the foot of
  `docs/HANDOFF_260824_visitor_sessions.md` still stands — mentions first.

## Ground rules

**LIVE = Railway.** `railway up -s Core --detach`, poll with an until-loop on
`railway deployment list -s Core | sed -n 2p` — match only the TOP row. Live DB
via `railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`, used with `pg`
from the repo's `node_modules` (no psql on this box).

**Gate = `pnpm test:unit`.** 6,697 green at handoff. The "9–11 errors" line is
pre-existing; judge by the FAILED count. `npx tsc --noEmit`, filter `^src/`.

**⚠️ Verify the RESULT, not the return value — and on the SAME connection.** Both
bugs in the visitor slice were this: a hook writing through `getLocalPayload()`
cannot see the uncommitted row it was fired for (thread `req`), and a
verification query that does not thread `req` reads the pre-commit row and warns
about a delete that worked.

**⚠️ Several repo files are CRLF.** Anchor-string edits assuming `\n` miss
silently. Read with `newline=''`, normalise, write back the same way.

**⚠️ Python `(?ms)` makes `.` match newlines** — `.*` eats the rest of the file.

**⚠️ Bash heredocs choke on apostrophe-heavy TypeScript.** Use the Write tool.
