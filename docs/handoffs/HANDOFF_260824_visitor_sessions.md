# Handoff — 260824 evening

Paste the block below as the opening message of the next session.

---

260824 ~2300 Handoff from the previous session.

Continuing Angel OS. Read `docs/GLOBAL_PUNCH_LIST.md` first — the living issue
board. Memory files worth loading: `project_chat_read_state`,
`project_users_directory_read`, `project_dm_visibility_and_naming`,
`reference_angel_node_01_thinkpad`, `project_identity_profile_friends`.

Ken is CEO, you are CIO. Temporal-stamp replies `YYMMDD ~HHMM Name —` top and
bottom. Ponytail mode. CTO mode — decide and act, don't ask on the obvious. No
Angel OS jargon in customer-facing copy.

## The job: finish anonymous visitor sessions

**Half of it is already merged and live, and it is inert.** The server sets a
visitor cookie and will persist a conversation IF the client sends a transcript
— and no client sends one yet. So the brochure-site chat behaves exactly as it
did. Nothing is broken; nothing is finished.

### Why this matters more than it looks

`GuestChatBubble` held the conversation in React state and nothing else. Three
consequences, and the third is the real one:

1. Refresh killed it.
2. Nobody at the portal ever saw it — your most engaged visitors were invisible
   and you could not know what people asked your own site.
3. **LEO could not remember the previous sentence.** Its context comes from
   READING the Messages table, and guest turns were never persisted, so every
   message was message one. "Do you rent the hall on weekends?" → good answer.
   "How much?" → non-sequitur.

Persistence and memory are the same fix. That is why this is worth doing
properly rather than patching context client-side.

### Ken's policy calls, 260824 — decided, do not re-litigate

- **Identity: a server-set httpOnly cookie.** Not localStorage — a page script
  cannot read it, and it is first-party on the portal's own domain.
- **No channel until the SECOND message.** Most first messages are a bounce or
  a test. Ken accepted that a one-message conversation stays invisible.
- **Unclaimed visitor channels expire at 30 days.**
- **Disclosure, verbatim:** "LEO may share this conversation with the site
  owner." Already in `src/constants/visitorDisclosure.ts`.

### What is DONE (merged, deployed, type-clean, UNTESTED and UNVERIFIED)

- `src/utilities/visitorSession.ts` — cookie name/header/reader, `newVisitorId`,
  `visitorChannelSlug`, `sanitizeBackfill` (bounded transcript replay).
- `src/constants/visitorDisclosure.ts` — Ken's line.
- `src/utilities/visitorChannels.ts` — `ensureVisitorChannel`,
  `persistVisitorMessage`, `backfillVisitorTurns`, `claimVisitorChannel`,
  `sweepExpiredVisitorChannels`.
- `src/endpoints/leo-chat.ts` — mints/reads the cookie, creates the channel on
  message two, backfills turn one from the replayed transcript, persists both
  sides, points `leoProcessMessage` at the visitor's own channel (which is what
  restores LEO's memory), returns `visitorChannelSlug`, sets `Set-Cookie`.
  Also extracted `resolveLeoUserId` — two callers now.

### What is LEFT

1. **The widget.** `GuestChatBubble` in
   `src/components/ChatControl/FloatingBubble.tsx` must POST `history` (its own
   prior turns) alongside `message`, and render `VISITOR_DISCLOSURE` above the
   input. Without the history the channel is never created and nothing else in
   this feature happens — this is the keystone, not a polish step.
2. **Claim on sign-up.** `claimVisitorChannel` is written and called by NOBODY.
   Wire it into registration/login: read the cookie, find the user's LEO DM
   (`findOrCreateDM` in `utilities/dmChannels.ts`), move the thread. The whole
   pre-signup conversation should land in their LEO DM so they never lose the
   thing that made them sign up.
3. **The TTL sweep.** `sweepExpiredVisitorChannels` is written and scheduled by
   nobody. crond is RETIRED — this is a Payload job (`autoRun` is the gate,
   `JOBS_AUTORUN=true` is Railway-only). See `project_scheduled_work_payload_jobs`.
4. **Tests.** None exist for any of the above. `sanitizeBackfill` bounds and
   `claimVisitorChannel`'s both-fields rewrite are the load-bearing ones.
5. **Verify live.** Nothing here has been exercised against a real portal.

### Traps specific to this area

- **A visitor channel is NOT a DM.** A DM's access check is
  `{ type: 'dm', members: { in: [user.id] } }` and a visitor has no user row, so
  a DM-shaped channel would be readable by nobody at all — the opposite of "the
  portal owner should see their leads". It is an ordinary `type: 'general'`
  channel in the tenant's AI Bus space. `'sales'`/`'support'` were rejected on
  purpose: they pull the channel into agent routing rules nobody configured for
  anonymous traffic.
- **Messages carry BOTH `channel` (slug string) and `channelRef` (relationship).**
  Anything that moves a message must rewrite both. `claimVisitorChannel` does.
- **Bulk `payload.update({ where })` on a RELATIONSHIP matches NOTHING silently**
  — find ids, then update by id. Bit `mergeDmChannelGroup` in production once.
- **`payload.delete` does not throw on a per-doc failure** — it resolves with an
  `errors` array. Verify destructive results by RE-QUERYING.
- **The backfill is visitor-supplied text.** It lands in the visitor's own
  channel and their own LEO context — the same place their next message goes
  anyway, so it grants nothing new — but it is bounded (20 turns, 4000 chars)
  and must stay bounded.

## Shipped today, do not re-derive

- **Users.read is a directory now.** Widened from `adminOrSelf` to
  `signedInDirectoryRead` so chat shows NAMES; every non-admin used to see
  "Unknown" for everyone. Payload decides ROW visibility before FIELD
  visibility, so field-level access alone could not fix it. All protection is
  field-level (`adminOrSelfFieldAccess`) and `usersFieldExposure.test.ts`
  requires every Users field to be approved-public or gated — Payload gives you
  a blacklist, not a whitelist. Uploadable `avatar` + stored `gravatar_hash`.
  Verified live with a throwaway non-admin.
- **Read state.** `users.readState` `{ channelSlug: isoTimestamp }`,
  `POST /api/chat/mark-read` + `GET /api/chat/unread`. Merge is MONOTONIC
  (`max`, server-side) — that is what makes read-modify-write safe with no lock.
  Counts everywhere capped at 99+, badges on every channel/DM row, "New"
  divider via `firstUnreadId`. ⚠️ **The client must mark the NEWEST MESSAGE
  SEEN, not `now`** — `now` always moves forward, so the server's no-op check
  can never fire and every heartbeat writes a row. Caught by live probing; the
  unit test passed throughout because it fed a fixed timestamp.
- **LiveKit.** Device pickers existed in one of three copy-pasted room bodies
  and were covered by a `height: 100%` grid; self-view was mirrored (wrong for
  DroidCam); the palette was LiveKit's, not the portal's. One `RoomBody` now,
  flex column, Mirror toggle, `--lk-*` mapped to our tokens.
- **`angel-node-01`** — the T440s is a working Ubuntu 26.04 + KDE Plasma node
  and ops workstation. `ssh -i ~/.ssh/angel_node angel@192.168.0.170`, console
  password `angel`. Build kit in `docs/selfhost/thinkpad/`. See
  `reference_angel_node_01_thinkpad` for the scars.

## Ground rules

**LIVE = Railway.** Deploy `railway up -s Core --detach`. Poll with an until-loop
on `railway deployment list -s Core | sed -n 2p` — match only the TOP row.
Live DB via `railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`, used
with `pg` from the repo's `node_modules` (no psql on this box; keep the script
IN the repo dir so node resolves `pg`).

**Gate = `pnpm test:unit`** — 6,678 green at handoff. Three files flake under
load and pass on a quieter run every time: `sprint19/vapiWebhook`,
`sprint44b-endeavor-truncation`, `sprint6-commerce`. The "9–11 errors" line is
pre-existing (verified on a stashed clean tree) — judge by the FAILED count.
`npx tsc --noEmit` clean in `src/`; filter with `grep -E "^src/"`.

**⚠️ Never edit an applied migration.** New column = NEW FILE. Record with
`UPDATE_MIGRATION_HASHES=1 npx vitest run tests/unit/migrations`.

**⚠️ Round-trip a new field against the live DB BEFORE shipping the config.**
Payload builds its SELECT from the live config; a column prod lacks makes the
whole collection unreadable.

**⚠️ Verify the RESULT, not the return value.** Three times in one session:
robocopy returned ≥8 after a perfect copy, `crontab -l` exited non-zero and
killed a `set -e` pipeline silently, and `payload.delete` resolves with an
`errors` array rather than throwing.

**⚠️ Python `(?ms)` makes `.` match newlines** — `.*` then eats the rest of the
file. Use `(?m)`. Destroyed a source file twice today.

**⚠️ Several repo files are CRLF.** Anchor-string edits that assume `\n` will
miss. Read with `newline=''`, detect, normalise, write back the same way.

**⚠️ PowerShell 5.1 reads UTF-8-without-BOM as Windows-1252** — an em dash
becomes three chars ending in `"` and every later string breaks. Keep `.ps1`
files pure ASCII.

**⚠️ Bash heredocs choke on apostrophe-heavy TypeScript.** Use the Write tool
for anything with prose in it.

## Also open, after the visitor slice

1. **Mentions** — `@user`, a mention feed, the count badge. The actual
   return-visit engine; unblocked by read state.
2. **Delivery audit** — reconnect gaps and poll/stream dedupe. Deliberately
   AFTER mentions, because mentions are the first feature where a dropped
   message is a personal failure rather than a cosmetic one.
3. **Wire `dm-roster`** — `GET /api/messages-ops/dm-roster` was committed
   2026-06-10 and no client has ever called it. That is why you can only DM
   someone you have already DMed. Client-side task, half a day, high payoff.
4. **A context menu on a DM** → the person's profile. Ken asked; this morning's
   names fix is what makes it possible. `project_identity_profile_friends`.
5. **Notifications for things that are NOT messages** — order shipped,
   membership lapsed, event tomorrow. Row with a read flag and a deep link.
   ⚠️ Do NOT build a second delivery system for chat.
6. Reactions, threads (`parentMessage` exists), search, pinned messages, typing
   indicators (Presence is already there and already polled), per-channel mute.
7. **Node loose ends** — DHCP reservation for `192.168.0.170`; compose
   `build:` → `image:` (that box must never run `next build`); restore a dump;
   Cloudflare Tunnel; two weeks as a SECOND node before it carries anything.
   Ken never answered whether he wants autologin on it.
