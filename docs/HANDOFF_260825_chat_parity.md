# Handoff — 260825: making the chat somewhere people return to

Paste the block below into a fresh session.

---

Continuing Angel OS. Read `docs/GLOBAL_PUNCH_LIST.md` first — the living issue board, updated
260824. Memory files worth loading: `project_dm_visibility_and_naming`,
`project_events_as_a_place`, `project_membership_joins_the_room`, `project_wdeg_community`,
`project_presence_mmorpg`, `project_identity_profile_friends`.

**Ken is CEO, you are CIO.** Temporal-stamp replies `YYMMDD ~HHMM Name —` top and bottom.
Ponytail mode. No Angel OS jargon in customer-facing copy.

## The job

Make the messaging system something people come back to. The target is NOT full Discord parity —
Discord's surface is enormous and most of it is not why people return. **People return because
someone said their name and they found out.** Build that loop, in this order.

### 1. Read state — `lastReadAt` per (user, channel) ⭐ START HERE

Unread badges, "new since" divider, and the ability to **dismiss**. Nothing else on the list
matters without it: with no read state there is no reason to ever open the app, because nothing
can tell you there is something new.

**Nothing exists today.** `ChatChannel.unreadCount` is declared optional in
`src/components/ChatControl/types.ts` and is populated by nobody. There is no `lastReadAt` on any
collection. `/api/notifications/poll` is NOT this — it is Gotify mirroring, inbound alerts from an
external server onto the AI Bus.

Design notes, not orders:
- One row per (user, channel) is the whole of it. A new collection is the obvious shape; consider
  whether it can hang off something that already exists before adding one.
- ⚠️ **A NEW COLLECTION needs its `<slug>_id` column on `payload_locked_documents_rels`**, not just
  its own table. Payload builds the admin's doc-lock query from the LIVE config, so the moment the
  collection registers, EVERY admin save fails — media uploads included. Fix live with
  `GET /api/provision-ops/db-repair-locks?key=$CRON_SECRET`, and put the ALTER in the migration so
  fresh nodes never need it. This took the admin down on 260820.
- Writes will be frequent and low-value. Think about write amplification before you put an index on
  everything.

### 2. The names fix — **a decision is owed by Ken before building**

`Users.read` is `adminOrSelf` (`src/collections/Users/index.ts:38`). A non-admin can read exactly
one user row: their own. So every `depth: 1` author population returns a bare id for anybody else
and the UI renders **"Unknown"**. Ken is super_admin and never sees it; every real user sees an
anonymous portal. A chat where you cannot see who anyone is, is not a chat.

⚠️ **Do NOT simply widen `read`** — that row carries email, phone and roles.

Two options, and Ken picks:
- **(a) Field-level access** — a co-member resolves `id` / `name` / avatar and nothing else.
- **(b) Projection endpoints** — keep `read` tight and let peers resolve names through the
  endpoints that already run `overrideAccess` (`dm-roster`, `space-members`).

Ask him, with your own recommendation, before writing code.

### 3. Wire `dm-roster` — click a person, get a DM

`GET /api/messages-ops/dm-roster?tenantId=` builds "every portal member (plus LEO) appears under
Direct Messages whether or not a channel exists", carrying the deterministic slug and a
`hasChannel` flag; the channel is created lazily by `POST /api/dm/find-or-create`. It was committed
**2026-06-10** and **no client has ever called it**. That is why you can only DM someone you have
already DMed. `src/endpoints/dm-roster.ts`, `src/utilities/dmRoster.ts` — this is a client task.

### 4. Mentions + notifications, on top of (1)

The return-visit engine, harder than anything except DMs themselves. Mentions (`@user`) plus a
mention feed, then notification delivery.

**Do not build a second delivery system for chat.** The bus already delivers; it just cannot
remember what you have seen — which is why (1) comes first. A `notifications` collection earns its
place only for things that are NOT messages: an order shipped, a membership lapsed, an event
tomorrow. Row with a `read` flag and a deep link.

### 5. Then reactions, edit/delete own message, threads, search

Real parity items, but polish next to the above. Note `parentMessageId` already exists on Messages
(column `parent_message_id`), so replies are half-built at the data layer.

## What you are building on — shipped 260824, all live

Three DM bugs were fixed in one day. Do not re-derive them.

- **DMs are GLOBAL, never tenant-scoped.** `ChatProvider` fetched the DM list with
  `where[tenant][equals]`, so a thread started from one portal was invisible from another. The
  server had said this three ways already: `findOrCreateDM` looks up globally by slug, `channels`
  and `messages` set `useTenantAccess: false`, and `buildChannelReadFilter`'s DM branch is
  `{ type: 'dm', members: { in: [user.id] } }` with no tenant clause. Membership is the gate.
- **DM rows carry a SYMMETRIC name** ("A ↔ B") because one row serves both people. Never render it
  directly. `src/components/ChatControl/dmLabel.ts` names a thread after whoever isn't you; its
  last fallback splits the stored name, which is why labels survive the `Users.read` problem above.
- **No DM had EVER loaded its history.** `loadMessages` gates on the channel being resolved, but
  tested `channels` — which only holds the ACTIVE SPACE's channels, and a DM lives in the AI Bus.
  Extracted as `canQueryMessages` and tested. ⚠️ **Any code that validates a channel against
  `channels` will silently reject every DM.**

## Traps specific to this area

- **A DM's slug is never in the active space's channel list.** See above. This is the single
  easiest way to reintroduce a broken DM.
- **DMs live in the tenant's AI Bus space (`ai-bus`), not a DM space.** `DM_SPACE_SLUG` still exists
  and `ensureDMSpaceMembership` is a deliberate **no-op** — granting space membership there would
  expose the bus's system channels (errors, system-log) to every DM participant.
- **The URL records the visually-active space for a DM** (`/spaces/34/808` for a channel living in
  space 18). Deliberate: a DM is space-independent, `effectiveSpaceId` routes the query to the
  channel's own home, and rewriting the path would drag the reader into another portal's AI Bus.
- **`chat-send` IS already rate-limited** (`applyRateLimit(req, 'chat_send')`). Do not add a second
  one.
- **Bulk `payload.update({where})` on a RELATIONSHIP matches NOTHING silently** — find ids, then
  update by id. Bit `mergeDmChannelGroup` in prod once already.
- Messages carry BOTH `channel` (slug string) and `channelRef` (relationship). Anything that moves
  a message must rewrite **both**.

## Ground rules

**LIVE = Railway.** Deploy `railway up -s Core --detach`. Live DB via
`railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`, used with `pg` from the repo's
node_modules (no `psql` on this box; keep the script IN the repo dir so node resolves `pg`). Poll a
deploy with an `until` loop on `railway deployment list -s Core | sed -n 2p` — match only the TOP
row or you match an older SUCCESS and return instantly.

**Gate = `pnpm test:unit`** — 6,631 green at handoff. Three tests flake under load and pass on a
quieter run every time: `sprint19/vapiWebhook`, `sprint44b-endeavor-truncation`,
`sprint6-commerce`. Under heavy load more of the same family (anything that boots the Payload
config) will time out — re-run before believing it. `npx tsc --noEmit` is clean in `src/`;
`tests/` carries pre-existing errors, so filter with `grep -E "^src/"`.

⚠️ **Never edit an applied migration** — Payload keys on the NAME, so the edit never runs and the
config then selects a column prod lacks. New column = NEW FILE. Record with
`UPDATE_MIGRATION_HASHES=1 npx vitest run tests/unit/migrations`.

⚠️ **A new field is TABLES, not config.** Versioned collections need the `_v` twin; a new block
needs its block tables; a polymorphic relationship needs its `<target>_id` on the rels table. Miss
it and the admin renders BLANK with no error.

⚠️ **Round-trip a new field against the live DB BEFORE shipping the config.** On 260824 the Events
`layout` migration wrote `events_rels` with pages/posts/products by analogy with Pages, but
`src/fields/link.ts` is `relationTo: ['pages','posts','products','events']` — Payload builds its
SELECT from the live config, so the missing `events_id` made the WHOLE collection unreadable. Caught
only because the field was exercised against live first. Do the same here.

⚠️ **Bash heredocs choke on apostrophe-heavy TypeScript.** Use the Write tool for any file with
prose in it. Python heredocs for edits are fine — use RAW strings for anything with backslashes.

⚠️ **`payload.delete({where})` does not throw on a per-doc failure** — it resolves with an `errors`
array. Verify destructive results by RE-QUERYING.

⚠️ **The tenant cache is 120s in prod.** Do not debug what is only the TTL.

## Also open, if you finish the above

- **Delivery audit** — what happens to message delivery across a reconnect (gaps, or does poll
  backfill?), and dedupe/ordering under the poll-plus-stream double path. Neither has been looked
  at closely. (Rate limiting was the third question and is already answered — see above.)
- **A DM has no way to get to the person** — Ken wants a context menu giving the user's
  properties/profile. `project_identity_profile_friends` is the adjacent work.
- Ken is separately weighing **repurposing a locked-out ThinkPad (i5 / 8 GB / residential) as a
  Linux host** to take load off Railway. Discussion only; `docs/LOCAL_SELFHOST.md` and
  `C:\Dev\datacenter\stack\docker-compose.yml` are the existing, working design it would port.
  The advice on the table: build images elsewhere (8 GB will not survive `next build` with
  `--max-old-space-size=4096`), run it on ethernet not 2.4 GHz wireless, and stand it up as a
  SECOND node for two weeks before trusting it with 22 live portals.
